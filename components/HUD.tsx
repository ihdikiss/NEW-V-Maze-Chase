
import React from 'react';
import { CameraMode } from '../types';

interface HUDProps {
  score: number;
  lives: number;
  level: number;
  question: string;
  ammo?: number;
  onToggleSettings?: () => void;
  isSettingsOpen?: boolean;
  cameraMode?: CameraMode;
  onCameraModeChange?: (mode: CameraMode) => void;
}

const HeartIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={`w-6 h-6 max-[800px]:w-4 max-[800px]:h-4 transition-all duration-500 ${filled ? 'drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]' : 'opacity-20'}`}
    fill={filled ? '#ef4444' : 'transparent'}
    stroke="#ef4444"
    strokeWidth="2"
  >
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

const CameraIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 max-[800px]:w-4 max-[800px]:h-4">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  </svg>
);

const HUD: React.FC<HUDProps> = ({ score, lives, level, question, ammo = 0, onToggleSettings, isSettingsOpen, cameraMode, onCameraModeChange }) => {
  return (
    <div className="w-full flex flex-col gap-2 max-[800px]:gap-1 z-20 pointer-events-none p-4 max-[800px]:p-2">
      {/* Upper Status Bar - Reduced height on mobile */}
      <div className="flex justify-between items-center px-8 py-3 max-[800px]:px-4 max-[800px]:py-1.5 bg-black/60 border border-white/10 rounded-2xl max-[800px]:rounded-xl backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.5)] pointer-events-auto">
        
        {/* Left Section: Sector, Camera Settings, Weapon */}
        <div className="flex gap-10 max-[800px]:gap-4 items-center">
          <div className="flex flex-col">
            <span className="text-[10px] max-[800px]:text-[8px] text-[#4a90e2] font-black tracking-[0.3em] max-[800px]:tracking-[0.1em] uppercase">SECTOR</span>
            <span className="text-white text-2xl max-[800px]:text-lg font-black font-['Orbitron']">PROTOCOL-0{level}</span>
          </div>

          {/* Camera Settings Button & Dropdown */}
          <div className="relative flex items-center">
            <button 
              onClick={onToggleSettings}
              className={`p-2 max-[800px]:p-1 rounded-xl max-[800px]:rounded-lg border transition-all duration-300 flex flex-col items-center gap-0.5
                ${isSettingsOpen 
                  ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                  : 'bg-white/5 border-white/10 text-blue-400 hover:bg-white/10 hover:border-blue-500/50'}`}
              title="Camera Protocols"
            >
              <CameraIcon />
              <span className="text-[7px] max-[800px]:text-[6px] font-black uppercase tracking-widest">Vision</span>
            </button>

            {/* CAMERA VISION MENU */}
            {isSettingsOpen && (
              <div className="absolute top-16 max-[800px]:top-12 left-0 w-48 max-[800px]:w-40 bg-[#0a0a20]/95 border border-cyan-500/30 rounded-2xl max-[800px]:rounded-xl p-2 backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.8)] z-[10001] animate-fade-in overflow-hidden">
                <div className="text-[8px] text-cyan-400 font-black tracking-widest uppercase mb-2 px-2 py-1 border-b border-white/5">Select Feed</div>
                
                <button 
                  onClick={() => onCameraModeChange?.(CameraMode.CHASE)}
                  className={`w-full text-right p-3 max-[800px]:p-2 rounded-xl flex items-center justify-between text-[10px] max-[800px]:text-[9px] font-bold transition-all hover:bg-white/5 mb-1 ${cameraMode === CameraMode.CHASE ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
                >
                  FOLLOW CAM
                  {cameraMode === CameraMode.CHASE && <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />}
                </button>

                <button 
                  onClick={() => onCameraModeChange?.(CameraMode.FIELD)}
                  className={`w-full text-right p-3 max-[800px]:p-2 rounded-xl flex items-center justify-between text-[10px] max-[800px]:text-[9px] font-bold transition-all hover:bg-white/5 mb-1 ${cameraMode === CameraMode.FIELD ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
                >
                  BIRD'S EYE
                  {cameraMode === CameraMode.FIELD && <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />}
                </button>

                <button 
                  onClick={() => onCameraModeChange?.(CameraMode.MOBILE)}
                  className={`w-full text-right p-3 max-[800px]:p-2 rounded-xl flex items-center justify-between text-[10px] max-[800px]:text-[9px] font-bold transition-all hover:bg-white/5 ${cameraMode === CameraMode.MOBILE ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
                >
                  TOP VIEW
                  {cameraMode === CameraMode.MOBILE && <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] max-[800px]:text-[8px] text-[#ff9f43] font-black tracking-[0.3em] max-[800px]:tracking-[0.1em] uppercase">WEAPON</span>
            <span className={`text-xl max-[800px]:text-sm font-black font-['Orbitron'] ${ammo > 0 ? 'text-[#ff9f43] animate-pulse' : 'text-gray-600'}`}>
              {ammo > 0 ? `READY [${ammo}]` : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Center Section: DATA */}
        <div className="flex items-center">
          <div className="flex flex-col items-center">
            <span className="text-[10px] max-[800px]:text-[8px] text-[#ffd700] font-black tracking-[0.3em] max-[800px]:tracking-[0.1em] uppercase">DATA</span>
            <span className="text-white text-3xl max-[800px]:text-xl font-black font-['Orbitron'] tracking-tighter drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]">
              {score.toString().padStart(6, '0')}
            </span>
          </div>
        </div>

        {/* Right Section: Integrity */}
        <div className="flex items-center gap-6 max-[800px]:gap-2">
          <div className="flex flex-col items-end">
            <span className="text-[10px] max-[800px]:text-[8px] text-red-500 font-black tracking-[0.2em] max-[800px]:tracking-[0.1em] uppercase mb-1">INTEGRITY</span>
            <div className="flex gap-2 max-[800px]:gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <HeartIcon key={i} filled={i < lives} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Question Module - Compact on mobile */}
      <div className="self-center w-full max-w-4xl max-[800px]:max-w-full">
        <div className="relative bg-[#050510]/90 border-y border-cyan-400/40 py-5 px-10 max-[800px]:py-2 max-[800px]:px-4 rounded-2xl max-[800px]:rounded-xl flex items-center justify-center gap-8 max-[800px]:gap-3 shadow-[0_0_40px_rgba(0,210,255,0.15)]">
          <div className="w-3 h-3 max-[800px]:w-1.5 max-[800px]:h-1.5 bg-cyan-400 rounded-full animate-ping"></div>
          <h2 className="text-xl md:text-2xl max-[800px]:text-sm text-center font-['Orbitron'] font-bold text-white tracking-widest max-[800px]:tracking-tight uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
            {question}
          </h2>
          <div className="w-3 h-3 max-[800px]:w-1.5 max-[800px]:h-1.5 bg-cyan-400 rounded-full animate-ping"></div>
        </div>
      </div>
    </div>
  );
};

export default HUD;
