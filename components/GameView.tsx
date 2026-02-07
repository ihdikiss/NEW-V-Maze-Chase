
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { TILE_SIZE, PLAYER_SPEED, ENEMY_SPEED_BASE, MAZE_STYLE, PROJECTILE_SPEED } from '../constants';
import { CameraMode, Position } from '../types';
import VirtualJoystick from './VirtualJoystick';

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
  x: number; y: number; vx: number; vy: number; id: string;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'shield' | 'weapon';
  picked: boolean;
  rotation: number;
}

const GameView: React.FC<GameViewProps> = ({ levelData, onCorrect, onIncorrect, onEnemyHit, onAmmoChange, cameraMode = CameraMode.CHASE, isTransitioning = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const playerRef = useRef({ 
    x: 0, y: 0, width: 44, height: 44, dir: 'up', 
    isShielded: false, shieldTime: 0, ammo: 0, isDead: false,
    respawnGrace: 0, currentAngle: 0, targetAngle: 0, 
    bankAngle: 0, 
    moveIntensity: 0, vx: 0, vy: 0,
    engineScale: 1, pulseTimer: 0
  });
  
  const currentMoveVec = useRef({ x: 0, y: 0 });
  const nextMoveVec = useRef({ x: 0, y: 0 }); 
  const cameraRef = useRef({ x: 0, y: 0 });
  const enemiesRef = useRef<any[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const rafRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(performance.now());
  const canCheckAnswerRef = useRef(true);
  const isEnemyFrozenRef = useRef(false);
  
  const [screenShake, setScreenShake] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const getDynamicZoom = useCallback(() => {
    if (!dimensions.width || !dimensions.height || !levelData?.maze?.[0]) return 1.0;
    const worldW = levelData.maze[0].length * TILE_SIZE;
    const worldH = levelData.maze.length * TILE_SIZE;
    const scaleX = (dimensions.width * 0.95) / worldW;
    const scaleY = (dimensions.height * 0.85) / worldH;
    const baseFit = Math.min(scaleX, scaleY);
    if (cameraMode === CameraMode.FIELD) return baseFit;
    if (cameraMode === CameraMode.MOBILE) return Math.max(baseFit, 0.6);
    return dimensions.width < 1024 ? Math.max(baseFit, 0.7) : 1.0;
  }, [dimensions, levelData, cameraMode]);

  const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;
  const lerpAngle = (current: number, target: number, step: number) => {
    let diff = target - current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return current + diff * step;
  };

  const isWall = (wx: number, wy: number) => {
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    const maze = levelData?.maze;
    if (!maze || ty < 0 || ty >= maze.length || tx < 0 || tx >= maze[0].length) return true;
    return maze[ty][tx] === 1;
  };

  const checkCol = (nx:number, ny:number) => {
    const pad = 14; 
    const pts = [{x:nx+pad,y:ny+pad},{x:nx+44-pad,y:ny+pad},{x:nx+pad,y:ny+44-pad},{x:nx+44-pad,y:ny+44-pad}];
    return pts.some(pt => isWall(pt.x, pt.y));
  };

  const findNextStep = (startTile: {x: number, y: number}, targetTile: {x: number, y: number}) => {
    const maze = levelData.maze;
    if (!maze) return startTile;
    const queue: {x: number, y: number, path: {x: number, y: number}[]}[] = [{ x: startTile.x, y: startTile.y, path: [] }];
    const visited = new Set<string>();
    visited.add(`${startTile.x},${startTile.y}`);
    const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
    let iterations = 0;
    while (queue.length > 0 && iterations < 200) {
      iterations++;
      const { x, y, path } = queue.shift()!;
      if (x === targetTile.x && y === targetTile.y) return path[0] || startTile;
      for (const d of dirs) {
        const nx = x + d.x; const ny = y + d.y; const key = `${nx},${ny}`;
        if (ny >= 0 && ny < maze.length && nx >= 0 && nx < maze[0].length && maze[ny][nx] !== 1 && !visited.has(key)) {
          visited.add(key); queue.push({ x: nx, y: ny, path: [...path, {x: nx, y: ny}] });
        }
      }
    }
    return startTile;
  };

  const initLevel = useCallback(() => {
    if (!levelData?.startPos || !levelData?.maze) return;
    const sx = levelData.startPos.x * TILE_SIZE + 10;
    const sy = levelData.startPos.y * TILE_SIZE + 10;
    playerRef.current = { 
      ...playerRef.current, x: sx, y: sy, vx:0, vy:0, isDead: false, respawnGrace: 3.0, 
      currentAngle: 0, targetAngle: 0, bankAngle: 0, moveIntensity: 0, ammo: 0, isShielded: false, shieldTime: 0,
      engineScale: 1, pulseTimer: 0
    };
    isEnemyFrozenRef.current = false;
    canCheckAnswerRef.current = true;
    currentMoveVec.current = { x: 0, y: 0 };
    nextMoveVec.current = { x: 0, y: 0 };
    cameraRef.current = { x: sx + 22, y: sy + 22 };
    enemiesRef.current = (levelData.enemies || []).map((e: any, i: number) => ({
      ...e, x: e.x * TILE_SIZE + 32, y: e.y * TILE_SIZE + 32, id: `enemy-${i}`, isDestroyed: false, 
      rotation: Math.random() * Math.PI * 2, angle: 0, targetTile: {x: e.x, y: e.y}, pathUpdateTimer: Math.random() * 0.5
    }));

    powerUpsRef.current = [
      { x: 1 * TILE_SIZE + 32, y: 9 * TILE_SIZE + 32, type: 'shield', picked: false, rotation: 0 },
      { x: 13 * TILE_SIZE + 32, y: 9 * TILE_SIZE + 32, type: 'weapon', picked: false, rotation: 0 },
      { x: 7 * TILE_SIZE + 32, y: 1 * TILE_SIZE + 32, type: 'weapon', picked: false, rotation: 0 }
    ];

    projectilesRef.current = [];
    onAmmoChange?.(0);
  }, [levelData, onAmmoChange]);

  useEffect(() => { initLevel(); }, [initLevel]);

  useEffect(() => {
    const updateSize = () => containerRef.current && setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    updateSize(); window.addEventListener('resize', updateSize); return () => window.removeEventListener('resize', updateSize);
  }, []);

  const fireProjectile = () => {
    const p = playerRef.current;
    if (p.ammo <= 0 || p.isDead) return;
    let vx=0, vy=0; const d = p.dir;
    if (d==='up') vy=-PROJECTILE_SPEED; else if (d==='down') vy=PROJECTILE_SPEED; else if (d==='left') vx=-PROJECTILE_SPEED; else vx=PROJECTILE_SPEED;
    projectilesRef.current.push({ x: p.x+22, y: p.y+22, vx, vy, id: `p-${Date.now()}` });
    p.ammo--; onAmmoChange?.(p.ammo);
  };

  const handleJoystickMove = (v: { x: number; y: number }) => {
    // Threshold for activation
    const threshold = 0.3;
    if (Math.abs(v.x) > Math.abs(v.y)) {
      if (Math.abs(v.x) > threshold) {
        nextMoveVec.current = { x: v.x > 0 ? 1 : -1, y: 0 };
      }
    } else {
      if (Math.abs(v.y) > threshold) {
        nextMoveVec.current = { x: 0, y: v.y > 0 ? 1 : -1 };
      }
    }
    
    // Smooth visual rotation/banking based on X axis
    playerRef.current.bankAngle = lerp(playerRef.current.bankAngle, v.x * 0.25, 0.1);
  };

  const update = useCallback(() => {
    const now = performance.now();
    let dt = Math.min((now - lastUpdateRef.current) / 1000, 0.1);
    lastUpdateRef.current = now;
    if (!levelData?.maze) return;
    if (isTransitioning) { draw(); rafRef.current = requestAnimationFrame(update); return; }
    if (screenShake > 0) setScreenShake(s => Math.max(0, s - 20 * dt));

    const p = playerRef.current;
    if (!p.isDead) {
      p.pulseTimer += dt;
      const tileX = Math.floor((p.x + 22) / TILE_SIZE);
      const tileY = Math.floor((p.y + 22) / TILE_SIZE);
      const centerX = tileX * TILE_SIZE + 10;
      const centerY = tileY * TILE_SIZE + 10;

      if (nextMoveVec.current.x !== 0 || nextMoveVec.current.y !== 0) {
        const isPerpendicular = (currentMoveVec.current.x !== 0 && nextMoveVec.current.y !== 0) || (currentMoveVec.current.y !== 0 && nextMoveVec.current.x !== 0);
        const distToCenter = Math.hypot(p.x - centerX, p.y - centerY);
        const canTurn = !checkCol(p.x + nextMoveVec.current.x * 20, p.y + nextMoveVec.current.y * 20);
        
        if (canTurn) {
          if (isPerpendicular && distToCenter < 32) {
            p.x = centerX; p.y = centerY;
            currentMoveVec.current = { ...nextMoveVec.current };
            nextMoveVec.current = { x: 0, y: 0 };
          } else if (!isPerpendicular) {
            currentMoveVec.current = { ...nextMoveVec.current };
            nextMoveVec.current = { x: 0, y: 0 };
          }
        }
      }

      const iv = currentMoveVec.current;
      if (iv.x !== 0 || iv.y !== 0) {
        const vx = iv.x * PLAYER_SPEED; const vy = iv.y * PLAYER_SPEED;
        if (iv.x !== 0) p.y = lerp(p.y, centerY, 15 * dt);
        if (iv.y !== 0) p.x = lerp(p.x, centerX, 15 * dt);
        if (!checkCol(p.x + vx * dt, p.y + vy * dt)) { p.x += vx * dt; p.y += vy * dt; } else { 
          p.x = Math.round(p.x / 4) * 4; p.y = Math.round(p.y / 4) * 4;
          currentMoveVec.current = { x: 0, y: 0 }; 
        }
        p.targetAngle = Math.atan2(vy, vx) + Math.PI/2;
        p.currentAngle = lerpAngle(p.currentAngle, p.targetAngle, 14 * dt);
        p.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
        p.moveIntensity = lerp(p.moveIntensity, 1, 6 * dt);
        // Bank angle handled by joystick move or set here if using keys
        if (iv.x !== 0 && Math.abs(p.bankAngle) < 0.01) p.bankAngle = lerp(p.bankAngle, iv.x * 0.08, 8 * dt);
      } else { 
        p.moveIntensity = lerp(p.moveIntensity, 0, 12 * dt);
        p.bankAngle = lerp(p.bankAngle, 0, 12 * dt);
      }

      if (p.isShielded) { p.shieldTime -= dt; if (p.shieldTime <= 0) p.isShielded = false; }
      if (p.respawnGrace > 0) p.respawnGrace -= dt;

      for (const pw of powerUpsRef.current) {
        if (!pw.picked && Math.hypot(p.x + 22 - pw.x, p.y + 22 - pw.y) < 30) {
          pw.picked = true;
          if (pw.type === 'shield') { p.isShielded = true; p.shieldTime = 5.0; } 
          else if (pw.type === 'weapon') { p.ammo += 5; onAmmoChange?.(p.ammo); }
        }
        pw.rotation += 2 * dt;
      }

      cameraRef.current.x = lerp(cameraRef.current.x, p.x + 22, 12 * dt);
      cameraRef.current.y = lerp(cameraRef.current.y, p.y + 22, 12 * dt);
    }

    projectilesRef.current = projectilesRef.current.filter(pj => {
      pj.x += pj.vx * dt; pj.y += pj.vy * dt;
      if (isWall(pj.x, pj.y)) return false;
      for (const e of enemiesRef.current) if (!e.isDestroyed && Math.hypot(pj.x-e.x, pj.y-e.y)<35) { e.isDestroyed = true; return false; }
      return true;
    });

    const pTX = Math.floor((p.x+22)/TILE_SIZE); const pTY = Math.floor((p.y+22)/TILE_SIZE);
    for (const e of enemiesRef.current) {
      if (e.isDestroyed) continue;
      if (Math.hypot(p.x+22-e.x, p.y+22-e.y)<35 && !p.isShielded && p.respawnGrace<=0) {
          p.isDead = true; setScreenShake(10); onEnemyHit(); setTimeout(() => { initLevel(); setScreenShake(0); }, 1200);
      }
      if (!isEnemyFrozenRef.current) {
        const dx = (e.targetTile.x * TILE_SIZE + 32) - e.x, dy = (e.targetTile.y * TILE_SIZE + 32) - e.y;
        const dist = Math.hypot(dx, dy);

        // إذا وصل العدو إلى الهدف أو انتهى المؤقت، اختر اتجاهاً عشوائياً جديداً
        e.pathUpdateTimer -= dt;
        if (dist < 5 || e.pathUpdateTimer <= 0) {
          const curTX = Math.floor(e.x / TILE_SIZE);
          const curTY = Math.floor(e.y / TILE_SIZE);
          const possibleDirs = [
            {x: 0, y: -1}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 1, y: 0}
          ].filter(dir => {
            const nx = curTX + dir.x;
            const ny = curTY + dir.y;
            return ny >= 0 && ny < levelData.maze.length && 
                   nx >= 0 && nx < levelData.maze[0].length && 
                   levelData.maze[ny][nx] !== 1;
          });

          if (possibleDirs.length > 0) {
            const chosen = possibleDirs[Math.floor(Math.random() * possibleDirs.length)];
            e.targetTile = { x: curTX + chosen.x, y: curTY + chosen.y };
          }
          // تعيين مؤقت عشوائي لتغيير الاتجاه حتى لو لم يصل، لزيادة العشوائية
          e.pathUpdateTimer = 0.5 + Math.random() * 1.5;
        }

        if (dist > 2) {
          const ms = ENEMY_SPEED_BASE;
          e.x += (dx/dist)*ms*dt; e.y += (dy/dist)*ms*dt;
          e.angle = lerpAngle(e.angle, Math.atan2(dy, dx), 8 * dt);
        }
      }
    }

    if (!p.isDead && canCheckAnswerRef.current && levelData.maze[pTY]?.[pTX] === 2) {
      const opt = levelData.options.find((opt:any) => opt.pos.x === pTX && opt.pos.y === pTY);
      if (opt) {
        canCheckAnswerRef.current = false;
        if (opt.isCorrect) { isEnemyFrozenRef.current = true; onCorrect(); } 
        else { onIncorrect(); setTimeout(() => canCheckAnswerRef.current = true, 2000); }
      }
    }
    draw(); rafRef.current = requestAnimationFrame(update);
  }, [levelData, onCorrect, onIncorrect, isTransitioning, dimensions, onAmmoChange]);

  const drawPlayer = (ctx: CanvasRenderingContext2D, p: any) => {
    ctx.save();
    ctx.translate(p.x + 22, p.y + 22);
    ctx.rotate(p.currentAngle);
    ctx.transform(1, 0, p.bankAngle, 1, 0, 0);

    const moveFactor = p.moveIntensity;
    const pulse = Math.sin(p.pulseTimer * 10) * 0.1 + 0.9;
    const isArmed = p.ammo > 0;

    if (moveFactor > 0.1) {
        ctx.save();
        const thrusterY = 12;
        const engineLen = (isArmed ? 25 : 20) * moveFactor * pulse;
        const grad = ctx.createLinearGradient(0, thrusterY, 0, thrusterY + engineLen);
        grad.addColorStop(0, isArmed ? 'rgba(255, 159, 67, 0.6)' : 'rgba(0, 242, 255, 0.4)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(8, thrusterY, 12, engineLen);
        ctx.fillRect(-20, thrusterY, 12, engineLen);
        ctx.restore();
    }

    const hullColor = isArmed ? '#2c3e50' : '#1e272e';
    const darkEdge = '#050510';
    ctx.shadowBlur = isArmed ? 15 : 10;
    ctx.shadowColor = isArmed ? 'rgba(255, 159, 67, 0.3)' : 'rgba(0,0,0,0.5)';

    ctx.beginPath();
    ctx.moveTo(0, -28); ctx.lineTo(38, 12); ctx.lineTo(25, 12); ctx.lineTo(18, 18); ctx.lineTo(8, 12); ctx.lineTo(0, 16); ctx.lineTo(-8, 12); ctx.lineTo(-18, 18); ctx.lineTo(-25, 12); ctx.lineTo(-38, 12); 
    ctx.closePath();
    const hullGrad = ctx.createLinearGradient(-38, 0, 38, 0);
    hullGrad.addColorStop(0, darkEdge); hullGrad.addColorStop(0.5, hullColor); hullGrad.addColorStop(1, darkEdge);
    ctx.fillStyle = hullGrad;
    ctx.fill();

    if (isArmed) {
        ctx.save();
        ctx.fillStyle = '#ff9f43'; ctx.shadowBlur = 10; ctx.shadowColor = '#ff9f43';
        ctx.beginPath(); ctx.moveTo(22, 10); ctx.lineTo(34, 10); ctx.lineTo(28, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-22, 10); ctx.lineTo(-34, 10); ctx.lineTo(-28, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255, 159, 67, 0.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-35, 12); ctx.lineTo(-10, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(35, 12); ctx.lineTo(10, 0); ctx.stroke();
        ctx.restore();
    }

    const cockpitGrad = ctx.createLinearGradient(0, -18, 0, -10);
    cockpitGrad.addColorStop(0, isArmed ? '#ff9f43' : '#000000'); cockpitGrad.addColorStop(1, '#1e272e');
    ctx.fillStyle = cockpitGrad;
    ctx.beginPath(); ctx.moveTo(-6, -16); ctx.quadraticCurveTo(0, -20, 6, -16); ctx.lineTo(8, -12); ctx.quadraticCurveTo(0, -14, -8, -12); ctx.closePath(); ctx.fill();

    const strobe = Math.sin(p.pulseTimer * 15) > 0.5;
    if (strobe) {
        ctx.shadowBlur = 8;
        ctx.fillStyle = isArmed ? '#ff9f43' : '#2ecc71'; ctx.shadowColor = ctx.fillStyle as string;
        ctx.beginPath(); ctx.arc(32, 11, 2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = isArmed ? '#ff4d4d' : '#e74c3c'; ctx.shadowColor = ctx.fillStyle as string;
        ctx.beginPath(); ctx.arc(-32, 11, 2, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    if (p.respawnGrace > 0 || p.isShielded) {
        ctx.restore(); ctx.save();
        ctx.translate(p.x + 22, p.y + 22);
        const sP = Math.sin(p.pulseTimer * 15) * 0.05 + 1;
        const sColor = p.isShielded ? 'rgba(0, 242, 255, 0.5)' : 'rgba(255, 255, 255, 0.3)';
        ctx.strokeStyle = sColor; ctx.lineWidth = 2; ctx.setLineDash([15, 8]);
        ctx.beginPath(); 
        for(let i=0; i<6; i++) {
            const angle = (i * Math.PI * 2) / 6;
            const rx = Math.cos(angle) * 62 * sP;
            const ry = Math.sin(angle) * 62 * sP;
            if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
        }
        ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  };

  const drawPowerUp = (ctx: CanvasRenderingContext2D, pw: PowerUp) => {
    if (pw.picked) return;
    ctx.save(); ctx.translate(pw.x, pw.y); ctx.rotate(pw.rotation);
    const color = pw.type === 'shield' ? '#00f2ff' : '#ff9f43';
    const pulse = Math.sin(performance.now() / 200) * 2 + 15;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, pulse + 12);
    glow.addColorStop(0, color); glow.addColorStop(0.5, color + '44'); glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, pulse + 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'white'; ctx.shadowBlur = 15; ctx.shadowColor = color;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 9, Math.PI/4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 20, 9, -Math.PI/4, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, e: any) => {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle + Math.PI/2);
    const p = Math.sin(performance.now() / 150) * 2;
    const isHunting = false; // لم يعد هناك مطاردة
    const glow = ctx.createRadialGradient(0, 0, 5, 0, 0, 25 + p);
    glow.addColorStop(0, isHunting ? 'rgba(255, 0, 51, 0.4)' : 'rgba(255, 0, 51, 0.2)'); glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 25 + p, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(15, 15); ctx.lineTo(0, 8); ctx.lineTo(-15, 15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff0033'; ctx.shadowBlur = 5; ctx.shadowColor = '#ff0033';
    ctx.beginPath(); ctx.arc(0, -5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !levelData?.maze) return;
    const {x:cx, y:cy} = cameraRef.current; const z = getDynamicZoom();
    ctx.fillStyle = MAZE_STYLE.floor; ctx.fillRect(0,0,dimensions.width,dimensions.height);
    ctx.save(); ctx.translate(dimensions.width/2, dimensions.height/2); ctx.scale(z,z); ctx.translate(-cx, -cy);
    
    levelData.maze.forEach((row: number[], r: number) => {
      row.forEach((v: number, c: number) => {
        if (v === 1) {
            const x = c * TILE_SIZE, y = r * TILE_SIZE;
            ctx.fillStyle = '#050515'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            const bg = ctx.createLinearGradient(x, y, x + TILE_SIZE, y + TILE_SIZE);
            bg.addColorStop(0, '#0a0a25'); bg.addColorStop(1, '#02020a');
            ctx.fillStyle = bg; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = MAZE_STYLE.wallBorder; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.4;
            ctx.beginPath();
            if (r === 0 || levelData.maze[r-1][c] !== 1) { ctx.moveTo(x, y); ctx.lineTo(x + TILE_SIZE, y); }
            if (r === levelData.maze.length - 1 || levelData.maze[r+1][c] !== 1) { ctx.moveTo(x, y + TILE_SIZE); ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE); }
            if (c === 0 || levelData.maze[r][c-1] !== 1) { ctx.moveTo(x, y); ctx.lineTo(x, y + TILE_SIZE); }
            if (c === row.length - 1 || levelData.maze[r][c+1] !== 1) { ctx.moveTo(x + TILE_SIZE, y); ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE); }
            ctx.stroke(); ctx.globalAlpha = 1.0;
        } else if (v === 2) {
          const opt = levelData.options.find((o:any) => o.pos.x === c && o.pos.y === r);
          if (opt) { ctx.fillStyle = 'white'; ctx.font = 'bold 12px Orbitron'; ctx.textAlign = 'center'; ctx.fillText(opt.text, c * TILE_SIZE + 32, r * TILE_SIZE + 38); }
        }
      });
    });

    for (const pw of powerUpsRef.current) drawPowerUp(ctx, pw);
    for (const pj of projectilesRef.current) { 
        ctx.save(); ctx.fillStyle = '#ff9f43'; ctx.shadowBlur = 10; ctx.shadowColor = '#ff9f43';
        ctx.beginPath(); ctx.arc(pj.x, pj.y, 5, 0, Math.PI*2); ctx.fill(); 
        ctx.fillStyle = 'rgba(255, 159, 67, 0.4)'; ctx.beginPath(); ctx.arc(pj.x, pj.y, 8, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
    const p = playerRef.current; 
    if (!p.isDead || Math.sin(Date.now()/50)>0) drawPlayer(ctx, p);
    for (const e of enemiesRef.current) if (!e.isDestroyed) drawEnemy(ctx, e);
    ctx.restore();
  };

  useEffect(() => {
    const kd = (e:KeyboardEvent) => {
      if (isTransitioning) return;
      if (['ArrowUp','w'].includes(e.key)) nextMoveVec.current = { x: 0, y: -1 };
      else if (['ArrowDown','s'].includes(e.key)) nextMoveVec.current = { x: 0, y: 1 };
      else if (['ArrowLeft','a'].includes(e.key)) nextMoveVec.current = { x: -1, y: 0 };
      else if (['ArrowRight','d'].includes(e.key)) nextMoveVec.current = { x: 1, y: 0 };
      if (e.code==='Space') fireProjectile();
    };
    window.addEventListener('keydown', kd); rafRef.current = requestAnimationFrame(update);
    return () => { window.removeEventListener('keydown', kd); cancelAnimationFrame(rafRef.current); };
  }, [update, isTransitioning]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full flex items-center justify-center bg-[#050510]">
      <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} className="block" />
      
      {/* HUD OVERLAYS - Virtual Controls */}
      {!isTransitioning && (
        <>
          {/* Joystick Area */}
          <div className="absolute bottom-12 left-12 z-[200]">
            <VirtualJoystick 
              onMove={handleJoystickMove} 
              onEnd={() => { nextMoveVec.current = { x: 0, y: 0 }; }} 
            />
          </div>

          {/* Fire Button Area */}
          <div className="absolute bottom-12 right-12 z-[200]">
            <button 
              onPointerDown={(e) => { e.preventDefault(); fireProjectile(); }}
              className="w-[100px] h-[100px] rounded-full border-4 border-orange-500/50 bg-orange-500/10 backdrop-blur-md shadow-[0_0_30px_rgba(255,159,67,0.4)] active:scale-90 active:bg-orange-500/30 transition-all flex items-center justify-center group touch-none select-none"
            >
              <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-orange-400 to-red-600 shadow-inner flex items-center justify-center">
                <span className="text-white font-black orbitron text-xs tracking-tighter opacity-80 group-active:scale-110 transition-transform">FIRE</span>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default GameView;
