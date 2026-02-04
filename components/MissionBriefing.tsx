
import React from 'react';

interface MissionBriefingProps {
  level: number;
  question: string;
  onEngage: () => void;
}

const MissionBriefing: React.FC<MissionBriefingProps> = ({ level, question, onEngage }) => {
  const getMissionType = (lvl: number) => {
    const types = [
      "GEOGRAPHIC DATA DECODING",
      "TEMPORAL CHRONOLOGY ANALYSIS",
      "ASTRO-PHYSICAL SCANNING",
      "CONTINENTAL MASS MAPPING",
      "BIOLOGICAL SENSORY AUDIT",
      "CHEMICAL ELEMENT IDENTIFICATION",
      "REGIONAL TOPOGRAPHY ANALYSIS",
      "TECHNOLOGICAL LINEAGE TRACING",
      "CELESTIAL ORBITAL TRACKING"
    ];
    return types[(lvl - 1) % types.length];
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#050510]/95 backdrop-blur-xl animate-fade-in p-4 overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 animate-[scan_3s_linear_infinite]"></div>
      </div>

      <div className="relative max-w-xl w-full max-h-[95vh] flex flex-col border border-cyan-500/30 bg-black/40 rounded-[2rem] md:rounded-[2.5rem] shadow-[0_0_50px_rgba(0,210,255,0.1)] overflow-hidden">
        {/* Header - Stays at top */}
        <div className="p-5 md:p-8 pb-3 md:pb-4 flex justify-between items-start shrink-0">
          <div>
            <p className="text-cyan-400 text-[7px] md:text-[8px] font-black tracking-[0.4em] uppercase mb-1">Mission Protocol</p>
            <h3 className="text-lg md:text-2xl font-black text-white font-['Orbitron']">SECTOR-0{level}</h3>
          </div>
          <div className="text-right">
            <p className="text-red-500 text-[7px] md:text-[8px] font-black tracking-[0.4em] uppercase mb-1">Security Status</p>
            <p className="text-white text-[10px] md:text-xs font-bold animate-pulse">LEVEL: CRITICAL</p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 md:px-8 custom-scrollbar">
          <div className="mb-6 p-4 border-l-4 border-cyan-500 bg-cyan-500/5">
            <p className="text-cyan-400 text-[7px] md:text-[8px] font-black tracking-widest uppercase mb-2">Objective Type:</p>
            <h4 className="text-xs md:text-base text-white font-['Orbitron'] font-bold tracking-tighter mb-4">{getMissionType(level)}</h4>
            
            <div className="h-px w-full bg-gradient-to-r from-cyan-500/50 to-transparent mb-4"></div>
            
            <p className="text-cyan-400 text-[7px] md:text-[8px] font-black tracking-widest uppercase mb-1">Decrypting Question...</p>
            <p className="text-base md:text-xl text-white font-['Orbitron'] font-bold leading-tight">
              {question}
            </p>
          </div>
        </div>

        {/* Footer - Stays at bottom */}
        <div className="p-5 md:p-8 pt-3 md:pt-4 flex flex-col items-center shrink-0">
          <button 
            onClick={onEngage}
            className="group relative w-full md:w-auto px-10 py-3 md:py-4 bg-cyan-600 hover:bg-cyan-500 transition-all duration-300 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(0,210,255,0.4)] active:scale-95 text-white font-black font-['Orbitron'] tracking-[0.2em] text-xs md:text-sm"
          >
            ENGAGE MISSION
          </button>
          <p className="mt-2 text-gray-500 text-[7px] md:text-[8px] font-bold tracking-widest uppercase animate-pulse">Neural Link Ready</p>
        </div>
      </div>
    </div>
  );
};

export default MissionBriefing;
