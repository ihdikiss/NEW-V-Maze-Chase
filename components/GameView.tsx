
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
    respawnGrace: 0, currentAngle: 0, moveIntensity: 0, vx: 0, vy: 0 
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
    playerRef.current = { ...playerRef.current, x: sx, y: sy, vx:0, vy:0, isDead: false, respawnGrace: 3.0, currentAngle: 0, moveIntensity: 0, ammo: 0 };
    isEnemyFrozenRef.current = false;
    canCheckAnswerRef.current = true;
    currentMoveVec.current = { x: 0, y: 0 };
    cameraRef.current = { x: sx + 22, y: sy + 22 };
    enemiesRef.current = (levelData.enemies || []).map((e: any, i: number) => ({
      ...e, x: e.x * TILE_SIZE + 32, y: e.y * TILE_SIZE + 32, id: `enemy-${i}`, isDestroyed: false, thinkTimer: Math.random() * 0.5, currentPath: []
    }));
    powerUpsRef.current = [
      { x: 3*TILE_SIZE+32, y: 3*TILE_SIZE+32, type: 'shield', picked: false },
      { x: 11*TILE_SIZE+32, y: 7*TILE_SIZE+32, type: 'weapon', picked: false }
    ];
    projectilesRef.current = []; explosionsRef.current = [];
  }, [levelData]);

  useEffect(() => { initLevel(); }, [initLevel]);

  useEffect(() => {
    const updateSize = () => containerRef.current && setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    updateSize(); window.addEventListener('resize', updateSize); return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleDeath = () => {
    if (playerRef.current.isDead || playerRef.current.respawnGrace > 0 || isEnemyFrozenRef.current) return;
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
      
      if (iv.x !== 0 || iv.y !== 0) {
        const mag = Math.hypot(iv.x, iv.y);
        const vx = (iv.x / mag) * PLAYER_SPEED; const vy = (iv.y / mag) * PLAYER_SPEED;
        if (!checkCol(p.x + vx * dt, p.y)) p.x += vx * dt;
        if (!checkCol(p.x, p.y + vy * dt)) p.y += vy * dt;
        p.currentAngle = lerpAngle(p.currentAngle, Math.atan2(vy, vx) + Math.PI/2, 15 * dt);
        p.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
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
  }, [levelData, onCorrect, onIncorrect, isTransitioning, dimensions]);

  const checkCol = (nx:number, ny:number) => {
    const pad = 12; const pts = [{x:nx+pad,y:ny+pad},{x:nx+44-pad,y:ny+pad},{x:nx+pad,y:ny+44-pad},{x:nx+44-pad,y:ny+44-pad}];
    return pts.some(pt => isWall(pt.x, pt.y));
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, p: any) => {
    ctx.save();
    ctx.translate(p.x + 22, p.y + 22);
    ctx.rotate(p.currentAngle);

    // 1. Aura/Glow Effect
    const auraGlow = ctx.createRadialGradient(0, 0, 5, 0, 0, 30);
    auraGlow.addColorStop(0, 'rgba(0, 210, 255, 0.3)');
    auraGlow.addColorStop(1, 'rgba(0, 210, 255, 0)');
    ctx.fillStyle = auraGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();

    // 2. Engine Thruster (Rear)
    if (p.moveIntensity > 0.1) {
      const enginePulse = Math.sin(Date.now() / 50) * 5;
      const thrusterGlow = ctx.createLinearGradient(0, 10, 0, 25 + enginePulse);
      thrusterGlow.addColorStop(0, '#00f2ff');
      thrusterGlow.addColorStop(0.5, 'rgba(0, 242, 255, 0.5)');
      thrusterGlow.addColorStop(1, 'rgba(0, 242, 255, 0)');
      
      ctx.fillStyle = thrusterGlow;
      ctx.beginPath();
      ctx.moveTo(-8, 10);
      ctx.lineTo(8, 10);
      ctx.lineTo(0, 25 + enginePulse * p.moveIntensity);
      ctx.fill();
    }

    // 3. Main Hull (Futuristic Body)
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00d2ff';
    
    // Body Shape
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -22); // Nose
    ctx.bezierCurveTo(15, -10, 18, 5, 12, 12); // Right Wing
    ctx.lineTo(-12, 12); // Back
    ctx.bezierCurveTo(-18, 5, -15, -10, 0, -22); // Left Wing
    ctx.fill();

    // 4. Detailed Sections
    // Central Power Core (Cockpit)
    ctx.fillStyle = '#00d2ff';
    ctx.beginPath();
    ctx.ellipse(0, -5, 6, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner White Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, -6, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing Lights
    ctx.fillStyle = '#00f2ff';
    ctx.fillRect(8, 2, 3, 6);
    ctx.fillRect(-11, 2, 3, 6);

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

    // Maze Rendering
    for (let r=0; r<levelData.maze.length; r++) {
      for (let c=0; c<levelData.maze[0].length; c++) {
        const v = levelData.maze[r][c]; 
        if (v===1) { 
          ctx.fillStyle = '#1e1e50'; ctx.fillRect(c*TILE_SIZE+4, r*TILE_SIZE+4, TILE_SIZE-8, TILE_SIZE-8); 
          ctx.strokeStyle = '#2d2d7a'; ctx.strokeRect(c*TILE_SIZE+4, r*TILE_SIZE+4, TILE_SIZE-8, TILE_SIZE-8);
        }
        else if (v===2) { 
          ctx.fillStyle = 'rgba(0,210,255,0.1)'; ctx.fillRect(c*TILE_SIZE+4, r*TILE_SIZE+4, TILE_SIZE-8, TILE_SIZE-8);
          const o = levelData.options.find((opt:any) => opt.pos.x===c && opt.pos.y===r);
          if (o) { 
            ctx.fillStyle='white'; ctx.font='bold 12px Orbitron'; ctx.textAlign='center'; 
            ctx.shadowBlur = 5; ctx.shadowColor = '#00d2ff';
            ctx.fillText(o.text, c*TILE_SIZE+32, r*TILE_SIZE+38); 
            ctx.shadowBlur = 0;
          }
        }
      }
    }

    // Player Rendering
    const p = playerRef.current;
    if (!p.isDead || Math.sin(Date.now()/50)>0) {
      drawPlayer(ctx, p);
    }

    // Enemy Rendering
    for (const e of enemiesRef.current) if (!e.isDestroyed) {
      ctx.save();
      ctx.translate(e.x, e.y);
      // Pulsing Enemy Glow
      const enemyPulse = Math.sin(Date.now() / 100) * 5;
      const eg = ctx.createRadialGradient(0,0,5,0,0,25 + enemyPulse);
      eg.addColorStop(0, 'rgba(255, 0, 0, 0.4)');
      eg.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.arc(0, 0, 25 + enemyPulse, 0, Math.PI*2); ctx.fill();
      
      // Enemy Body
      ctx.fillStyle='#ff4d4d'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#330000'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Projectile Rendering
    for (const pj of projectilesRef.current) { 
      ctx.fillStyle='#00f2ff'; 
      ctx.shadowBlur = 10; ctx.shadowColor = '#00f2ff';
      ctx.beginPath(); ctx.arc(pj.x, pj.y, 5, 0, Math.PI*2); ctx.fill(); 
      ctx.shadowBlur = 0;
    }
    
    ctx.restore();
  };

  useEffect(() => {
    const kd = (e:KeyboardEvent) => {
      if (isTransitioning) return;
      if (['ArrowUp','w'].includes(e.key)) currentMoveVec.current.y = -1;
      else if (['ArrowDown','s'].includes(e.key)) currentMoveVec.current.y = 1;
      else if (['ArrowLeft','a'].includes(e.key)) currentMoveVec.current.x = -1;
      else if (['ArrowRight','d'].includes(e.key)) currentMoveVec.current.x = 1;
      if (e.code==='Space') fireProjectile();
    };
    const ku = (e:KeyboardEvent) => {
      if (['ArrowUp','ArrowDown','w','s'].includes(e.key)) currentMoveVec.current.y = 0;
      else if (['ArrowLeft','ArrowRight','a','d'].includes(e.key)) currentMoveVec.current.x = 0;
    };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    rafRef.current = requestAnimationFrame(update);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); cancelAnimationFrame(rafRef.current); };
  }, [update]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full flex items-center justify-center bg-[#050510]">
      <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} className="block" />
    </div>
  );
};

export default GameView;
