
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import GameView from './components/GameView';
import HUD from './components/HUD';
import MissionBriefing from './components/MissionBriefing';
import { GameState, CameraMode } from './types';
import { LEVELS as HARDCODED_LEVELS, TILE_SIZE } from './constants';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.LANDING);
  const [cameraMode, setCameraMode] = useState<CameraMode>(CameraMode.CHASE);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [levelIndex, setLevelIndex] = useState(0);
  const [ammo, setAmmo] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<{ type: 'success' | 'fail', message: string } | null>(null);
  
  // Game Content State
  const [activeLevels, setActiveLevels] = useState(HARDCODED_LEVELS);

  // Membership & Auth State
  const [isPremium, setIsPremium] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Admin Panel States
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<string[]>([]);
  const [activeAdminEmail, setActiveAdminEmail] = useState<string | null>(null);
  const [newAdminEmailInput, setNewAdminEmailInput] = useState('');
  const [isAdminAddingEmail, setIsAdminAddingEmail] = useState(false);
  const [adminStatus, setAdminStatus] = useState({ type: '', msg: '' });
  const [adminFormData, setAdminFormData] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    correct_option: 'A' 
  });

  // Handle Hash for Admin
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#admin') setGameState(GameState.ADMIN);
      else if (gameState === GameState.ADMIN) setGameState(GameState.LANDING);
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [gameState]);

  // Fetch Data
  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const { data: qData } = await supabase.from('custom_questions').select('*').order('created_at', { ascending: false });
      if (qData) setAllQuestions(qData);
      const { data: pData } = await supabase.from('profiles').select('email');
      if (pData) setRegisteredUsers(pData.map(p => p.email).filter(e => e));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => {
    if (gameState === GameState.ADMIN && isAdminLoggedIn) fetchAdminData();
  }, [gameState, isAdminLoggedIn]);

  const adminUserList = useMemo(() => {
    const fromQuestions = allQuestions.map(q => q.assigned_to_email).filter((ema): ema is string => !!ema);
    return Array.from(new Set([...registeredUsers, ...fromQuestions])).sort();
  }, [allQuestions, registeredUsers]);

  const mapQuestionsToLevels = (questions: any[]) => {
    const mapped = questions.map((q, idx) => {
      const template = HARDCODED_LEVELS[idx % HARDCODED_LEVELS.length];
      return {
        ...template,
        id: q.id,
        question: q.question_text,
        options: [
          { text: q.option_a, isCorrect: q.correct_option === 'A', pos: template.options[0].pos },
          { text: q.option_b, isCorrect: q.correct_option === 'B', pos: template.options[1].pos },
          { text: q.option_c, isCorrect: q.correct_option === 'C', pos: template.options[2]?.pos || {x: 7, y: 7} },
        ].filter(opt => opt.text)
      };
    });
    setActiveLevels(mapped);
  };

  const syncCustomQuestions = async (targetEmail: string | null) => {
    try {
      if (targetEmail) {
        const { data } = await supabase.from('custom_questions').select('*').eq('assigned_to_email', targetEmail);
        if (data && data.length > 0) { mapQuestionsToLevels(data); return; }
      }
      const { data: gen } = await supabase.from('custom_questions').select('*').is('assigned_to_email', null);
      if (gen && gen.length > 0) mapQuestionsToLevels(gen);
      else setActiveLevels(HARDCODED_LEVELS);
    } catch (err) { setActiveLevels(HARDCODED_LEVELS); }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsPremium(!!session);
      setUserEmail(session?.user.email || null);
      syncCustomQuestions(session?.user.email || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsPremium(!!session);
      setUserEmail(session?.user.email || null);
      syncCustomQuestions(session?.user.email || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAdminAddQuestion = async (e: React.FormEvent, shouldClear: boolean = false) => {
    if(e) e.preventDefault();
    setLoading(true);
    
    // Explicit Payload: Fixes "option_d" missing error by only sending known columns
    const payload = { 
      question_text: adminFormData.question_text,
      option_a: adminFormData.option_a,
      option_b: adminFormData.option_b,
      option_c: adminFormData.option_c,
      correct_option: adminFormData.correct_option,
      assigned_to_email: activeAdminEmail 
    };

    const { error } = await supabase.from('custom_questions').insert([payload]);
    
    if (error) {
      setAdminStatus({ type: 'error', msg: 'خطأ: ' + error.message });
    } else {
      setAdminStatus({ type: 'success', msg: 'تم الحفظ بنجاح!' });
      if (shouldClear) {
        setAdminFormData({
          question_text: '',
          option_a: '',
          option_b: '',
          option_c: '',
          correct_option: 'A'
        });
      }
      fetchAdminData();
    }
    setLoading(false);
    setTimeout(() => setAdminStatus({ type: '', msg: '' }), 3000);
  };

  const deleteAdminQuestion = async (id: number) => {
    if (!confirm('حذف؟')) return;
    await supabase.from('custom_questions').delete().eq('id', id);
    fetchAdminData();
  };

  const startGame = () => {
    setScore(0); setLives(3); setLevelIndex(0); setAmmo(0);
    setGameState(GameState.BRIEFING);
  };

  const nextLevel = () => {
    if (!isPremium && levelIndex === 4) { setGameState(GameState.RESULT); return; }
    if (levelIndex < activeLevels.length - 1) { setLevelIndex(l => l + 1); setGameState(GameState.BRIEFING); }
    else setGameState(GameState.RESULT);
  };

  const handleCorrect = useCallback(() => {
    setScore(s => s + 500);
    setLastFeedback({ type: 'success', message: 'ACCESS GRANTED' });
    setTimeout(() => { setLastFeedback(null); nextLevel(); }, 2500);
  }, [levelIndex, isPremium, activeLevels]);

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

  return (
    <div className="relative w-full h-screen bg-[#050510] text-white flex flex-col overflow-hidden font-sans text-right" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1a1a3a_0%,#050510_100%)] z-0"></div>
      
      {gameState === GameState.LANDING && (
        <div className="z-10 h-full w-full flex flex-col items-center justify-center animate-fade-in p-6 text-center">
          <div className="relative mb-8">
            <h1 className="text-8xl md:text-[10rem] font-black font-['Orbitron'] text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-emerald-300">9</h1>
            <h1 className="text-5xl md:text-7xl font-black text-white font-['Orbitron']">RA <span className="text-emerald-400">O</span> NCHT</h1>
          </div>
          <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
            <button onClick={() => setGameState(GameState.INTRO)} className="flex-1 py-5 bg-white/5 border border-white/10 rounded-2xl text-xl font-bold">المجانية</button>
            <button onClick={() => setShowAuthModal(true)} className="flex-1 py-5 bg-gradient-to-r from-cyan-600 to-blue-700 rounded-2xl text-xl font-black">بريميوم</button>
          </div>
        </div>
      )}

      {gameState === GameState.ADMIN && (
        <div className="z-50 h-full w-full flex flex-col p-4 md:p-10 overflow-y-auto bg-[#050510]" dir="rtl">
          {!isAdminLoggedIn ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="bg-[#0a0a20] border border-cyan-500/30 p-12 rounded-[3rem] text-center w-full max-w-md">
                <h2 className="orbitron text-3xl font-black text-white mb-8">SECURE ACCESS</h2>
                <form onSubmit={e => { e.preventDefault(); if(adminPassInput === 'ADMIN_9RA_2025') setIsAdminLoggedIn(true); }} className="space-y-6">
                  <input type="password" placeholder="KEY" value={adminPassInput} onChange={e => setAdminPassInput(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center text-xl outline-none" />
                  <button className="w-full py-5 bg-cyan-600 rounded-2xl font-black">LOGIN</button>
                </form>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-7xl mx-auto flex flex-col gap-8">
              <header className="flex justify-between items-center bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
                <h1 className="orbitron text-3xl font-black text-white">MISSION CONTROL</h1>
                <button onClick={() => { window.location.hash = ''; setGameState(GameState.LANDING); }} className="px-8 py-3 bg-red-500/10 text-red-500 rounded-full">DISCONNECT</button>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-3 bg-white/5 p-6 rounded-[2rem] border border-white/10">
                  <h3 className="orbitron text-[10px] text-cyan-400 mb-6 tracking-widest font-black uppercase">Registered Users</h3>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    <button onClick={() => setActiveAdminEmail(null)} className={`w-full text-right p-4 rounded-2xl transition-all ${activeAdminEmail === null ? 'bg-cyan-600' : 'hover:bg-white/5 text-gray-500'}`}>الأسئلة العامة</button>
                    {adminUserList.map(ema => (
                      <button key={ema} onClick={() => setActiveAdminEmail(ema)} className={`w-full text-right p-4 rounded-2xl transition-all truncate text-sm font-bold ${activeAdminEmail === ema ? 'bg-purple-600' : 'hover:bg-white/5 text-gray-400'}`}>{ema}</button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-9 space-y-8">
                  <div className="bg-white/5 p-10 rounded-[2.5rem] border border-white/10 relative">
                    <h2 className="text-2xl font-black mb-8">إدارة الأسئلة لـ: <span className="text-cyan-400">{activeAdminEmail || 'القطاع العام'}</span></h2>
                    
                    <form onSubmit={(e) => handleAdminAddQuestion(e, false)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">نص السؤال</label>
                        <textarea required placeholder="أدخل نص السؤال..." className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-lg font-bold outline-none focus:border-cyan-500" value={adminFormData.question_text} onChange={e => setAdminFormData({...adminFormData, question_text: e.target.value})} />
                      </div>
                      
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">خيارات الإجابة</label>
                        <input required placeholder="خيار أ (A)" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-sm" value={adminFormData.option_a} onChange={e => setAdminFormData({...adminFormData, option_a: e.target.value})} />
                        <input required placeholder="خيار ب (B)" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-sm" value={adminFormData.option_b} onChange={e => setAdminFormData({...adminFormData, option_b: e.target.value})} />
                        <input required placeholder="خيار ج (C)" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-sm" value={adminFormData.option_c} onChange={e => setAdminFormData({...adminFormData, option_c: e.target.value})} />
                      </div>

                      <div className="flex flex-col justify-between">
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 block">الإجابة الصحيحة</label>
                          <select className="w-full bg-black border border-white/10 p-4 rounded-xl orbitron text-sm font-bold text-white outline-none" value={adminFormData.correct_option} onChange={e => setAdminFormData({...adminFormData, correct_option: e.target.value})}>
                            <option value="A">OPTION A</option>
                            <option value="B">OPTION B</option>
                            <option value="C">OPTION C</option>
                          </select>
                        </div>
                        
                        <div className="mt-8 flex flex-col gap-4">
                          {adminStatus.msg && <div className={`text-center p-3 rounded-xl text-xs font-black ${adminStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{adminStatus.msg}</div>}
                          <div className="flex gap-4">
                            <button type="submit" className="flex-1 py-5 bg-cyan-600 rounded-2xl font-black orbitron text-xl">SAVE</button>
                            <button 
                              type="button" 
                              onClick={(e) => handleAdminAddQuestion(e, true)}
                              className="flex-1 py-5 bg-[#00FF41] hover:bg-[#00e03a] text-black rounded-2xl font-black orbitron text-xl shadow-[0_0_20px_rgba(0,255,65,0.4)]"
                            >
                              SAVE & ADD ANOTHER
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>

                  <div className="bg-white/5 p-10 rounded-[2.5rem] border border-white/10">
                    <h3 className="orbitron text-center text-gray-500 mb-8 font-black uppercase">Active Data Logs</h3>
                    <div className="space-y-4">
                      {allQuestions.filter(q => q.assigned_to_email === activeAdminEmail).map(q => (
                        <div key={q.id} className="bg-black/40 p-6 rounded-[2rem] flex justify-between items-center border border-white/5">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-white mb-4">{q.question_text}</p>
                            <div className="flex flex-wrap gap-3">
                              {['A','B','C'].map(k => (
                                <div key={k} className={`px-4 py-2 rounded-xl text-[10px] font-bold border ${q.correct_option === k ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-black/30 border-white/5 text-gray-500'}`}>{k}: {q['option_'+k.toLowerCase()]}</div>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => deleteAdminQuestion(q.id)} className="p-4 bg-red-500/10 text-red-500 rounded-2xl">DELETE</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {gameState === GameState.INTRO && (
        <div className="z-10 h-full w-full flex flex-col items-center justify-center p-4 text-center">
            <h1 className="text-7xl font-black orbitron mb-4">RA <span className="text-emerald-400">O</span> NCHT</h1>
            <button onClick={startGame} className="px-16 py-4 bg-blue-600 rounded-2xl font-black orbitron text-3xl">START</button>
        </div>
      )}
      {gameState === GameState.BRIEFING && <MissionBriefing level={levelIndex + 1} question={activeLevels[levelIndex].question} onEngage={() => setGameState(GameState.PLAYING)} />}
      {gameState === GameState.PLAYING && (
        <div className="relative w-full h-full flex flex-col z-10">
          <HUD score={score} lives={lives} level={levelIndex + 1} question={activeLevels[levelIndex].question} ammo={ammo} onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)} isSettingsOpen={isSettingsOpen} />
          <div className="flex-1 w-full relative">
            <GameView levelData={activeLevels[levelIndex]} onCorrect={handleCorrect} onIncorrect={handleIncorrect} onEnemyHit={handleEnemyCollision} onAmmoChange={setAmmo} cameraMode={cameraMode} />
          </div>
          {lastFeedback && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className={`px-12 py-8 rounded-[2rem] border-b-8 ${lastFeedback.type === 'success' ? 'bg-green-600/30 border-green-500 text-green-400' : 'bg-red-600/30 border-red-500 text-red-400'}`}>
                <h2 className="text-5xl font-black orbitron">{lastFeedback.message}</h2>
              </div>
            </div>
          )}
        </div>
      )}
      {(gameState === GameState.RESULT || gameState === GameState.GAME_OVER) && (
        <div className="z-20 h-full w-full flex flex-col items-center justify-center bg-black/90">
            <h1 className={`text-6xl font-black mb-10 orbitron ${gameState === GameState.GAME_OVER ? 'text-red-500' : 'text-green-500'}`}>{gameState === GameState.GAME_OVER ? 'SYSTEM FAILURE' : 'MISSION COMPLETE'}</h1>
            <button onClick={startGame} className="px-12 py-4 bg-cyan-600 rounded-2xl font-black text-xl">REINITIALIZE</button>
        </div>
      )}
    </div>
  );
};

export default App;
