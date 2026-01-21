
import React, { useState, useCallback } from 'react';
import GameView from './components/GameView';
import HUD from './components/HUD';
import MissionBriefing from './components/MissionBriefing';
import { GameState, CameraMode } from './types';
import { LEVELS } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.INTRO);
  const [cameraMode, setCameraMode] = useState<CameraMode>(CameraMode.CHASE);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [levelIndex, setLevelIndex] = useState(0);
  const [ammo, setAmmo] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<{ type: 'success' | 'fail', message: string } | null>(null);

  const startGame = () => {
    setScore(0);
    setLives(3);
    setLevelIndex(0);
    setAmmo(0);
    setLastFeedback(null);
    setGameState(GameState.BRIEFING);
  };

  const nextLevel = () => {
    if (levelIndex < LEVELS.length - 1) {
      setLevelIndex(l => l + 1);
      setGameState(GameState.BRIEFING);
    } else {
      setGameState(GameState.RESULT);
    }
  };

  const handleCorrect = useCallback(() => {
    setScore(s => s + 500);
    setLastFeedback({ type: 'success', message: 'ACCESS GRANTED' });
    setTimeout(() => {
      setLastFeedback(null);
      nextLevel();
    }, 2500);
  }, [levelIndex]);

  const handleIncorrect = useCallback(() => {
    setLastFeedback({ type: 'fail', message: 'WARNING: WRONG SECTOR' });
    setTimeout(() => setLastFeedback(null), 2000);
  }, []);

  const handleEnemyCollision = useCallback(() => {
    setLives(l => {
      const next = l - 1;
      if (next <= 0) { setGameState(GameState.GAME_OVER); return 0; }
      return next;
    });
    setLastFeedback({ type: 'fail', message: 'DETECTION ERROR' });
    setTimeout(() => setLastFeedback(null), 2000);
  }, []);

  const engageMission = () => {
    setGameState(GameState.PLAYING);
  };

  return (
    <div className="relative w-full h-screen bg-[#050510] text-white flex flex-col overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1a1a3a_0%,#050510_100%)] z-0"></div>
      
      {gameState === GameState.INTRO && (
        <div className="z-10 h-full w-full flex flex-col items-center justify-start lg:justify-center animate-fade-in p-4 overflow-y-auto">
          <div className="flex flex-col items-center w-full max-w-4xl py-8">
            {/* Logo Section - Adjusted for short screens */}
            <div className="relative group mb-4 flex flex-col items-center">
              <div className="absolute -inset-6 bg-gradient-to-r from-cyan-600 via-blue-500 to-emerald-400 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative flex items-center gap-2 md:gap-4">
                 {/* massive Neon 9 - Scaled down for mobile */}
                 <span className="text-7xl md:text-[8rem] lg:text-[10rem] font-black font-['Orbitron'] text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 via-blue-500 to-cyan-300 drop-shadow-[0_0_25px_rgba(34,211,238,0.5)] leading-none">9</span>
                 <div className="flex flex-col -ml-1 md:-ml-2">
                   <h1 className="text-3xl md:text-5xl lg:text-7xl font-black text-white font-['Orbitron'] tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                     RA <span className="text-emerald-400">O</span> NCHT
                   </h1>
                   <div className="h-1 md:h-1.5 w-full bg-gradient-to-r from-cyan-500 via-blue-400 to-emerald-500 rounded-full mt-1"></div>
                 </div>
              </div>
            </div>

            {/* Orientation Message - Compact */}
            <div className="flex flex-col items-center gap-2 mb-6 text-center animate-pulse w-full">
              <div className="flex items-center gap-3 text-cyan-400 bg-cyan-400/5 px-6 py-2 rounded-xl border border-cyan-400/20 backdrop-blur-sm">
                 <svg 
                   className="w-6 h-6 animate-[rotate-phone_3s_ease-in-out_infinite] text-cyan-400" 
                   viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 >
                   <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                   <line x1="12" y1="18" x2="12.01" y2="18"></line>
                 </svg>
                 <p className="text-[12px] md:text-base font-bold tracking-wide font-sans">
                   من أجل تجربة مميزة، قم بجعل الهاتف بوضع أفقي
                 </p>
              </div>
            </div>
            
            {/* Start Button Container - Ensured visibility */}
            <div className="w-full max-w-lg bg-black/60 backdrop-blur-2xl border border-white/10 p-6 md:p-8 rounded-[2rem] shadow-[0_25px_60px_rgba(0,0,0,0.6)] text-center relative overflow-hidden">
              <p className="text-[#4a90e2] text-[10px] md:text-xs font-black tracking-[0.2em] uppercase mb-2 md:mb-4">تم تفعيل بروتوكول التحدي</p>
              <div className="flex flex-col gap-1 md:gap-2 mb-6 md:mb-8 font-sans leading-relaxed text-gray-300 font-bold text-base md:text-xl">
                <p>انطلق في <span className="text-white">متاهة التحدي</span></p>
                <p>اعثر على <span className="text-cyan-400">الجواب الصحيح</span></p>
                <p>احذر من <span className="text-red-500">الاصطدام بالوحوش</span></p>
              </div>
              <button 
                onClick={startGame}
                className="w-full md:w-auto px-12 md:px-16 py-3 md:py-4 font-black text-white bg-gradient-to-r from-blue-600 to-blue-800 font-['Orbitron'] rounded-xl md:rounded-2xl hover:from-blue-500 hover:to-blue-700 transition-all active:scale-95 text-2xl md:text-3xl tracking-[0.2em] shadow-[0_0_40px_rgba(37,99,235,0.4)]"
              >
                START
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState === GameState.BRIEFING && (
        <MissionBriefing 
          level={levelIndex + 1} 
          question={LEVELS[levelIndex].question} 
          onEngage={engageMission} 
        />
      )}

      {gameState === GameState.PLAYING && (
        <div className="relative w-full h-full flex flex-col z-10">
          <div className="absolute top-4 right-4 z-50 flex gap-3 pointer-events-auto">
            <button 
              onClick={() => setGameState(GameState.INTRO)}
              title="Abort Mission"
              className="w-10 h-10 flex items-center justify-center bg-red-950/20 border border-red-500/30 text-red-500 rounded-full hover:bg-red-600 hover:text-white hover:border-red-400 transition-all active:scale-90 shadow-[0_0_15px_rgba(239,68,68,0.2)] backdrop-blur-md"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {isSettingsOpen && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[60] w-72 bg-black/90 border border-blue-500/30 rounded-2xl backdrop-blur-xl p-4 shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-fade-in pointer-events-auto">
              <h3 className="text-blue-400 text-[10px] font-black tracking-widest uppercase mb-4 text-center border-b border-white/10 pb-2">Vision Protocols</h3>
              <div className="flex flex-col gap-2">
                {[
                  { id: CameraMode.CHASE, label: 'Chase Cam', desc: 'Precise Navigation' },
                  { id: CameraMode.FIELD, label: 'Strategic Overview', desc: 'Full Battlefield View' },
                  { id: CameraMode.MOBILE, label: 'Mobile Optimized', desc: 'Landscape Fit' }
                ].map(mode => (
                  <button 
                    key={mode.id}
                    onClick={() => { setCameraMode(mode.id); setIsSettingsOpen(false); }}
                    className={`flex flex-col items-start p-3 rounded-xl transition-all border ${cameraMode === mode.id ? 'bg-blue-600/20 border-blue-500/50 text-white' : 'hover:bg-white/5 border-transparent text-gray-400'}`}
                  >
                    <span className="text-xs font-bold font-['Orbitron'] tracking-tighter">{mode.label}</span>
                    <span className="text-[8px] opacity-60 uppercase">{mode.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <HUD 
            score={score} 
            lives={lives} 
            level={levelIndex + 1} 
            question={LEVELS[levelIndex].question} 
            ammo={ammo}
            onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
            isSettingsOpen={isSettingsOpen}
          />
          <div className="flex-1 w-full relative">
            <GameView 
              levelData={LEVELS[levelIndex]} 
              onCorrect={handleCorrect}
              onIncorrect={handleIncorrect}
              onEnemyHit={handleEnemyCollision}
              onAmmoChange={setAmmo}
              cameraMode={cameraMode}
            />
          </div>
          {lastFeedback && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
              <div className={`px-12 py-8 rounded-[2rem] border-b-8 shadow-2xl transform scale-110 animate-bounce
                ${lastFeedback.type === 'success' ? 'bg-green-600/30 border-green-500 text-green-400' : 'bg-red-600/30 border-red-500 text-red-400'}`}>
                <h2 className="text-5xl font-black font-['Orbitron'] tracking-tighter uppercase">{lastFeedback.message}</h2>
              </div>
            </div>
          )}
        </div>
      )}

      {(gameState === GameState.RESULT || gameState === GameState.GAME_OVER) && (
        <div className="z-20 h-full w-full flex flex-col items-center justify-center animate-scale-up bg-black/90 backdrop-blur-xl">
          <div className="p-8 md:p-16 border-4 border-white/5 rounded-[3rem] md:rounded-[4rem] bg-[#08081a] shadow-2xl text-center relative max-w-2xl w-full mx-4">
            <h1 className={`text-4xl md:text-7xl font-black mb-10 font-['Orbitron'] tracking-tighter ${gameState === GameState.GAME_OVER ? 'text-red-500' : 'text-green-500'}`}>
              {gameState === GameState.GAME_OVER ? 'SYSTEM FAILURE' : 'MISSION CLEAR'}
            </h1>
            <div className="flex flex-col items-center gap-2 mb-12">
              <span className="text-gray-500 text-[10px] md:text-xs font-black tracking-[0.5em] uppercase">
                {gameState === GameState.GAME_OVER ? 'ATTEMPTS EXHAUSTED' : 'Final Efficiency Rating'}
              </span>
              <span className="text-5xl md:text-6xl font-black text-white font-['Orbitron']">{score}</span>
            </div>
            <button 
              onClick={startGame}
              className="bg-white text-black px-12 md:px-16 py-4 md:py-6 font-black text-xl md:text-2xl rounded-2xl hover:bg-cyan-400 hover:text-white transition-all font-['Orbitron'] tracking-widest shadow-xl"
            >
              {gameState === GameState.GAME_OVER ? 'RETRY MISSION' : 'RE-INITIALIZE'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
