
import React, { useState, useRef, useEffect } from 'react';

interface VirtualJoystickProps {
  onMove: (vector: { x: number; y: number }) => void;
  onEnd: () => void;
}

const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ onMove, onEnd }) => {
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const baseRef = useRef<HTMLDivElement>(null);
  const radius = 60; // 120px / 2

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsActive(true);
    updatePosition(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isActive) return;
    updatePosition(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsActive(false);
    setPosition({ x: 0, y: 0 });
    onEnd();
  };

  const updatePosition = (e: React.PointerEvent) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + radius;
    const centerY = rect.top + radius;

    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > radius) {
      dx = (dx / distance) * radius;
      dy = (dy / distance) * radius;
    }

    setPosition({ x: dx, y: dy });
    onMove({ x: dx / radius, y: dy / radius });
  };

  return (
    <div 
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-[120px] h-[120px] rounded-full border-2 border-cyan-500/30 bg-cyan-500/5 backdrop-blur-sm shadow-[0_0_30px_rgba(0,210,255,0.15)] touch-none select-none"
    >
      {/* Outer Ring Decoration */}
      <div className="absolute inset-0 rounded-full border border-cyan-500/10 scale-90" />
      
      {/* The Handle */}
      <div 
        className="absolute w-[60px] h-[60px] rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_20px_rgba(0,210,255,0.5)] flex items-center justify-center transition-transform duration-75 ease-out"
        style={{
          transform: `translate(calc(30px + ${position.x}px), calc(30px + ${position.y}px))`,
          left: 0,
          top: 0
        }}
      >
        <div className="w-[40px] h-[40px] rounded-full border border-white/20 bg-white/10" />
      </div>
    </div>
  );
};

export default VirtualJoystick;
