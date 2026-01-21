
import React from 'react';

interface MissionBriefingProps {
  level: number;
  question: string;
  onEngage: () => void;
}

const MissionBriefing: React.FC<MissionBriefingProps> = ({ level, question, onEngage }) => {
  // تفعيل مسميات تقنية لأنواع المهام بناءً على رقم المستوى
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
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#050510]/95 backdrop-blur-xl animate-fade-in">
      {/* Decorative Elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 animate-[scan_3s_linear_infinite]"></div>
        <div className="grid grid-cols-12 h-full w-full">
            {Array.from({length: 12}).map((_, i) => (
                <div key={i} className="border-r border-cyan-900/30 h-full"></div>
            ))}
        </div>
      </div>

      <div className="relative max-w-2xl w-full p-12 mx-4 border border-cyan-500/30 bg-black/40 rounded-[3rem] shadow-[0_0_50px_rgba(0,210,255,0.1)]">
        {/* Header Details */}
        <div className="flex justify-between items-start mb-12">
          <div>
            <p className="text-cyan-400 text-[10px] font-black tracking-[0.4em] uppercase mb-1">Mission Protocol</p>
            <h3 className="text-3xl font-black text-white font-['Orbitron']">SECTOR-0{level}</h3>
          </div>
          <div className="text-right">
            <p className="text-red-500 text-[10px] font-black tracking-[0.4em] uppercase mb-1">Security Status</p>
            <p className="text-white font-bold animate-pulse">LEVEL: CRITICAL</p>
          </div>
        </div>

        {/* Mission Objective */}
        <div className="mb-10 p-6 border-l-4 border-cyan-500 bg-cyan-500/5">
          <p className="text-cyan-400 text-xs font-black tracking-widest uppercase mb-4">Objective Type:</p>
          <h4 className="text-xl text-white font-['Orbitron'] font-bold tracking-tighter mb-6">{getMissionType(level)}</h4>
          
          <div className="h-px w-full bg-gradient-to-r from-cyan-500/50 to-transparent mb-6"></div>
          
          <p className="text-cyan-400 text-xs font-black tracking-widest uppercase mb-2">Decrypting Question...</p>
          <p className="text-2xl md:text-3xl text-white font-['Orbitron'] font-bold leading-tight animate-typewriter">
            {question}
          </p>
        </div>

        {/* Action Button */}
        <div className="flex flex-col items-center">
          <button 
            onClick={onEngage}
            className="group relative px-16 py-5 bg-cyan-600 hover:bg-cyan-500 transition-all duration-300 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(0,210,255,0.4)] active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            <span className="relative z-10 text-white font-black font-['Orbitron'] tracking-[0.3em] text-lg">ENGAGE MISSION</span>
          </button>
          <p className="mt-6 text-gray-500 text-[10px] font-bold tracking-widest uppercase animate-pulse">Ready for Neural Link...</p>
        </div>
      </div>
    </div>
  );
};

export default MissionBriefing;
