
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { TILE_SIZE, PLAYER_SPEED, ENEMY_SPEED_BASE, MAZE_STYLE, PROJECTILE_SPEED } from '../constants';
import { CameraMode, Position } from '../types';

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

interface Explosion {
  x: number; y: number; life: number; id: string;
}

const GameView: React.FC<GameViewProps> = ({ levelData, onCorrect, onIncorrect, onEnemyHit, onAmmoChange, cameraMode = CameraMode.CHASE, isTransitioning = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const playerRef = useRef({ 
    x: 0, y: 0, width: 44, height: 44, dir: 'up', 
    isShielded: false, shieldTime: 0, ammo: 0, isDead: false,
    respawnGrace: 0, currentAngle: 0, moveIntensity: 0, vx: 0, vy: 0,
    tiltAngle: 0, 
    pitchFactor: 0, 
    bankFactor: 0,  
    visualScaleX: 1, 
    visualScaleY: 1,
    engineGlowScale: 1
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

  const findPath = (start: Position, end: Position): Position[] | null => {
    const maze = levelData.maze;
    if (!maze) return null;
    const queue: { pos: Position; path: Position[] }[] = [{ pos: start, path: [] }];
    const visited = new Set<string>();
    visited.add(`${start.x},${start.y}`);
    const directions = [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}];
    while (queue.length > 0) {
      const { pos, path } = queue.shift()!;
      if (pos.x === end.x && pos.y === end.y) return path;
      for (const d of directions) {
        const next = { x: pos.x + d.x, y: pos.y + d.y };
        if (next.y>=0 && next.y<maze.length && next.x>=0 && next.x<maze[0].length && maze[next.y][next.x]!==1 && !visited.has(`${next.x},${next.y}`)) {
          visited.add(`${next.x},${next.y}`);
          queue.push({ pos: next, path: [...path, next] });
        }
      }
    }
    return null;
  };

  const initLevel = useCallback(() => {
    if (!levelData?.startPos || !levelData?.maze) return;
    const sx = levelData.startPos.x * TILE_SIZE + 10;
    const sy = levelData.startPos.y * TILE_SIZE + 10;
    playerRef.current = { 
      ...playerRef.current, x: sx, y: sy, vx:0, vy:0, isDead: false, respawnGrace: 3.0, 
      currentAngle: 0, moveIntensity: 0, ammo: 0, isShielded: false, shieldTime: 0,
      tiltAngle: 0, visualScaleX: 1, visualScaleY: 1, engineGlowScale: 1,
      bankFactor: 0, pitchFactor: 0
    };
    isEnemyFrozenRef.current = false;
    canCheckAnswerRef.current = true;
    currentMoveVec.current = { x: 0, y: 0 };
    cameraRef.current = { x: sx + 22, y: sy + 22 };
    enemiesRef.current = (levelData.enemies || []).map((e: any, i: number) => ({
      ...e, x: e.x * TILE_SIZE + 32, y: e.y * TILE_SIZE + 32, id: `enemy-${i}`, isDestroyed: false, 
      thinkTimer: Math.random() * 0.5, currentPath: [], rotation: Math.random() * Math.PI * 2
    }));

    powerUpsRef.current = [
      { x: 3 * TILE_SIZE + 32, y: 3 * TILE_SIZE + 32, type: 'shield', picked: false },
      { x: 11 * TILE_SIZE + 32, y: 7 * TILE_SIZE + 32, type: 'weapon', picked: false }
    ];
    
    projectilesRef.current = []; explosionsRef.current = [];
    onAmmoChange?.(0);
  }, [levelData, onAmmoChange]);

  useEffect(() => { initLevel(); }, [initLevel]);

  useEffect(() => {
    const updateSize = () => containerRef.current && setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    updateSize(); window.addEventListener('resize', updateSize); return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleDeath = () => {
    if (playerRef.current.isDead || playerRef.current.respawnGrace > 0 || isEnemyFrozenRef.current || playerRef.current.isShielded) return;
    playerRef.current.isDead = true; setScreenShake(10);
    onEnemyHit();
    setTimeout(() => { initLevel(); setScreenShake(0); }, 1200);
  };

  const fireProjectile = () => {
    if (playerRef.current.ammo <= 0 || playerRef.current.isDead) return;
    let vx=0, vy=0; const d = playerRef.current.dir;
    if (d==='up') vy=-PROJECTILE_SPEED; else if (d==='down') vy=PROJECTILE_SPEED; else if (d==='left') vx=-PROJECTILE_SPEED; else vx=PROJECTILE_SPEED;
    projectilesRef.current.push({ x: playerRef.current.x+22, y: playerRef.current.y+22, vx, vy, id: `p-${Date.now()}` });
    playerRef.current.ammo--; onAmmoChange?.(playerRef.current.ammo);
  };

  const update = useCallback(() => {
    if (!levelData?.maze) return;
    const now = performance.now();
    let dt = Math.min((now - lastUpdateRef.current) / 1000, 0.1);
    lastUpdateRef.current = now;

    if (isTransitioning) { draw(); rafRef.current = requestAnimationFrame(update); return; }
    if (screenShake > 0) setScreenShake(s => Math.max(0, s - 20 * dt));

    const p = playerRef.current;
    if (!p.isDead) {
      const iv = currentMoveVec.current;
      p.moveIntensity = lerp(p.moveIntensity, (iv.x !== 0 || iv.y !== 0) ? 1 : 0, 10 * dt);
      
      let targetBank = 0;
      let targetPitch = 0;
      let targetEngineScale = 1;

      if (iv.x !== 0 || iv.y !== 0) {
        const mag = Math.hypot(iv.x, iv.y);
        const vx = (iv.x / mag) * PLAYER_SPEED; const vy = (iv.y / mag) * PLAYER_SPEED;
        
        if (!checkCol(p.x + vx * dt, p.y)) p.x += vx * dt;
        if (!checkCol(p.x, p.y + vy * dt)) p.y += vy * dt;
        
        p.currentAngle = lerpAngle(p.currentAngle, Math.atan2(vy, vx) + Math.PI/2, 15 * dt);
        p.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');

        if (iv.x !== 0) targetBank = iv.x;
        if (iv.y < 0) { 
            targetPitch = 1;
            targetEngineScale = 1.8;
        } else if (iv.y > 0) {
            targetPitch = -0.5;
            targetEngineScale = 0.5;
        }
      }

      p.bankFactor = lerp(p.bankFactor, targetBank, 8 * dt);
      p.pitchFactor = lerp(p.pitchFactor, targetPitch, 8 * dt);
      p.engineGlowScale = lerp(p.engineGlowScale, targetEngineScale, 8 * dt);

      for (const pw of powerUpsRef.current) {
        if (!pw.picked && Math.hypot(p.x + 22 - pw.x, p.y + 22 - pw.y) < 35) {
          pw.picked = true;
          if (pw.type === 'shield') {
            p.isShielded = true;
            p.shieldTime = 12;
          } else if (pw.type === 'weapon') {
            p.ammo += 5;
            onAmmoChange?.(p.ammo);
          }
        }
      }

      if (p.isShielded) {
        p.shieldTime -= dt;
        if (p.shieldTime <= 0) p.isShielded = false;
      }

      if (p.respawnGrace > 0) p.respawnGrace -= dt;
      cameraRef.current.x = lerp(cameraRef.current.x, p.x + 22, 10 * dt);
      cameraRef.current.y = lerp(cameraRef.current.y, p.y + 22, 10 * dt);
    }

    projectilesRef.current = projectilesRef.current.filter(pj => {
      pj.x += pj.vx * dt; pj.y += pj.vy * dt;
      if (isWall(pj.x, pj.y)) return false;
      for (const e of enemiesRef.current) if (!e.isDestroyed && Math.hypot(pj.x-e.x, pj.y-e.y)<30) { e.isDestroyed = true; return false; }
      return true;
    });

    const movementAllowed = !isTransitioning && !isEnemyFrozenRef.current;
    const pTX = Math.floor((p.x+22)/TILE_SIZE); const pTY = Math.floor((p.y+22)/TILE_SIZE);

    for (const e of enemiesRef.current) {
      if (e.isDestroyed) continue;
      if (!movementAllowed) { e.vx = 0; e.vy = 0; continue; }
      if (Math.hypot(p.x+22-e.x, p.y+22-e.y)<30 && !p.isShielded && p.respawnGrace<=0) handleDeath();
      
      e.rotation += 2 * dt; 
      e.thinkTimer -= dt;
      if (e.thinkTimer <= 0) {
        const path = findPath({x: Math.floor(e.x/TILE_SIZE), y: Math.floor(e.y/TILE_SIZE)}, {x: pTX, y: pTY});
        if (path) e.currentPath = path; e.thinkTimer = 0.5;
      }
      if (e.currentPath.length > 0) {
        const next = e.currentPath[0];
        const tx = next.x * TILE_SIZE + 32, ty = next.y * TILE_SIZE + 32;
        const dist = Math.hypot(tx-e.x, ty-e.y);
        if (dist > 5) {
          e.x += ((tx-e.x)/dist) * ENEMY_SPEED_BASE * dt;
          e.y += ((ty-e.y)/dist) * ENEMY_SPEED_BASE * dt;
        } else e.currentPath.shift();
      }
    }

    if (!p.isDead && canCheckAnswerRef.current && levelData.maze[pTY]?.[pTX] === 2) {
      const opt = levelData.options.find((o:any) => o.pos.x === pTX && o.pos.y === pTY);
      if (opt) {
        canCheckAnswerRef.current = false;
        if (opt.isCorrect) { 
          isEnemyFrozenRef.current = true;
          onCorrect(); 
        } else { 
          onIncorrect(); 
          setTimeout(() => canCheckAnswerRef.current = true, 2000);
        }
      }
    }

    draw();
    rafRef.current = requestAnimationFrame(update);
  }, [levelData, onCorrect, onIncorrect, isTransitioning, dimensions, onAmmoChange]);

  const checkCol = (nx:number, ny:number) => {
    const pad = 12; const pts = [{x:nx+pad,y:ny+pad},{x:nx+44-pad,y:ny+pad},{x:nx+pad,y:ny+44-pad},{x:nx+44-pad,y:ny+44-pad}];
    return pts.some(pt => isWall(pt.x, pt.y));
  };

  const drawPowerUp = (ctx: CanvasRenderingContext2D, pw: any) => {
    const time = Date.now();
    const pulse = Math.sin(time / 200) * 0.2 + 1;
    const rotate = time / 500;
    
    ctx.save();
    ctx.translate(pw.x, pw.y);
    
    const color = pw.type === 'shield' ? '#00f2ff' : '#ff9f43';
    
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 25 * pulse);
    glow.addColorStop(0, color + '66');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 25 * pulse, 0, Math.PI * 2); ctx.fill();
    
    ctx.rotate(rotate);
    ctx.fillStyle = color;
    ctx.shadowBlur = 15; ctx.shadowColor = color;
    
    if (pw.type === 'shield') {
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.strokeRect(-6, -6, 12, 12);
    } else {
      ctx.beginPath();
      for(let i=0; i<4; i++) {
        ctx.rotate(Math.PI/2);
        ctx.moveTo(12, 0); ctx.lineTo(0, 4); ctx.lineTo(0, -4);
      }
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-3, -3, 6, 6);
    }
    
    ctx.restore();
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, p: any) => {
    ctx.save();
    ctx.translate(p.x + 22, p.y + 22);
    ctx.rotate(p.currentAngle);
    
    const time = Date.now();
    const pulse = Math.sin(time / 200) * 0.5 + 0.5;
    const isArmed = p.ammo > 0;
    const themeColor = isArmed ? '#ff9f43' : '#00f2ff';

    if (p.isShielded) {
      const shieldPulse = Math.sin(time / 100) * 5;
      const sg = ctx.createRadialGradient(0, 0, 30, 0, 0, 45 + shieldPulse);
      sg.addColorStop(0, 'transparent');
      sg.addColorStop(0.8, themeColor + '66');
      sg.addColorStop(1, 'transparent');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(0, 0, 45 + shieldPulse, 0, Math.PI * 2); ctx.fill();
    }

    const scannerGlow = ctx.createLinearGradient(0, -30, 0, -120);
    scannerGlow.addColorStop(0, isArmed ? 'rgba(255, 159, 67, 0.6)' : 'rgba(0, 242, 255, 0.6)');
    scannerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = scannerGlow;
    ctx.beginPath(); ctx.moveTo(-5, -28); ctx.lineTo(-25, -120); ctx.lineTo(0, -120); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5, -28); ctx.lineTo(25, -120); ctx.lineTo(0, -120); ctx.fill();

    if (p.moveIntensity > 0.05) {
      const enginePulse = (Math.sin(time / 40) * 8) * p.engineGlowScale;
      const washGlow = ctx.createRadialGradient(0, 20, 0, 0, 20, 40 * p.engineGlowScale);
      washGlow.addColorStop(0, themeColor + '66');
      washGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = washGlow;
      ctx.beginPath(); ctx.arc(0, 20, 40, 0, Math.PI * 2); ctx.fill();

      const drawEngine = (offsetX: number) => {
        const thrustLen = (30 + enginePulse) * p.moveIntensity * p.engineGlowScale;
        const g = ctx.createLinearGradient(0, 8, 0, 8 + thrustLen);
        g.addColorStop(0, '#fff'); g.addColorStop(0.3, themeColor); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        const bankShift = p.bankFactor * 10;
        const widthScale = 1 - Math.abs(p.bankFactor) * 0.3;
        const engineX = (offsetX * widthScale) + (bankShift * 0.3);
        ctx.beginPath(); ctx.moveTo(engineX - 4, 8); ctx.lineTo(engineX + 4, 8); ctx.lineTo(engineX, 8 + thrustLen); ctx.fill();
      };
      drawEngine(-10); drawEngine(10);
    }

    ctx.scale(p.visualScaleX, p.visualScaleY);
    const bankShift = p.bankFactor * 10;
    const widthScale = 1 - Math.abs(p.bankFactor) * 0.3;

    const drawFacet = (color: string, points: [number, number][]) => {
      ctx.fillStyle = color; ctx.beginPath();
      points.forEach((pt, i) => {
        const x = (pt[0] * widthScale) + (bankShift * (pt[1] < 0 ? 0.2 : 0.5));
        const y = pt[1] - (p.pitchFactor * (pt[1] > 0 ? 10 : 0));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath(); ctx.fill();
    };

    drawFacet('#111', [[0, -28], [24, 8], [12, 10], [0, 14], [-12, 10], [-24, 8]]);
    drawFacet(p.bankFactor > 0 ? '#050505' : '#222', [[0, -28], [4, -5], [0, 10], [-4, -5]]);

    if (isArmed) {
      ctx.shadowBlur = 25; ctx.shadowColor = '#ff9f43';
      drawFacet('#222', [[-12, -18], [-24, -12], [-12, -6]]);
      drawFacet('#222', [[12, -18], [24, -12], [12, -6]]);
      const podY = 8 - (p.pitchFactor * 10);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect((-30 * widthScale) + bankShift, podY, 10 * widthScale, 14);
      ctx.fillRect((20 * widthScale) + bankShift, podY, 10 * widthScale, 14);
      ctx.fillStyle = '#ff9f43';
      ctx.fillRect((-28 * widthScale) + bankShift, podY + 3, 6 * widthScale, 8);
      ctx.fillRect((22 * widthScale) + bankShift, podY + 3, 6 * widthScale, 8);
      const bladePulse = Math.sin(time / 40) * 8;
      drawFacet('#ff9f43', [[-24, 8], [-42 - bladePulse, 14], [-24, 16]]);
      drawFacet('#ff9f43', [[24, 8], [42 + bladePulse, 14], [24, 16]]);
      ctx.fillStyle = 'rgba(255, 159, 67, 0.4)';
      drawFacet('rgba(255, 159, 67, 0.4)', [[-15, 10], [-30 - bladePulse/2, 22], [-15, 12]]);
      drawFacet('rgba(255, 159, 67, 0.4)', [[15, 10], [30 + bladePulse/2, 22], [15, 12]]);
      ctx.shadowBlur = 0;
    }

    ctx.strokeStyle = isArmed ? `rgba(255, 159, 67, ${0.4 + pulse * 0.6})` : `rgba(0, 242, 255, ${0.4 + pulse * 0.6})`;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 15; ctx.shadowColor = themeColor;
    ctx.beginPath(); ctx.moveTo(-8 * widthScale + bankShift, -5); ctx.lineTo(-24 * widthScale + bankShift, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8 * widthScale + bankShift, -5); ctx.lineTo(24 * widthScale + bankShift, 8); ctx.stroke();
    ctx.shadowBlur = 0;

    const cockpitY = -12 + (p.pitchFactor * 5);
    const cockpitGlow = ctx.createRadialGradient(bankShift*0.3, cockpitY, 1, bankShift*0.3, cockpitY, 10);
    cockpitGlow.addColorStop(0, '#fff'); cockpitGlow.addColorStop(0.4, themeColor); cockpitGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = cockpitGlow; ctx.beginPath(); ctx.ellipse(bankShift*0.3, cockpitY, 6 * widthScale, 12, 0, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, e: any) => {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rotation);
    const enemyPulse = Math.sin(Date.now() / 150) * 8;
    const eg = ctx.createRadialGradient(0, 0, 0, 0, 0, 30 + enemyPulse);
    eg.addColorStop(0, 'rgba(255, 0, 50, 0.4)');
    eg.addColorStop(1, 'transparent');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(0, 0, 30 + enemyPulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 10; ctx.shadowColor = '#ff0033';
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6;
        const x = Math.cos(angle) * 16;
        const y = Math.sin(angle) * 16;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff4d4d';
    for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
        ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(24, 0); ctx.lineTo(14, 4); ctx.fill();
        ctx.restore();
    }
    const eyePulse = Math.abs(Math.sin(Date.now() / 200)) * 4;
    const eyeGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, 10 + eyePulse);
    eyeGlow.addColorStop(0, '#fff'); eyeGlow.addColorStop(0.3, '#ff0033'); eyeGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = eyeGlow; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !levelData?.maze) return;
    const {x:cx, y:cy} = cameraRef.current; const z = getDynamicZoom();
    
    ctx.fillStyle = '#050515'; ctx.fillRect(0,0,dimensions.width,dimensions.height);
    
    ctx.save();
    ctx.translate(dimensions.width/2, dimensions.height/2); ctx.scale(z,z);
    if (screenShake>0) ctx.translate(Math.random()*screenShake-screenShake/2, Math.random()*screenShake-screenShake/2);
    ctx.translate(-cx, -cy);

    const time = Date.now();
    const maze = levelData.maze;
    const rows = maze.length;
    const cols = maze[0].length;

    for (let r=0; r < rows; r++) {
      for (let c=0; c < cols; c++) {
        const v = maze[r][c]; 
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (v === 1) { 
          const isWallAbove = r > 0 && maze[r-1][c] === 1;
          const isWallBelow = r < rows - 1 && maze[r+1][c] === 1;
          const isWallLeft = c > 0 && maze[r][c-1] === 1;
          const isWallRight = c < cols - 1 && maze[r][c+1] === 1;

          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(x + 10, y + 10, TILE_SIZE, TILE_SIZE);

          ctx.fillStyle = MAZE_STYLE.wallBody;
          ctx.fillRect(x, y + 8, TILE_SIZE, TILE_SIZE - 8);
          
          if (isWallRight) ctx.fillRect(x + TILE_SIZE - 2, y + 8, 4, TILE_SIZE - 8);
          if (isWallBelow) ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 4);

          const wallGrad = ctx.createLinearGradient(x, y, x, y + TILE_SIZE);
          wallGrad.addColorStop(0, MAZE_STYLE.wallTop);
          wallGrad.addColorStop(1, MAZE_STYLE.wallBody);
          ctx.fillStyle = wallGrad;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

          ctx.fillStyle = MAZE_STYLE.wallTop;
          if (isWallRight) ctx.fillRect(x + TILE_SIZE - 2, y, 4, TILE_SIZE);
          if (isWallBelow) ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 4);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          const starSeed = (r * 7 + c * 3) % 10;
          for(let i=0; i<2; i++) {
             const sx = x + 10 + ((starSeed * (i+1) * 17) % (TILE_SIZE - 20));
             const sy = y + 10 + ((starSeed * (i+1) * 31) % (TILE_SIZE - 20));
             const starPulse = Math.sin(time / 500 + i) * 0.5 + 0.5;
             ctx.globalAlpha = starPulse;
             ctx.beginPath(); ctx.arc(sx, sy, 0.8, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalAlpha = 1.0;

          ctx.strokeStyle = MAZE_STYLE.wallBorder;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (!isWallAbove) { ctx.moveTo(x, y); ctx.lineTo(x + TILE_SIZE, y); }
          if (!isWallBelow) { ctx.moveTo(x, y + TILE_SIZE); ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE); }
          if (!isWallLeft) { ctx.moveTo(x, y); ctx.lineTo(x, y + TILE_SIZE); }
          if (!isWallRight) { ctx.moveTo(x + TILE_SIZE, y); ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE); }
          ctx.stroke();
        }
        else if (v===2) { 
          ctx.fillStyle = 'rgba(0,210,255,0.1)'; ctx.fillRect(x+4, y+4, TILE_SIZE-8, TILE_SIZE-8);
          const o = levelData.options.find((opt:any) => opt.pos.x===c && opt.pos.y===r);
          if (o) { 
            ctx.fillStyle='white'; ctx.font='bold 12px Orbitron'; ctx.textAlign='center'; 
            ctx.shadowBlur = 5; ctx.shadowColor = '#00d2ff';
            ctx.fillText(o.text, x+32, y+38); 
            ctx.shadowBlur = 0;
          }
        }
      }
    }

    for (const pw of powerUpsRef.current) if (!pw.picked) drawPowerUp(ctx, pw);

    const p = playerRef.current;
    if (!p.isDead || Math.sin(Date.now()/50)>0) drawPlayer(ctx, p);
    for (const e of enemiesRef.current) if (!e.isDestroyed) drawEnemy(ctx, e);

    for (const pj of projectilesRef.current) { 
      ctx.fillStyle='#ff9f43'; 
      ctx.shadowBlur = 15; ctx.shadowColor = '#ff9f43';
      ctx.beginPath(); ctx.arc(pj.x, pj.y, 6, 0, Math.PI*2); ctx.fill(); 
      ctx.shadowBlur = 0;
    }
    
    ctx.restore();
  };

  useEffect(() => {
    const kd = (e:KeyboardEvent) => {
      if (isTransitioning) return;
      if (['ArrowUp','w'].includes(e.key)) { currentMoveVec.current.y = -1; currentMoveVec.current.x = 0; }
      else if (['ArrowDown','s'].includes(e.key)) { currentMoveVec.current.y = 1; currentMoveVec.current.x = 0; }
      else if (['ArrowLeft','a'].includes(e.key)) { currentMoveVec.current.x = -1; currentMoveVec.current.y = 0; }
      else if (['ArrowRight','d'].includes(e.key)) { currentMoveVec.current.x = 1; currentMoveVec.current.y = 0; }
      if (e.code==='Space') fireProjectile();
    };
    window.addEventListener('keydown', kd);
    rafRef.current = requestAnimationFrame(update);
    return () => { window.removeEventListener('keydown', kd); cancelAnimationFrame(rafRef.current); };
  }, [update]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full flex items-center justify-center bg-[#050510]">
      <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} className="block" />
      
      {/* 🚀 STYLES FOR INTEGRATED MOBILE CONTROLS */}
      <style>{`
        .mobile-ui-container {
          position: fixed !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 99999 !important;
          pointer-events: none !important;
          display: none !important;
          touch-action: none !important;
          -webkit-user-select: none !important;
          user-select: none !important;
          padding: 1rem 1rem 2.5rem 1rem !important; /* Low position */
          justify-content: space-between !important;
          align-items: flex-end !important;
        }

        @media (max-width: 1024px) {
          .mobile-ui-container {
            display: flex !important;
          }
        }

        /* 🎮 TRANSPARENT INTEGRATED D-PAD PANEL */
        .dpad-panel {
          pointer-events: auto !important;
          background: transparent !important; /* Fully transparent panel back */
          border: none !important;
          display: grid !important;
          grid-template-areas: 
            ". up ."
            "left center right"
            ". down .";
          grid-template-columns: repeat(3, 2.3rem) !important; /* Smaller size buttons */
          grid-template-rows: repeat(3, 2.3rem) !important; /* Smaller size buttons */
          gap: 1px !important; /* Integrated/Connected look */
          padding: 0px !important;
          box-shadow: none !important;
        }

        .dpad-btn {
          background: rgba(0, 210, 255, 0.05) !important; /* Very faint tint */
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s !important;
          -webkit-tap-highlight-color: transparent !important;
          touch-action: none !important;
          border: 1px solid rgba(0, 210, 255, 0.15) !important; /* Subtle boundary */
        }

        .dpad-btn:active {
          background: rgba(0, 210, 255, 0.4) !important;
          box-shadow: inset 0 0 12px rgba(0, 210, 255, 0.5) !important;
          transform: scale(0.9);
        }

        .btn-up { grid-area: up; border-radius: 0.5rem 0.5rem 0.1rem 0.1rem !important; }
        .btn-down { grid-area: down; border-radius: 0.1rem 0.1rem 0.5rem 0.5rem !important; }
        .btn-left { grid-area: left; border-radius: 0.5rem 0.1rem 0.1rem 0.5rem !important; }
        .btn-right { grid-area: right; border-radius: 0.1rem 0.5rem 0.5rem 0.1rem !important; }
        
        .dpad-center { 
          grid-area: center; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          background: rgba(0, 210, 255, 0.02) !important;
          border: 1px solid rgba(0, 210, 255, 0.1);
        }

        .shoot-btn-wrapper {
          pointer-events: auto !important;
          background: transparent !important;
        }

        .shoot-btn-circle {
          width: 3.5rem; /* Smaller shoot button to match */
          height: 3.5rem;
          background: rgba(239, 68, 68, 0.05) !important;
          border: 2px solid rgba(239, 68, 68, 0.2) !important;
          border-radius: 50% !important;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.1s;
          backdrop-filter: blur(2px);
        }

        .shoot-btn-circle:active {
          background: rgba(239, 68, 68, 0.3) !important;
          transform: scale(0.85);
        }
      `}</style>
      
      <div className="mobile-ui-container">
        
        {/* Left Side: Shoot Button */}
        <div className="shoot-btn-wrapper">
          <button 
            onTouchStart={(e) => { e.preventDefault(); fireProjectile(); }}
            className="shoot-btn-circle"
          >
            <div className="relative w-5 h-5 flex items-center justify-center pointer-events-none">
                <div className="absolute w-full h-px bg-red-500/40" />
                <div className="absolute h-full w-px bg-red-500/40" />
                <div className="w-1.5 h-1.5 bg-red-500/80 rounded-full" />
            </div>
          </button>
        </div>

        {/* Right Side: Integrated D-PAD Panel (Small & Transparent) */}
        <div className="dpad-panel">
          {/* Up */}
          <button 
            onTouchStart={(e) => { e.preventDefault(); currentMoveVec.current.y = -1; currentMoveVec.current.x = 0; }} 
            className="dpad-btn btn-up"
          >
            <svg className="w-3.5 h-3.5 text-cyan-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" d="M5 15l7-7 7 7" /></svg>
          </button>
          {/* Down */}
          <button 
            onTouchStart={(e) => { e.preventDefault(); currentMoveVec.current.y = 1; currentMoveVec.current.x = 0; }} 
            className="dpad-btn btn-down"
          >
            <svg className="w-3.5 h-3.5 text-cyan-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {/* Left */}
          <button 
            onTouchStart={(e) => { e.preventDefault(); currentMoveVec.current.x = -1; currentMoveVec.current.y = 0; }} 
            className="dpad-btn btn-left"
          >
            <svg className="w-3.5 h-3.5 text-cyan-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" d="M15 19l-7-7 7-7" /></svg>
          </button>
          {/* Right */}
          <button 
            onTouchStart={(e) => { e.preventDefault(); currentMoveVec.current.x = 1; currentMoveVec.current.y = 0; }} 
            className="dpad-btn btn-right"
          >
            <svg className="w-3.5 h-3.5 text-cyan-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" d="M9 5l7 7-7 7" /></svg>
          </button>
          {/* Center Indicator */}
          <div className="dpad-center">
             <div className="w-1 h-1 rounded-full bg-cyan-400/10" />
          </div>
        </div>

      </div>
    </div>
  );
};

export default GameView;
