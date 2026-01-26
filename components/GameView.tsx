
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
  isTransitioning?: boolean;
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

const GameView: React.FC<GameViewProps> = ({ levelData, onCorrect, onIncorrect, onEnemyHit, onAmmoChange, cameraMode = CameraMode.CHASE, isTransitioning = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const playerRef = useRef({ 
    x: 0, y: 0, width: 44, height: 44, dir: 'up', animFrame: 0, 
    isShielded: false, shieldTime: 0, ammo: 0, isDead: false,
    respawnGrace: 0,
    currentAngle: 0,
    moveIntensity: 0,
    vx: 0, vy: 0 
  });
  
  const currentMoveVec = useRef({ x: 0, y: 0 });
  const cameraRef = useRef({ x: 0, y: 0 });
  const enemiesRef = useRef<any[]>([]);
  const powerUpsRef = useRef<any[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const rafRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(performance.now());
  const canCheckAnswerRef = useRef(true);
  
  const [screenShake, setScreenShake] = useState(0);
  const [isGlitching, setIsGlitching] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    console.log('Game Version 1.0.6 - Smart Cornering Restored');
  }, []);

  const getDynamicZoom = useCallback(() => {
    if (!dimensions.width || !dimensions.height) return 1.0;
    const worldW = levelData.maze[0].length * TILE_SIZE;
    const worldH = levelData.maze.length * TILE_SIZE;
    const scaleX = (dimensions.width * 0.95) / worldW;
    const scaleY = (dimensions.height * 0.85) / worldH;
    const baseFit = Math.min(scaleX, scaleY);
    if (cameraMode === CameraMode.FIELD) return baseFit;
    if (cameraMode === CameraMode.MOBILE) return Math.max(baseFit, 0.6);
    return dimensions.width < 1024 ? Math.max(baseFit, 0.7) : 1.0;
  }, [dimensions, levelData.maze, cameraMode]);

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
    playerRef.current.isDead = false;
    playerRef.current.respawnGrace = 3.0; 
    playerRef.current.currentAngle = 0;
    playerRef.current.moveIntensity = 0;
    playerRef.current.ammo = 0;
    if (onAmmoChange) onAmmoChange(0);
    currentMoveVec.current = { x: 0, y: 0 };
    cameraRef.current.x = startX + 22;
    cameraRef.current.y = startY + 22;

    enemiesRef.current = levelData.enemies.map((e: any, i: number) => ({
      ...e,
      x: e.x * TILE_SIZE + 32,
      y: e.y * TILE_SIZE + 32,
      vx: 0, vy: 0,
      id: `enemy-${i}`,
      frame: Math.random() * 10,
      rotation: Math.random() * Math.PI * 2,
      isDestroyed: false,
      respawnTimer: 0,
      isDormant: true,
      thinkTimer: 0 // For reaction delay
    }));

    powerUpsRef.current = [
      { x: 3 * TILE_SIZE + 32, y: 3 * TILE_SIZE + 32, type: 'shield', picked: false },
      { x: 11 * TILE_SIZE + 32, y: 7 * TILE_SIZE + 32, type: 'weapon', picked: false }
    ];
    projectilesRef.current = [];
    explosionsRef.current = [];
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

  const checkCollision = (nx: number, ny: number, size: number = 44, padding: number = 14) => {
    const points = [
      { x: nx + padding, y: ny + padding },
      { x: nx + size - padding, y: ny + padding },
      { x: nx + padding, y: ny + size - padding },
      { x: nx + size - padding, y: ny + size - padding }
    ];
    for (const p of points) { if (isWall(p.x, p.y)) return true; }
    return false;
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
    if (isTransitioning || playerRef.current.ammo <= 0 || playerRef.current.isDead) return;
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
    let dt = (now - lastUpdateRef.current) / 1000;
    if (dt > 0.1) dt = 0.016; 
    lastUpdateRef.current = now;

    if (isTransitioning) {
      draw();
      rafRef.current = requestAnimationFrame(update);
      return;
    }

    if (screenShake > 0) setScreenShake(s => Math.max(0, s - 0.5));

    const p = playerRef.current;
    if (!p.isDead) {
      const inputX = currentMoveVec.current.x;
      const inputY = currentMoveVec.current.y;
      
      if (inputX !== 0 || inputY !== 0) {
        const mag = Math.hypot(inputX, inputY);
        const speedX = (inputX / mag) * PLAYER_SPEED;
        const speedY = (inputY / mag) * PLAYER_SPEED;
        
        let dx = speedX * dt;
        let dy = speedY * dt;
        
        // --- Smart Cornering Logic ---
        // Helps nudge the player towards corridor centers if they are slightly misaligned
        const snapThreshold = 22; 
        const centerX = Math.floor(p.x / TILE_SIZE) * TILE_SIZE + (TILE_SIZE - 44) / 2;
        const centerY = Math.floor(p.y / TILE_SIZE) * TILE_SIZE + (TILE_SIZE - 44) / 2;

        if (inputX !== 0 && inputY === 0) { // Horizontal Request
           const offY = p.y - centerY;
           if (Math.abs(offY) < snapThreshold && checkCollision(p.x + dx, p.y)) {
              // If blocked horizontally, try to nudge toward vertical center to clear corner
              p.y = lerp(p.y, centerY, 15 * dt);
           }
        } else if (inputY !== 0 && inputX === 0) { // Vertical Request
           const offX = p.x - centerX;
           if (Math.abs(offX) < snapThreshold && checkCollision(p.x, p.y + dy)) {
              // If blocked vertically, try to nudge toward horizontal center
              p.x = lerp(p.x, centerX, 15 * dt);
           }
        }

        const canMoveX = !checkCollision(p.x + dx, p.y);
        const canMoveY = !checkCollision(p.x, p.y + dy);
        
        p.vx = speedX; p.vy = speedY;
        if (canMoveX) p.x += dx;
        if (canMoveY) p.y += dy;
        
        if (canMoveX || canMoveY) {
          if (Math.abs(speedX) > Math.abs(speedY)) p.dir = speedX > 0 ? 'right' : 'left';
          else p.dir = speedY > 0 ? 'down' : 'up';
          
          const targetAngle = Math.atan2(speedY, speedX) + Math.PI / 2;
          p.currentAngle = lerpAngle(p.currentAngle, targetAngle, Math.min(1.0, 20 * dt)); 
          p.moveIntensity = Math.min(p.moveIntensity + 10 * dt, 1);
        } else {
          p.moveIntensity = Math.max(p.moveIntensity - 10 * dt, 0);
        }
      } else {
        p.vx = 0; p.vy = 0;
        p.moveIntensity = Math.max(p.moveIntensity - 10 * dt, 0);
      }

      if (p.respawnGrace > 0) p.respawnGrace -= dt;
      if (p.shieldTime > 0) {
        p.shieldTime -= dt;
        if (p.shieldTime <= 0) p.isShielded = false;
      }
      cameraRef.current.x = lerp(cameraRef.current.x, p.x + 22, Math.min(1.0, 10 * dt));
      cameraRef.current.y = lerp(cameraRef.current.y, p.y + 22, Math.min(1.0, 10 * dt));
      
      const pCenterX = p.x + 22, pCenterY = p.y + 22;
      for (const pw of powerUpsRef.current) {
          if (pw.picked) continue;
          if (Math.hypot(pCenterX - pw.x, pCenterY - pw.y) < 30) {
              pw.picked = true;
              if (pw.type === 'shield') { p.isShielded = true; p.shieldTime = 8; }
              else if (pw.type === 'weapon') { p.ammo += 3; if (onAmmoChange) onAmmoChange(p.ammo); }
          }
      }
    }

    projectilesRef.current = projectilesRef.current.filter(pj => {
      pj.x += pj.vx * dt; pj.y += pj.vy * dt;
      if (isWall(pj.x, pj.y)) return false;
      for (const e of enemiesRef.current) {
        if (e.isDestroyed) continue;
        if (Math.hypot(pj.x - e.x, pj.y - e.y) < 40) {
          e.isDestroyed = true; e.respawnTimer = 6;
          explosionsRef.current.push({ x: e.x, y: e.y, life: 1.0, id: `exp-${Date.now()}` });
          return false;
        }
      }
      return true;
    });

    explosionsRef.current = explosionsRef.current.filter(exp => (exp.life -= dt * 2.5) > 0);

    const pCenterX = p.x + 22, pCenterY = p.y + 22;
    for (let i = 0; i < enemiesRef.current.length; i++) {
      const e = enemiesRef.current[i];
      if (e.isDestroyed) { if ((e.respawnTimer -= dt) <= 0) e.isDestroyed = false; continue; }
      
      const dist = Math.hypot(pCenterX - e.x, pCenterY - e.y);
      if (dist < 34 && !p.isShielded && p.respawnGrace <= 0) handleDeath();
      
      e.frame += 6 * dt; e.rotation += 3 * dt;
      
      if (e.thinkTimer > 0) {
        e.thinkTimer -= dt;
        continue; // Wait out the reaction delay
      }

      const targetX = pCenterX, targetY = pCenterY;
      const eDist = Math.hypot(targetX - e.x, targetY - e.y);
      
      if (eDist > 1) {
        const baseS = ENEMY_SPEED_BASE; 
        let dvx = ((targetX - e.x) / eDist) * baseS;
        let dvy = ((targetY - e.y) / eDist) * baseS;

        // Intersection / Turn logic: if the enemy has to change direction significantly
        const newAngle = Math.atan2(dvy, dvx);
        const oldAngle = Math.atan2(e.vy, e.vx);
        const angleDiff = Math.abs(newAngle - oldAngle);
        // If angle changed significantly (like taking a turn), add reaction delay
        if (angleDiff > 0.5 && (e.vx !== 0 || e.vy !== 0)) {
           e.thinkTimer = 0.15; // 0.15s Reaction Delay
        }

        // Separation force
        for (let j = 0; j < enemiesRef.current.length; j++) {
            if (i === j) continue;
            const other = enemiesRef.current[j];
            if (other.isDestroyed) continue;
            const d = Math.hypot(e.x - other.x, e.y - other.y);
            if (d < 50) {
                const force = (50 - d) / 50;
                dvx += (e.x - other.x) / d * force * 150; 
                dvy += (e.y - other.y) / d * force * 150;
            }
        }
        e.vx = dvx; e.vy = dvy;
      }

      // Enemy Collision + Movement
      if (!checkCollision(e.x + e.vx * dt - 22, e.y - 22, 44, 10)) e.x += e.vx * dt;
      if (!checkCollision(e.x - 22, e.y + e.vy * dt - 22, 44, 10)) e.y += e.vy * dt;
    }

    if (!p.isDead) {
      const pTx = Math.floor(pCenterX / TILE_SIZE), pTy = Math.floor(pCenterY / TILE_SIZE);
      if (canCheckAnswerRef.current && levelData.maze[pTy]?.[pTx] === 2) {
        const targetOpt = levelData.options.find((o: any) => o.pos.x === pTx && o.pos.y === pTy);
        if (targetOpt) {
          canCheckAnswerRef.current = false;
          if (targetOpt.isCorrect) onCorrect(); else onIncorrect();
          setTimeout(() => canCheckAnswerRef.current = true, 3500);
        }
      }
    }
    draw();
    rafRef.current = requestAnimationFrame(update);
  }, [levelData, onCorrect, onIncorrect, onEnemyHit, dimensions, isTransitioning, onAmmoChange]);

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const p = playerRef.current;
    if (p.isDead && Math.sin(performance.now() / 50) > 0) return;
    const time = performance.now();
    ctx.save();
    ctx.translate(p.x + 22, p.y + 22);
    ctx.rotate(p.currentAngle);
    const bank = p.moveIntensity * 0.15;
    ctx.scale(1 - bank, 1);
    const enginePower = (16 + Math.sin(time / 30) * 4) * (0.6 + p.moveIntensity * 0.8);
    [-16, 16].forEach(offsetX => {
      const auraGrd = ctx.createRadialGradient(offsetX, 14, 0, offsetX, 14, enginePower * 1.8);
      auraGrd.addColorStop(0, 'rgba(0, 210, 255, 0.6)');
      auraGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGrd; ctx.beginPath(); ctx.arc(offsetX, 14, enginePower * 1.5, 0, Math.PI * 2); ctx.fill();
      const coreGrd = ctx.createLinearGradient(offsetX, 12, offsetX, 12 + enginePower);
      coreGrd.addColorStop(0, '#ffffff'); coreGrd.addColorStop(0.5, '#00d2ff'); coreGrd.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrd; ctx.beginPath(); ctx.ellipse(offsetX, 12 + enginePower / 2, 4, enginePower, 0, 0, Math.PI * 2); ctx.fill();
    });
    const chassisGrd = ctx.createLinearGradient(-22, 0, 22, 0);
    chassisGrd.addColorStop(0, '#1a1d23'); chassisGrd.addColorStop(0.5, '#2f3542'); chassisGrd.addColorStop(1, '#1a1d23');
    ctx.fillStyle = chassisGrd; ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(26, 12); ctx.lineTo(12, 18); ctx.lineTo(0, 10); ctx.lineTo(-12, 18); ctx.lineTo(-26, 12); ctx.closePath(); ctx.fill();
    const armorGrd = ctx.createLinearGradient(-15, 0, 15, 0);
    armorGrd.addColorStop(0, '#d1d8e0'); armorGrd.addColorStop(0.5, '#ffffff'); armorGrd.addColorStop(1, '#d1d8e0');
    ctx.fillStyle = armorGrd; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(16, 8); ctx.lineTo(0, 2); ctx.lineTo(-16, 8); ctx.closePath(); ctx.fill();
    const canopyGrd = ctx.createRadialGradient(0, -10, 2, 0, -10, 10);
    canopyGrd.addColorStop(0, '#74b9ff'); canopyGrd.addColorStop(0.7, '#0984e3'); canopyGrd.addColorStop(1, '#1e3799');
    ctx.fillStyle = canopyGrd; ctx.beginPath(); ctx.ellipse(0, -10, 6, 12, 0, 0, Math.PI * 2); ctx.fill();
    const neonPulse = (Math.sin(time / 200) + 1) / 2;
    ctx.fillStyle = `rgba(0, 255, 255, ${0.4 + neonPulse * 0.6})`;
    ctx.beginPath(); ctx.arc(-22, 10, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(22, 10, 2, 0, Math.PI * 2); ctx.fill();
    if (p.isShielded) {
      ctx.strokeStyle = '#00f2ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.1 + neonPulse * 0.2; ctx.fillStyle = '#00f2ff'; ctx.fill(); ctx.globalAlpha = 1.0;
    }
    ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, e: any) => {
    const time = performance.now();
    const pulse = (Math.sin(time / 200) + 1) / 2;
    const isActive = !e.isDormant && !e.isDestroyed;
    ctx.save();
    ctx.translate(e.x, e.y + Math.sin(e.frame) * 8); 
    ctx.rotate(e.rotation);
    const hoverGrd = ctx.createRadialGradient(0, 0, 5, 0, 0, 35);
    hoverGrd.addColorStop(0, `rgba(255, 0, 0, ${0.2 * pulse})`);
    hoverGrd.addColorStop(1, 'transparent');
    ctx.fillStyle = hoverGrd; ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.rotate((i * Math.PI) / 2); ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(24, -12); ctx.lineTo(28, 0); ctx.lineTo(24, 12); ctx.lineTo(4, 4); ctx.closePath();
        const bladeGrd = ctx.createLinearGradient(4, 0, 28, 0); bladeGrd.addColorStop(0, '#2d3436'); bladeGrd.addColorStop(1, '#000000');
        ctx.fillStyle = bladeGrd; ctx.fill(); ctx.stroke();
        ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + pulse * 0.7})`; ctx.fillRect(18, -2, 6, 4); ctx.restore();
    }
    const coreGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
    coreGrd.addColorStop(0, '#444'); coreGrd.addColorStop(1, '#000');
    ctx.fillStyle = coreGrd; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 1; ctx.stroke();
    if (isActive) {
        ctx.shadowBlur = 15 + pulse * 10; ctx.shadowColor = '#ff4d4d';
        const eyeGrd = ctx.createRadialGradient(0, 0, 2, 0, 0, 9);
        eyeGrd.addColorStop(0, '#ffffff'); eyeGrd.addColorStop(0.3, '#ff4d4d'); eyeGrd.addColorStop(1, '#630000');
        ctx.fillStyle = eyeGrd; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff0000'; ctx.fillRect(-6, -1, 12, 2);
    } else { ctx.fillStyle = '#220000'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };

  const drawPowerUp = (ctx: CanvasRenderingContext2D, pw: any) => {
    if (pw.picked) return;
    const time = performance.now();
    const pulse = (Math.sin(time / 250) + 1) / 2;
    ctx.save();
    ctx.translate(pw.x, pw.y);
    ctx.shadowBlur = 15 + pulse * 10;
    ctx.shadowColor = pw.type === 'shield' ? '#00f2ff' : '#ff9f43';
    ctx.globalAlpha = 0.2 + pulse * 0.2;
    ctx.fillStyle = pw.type === 'shield' ? '#00f2ff' : '#ff9f43';
    ctx.beginPath(); ctx.arc(0, 0, 20 + pulse * 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (pw.type === 'shield') {
        ctx.fillStyle = '#00f2ff';
        ctx.beginPath();
        ctx.moveTo(0, -12); ctx.lineTo(10, -8); ctx.lineTo(10, 4); ctx.lineTo(0, 12); ctx.lineTo(-10, 4); ctx.lineTo(-10, -8);
        ctx.closePath(); ctx.fill();
    } else {
        ctx.fillStyle = '#ff9f43';
        ctx.fillRect(-10, -10, 20, 20);
        ctx.fillStyle = '#000'; ctx.fillRect(-6, -2, 12, 4); ctx.fillRect(-2, -6, 4, 12);
    }
    ctx.restore();
  };

  const drawProjectile = (ctx: CanvasRenderingContext2D, pj: Projectile) => {
    ctx.save();
    ctx.translate(pj.x, pj.y);
    ctx.shadowBlur = 15; ctx.shadowColor = '#00f2ff';
    ctx.fillStyle = '#00f2ff';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const drawWallBlock = (ctx: CanvasRenderingContext2D, sx: number, sy: number, tx: number, ty: number) => {
    const time = performance.now();
    const pulse = (Math.sin(time / 600) + 1) / 2;
    ctx.fillStyle = '#0a0a25';
    ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    const hullGrd = ctx.createLinearGradient(sx, sy, sx + TILE_SIZE, sy + TILE_SIZE);
    hullGrd.addColorStop(0, '#1e1e50'); hullGrd.addColorStop(0.5, '#12123d'); hullGrd.addColorStop(1, '#0a0a20');
    ctx.fillStyle = hullGrd; ctx.fillRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    ctx.fillStyle = '#1a1a4a'; ctx.fillRect(sx + 8, sy + 8, TILE_SIZE - 16, TILE_SIZE - 16);
    ctx.strokeStyle = '#4a90e2'; ctx.lineWidth = 1; ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.moveTo(sx + 10, sy + 10); ctx.lineTo(sx + 20, sy + 20); ctx.moveTo(sx + TILE_SIZE - 10, sy + 10); ctx.lineTo(sx + TILE_SIZE - 20, sy + 20); ctx.stroke();
    ctx.globalAlpha = 0.4 + pulse * 0.6; ctx.shadowBlur = 4 * pulse; ctx.shadowColor = '#00f2ff';
    ctx.strokeStyle = pulse > 0.5 ? '#00f2ff' : '#4a90e2'; ctx.lineWidth = 1.5;
    const seed = (tx * 7 + ty * 13) % 4; ctx.beginPath();
    if (seed === 0) { ctx.moveTo(sx + 12, sy + TILE_SIZE/2); ctx.lineTo(sx + TILE_SIZE - 12, sy + TILE_SIZE/2); }
    else if (seed === 1) { ctx.moveTo(sx + TILE_SIZE/2, sy + 12); ctx.lineTo(sx + TILE_SIZE/2, sy + TILE_SIZE - 12); }
    else if (seed === 2) { ctx.arc(sx + TILE_SIZE/2, sy + TILE_SIZE/2, 10, 0, Math.PI * 1.5); }
    else { ctx.moveTo(sx + 12, sy + 12); ctx.lineTo(sx + 25, sy + 25); ctx.lineTo(sx + TILE_SIZE - 12, sy + 25); }
    ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(74, 144, 226, 0.6)'; ctx.lineWidth = 1;
    ctx.strokeRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8); ctx.fillStyle = '#4a90e2';
    [10, TILE_SIZE - 10].forEach(px => { [10, TILE_SIZE - 10].forEach(py => { ctx.beginPath(); ctx.arc(sx + px, sy + py, 1.5, 0, Math.PI * 2); ctx.fill(); }); });
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas || dimensions.width === 0) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { x: camX, y: camY } = cameraRef.current;
    const zoomVal = getDynamicZoom();
    ctx.save();
    ctx.fillStyle = MAZE_STYLE.floor;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    ctx.translate(dimensions.width / 2, dimensions.height / 2);
    ctx.scale(zoomVal, zoomVal);
    if (screenShake > 0) ctx.translate(Math.random()*screenShake - screenShake/2, Math.random()*screenShake - screenShake/2);
    ctx.translate(-camX, -camY);
    for (let r = 0; r < levelData.maze.length; r++) {
      for (let c = 0; c < levelData.maze[0].length; c++) {
        const sx = c * TILE_SIZE, sy = r * TILE_SIZE;
        const cell = levelData.maze[r][c];
        if (cell === 1) { drawWallBlock(ctx, sx, sy, c, r); }
        else if (cell === 2) {
          ctx.fillStyle = "rgba(0, 210, 255, 0.1)"; ctx.fillRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          ctx.strokeStyle = "rgba(0, 210, 255, 0.3)"; ctx.lineWidth = 1; ctx.strokeRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          const opt = levelData.options.find((o: any) => o.pos.x === c && o.pos.y === r);
          if (opt) { ctx.fillStyle = "white"; ctx.font = "bold 14px Orbitron"; ctx.textAlign = "center"; ctx.fillText(opt.text, sx + TILE_SIZE / 2, sy + TILE_SIZE / 2 + 5); }
        }
      }
    }
    for (const pw of powerUpsRef.current) drawPowerUp(ctx, pw);
    for (const pj of projectilesRef.current) drawProjectile(ctx, pj);
    drawPlayer(ctx);
    for (const e of enemiesRef.current) { if (!e.isDestroyed) drawEnemy(ctx, e); }
    for (const exp of explosionsRef.current) {
        ctx.fillStyle = `rgba(255,159,67,${exp.life})`;
        ctx.beginPath(); ctx.arc(exp.x, exp.y, 40 * exp.life, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (isGlitching) { ctx.fillStyle = 'rgba(255, 0, 0, 0.1)'; ctx.fillRect(0, 0, dimensions.width, dimensions.height); }
  };

  const handleMobileTouch = (key: string, start: boolean) => {
    if (isTransitioning || !start) return;
    if (key === 'ArrowUp') currentMoveVec.current = { x: 0, y: -1 };
    else if (key === 'ArrowDown') currentMoveVec.current = { x: 0, y: 1 };
    else if (key === 'ArrowLeft') currentMoveVec.current = { x: -1, y: 0 };
    else if (key === 'ArrowRight') currentMoveVec.current = { x: 1, y: 0 };
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioning) return;
      if (['ArrowUp', 'w'].includes(e.key)) currentMoveVec.current = { x: 0, y: -1 };
      else if (['ArrowDown', 's'].includes(e.key)) currentMoveVec.current = { x: 0, y: 1 };
      else if (['ArrowLeft', 'a'].includes(e.key)) currentMoveVec.current = { x: -1, y: 0 };
      else if (['ArrowRight', 'd'].includes(e.key)) currentMoveVec.current = { x: 1, y: 0 };
      if (e.code === 'Space') fireProjectile();
    };
    window.addEventListener('keydown', handleKeyDown);
    rafRef.current = requestAnimationFrame(update);
    return () => { window.removeEventListener('keydown', handleKeyDown); cancelAnimationFrame(rafRef.current); };
  }, [update, isTransitioning]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden bg-[#050510]">
      <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} className="w-full h-full block" />
      {dimensions.width < 1024 && (
        <div className="absolute inset-0 z-30 pointer-events-none select-none">
          <div className="absolute bottom-10 left-10 w-36 h-36 pointer-events-auto">
            <div className="relative w-full h-full flex items-center justify-center rounded-full border-2 border-white/20 bg-white/5 backdrop-blur-[1px] opacity-40 active:opacity-80 transition-all">
              <button className="absolute top-1 w-12 h-12 flex items-center justify-center active:scale-95 transition-transform" onTouchStart={() => handleMobileTouch('ArrowUp', true)}><div className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center bg-white/5"><span className="text-white text-base">▲</span></div></button>
              <button className="absolute bottom-1 w-12 h-12 flex items-center justify-center active:scale-95 transition-transform" onTouchStart={() => handleMobileTouch('ArrowDown', true)}><div className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center bg-white/5"><span className="text-white text-base">▼</span></div></button>
              <button className="absolute left-1 w-12 h-12 flex items-center justify-center active:scale-95 transition-transform" onTouchStart={() => handleMobileTouch('ArrowLeft', true)}><div className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center bg-white/5"><span className="text-white text-base">◀</span></div></button>
              <button className="absolute right-1 w-12 h-12 flex items-center justify-center active:scale-95 transition-transform" onTouchStart={() => handleMobileTouch('ArrowRight', true)}><div className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center bg-white/5"><span className="text-white text-base">▶</span></div></button>
            </div>
          </div>
          <div className="absolute bottom-12 right-12 pointer-events-auto">
            <button className="w-24 h-24 rounded-full border-2 border-white/40 bg-white/5 backdrop-blur-sm flex items-center justify-center text-4xl opacity-40 active:opacity-80 active:scale-90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]" onTouchStart={() => fireProjectile()}>
              <span className="drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">💣</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameView;
