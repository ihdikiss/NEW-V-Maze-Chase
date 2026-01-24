
import React from 'react';

const MissionTransition: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#050510] flex flex-col items-center justify-center overflow-hidden select-none pointer-events-auto">
      {/* Warp Speed Stars Background */}
      <div className="absolute inset-0 opacity-40">
        {Array.from({ length: 50 }).map((_, i) => (
          <div 
            key={i}
            className="absolute bg-white rounded-full animate-[warp_0.8s_linear_infinite]"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 40 + 20}px`,
              height: '1.5px',
              animationDelay: `${Math.random() * 2}s`,
              opacity: Math.random()
            }}
          />
        ))}
      </div>

      {/* Planet on Left (Sliding Out) */}
      <div className="absolute left-[-20%] w-[50vh] h-[50vh] bg-gradient-to-br from-purple-600 to-indigo-900 rounded-full blur-sm opacity-60 animate-[planet-exit_4s_ease-in-out_forwards]"></div>
      
      {/* New Planet on Right (Sliding In) */}
      <div className="absolute right-[-20%] w-[60vh] h-[60vh] bg-gradient-to-br from-emerald-500 to-blue-900 rounded-full blur-sm opacity-60 animate-[planet-enter_4s_ease-in-out_forwards]"></div>

      {/* Center Spaceship Container */}
      <div className="relative flex flex-col items-center gap-12 animate-[ship-vibration_0.1s_infinite]">
        <div className="relative">
          {/* Blue Thruster Glow */}
          <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-24 h-8 bg-cyan-400/40 blur-xl animate-pulse"></div>
          
          {/* SVG Spaceship */}
          <svg width="180" height="100" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_20px_rgba(0,210,255,0.6)]">
            <path d="M10 30 L40 10 L85 28 L95 30 L85 32 L40 50 Z" fill="#D1D8E0" />
            <path d="M40 10 L85 28 L40 30 Z" fill="#FFFFFF" opacity="0.8" />
            <path d="M40 30 L85 32 L40 50 Z" fill="#A5B1C2" />
            <rect x="50" y="24" width="12" height="12" rx="6" fill="#0984E3" />
            {/* Wing Detail */}
            <path d="M20 20 L50 22 L45 28 Z" fill="#4A90E2" />
            <path d="M20 40 L50 38 L45 32 Z" fill="#4A90E2" />
          </svg>
        </div>

        {/* Text Module */}
        <div className="text-center space-y-4">
          <h2 className="text-5xl md:text-7xl font-black orbitron text-white tracking-[0.2em] animate-[glitch-text_0.5s_infinite] drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
            SECTOR CLEARED
          </h2>
          <p className="text-cyan-400 font-black orbitron text-sm tracking-[0.4em] uppercase opacity-80 animate-pulse">
            HYPER-SPACE JUMP INITIATED
          </p>
        </div>
      </div>

      <style>{`
        @keyframes warp {
          from { transform: translateX(100vw); }
          to { transform: translateX(-100vw); }
        }
        @keyframes planet-exit {
          from { transform: translateX(0); }
          to { transform: translateX(-150%); }
        }
        @keyframes planet-enter {
          from { transform: translateX(150%); }
          to { transform: translateX(0); }
        }
        @keyframes ship-vibration {
          0% { transform: translate(0, 0); }
          50% { transform: translate(1px, -1px); }
          100% { transform: translate(-1px, 1px); }
        }
        @keyframes glitch-text {
          0% { transform: translate(0); text-shadow: 2px 0 red, -2px 0 blue; }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(2px, -2px); text-shadow: -2px 0 red, 2px 0 blue; }
          60% { transform: translate(-2px, -2px); }
          80% { transform: translate(2px, 2px); }
          100% { transform: translate(0); }
        }
      `}</style>
    </div>
  );
};

export default MissionTransition;
