
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { TILE_SIZE, PLAYER_SPEED, ENEMY_SPEED_BASE, MAZE_STYLE, PROJECTILE_SPEED } from '../constants';
import { CameraMode } from '../types';

interface GameViewProps {
  levelData: any;
  onCorrect: () => void;
  onIncorrect: () => void;
  onEnemyHit: () => void;
  onAmmoChange?: (ammo: number) => void;
  cameraMode?: CameraMode;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  id: string;
}

interface Explosion {
  x: number;
  y: number;
  life: number; 
  id: string;
}

const GameView: React.FC<GameViewProps> = ({ levelData, onCorrect, onIncorrect, onEnemyHit, onAmmoChange, cameraMode = CameraMode.CHASE }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Game state refs
  const playerRef = useRef({ 
    x: 0, y: 0, width: 44, height: 44, dir: 'up', animFrame: 0, 
    isShielded: false, shieldTime: 0, ammo: 0, isDead: false,
    respawnGrace: 0,
    currentAngle: 0,
    moveIntensity: 0,
    vx: 0, vy: 0 
  });
  
  // PERSISTENT MOVEMENT REF: Stores the last active direction vector
  const currentMoveVec = useRef({ x: 0, y: 0 });

  const cameraRef = useRef({ x: 0, y: 0 });
  const enemiesRef = useRef<any[]>([]);
  const powerUpsRef = useRef<any[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const keysPressed = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(performance.now());
  const canCheckAnswerRef = useRef(true);
  
  const [screenShake, setScreenShake] = useState(0);
  const [isGlitching, setIsGlitching] = useState(false);
  const [showSafeMsg, setShowSafeMsg] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const getDynamicZoom = () => {
    if (cameraMode === CameraMode.FIELD) {
      const worldW = levelData.maze[0].length * TILE_SIZE;
      const worldH = levelData.maze.length * TILE_SIZE;
      const scaleX = (dimensions.width * 0.96) / worldW;
      const scaleY = (dimensions.height * 0.82) / worldH;
      return Math.min(scaleX, scaleY);
    }
    if (cameraMode === CameraMode.MOBILE) return 0.65;
    if (dimensions.width < 1024) return 0.75;
    return 1.0; 
  };

  const zoom = getDynamicZoom();

  const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;

  const lerpAngle = (current: number, target: number, step: number) => {
    let diff = target - current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return current + diff * step;
  };

  const getMazeValue = (tx: number, ty: number) => {
    const maze = levelData.maze;
    if (ty < 0 || ty >= maze.length || tx < 0 || tx >= maze[0].length) return 1;
    return maze[ty][tx];
  };

  const isWall = (wx: number, wy: number) => {
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    return getMazeValue(tx, ty) === 1;
  };

  const initLevel = useCallback(() => {
    const startX = levelData.startPos.x * TILE_SIZE + (TILE_SIZE - 44) / 2;
    const startY = levelData.startPos.y * TILE_SIZE + (TILE_SIZE - 44) / 2;
    
    playerRef.current.x = startX;
    playerRef.current.y = startY;
    playerRef.current.vx = 0;
    playerRef.current.vy = 0;
    playerRef.current.isShielded = false;
    playerRef.current.shieldTime = 0;
    playerRef.current.isDead = false;
    playerRef.current.ammo = 0; 
    playerRef.current.respawnGrace = 3.0; 
    playerRef.current.currentAngle = 0;
    playerRef.current.moveIntensity = 0;

    // Reset Persistent Movement on level start
    currentMoveVec.current = { x: 0, y: 0 };
    
    setShowSafeMsg(true);
    setTimeout(() => setShowSafeMsg(false), 2000);
    
    cameraRef.current.x = startX + 22;
    cameraRef.current.y = startY + 22;

    enemiesRef.current = levelData.enemies.map((e: any, i: number) => {
      let tx = e.x;
      let ty = e.y;
      if (getMazeValue(tx, ty) === 1) {
        const neighbors = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,-1]];
        for (const [nx, ny] of neighbors) {
          if (getMazeValue(tx + nx, ty + ny) !== 1) { tx += nx; ty += ny; break; }
        }
      }
      return {
        ...e,
        x: tx * TILE_SIZE + 32,
        y: ty * TILE_SIZE + 32,
        vx: 0, vy: 0,
        id: `enemy-${i}`,
        frame: Math.random() * 10,
        rotation: Math.random() * Math.PI * 2,
        isDestroyed: false,
        respawnTimer: 0,
        isDormant: Math.hypot((tx * TILE_SIZE + 32) - (startX + 22), (ty * TILE_SIZE + 32) - (startY + 22)) < TILE_SIZE * 4,
        stuckFrames: 0 
      };
    });

    const getSafePos = (tx: number, ty: number) => {
      if (getMazeValue(tx, ty) !== 1) return { x: tx * TILE_SIZE + 32, y: ty * TILE_SIZE + 32 };
      const spiral = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
      for (const [dx, dy] of spiral) {
        if (getMazeValue(tx + dx, ty + dy) !== 1) return { x: (tx + dx) * TILE_SIZE + 32, y: (ty + dy) * TILE_SIZE + 32 };
      }
      return { x: tx * TILE_SIZE + 32, y: ty * TILE_SIZE + 32 };
    };

    powerUpsRef.current = [
      { ...getSafePos(3, 3), type: 'shield' },
      { ...getSafePos(11, 7), type: 'shield' },
      { ...getSafePos(1, 5), type: 'weapon' },
      { ...getSafePos(13, 5), type: 'weapon' }
    ];
    
    projectilesRef.current = [];
    explosionsRef.current = [];
    if (onAmmoChange) onAmmoChange(0);
  }, [levelData, onAmmoChange]);

  useEffect(() => { initLevel(); }, [initLevel]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const checkCollision = (nx: number, ny: number, size: number = 44, padding: number = 12) => {
    const points = [
      { x: nx + padding, y: ny + padding },
      { x: nx + size - padding, y: ny + padding },
      { x: nx + padding, y: ny + size - padding },
      { x: nx + size - padding, y: ny + size - padding }
    ];
    for (const p of points) { if (isWall(p.x, p.y)) return true; }
    return false;
  };

  const createExplosion = (x: number, y: number) => {
    explosionsRef.current.push({ x, y, life: 1.0, id: `exp-${Date.now()}-${Math.random()}` });
  };

  const handleDeath = () => {
    if (playerRef.current.isDead || playerRef.current.respawnGrace > 0) return;
    playerRef.current.isDead = true;
    setScreenShake(15);
    setIsGlitching(true);
    onEnemyHit();
    setTimeout(() => { initLevel(); setIsGlitching(false); setScreenShake(0); }, 1200);
  };

  const fireProjectile = () => {
    if (playerRef.current.ammo <= 0 || playerRef.current.isDead) return;
    let vx = 0, vy = 0;
    const dir = playerRef.current.dir;
    if (dir === 'up') vy = -PROJECTILE_SPEED;
    else if (dir === 'down') vy = PROJECTILE_SPEED;
    else if (dir === 'left') vx = -PROJECTILE_SPEED;
    else if (dir === 'right') vx = PROJECTILE_SPEED;
    projectilesRef.current.push({ x: playerRef.current.x + 22, y: playerRef.current.y + 22, vx, vy, id: `p-${Date.now()}` });
    playerRef.current.ammo--;
    if (onAmmoChange) onAmmoChange(playerRef.current.ammo);
  };

  const update = useCallback(() => {
    const now = performance.now();
    const dt = (now - lastUpdateRef.current) / 1000;
    lastUpdateRef.current = now;

    if (screenShake > 0) setScreenShake(s => Math.max(0, s - 0.5));

    const p = playerRef.current;
    if (!p.isDead) {
      // Use persistent movement vector instead of raw keys state
      let inputX = currentMoveVec.current.x;
      let inputY = currentMoveVec.current.y;

      if (inputX !== 0 || inputY !== 0) {
        const mag = Math.hypot(inputX, inputY);
        const dx = (inputX / mag) * PLAYER_SPEED;
        const dy = (inputY / mag) * PLAYER_SPEED;
        p.vx = dx; p.vy = dy;
        
        // Sliding logic: if blocked in one axis, allow movement in the other
        let moved = false;
        if (!checkCollision(p.x + dx, p.y)) { p.x += dx; moved = true; }
        if (!checkCollision(p.x, p.y + dy)) { p.y += dy; moved = true; }
        
        if (moved) {
          if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
          else p.dir = dy > 0 ? 'down' : 'up';
          const targetAngle = Math.atan2(dy, dx) + Math.PI / 2;
          p.currentAngle = lerpAngle(p.currentAngle, targetAngle, 0.15);
          p.moveIntensity = Math.min(p.moveIntensity + 0.1, 1);
        } else {
          // If totally blocked, stop animation intensity
          p.moveIntensity = Math.max(p.moveIntensity - 0.1, 0);
        }
      } else {
        p.vx = 0; p.vy = 0;
        p.moveIntensity = Math.max(p.moveIntensity - 0.1, 0);
      }

      p.animFrame += 0.25;
      if (p.respawnGrace > 0) p.respawnGrace -= dt;
      if (p.shieldTime > 0) {
        p.shieldTime -= dt;
        if (p.shieldTime <= 0) p.isShielded = false;
      }

      if (cameraMode === CameraMode.FIELD) {
        const worldW = levelData.maze[0].length * TILE_SIZE;
        const worldH = levelData.maze.length * TILE_SIZE;
        cameraRef.current.x = lerp(cameraRef.current.x, worldW / 2, 0.1);
        cameraRef.current.y = lerp(cameraRef.current.y, worldH / 2, 0.1);
      } else {
        cameraRef.current.x = lerp(cameraRef.current.x, p.x + 22, 0.1);
        cameraRef.current.y = lerp(cameraRef.current.y, p.y + 22, 0.1);
        const worldW = levelData.maze[0].length * TILE_SIZE;
        const worldH = levelData.maze.length * TILE_SIZE;
        const currentZoom = getDynamicZoom();
        const vW = (dimensions.width / 2) / currentZoom;
        const vH = (dimensions.height / 2) / currentZoom;
        if (worldW > vW * 2) cameraRef.current.x = Math.max(vW, Math.min(worldW - vW, cameraRef.current.x));
        else cameraRef.current.x = worldW / 2;
        if (worldH > vH * 2) cameraRef.current.y = Math.max(vH, Math.min(worldH - vH, cameraRef.current.y));
        else cameraRef.current.y = worldH / 2;
      }
    }

    const pCenterX = p.x + 22, pCenterY = p.y + 22;
    const pTx = Math.floor(pCenterX / TILE_SIZE), pTy = Math.floor(pCenterY / TILE_SIZE);
    const isOverCorrectZone = levelData.maze[pTy]?.[pTx] === 2 && 
      levelData.options.find((o: any) => o.pos.x === pTx && o.pos.y === pTy)?.isCorrect;

    projectilesRef.current = projectilesRef.current.filter(pj => {
      pj.x += pj.vx; pj.y += pj.vy;
      if (isWall(pj.x, pj.y)) return false;
      for (const e of enemiesRef.current) {
        if (e.isDestroyed) continue;
        if (Math.hypot(pj.x - e.x, pj.y - e.y) < 30) {
          e.isDestroyed = true; e.respawnTimer = 6;
          createExplosion(e.x, e.y); return false;
        }
      }
      return true;
    });

    explosionsRef.current = explosionsRef.current.filter(exp => (exp.life -= dt * 2.5) > 0);

    for (let i = 0; i < enemiesRef.current.length; i++) {
      const e = enemiesRef.current[i];
      if (e.isDestroyed) { if ((e.respawnTimer -= dt) <= 0) e.isDestroyed = false; continue; }
      if (!p.isDead) {
        e.frame += isOverCorrectZone ? 0.05 : 0.1; e.rotation += isOverCorrectZone ? 0.01 : 0.05;
        if (isOverCorrectZone) { e.vx *= 0.6; e.vy *= 0.6; } 
        else {
          const cTx = Math.floor(e.x / TILE_SIZE), cTy = Math.floor(e.y / TILE_SIZE);
          if (getMazeValue(cTx, cTy) === 1) {
            for (const [nx, ny] of [[0,1],[0,-1],[1,0],[-1,0]]) {
              if (getMazeValue(cTx + nx, cTy + ny) !== 1) { e.x += nx * 4; e.y += ny * 4; break; }
            }
          }
          const targetX = pCenterX, targetY = pCenterY;
          const dist = Math.hypot(targetX - e.x, targetY - e.y);
          if (dist > 1) {
            let baseS = ENEMY_SPEED_BASE * (0.8 + ((levelData.id || 1) * 0.05));
            if (e.isDormant || p.respawnGrace > 0) baseS *= 0.2; else e.isDormant = false;
            const desiredVx = ((targetX - e.x) / dist) * baseS;
            const desiredVy = ((targetY - e.y) / dist) * baseS;
            let sepX = 0, sepY = 0;
            for (const other of enemiesRef.current) {
              if (other === e || other.isDestroyed) continue;
              const d2 = Math.hypot(e.x - other.x, e.y - other.y);
              if (d2 < 50) { sepX += (e.x - other.x) / d2 * 1.5; sepY += (e.y - other.y) / d2 * 1.5; }
            }
            e.vx += (desiredVx + sepX - e.vx) * 0.08; e.vy += (desiredVy + sepY - e.vy) * 0.08;
          }
        }
        if (!checkCollision(e.x + e.vx - 14, e.y - 14, 28, 4)) e.x += e.vx; else e.vx *= -0.5;
        if (!checkCollision(e.x - 14, e.y + e.vy - 14, 28, 4)) e.y += e.vy; else e.vy *= -0.5;
        if (Math.hypot(pCenterX - e.x, pCenterY - e.y) < 34 && !p.isShielded && p.respawnGrace <= 0) handleDeath();
      }
    }

    if (!p.isDead) {
      powerUpsRef.current = powerUpsRef.current.filter(pu => {
        if (Math.hypot(pu.x - pCenterX, pu.y - pCenterY) < 40) {
          if (pu.type === 'shield') { p.isShielded = true; p.shieldTime = 6; }
          else { p.ammo = Math.min(p.ammo + 5, 10); if (onAmmoChange) onAmmoChange(p.ammo); }
          return false;
        }
        return true;
      });
      if (canCheckAnswerRef.current && levelData.maze[pTy]?.[pTx] === 2) {
        const opt = levelData.options.find((o: any) => o.pos.x === pTx && o.pos.y === pTy);
        if (opt) {
          canCheckAnswerRef.current = false;
          if (opt.isCorrect) onCorrect(); else onIncorrect();
          setTimeout(() => canCheckAnswerRef.current = true, 3500);
        }
      }
    }
    draw();
    rafRef.current = requestAnimationFrame(update);
  }, [levelData, onCorrect, onIncorrect, onEnemyHit, dimensions, onAmmoChange, initLevel, screenShake, zoom, cameraMode]);

  const drawWallBlock = (ctx: CanvasRenderingContext2D, sx: number, sy: number, tx: number, ty: number) => {
    const isW = (x: number, y: number) => getMazeValue(x, y) === 1;
    const down = isW(tx, ty + 1), right = isW(tx + 1, ty), up = isW(tx, ty - 1), left = isW(tx - 1, ty);
    ctx.fillStyle = MAZE_STYLE.wallBody;
    const depth = 8;
    if (!down) {
      ctx.beginPath(); ctx.moveTo(sx, sy + TILE_SIZE); ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE);
      ctx.lineTo(sx + TILE_SIZE - depth, sy + TILE_SIZE + depth); ctx.lineTo(sx + depth, sy + TILE_SIZE + depth);
      ctx.closePath(); ctx.fill();
    }
    if (!right) {
      ctx.beginPath(); ctx.moveTo(sx + TILE_SIZE, sy); ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE);
      ctx.lineTo(sx + TILE_SIZE + depth, sy + TILE_SIZE - depth); ctx.lineTo(sx + TILE_SIZE + depth, sy + depth);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = MAZE_STYLE.wallTop; ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = MAZE_STYLE.wallBorder; ctx.lineWidth = 2;
    if (!up) { ctx.beginPath(); ctx.moveTo(sx, sy+1); ctx.lineTo(sx + TILE_SIZE, sy+1); ctx.stroke(); }
    if (!down) { ctx.beginPath(); ctx.moveTo(sx, sy + TILE_SIZE-1); ctx.lineTo(sx + TILE_SIZE, sy + TILE_SIZE-1); ctx.stroke(); }
    if (!left) { ctx.beginPath(); ctx.moveTo(sx+1, sy); ctx.lineTo(sx+1, sy + TILE_SIZE); ctx.stroke(); }
    if (!right) { ctx.beginPath(); ctx.moveTo(sx + TILE_SIZE-1, sy); ctx.lineTo(sx + TILE_SIZE-1, sy + TILE_SIZE); ctx.stroke(); }
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const p = playerRef.current;
    if (p.isDead && Math.sin(performance.now() / 50) > 0) return;
    
    ctx.save();
    ctx.translate(p.x + 22, p.y + 22);
    ctx.rotate(p.currentAngle);
    
    const bank = p.moveIntensity * 0.15;
    ctx.scale(1 - bank, 1);

    const time = performance.now();
    const flicker = Math.sin(time / 40) * 4;
    const enginePower = (14 + flicker) * (0.6 + p.moveIntensity * 0.6);
    
    [-14, 14].forEach(offsetX => {
      const auraGrd = ctx.createRadialGradient(offsetX, 12, 0, offsetX, 12, enginePower * 2);
      auraGrd.addColorStop(0, 'rgba(0, 210, 255, 0.4)');
      auraGrd.addColorStop(1, 'rgba(0, 210, 255, 0)');
      ctx.fillStyle = auraGrd;
      ctx.beginPath();
      ctx.arc(offsetX, 12 + enginePower/2, enginePower, 0, Math.PI * 2);
      ctx.fill();

      const coreGrd = ctx.createLinearGradient(offsetX, 10, offsetX, 10 + enginePower * 1.8);
      coreGrd.addColorStop(0, '#ffffff');
      coreGrd.addColorStop(0.3, '#00f2ff');
      coreGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrd;
      ctx.beginPath();
      ctx.ellipse(offsetX, 12 + enginePower/2, 6, enginePower, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    if (p.moveIntensity > 0.1) {
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00d2ff';
      ctx.globalAlpha = 0.2 * p.moveIntensity;
      ctx.restore();
    }

    if (p.respawnGrace > 0) {
      ctx.save();
      const pulse = 0.2 + Math.sin(time / 80) * 0.15;
      ctx.fillStyle = `rgba(0, 242, 255, ${pulse})`;
      ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (p.isShielded) {
      ctx.save();
      const glow = 0.4 + Math.sin(time / 120) * 0.2;
      ctx.strokeStyle = `rgba(0, 242, 255, ${glow})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = '#1e272e';
    ctx.beginPath();
    ctx.moveTo(0, -20); ctx.lineTo(26, 14); ctx.lineTo(12, 18); ctx.lineTo(0, 12); ctx.lineTo(-12, 18); ctx.lineTo(-26, 14);
    ctx.closePath(); ctx.fill();

    const hullGrd = ctx.createLinearGradient(-15, 0, 15, 0);
    hullGrd.addColorStop(0, '#d1d8e0');
    hullGrd.addColorStop(0.5, '#ffffff');
    hullGrd.addColorStop(1, '#d1d8e0');
    ctx.fillStyle = hullGrd;
    ctx.beginPath();
    ctx.moveTo(0, -26); ctx.lineTo(18, 10); ctx.lineTo(0, 4); ctx.lineTo(-18, 10);
    ctx.closePath(); ctx.fill();

    const neonPulse = (Math.sin(time / 300) + 1) / 2;
    ctx.strokeStyle = `rgba(0, 242, 255, ${0.4 + neonPulse * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-18, 6); ctx.lineTo(-10, 0); ctx.moveTo(18, 6); ctx.lineTo(10, 0);
    ctx.stroke();

    const canopyGrd = ctx.createRadialGradient(0, -10, 1, 0, -10, 14);
    canopyGrd.addColorStop(0, '#74b9ff'); canopyGrd.addColorStop(0.7, '#0984e3'); canopyGrd.addColorStop(1, '#1e3799');
    ctx.fillStyle = canopyGrd;
    ctx.beginPath(); ctx.ellipse(0, -10, 7, 12, 0, 0, Math.PI * 2); ctx.fill();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath(); ctx.ellipse(-2, -14, 2, 4, -0.3, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, e: any) => {
    const time = performance.now();
    const isActive = !e.isDormant && !e.isDestroyed;
    const speed = Math.hypot(e.vx, e.vy);
    
    ctx.save();
    ctx.translate(e.x, e.y + Math.sin(e.frame) * 8);

    if (speed > 0.5 && isActive) {
      for (let i = 1; i <= 2; i++) {
        ctx.save();
        ctx.translate(-e.vx * i * 3, -e.vy * i * 3);
        ctx.globalAlpha = 0.3 / i;
        ctx.rotate(e.rotation);
        ctx.strokeStyle = '#ff4d4d';
        ctx.lineWidth = 2;
        ctx.strokeRect(-15, -15, 30, 30);
        ctx.restore();
      }
    }

    ctx.rotate(e.rotation);

    const shift = isActive ? Math.sin(time / 200) * 4 : 0;
    ctx.fillStyle = '#1e272e';
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(10 + shift, -18);
      ctx.lineTo(22 + shift, -10);
      ctx.lineTo(22 + shift, 10);
      ctx.lineTo(10 + shift, 18);
      ctx.closePath();
      ctx.fill();
      
      ctx.strokeStyle = isActive ? 'rgba(255, 77, 77, 0.4)' : 'rgba(100, 100, 100, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.rotate(time / 500);
    ctx.strokeStyle = isActive ? 'rgba(255, 77, 77, 0.2)' : 'rgba(50, 50, 50, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (isActive) {
      ctx.save();
      const engineFlicker = 5 + Math.random() * 5;
      const engineGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, engineFlicker * 2);
      engineGrd.addColorStop(0, '#ff4d4d');
      engineGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = engineGrd;
      ctx.beginPath();
      ctx.arc(0, 0, engineFlicker * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const eyePulse = (Math.sin(time / 150) + 1) / 2;
    const eyeGlow = isActive ? 15 + eyePulse * 15 : 5;
    
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = eyeGlow;
    ctx.shadowColor = '#ff4d4d';
    ctx.fillStyle = isActive ? '#ff4d4d' : '#4a0000';
    ctx.beginPath();
    ctx.arc(0, 0, 5 + eyePulse * 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(-3, -3, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { x: camX, y: camY } = cameraRef.current;
    const currentZoom = getDynamicZoom();
    ctx.save(); ctx.fillStyle = MAZE_STYLE.floor; ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    ctx.translate(dimensions.width / 2, dimensions.height / 2); ctx.scale(currentZoom, currentZoom);
    if (screenShake > 0) ctx.translate(Math.random()*screenShake - screenShake/2, Math.random()*screenShake - screenShake/2);
    ctx.translate(-camX, -camY);
    ctx.strokeStyle = MAZE_STYLE.floorGrid; ctx.lineWidth = 1;
    for(let i=-2; i<levelData.maze[0].length+2; i++) { ctx.beginPath(); ctx.moveTo(i*64, 0); ctx.lineTo(i*64, levelData.maze.length*64); ctx.stroke(); }
    for(let i=-2; i<levelData.maze.length+2; i++) { ctx.beginPath(); ctx.moveTo(0, i*64); ctx.lineTo(levelData.maze[0].length*64, i*64); ctx.stroke(); }
    const maze = levelData.maze;
    for (let r = 0; r < maze.length; r++) {
      for (let c = 0; c < maze[0].length; c++) {
        const sx = c * TILE_SIZE, sy = r * TILE_SIZE;
        if (maze[r][c] === 1) drawWallBlock(ctx, sx, sy, c, r); 
        else if (maze[r][c] === 2) {
          const pulse = (Math.sin(performance.now() / 400) + 1) / 2;
          ctx.fillStyle = `rgba(74, 144, 226, ${0.1 + pulse * 0.2})`; ctx.fillRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          ctx.strokeStyle = `rgba(0, 210, 255, ${0.5 + pulse * 0.5})`; ctx.lineWidth = 2; ctx.strokeRect(sx + 6, sy + 6, TILE_SIZE - 12, TILE_SIZE - 12);
          const opt = levelData.options.find((o: any) => o.pos.x === c && o.pos.y === r);
          if (opt) {
            const baseFontSize = 14;
            const adaptiveFontSize = Math.min(TILE_SIZE * 0.85, Math.max(baseFontSize, Math.floor(baseFontSize / currentZoom)));
            ctx.fillStyle = "white"; ctx.font = `bold ${adaptiveFontSize}px Orbitron`; ctx.textAlign = "center";
            ctx.shadowBlur = 10; ctx.shadowColor = "rgba(0, 210, 255, 0.8)";
            ctx.fillText(opt.text, sx + TILE_SIZE/2, sy + TILE_SIZE/2 + (adaptiveFontSize / 3)); ctx.shadowBlur = 0;
          }
        }
      }
    }
    for (const pu of powerUpsRef.current) {
      const color = pu.type === 'shield' ? '#00f2ff' : MAZE_STYLE.weaponPowerUp;
      ctx.save(); ctx.shadowBlur = 20; ctx.shadowColor = color; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(pu.x, pu.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    for (const pj of projectilesRef.current) { ctx.fillStyle = '#00f2ff'; ctx.beginPath(); ctx.arc(pj.x, pj.y, 4, 0, Math.PI * 2); ctx.fill(); }
    drawPlayer(ctx);
    for (const e of enemiesRef.current) { if (!e.isDestroyed) drawEnemy(ctx, e); }
    for (const exp of explosionsRef.current) {
        ctx.save(); ctx.translate(exp.x, exp.y); ctx.fillStyle = `rgba(255,159,67,${exp.life})`;
        ctx.beginPath(); ctx.arc(0,0,40*exp.life,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
    if (isGlitching) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.1)'; ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      ctx.fillStyle = 'white'; ctx.font = '900 40px Orbitron'; ctx.textAlign = 'center'; ctx.fillText('SYSTEM REBOOT...', dimensions.width/2, dimensions.height/2);
    }
    if (showSafeMsg && !isGlitching) {
      ctx.save(); ctx.fillStyle = '#00d2ff'; ctx.font = 'bold 24px Orbitron'; ctx.textAlign = 'center';
      ctx.fillText('SAFE MODE ACTIVE', dimensions.width/2, dimensions.height/2 + 100); ctx.restore();
    }
  };

  const handleMobileTouch = (key: string, start: boolean) => {
    // Only update movement vector on touch start to enable persistent movement
    if (!start) return;
    
    if (key === 'ArrowUp') currentMoveVec.current = { x: 0, y: -1 };
    else if (key === 'ArrowDown') currentMoveVec.current = { x: 0, y: 1 };
    else if (key === 'ArrowLeft') currentMoveVec.current = { x: -1, y: 0 };
    else if (key === 'ArrowRight') currentMoveVec.current = { x: 1, y: 0 };
  };

  const handleBombPress = () => {
    fireProjectile();
    if (navigator.vibrate) navigator.vibrate(50);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Directional keys set the persistent movement vector
      if (['ArrowUp', 'w'].includes(e.key)) currentMoveVec.current = { x: 0, y: -1 };
      else if (['ArrowDown', 's'].includes(e.key)) currentMoveVec.current = { x: 0, y: 1 };
      else if (['ArrowLeft', 'a'].includes(e.key)) currentMoveVec.current = { x: -1, y: 0 };
      else if (['ArrowRight', 'd'].includes(e.key)) currentMoveVec.current = { x: 1, y: 0 };
      
      if (e.code === 'Space') fireProjectile();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    rafRef.current = requestAnimationFrame(update);
    return () => { window.removeEventListener('keydown', handleKeyDown); cancelAnimationFrame(rafRef.current); };
  }, [update]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden bg-[#050510]">
      <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} className="w-full h-full block" />
      
      {/* Modern Transparent Mobile Controls (Battle Royale Style) */}
      {dimensions.width < 1024 && (
        <div className="absolute inset-0 z-30 pointer-events-none select-none">
          
          {/* Left Side: Transparent Circular D-Pad - Resized to Medium (w-36 h-36) */}
          <div className="absolute bottom-10 left-10 w-36 h-36 pointer-events-auto">
            <div className="relative w-full h-full flex items-center justify-center rounded-full border-2 border-white/20 bg-white/5 backdrop-blur-[1px] opacity-40 active:opacity-80 transition-all">
              {/* Central Tracking Plate */}
              <div className="absolute w-12 h-12 rounded-full border border-white/30 bg-white/10 shadow-inner z-0"></div>
              
              {/* Directional Buttons - Scaled to fit w-36 */}
              <button 
                className="absolute top-1 w-12 h-12 flex items-center justify-center active:scale-95 transition-transform"
                onTouchStart={() => handleMobileTouch('ArrowUp', true)}
              >
                <div className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center bg-white/5 active:bg-white/20"><span className="text-white text-base">▲</span></div>
              </button>
              
              <button 
                className="absolute bottom-1 w-12 h-12 flex items-center justify-center active:scale-95 transition-transform"
                onTouchStart={() => handleMobileTouch('ArrowDown', true)}
              >
                <div className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center bg-white/5 active:bg-white/20"><span className="text-white text-base">▼</span></div>
              </button>

              <button 
                className="absolute left-1 w-12 h-12 flex items-center justify-center active:scale-95 transition-transform"
                onTouchStart={() => handleMobileTouch('ArrowLeft', true)}
              >
                <div className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center bg-white/5 active:bg-white/20"><span className="text-white text-base">◀</span></div>
              </button>

              <button 
                className="absolute right-1 w-12 h-12 flex items-center justify-center active:scale-95 transition-transform"
                onTouchStart={() => handleMobileTouch('ArrowRight', true)}
              >
                <div className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center bg-white/5 active:bg-white/20"><span className="text-white text-base">▶</span></div>
              </button>
            </div>
          </div>

          {/* Right Side: Elegant Circular Bomb Button */}
          <div className="absolute bottom-12 right-12 pointer-events-auto">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[9px] font-black orbitron text-white/40 tracking-[0.2em] uppercase">Tactical Strike</span>
              <button 
                className="w-24 h-24 rounded-full border-2 border-white/40 bg-white/5 backdrop-blur-sm flex items-center justify-center text-4xl opacity-40 active:opacity-80 active:scale-90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                onTouchStart={handleBombPress}
              >
                <span className="drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">💣</span>
              </button>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
};

export default GameView;
