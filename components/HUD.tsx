
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
    className={`w-5 h-5 max-[800px]:w-4 max-[800px]:h-4 transition-all duration-500 ${filled ? 'drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]' : 'opacity-20'}`}
    fill={filled ? '#ef4444' : 'transparent'}
    stroke="#ef4444"
    strokeWidth="2"
  >
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

const CameraIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 max-[800px]:w-4 max-[800px]:h-4">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  </svg>
);

const HUD: React.FC<HUDProps> = ({ score, lives, level, question, ammo = 0, onToggleSettings, isSettingsOpen, cameraMode, onCameraModeChange }) => {
  
  const getRank = (lvl: number) => {
    if (lvl <= 2) return { text: "STUDENT [طالب]", color: "text-blue-400" };
    if (lvl <= 4) return { text: "GRADUATE [خريج]", color: "text-emerald-400" };
    if (lvl <= 6) return { text: "RESEARCHER [باحث]", color: "text-yellow-400" };
    if (lvl <= 8) return { text: "SPECIALIST [متخصص]", color: "text-purple-400" };
    return { text: "DOCTOR [دكتور]", color: "text-red-400" };
  };

  const rank = getRank(level);

  return (
    <div className="w-full flex flex-col gap-1 z-20 pointer-events-none p-2 md:p-3">
      {/* Upper Status Bar */}
      <div className="flex justify-between items-center px-4 py-1.5 max-h-[10vh] bg-black/60 border border-white/10 rounded-xl backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)] pointer-events-auto">
        
        {/* Left Section: Sector & Vision */}
        <div className="flex gap-4 md:gap-8 items-center h-full">
          <div className="flex flex-col justify-center">
            <span className="text-[7px] md:text-[8px] text-[#4a90e2] font-black tracking-widest uppercase leading-none mb-0.5">SECTOR</span>
            <span className="text-white text-base md:text-xl font-black font-['Orbitron'] leading-none">P-0{level}</span>
          </div>

          <div className="relative flex items-center h-full">
            <button 
              onClick={onToggleSettings}
              className={`p-1.5 rounded-lg border transition-all duration-300 flex flex-col items-center justify-center
                ${isSettingsOpen 
                  ? 'bg-blue-600 border-blue-400 text-white' 
                  : 'bg-white/5 border-white/10 text-blue-400 hover:bg-white/10'}`}
            >
              <CameraIcon />
              <span className="text-[6px] font-black uppercase tracking-tighter">Vision</span>
            </button>

            {isSettingsOpen && (
              <div className="absolute top-10 left-0 w-36 bg-[#0a0a20]/95 border border-cyan-500/30 rounded-xl p-1 backdrop-blur-xl shadow-2xl z-[10001] animate-fade-in">
                <button onClick={() => onCameraModeChange?.(CameraMode.CHASE)} className={`w-full text-right px-2 py-1.5 rounded-lg text-[8px] font-bold ${cameraMode === CameraMode.CHASE ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}>FOLLOW CAM</button>
                <button onClick={() => onCameraModeChange?.(CameraMode.FIELD)} className={`w-full text-right px-2 py-1.5 rounded-lg text-[8px] font-bold ${cameraMode === CameraMode.FIELD ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}>BIRD'S EYE</button>
                <button onClick={() => onCameraModeChange?.(CameraMode.MOBILE)} className={`w-full text-right px-2 py-1.5 rounded-lg text-[8px] font-bold ${cameraMode === CameraMode.MOBILE ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}>TOP VIEW</button>
              </div>
            )}
          </div>
        </div>

        {/* Center Section: Info & Data */}
        <div className="flex flex-col items-center justify-center gap-1">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <span className="text-[6px] text-gray-500 font-bold uppercase tracking-tighter">RANK</span>
              <span className={`text-[8px] md:text-[10px] font-black orbitron ${rank.color}`}>{rank.text}</span>
            </div>
            <div className="h-6 w-px bg-white/10 mx-2"></div>
            <div className="flex flex-col items-center">
              <span className="text-[6px] text-[#ffd700] font-black tracking-widest uppercase mb-0.5">DATA</span>
              <span className="text-white text-sm md:text-lg font-black font-['Orbitron'] leading-none tracking-tighter">
                {score.toString().padStart(6, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Weapons & Life */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col justify-center items-center">
            <span className="text-[7px] md:text-[8px] text-[#ff9f43] font-black tracking-widest uppercase leading-none mb-0.5">WEAPON</span>
            <span className={`text-xs md:text-sm font-black font-['Orbitron'] leading-none ${ammo > 0 ? 'text-[#ff9f43] animate-pulse' : 'text-gray-600'}`}>
              {ammo > 0 ? `[${ammo}]` : 'OFF'}
            </span>
          </div>
          <div className="flex flex-col items-end justify-center">
            <span className="text-[7px] md:text-[8px] text-red-500 font-black tracking-widest uppercase leading-none mb-1">LIFE</span>
            <div className="flex gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <HeartIcon key={i} filled={i < lives} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Question Module */}
      <div className="self-center w-full max-w-4xl mt-1">
        <div className="relative bg-[#050510]/90 border-y border-cyan-400/40 py-1.5 px-4 rounded-xl flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(0,210,255,0.1)]">
          <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping shrink-0"></div>
          <h2 className="text-[clamp(0.75rem,2.5vh,1.25rem)] text-center font-['Orbitron'] font-bold text-white tracking-tight uppercase leading-tight">
            {question}
          </h2>
          <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping shrink-0"></div>
        </div>
      </div>
    </div>
  );
};

export default HUD;
