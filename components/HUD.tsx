
import React from 'react';

interface HUDProps {
  score: number;
  lives: number;
  level: number;
  question: string;
  ammo?: number;
  onToggleSettings?: () => void;
  isSettingsOpen?: boolean;
}

const HeartIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={`w-6 h-6 transition-all duration-500 ${filled ? 'drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]' : 'opacity-20'}`}
    fill={filled ? '#ef4444' : 'transparent'}
    stroke="#ef4444"
    strokeWidth="2"
  >
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

const CameraIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  </svg>
);

const HUD: React.FC<HUDProps> = ({ score, lives, level, question, ammo = 0, onToggleSettings, isSettingsOpen }) => {
  return (
    <div className="w-full flex flex-col gap-4 z-20 pointer-events-none p-4 md:p-6">
      {/* Upper Status Bar - Added pointer-events-auto here to enable clicking on child buttons */}
      <div className="flex justify-between items-center px-8 py-3 bg-black/60 border border-white/10 rounded-2xl backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.5)] pointer-events-auto">
        
        {/* Left Section: Sector, Camera Settings, Weapon */}
        <div className="flex gap-10 items-center">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#4a90e2] font-black tracking-[0.3em] uppercase">SECTOR</span>
            <span className="text-white text-2xl font-black font-['Orbitron']">PROTOCOL-0{level}</span>
          </div>

          {/* Camera Settings Button */}
          <div className="flex items-center">
            <button 
              onClick={onToggleSettings}
              className={`p-2 rounded-xl border transition-all duration-300 flex flex-col items-center gap-0.5
                ${isSettingsOpen 
                  ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                  : 'bg-white/5 border-white/10 text-blue-400 hover:bg-white/10 hover:border-blue-500/50'}`}
              title="Camera Protocols"
            >
              <CameraIcon />
              <span className="text-[7px] font-black uppercase tracking-widest">Vision</span>
            </button>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] text-[#ff9f43] font-black tracking-[0.3em] uppercase">WEAPON</span>
            <span className={`text-xl font-black font-['Orbitron'] ${ammo > 0 ? 'text-[#ff9f43] animate-pulse' : 'text-gray-600'}`}>
              {ammo > 0 ? `READY [${ammo}]` : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Center Section: DATA */}
        <div className="flex items-center">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-[#ffd700] font-black tracking-[0.3em] uppercase">DATA</span>
            <span className="text-white text-3xl font-black font-['Orbitron'] tracking-tighter drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]">
              {score.toString().padStart(6, '0')}
            </span>
          </div>
        </div>

        {/* Right Section: Integrity */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-red-500 font-black tracking-[0.2em] uppercase mb-1">INTEGRITY</span>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <HeartIcon key={i} filled={i < lives} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Question Module */}
      <div className="self-center w-full max-w-4xl">
        <div className="relative bg-[#050510]/90 border-y border-cyan-400/40 py-5 px-10 rounded-2xl flex items-center justify-center gap-8 shadow-[0_0_40px_rgba(0,210,255,0.15)]">
          <div className="w-3 h-3 bg-cyan-400 rounded-full animate-ping"></div>
          <h2 className="text-xl md:text-2xl text-center font-['Orbitron'] font-bold text-white tracking-widest uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
            {question}
          </h2>
          <div className="w-3 h-3 bg-cyan-400 rounded-full animate-ping"></div>
        </div>
      </div>
    </div>
  );
};

export default HUD;
