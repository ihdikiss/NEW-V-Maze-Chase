
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

  // Admin State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [activeAdminEmail, setActiveAdminEmail] = useState<string | null>(null);
  const [newAdminEmailInput, setNewAdminEmailInput] = useState('');
  const [isAdminAddingEmail, setIsAdminAddingEmail] = useState(false);
  const [adminStatus, setAdminStatus] = useState({ type: '', msg: '' });
  const [adminFormData, setAdminFormData] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    correct_option: 0
  });

  // Check for #admin hash
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#admin') {
        setGameState(GameState.ADMIN);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const syncCustomQuestions = async (targetEmail: string | null) => {
    try {
      if (targetEmail) {
        const { data: userQuestions, error: userError } = await supabase
          .from('custom_questions')
          .select('*')
          .eq('assigned_to_ema', targetEmail);
        
        if (!userError && userQuestions && userQuestions.length > 0) {
          mapQuestionsToLevels(userQuestions);
          return;
        }
      }

      const { data: generalQuestions, error: genError } = await supabase
        .from('custom_questions')
        .select('*')
        .is('assigned_to_ema', null);
      
      if (!genError && generalQuestions && generalQuestions.length > 0) {
        mapQuestionsToLevels(generalQuestions);
      } else {
        setActiveLevels(HARDCODED_LEVELS);
      }
    } catch (err) {
      setActiveLevels(HARDCODED_LEVELS);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('custom_questions')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAllQuestions(data);
    setLoading(false);
  };

  useEffect(() => {
    if (gameState === GameState.ADMIN && isAdminLoggedIn) {
      fetchAdminData();
    }
  }, [gameState, isAdminLoggedIn]);

  const mapQuestionsToLevels = (questions: any[]) => {
    const mapped = questions.map((q, idx) => {
      const template = HARDCODED_LEVELS[idx % HARDCODED_LEVELS.length];
      return {
        ...template,
        id: q.id,
        question: q.question_text,
        options: [
          { text: q.option_a, isCorrect: q.correct_option === 0, pos: template.options[0].pos },
          { text: q.option_b, isCorrect: q.correct_option === 1, pos: template.options[1].pos },
          { text: q.option_c, isCorrect: q.correct_option === 2, pos: template.options[2].pos }
        ]
      };
    });
    setActiveLevels(mapped);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsPremium(true);
        setUserEmail(session.user.email || null);
        syncCustomQuestions(session.user.email || null);
      } else {
        syncCustomQuestions(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email || null;
      setIsPremium(!!session);
      setUserEmail(email);
      syncCustomQuestions(email);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setIsPremium(true);
        setShowAuthModal(false);
        setGameState(GameState.PRO_SUCCESS);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setIsPremium(true);
        setShowAuthModal(false);
        setGameState(GameState.PRO_SUCCESS);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...adminFormData, assigned_to_ema: activeAdminEmail };
    const { error } = await supabase.from('custom_questions').insert([payload]);
    if (error) {
      setAdminStatus({ type: 'error', msg: 'خطأ: ' + error.message });
    } else {
      setAdminStatus({ type: 'success', msg: 'تم بنجاح!' });
      setAdminFormData({ question_text: '', option_a: '', option_b: '', option_c: '', correct_option: 0 });
      fetchAdminData();
    }
    setLoading(false);
    setTimeout(() => setAdminStatus({ type: '', msg: '' }), 3000);
  };

  const deleteAdminQuestion = async (id: number) => {
    if (!confirm('حذف نهائي؟')) return;
    const { error } = await supabase.from('custom_questions').delete().eq('id', id);
    if (!error) fetchAdminData();
  };

  const adminUniqueEmails = useMemo(() => {
    const emails = allQuestions.map(q => q.assigned_to_ema).filter(e => e);
    return [...new Set(emails)];
  }, [allQuestions]);

  const startGame = () => {
    setScore(0);
    setLives(3);
    setLevelIndex(0);
    setAmmo(0);
    setLastFeedback(null);
    setGameState(GameState.BRIEFING);
  };

  const nextLevel = () => {
    if (!isPremium && levelIndex === 4) {
      setGameState(GameState.RESULT);
      return;
    }
    if (levelIndex < activeLevels.length - 1) {
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

  const engageMission = () => {
    setGameState(GameState.PLAYING);
  };

  return (
    <div className="relative w-full h-screen bg-[#050510] text-white flex flex-col overflow-hidden font-sans text-right" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1a1a3a_0%,#050510_100%)] z-0"></div>
      
      {/* 1. LANDING PAGE */}
      {gameState === GameState.LANDING && (
        <div className="z-10 h-full w-full flex flex-col items-center justify-center animate-fade-in p-6 text-center">
          <div className="relative mb-8 transform hover:scale-105 transition-transform duration-500">
            <div className="absolute -inset-10 bg-cyan-500/20 rounded-full blur-3xl"></div>
            <div className="relative flex items-center gap-4 flex-row-reverse">
               <span className="text-8xl md:text-[10rem] font-black font-['Orbitron'] text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 via-blue-500 to-emerald-300 drop-shadow-[0_0_40px_rgba(34,211,238,0.6)] leading-none">9</span>
               <div className="flex flex-col -mr-4 text-right">
                 <h1 className="text-5xl md:text-7xl font-black text-white font-['Orbitron'] tracking-tighter uppercase">
                   RA <span className="text-emerald-400">O</span> NCHT
                 </h1>
                 <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full mt-1"></div>
               </div>
            </div>
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-gray-200 mb-12 max-w-2xl leading-relaxed font-sans">
            مرحباً بك في أول منصة تجمع بين متعة المغامرة الفضائية والتحصيل الدراسي
          </h2>

          <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
            <button onClick={() => { setIsPremium(false); setGameState(GameState.INTRO); }} className="flex-1 py-5 px-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xl font-bold">
              <span className="text-gray-400 block text-xs uppercase tracking-widest mb-1">ابدأ الآن</span> النسخة المجانية
            </button>
            <button onClick={() => setShowAuthModal(true)} className="flex-1 py-5 px-8 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 transition-all text-xl font-black shadow-[0_0_30px_rgba(8,145,178,0.4)]">
               <span className="text-cyan-200 block text-xs uppercase tracking-widest mb-1">بريميوم</span> النسخة المدفوعة
            </button>
          </div>

          {showAuthModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" dir="ltr">
              <div className="bg-[#0a0a20] border border-cyan-500/30 w-full max-w-md rounded-[2.5rem] p-8 animate-fade-in relative">
                <button onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white">✕</button>
                <h3 className="text-3xl font-black font-['Orbitron'] text-center mb-6 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">AUTH PORTAL</h3>
                <div className="flex bg-white/5 rounded-xl p-1 mb-6">
                  <button onClick={() => setAuthMode('signup')} className={`flex-1 py-2 rounded-lg ${authMode === 'signup' ? 'bg-cyan-600' : 'text-gray-500'}`}>Register</button>
                  <button onClick={() => setAuthMode('login')} className={`flex-1 py-2 rounded-lg ${authMode === 'login' ? 'bg-cyan-600' : 'text-gray-500'}`}>Login</button>
                </div>
                <form onSubmit={handleAuth} className="space-y-4 text-left">
                  <input type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-500" />
                  <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-cyan-500" />
                  {authError && <p className="text-red-500 text-xs font-bold">{authError}</p>}
                  <button type="submit" disabled={loading} className="w-full py-4 bg-cyan-600 rounded-xl font-black">{loading ? '...' : 'SUBMIT'}</button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. ADMIN PANEL (دمج مباشر) */}
      {gameState === GameState.ADMIN && (
        <div className="z-50 h-full w-full flex flex-col animate-fade-in p-4 md:p-10 overflow-y-auto bg-[#050510]" dir="rtl">
          {!isAdminLoggedIn ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="bg-[#0a0a20] border border-cyan-500/30 p-12 rounded-[3rem] text-center w-full max-w-md shadow-2xl">
                <h2 className="orbitron text-3xl font-black text-cyan-400 mb-8">ADMIN LOGIN</h2>
                <form onSubmit={e => { e.preventDefault(); if(adminPassInput === 'ADMIN_9RA_2025') setIsAdminLoggedIn(true); else alert('Wrong Key'); }} className="space-y-6">
                  <input type="password" placeholder="ENTER ACCESS KEY" value={adminPassInput} onChange={e => setAdminPassInput(e.target.value)} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-center text-xl orbitron outline-none focus:border-cyan-500" />
                  <button className="w-full py-4 bg-cyan-600 rounded-2xl font-black orbitron">ENTER SECTOR</button>
                </form>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-7xl mx-auto flex flex-col gap-8">
              <header className="flex justify-between items-center bg-white/5 p-6 rounded-3xl border border-white/10">
                <div>
                  <h1 className="orbitron text-3xl font-black">MISSION CONTROL</h1>
                  <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Admin Dashboard</p>
                </div>
                <button onClick={() => { window.location.hash = ''; setGameState(GameState.LANDING); }} className="px-6 py-2 border border-red-500/50 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all">خروج</button>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-3 bg-white/5 p-6 rounded-3xl border border-white/10">
                  <h3 className="orbitron text-xs text-cyan-400 mb-4 tracking-widest">TARGET SELECT</h3>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    <button onClick={() => setActiveAdminEmail(null)} className={`w-full text-right p-3 rounded-xl transition-all ${activeAdminEmail === null ? 'bg-cyan-600 text-white' : 'hover:bg-white/5 text-gray-500'}`}>الأسئلة العامة</button>
                    <div className="h-px bg-white/10 my-4"></div>
                    {adminUniqueEmails.map(ema => (
                      <button key={ema} onClick={() => setActiveAdminEmail(ema)} className={`w-full text-right p-3 rounded-xl transition-all truncate text-sm ${activeAdminEmail === ema ? 'bg-purple-600 text-white' : 'hover:bg-white/5 text-gray-500'}`}>{ema}</button>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-white/10">
                    {isAdminAddingEmail ? (
                      <div className="space-y-2">
                        <input type="email" placeholder="new@user.com" value={newAdminEmailInput} onChange={e => setNewAdminEmailInput(e.target.value)} className="w-full bg-white/5 border border-white/10 p-2 rounded-lg text-xs" />
                        <button onClick={() => { if(newAdminEmailInput) { setActiveAdminEmail(newAdminEmailInput); setIsAdminAddingEmail(false); setNewAdminEmailInput(''); } }} className="w-full bg-cyan-600 py-2 rounded-lg text-xs font-bold">تأكيد</button>
                      </div>
                    ) : (
                      <button onClick={() => setIsAdminAddingEmail(true)} className="w-full py-3 border border-dashed border-white/20 text-gray-500 rounded-xl text-xs hover:text-cyan-400">إضافة إيميل جديد</button>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-9 space-y-8">
                  <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
                    <h2 className="text-xl font-bold mb-6">إضافة سؤال لـ: <span className="text-cyan-400">{activeAdminEmail || 'الأسئلة العامة'}</span></h2>
                    <form onSubmit={handleAdminAddQuestion} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <textarea required placeholder="نص السؤال" className="md:col-span-2 bg-white/5 border border-white/10 p-4 rounded-xl" value={adminFormData.question_text} onChange={e => setAdminFormData({...adminFormData, question_text: e.target.value})} />
                      <input required placeholder="الخيار أ" className="bg-white/5 border border-white/10 p-3 rounded-xl" value={adminFormData.option_a} onChange={e => setAdminFormData({...adminFormData, option_a: e.target.value})} />
                      <input required placeholder="الخيار ب" className="bg-white/5 border border-white/10 p-3 rounded-xl" value={adminFormData.option_b} onChange={e => setAdminFormData({...adminFormData, option_b: e.target.value})} />
                      <input required placeholder="الخيار ج" className="bg-white/5 border border-white/10 p-3 rounded-xl" value={adminFormData.option_c} onChange={e => setAdminFormData({...adminFormData, option_c: e.target.value})} />
                      <select className="bg-[#050510] border border-white/10 p-3 rounded-xl" value={adminFormData.correct_option} onChange={e => setAdminFormData({...adminFormData, correct_option: parseInt(e.target.value)})}>
                        <option value={0}>الخيار أ صحيح</option>
                        <option value={1}>الخيار ب صحيح</option>
                        <option value={2}>الخيار ج صحيح</option>
                      </select>
                      <button className="bg-cyan-600 py-3 rounded-xl font-black uppercase tracking-widest">{loading ? '...' : 'Deploy'}</button>
                      {adminStatus.msg && <p className={`md:col-span-2 text-center text-xs font-bold ${adminStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{adminStatus.msg}</p>}
                    </form>
                  </div>
                  <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
                    <h3 className="orbitron text-xs text-gray-500 mb-6 tracking-widest">CURRENT RECORDS</h3>
                    <div className="space-y-4">
                      {allQuestions.filter(q => q.assigned_to_ema === activeAdminEmail).map(q => (
                        <div key={q.id} className="bg-black/20 p-4 rounded-2xl flex justify-between items-center border border-white/5">
                          <div>
                            <p className="font-bold text-white">{q.question_text}</p>
                            <div className="flex gap-4 text-[10px] text-gray-500 mt-1">
                              <span className={q.correct_option === 0 ? 'text-green-400' : ''}>أ: {q.option_a}</span>
                              <span className={q.correct_option === 1 ? 'text-green-400' : ''}>ب: {q.option_b}</span>
                              <span className={q.correct_option === 2 ? 'text-green-400' : ''}>ج: {q.option_c}</span>
                            </div>
                          </div>
                          <button onClick={() => deleteAdminQuestion(q.id)} className="p-2 text-red-500/50 hover:text-red-500">✕</button>
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

      {/* REST OF GAME SCREENS */}
      {gameState === GameState.INTRO && (
        <div className="z-10 h-full w-full flex flex-col items-center justify-center animate-fade-in p-4 text-center">
            <h1 className="text-7xl font-black orbitron mb-4">RA <span className="text-emerald-400">O</span> NCHT</h1>
            <div className="max-w-lg bg-black/60 p-8 rounded-[2rem] border border-white/10">
              <button onClick={startGame} className="px-16 py-4 bg-blue-600 rounded-2xl font-black orbitron text-3xl shadow-xl active:scale-95 transition-all">START</button>
            </div>
        </div>
      )}

      {gameState === GameState.BRIEFING && (
        <MissionBriefing level={levelIndex + 1} question={activeLevels[levelIndex].question} onEngage={engageMission} />
      )}

      {gameState === GameState.PLAYING && (
        <div className="relative w-full h-full flex flex-col z-10">
          <HUD score={score} lives={lives} level={levelIndex + 1} question={activeLevels[levelIndex].question} ammo={ammo} onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)} isSettingsOpen={isSettingsOpen} />
          <div className="flex-1 w-full relative">
            <GameView levelData={activeLevels[levelIndex]} onCorrect={handleCorrect} onIncorrect={handleIncorrect} onEnemyHit={handleEnemyCollision} onAmmoChange={setAmmo} cameraMode={cameraMode} />
          </div>
          {lastFeedback && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className={`px-12 py-8 rounded-[2rem] border-b-8 shadow-2xl animate-bounce ${lastFeedback.type === 'success' ? 'bg-green-600/30 border-green-500 text-green-400' : 'bg-red-600/30 border-red-500 text-red-400'}`}>
                <h2 className="text-5xl font-black orbitron uppercase">{lastFeedback.message}</h2>
              </div>
            </div>
          )}
        </div>
      )}

      {(gameState === GameState.RESULT || gameState === GameState.GAME_OVER) && (
        <div className="z-20 h-full w-full flex flex-col items-center justify-center bg-black/90">
            <h1 className={`text-6xl font-black mb-10 orbitron ${gameState === GameState.GAME_OVER ? 'text-red-500' : 'text-green-500'}`}>{gameState === GameState.GAME_OVER ? 'SYSTEM FAILURE' : 'MISSION COMPLETE'}</h1>
            <p className="text-6xl font-black mb-10 orbitron">{score.toString().padStart(6, '0')}</p>
            <button onClick={startGame} className="px-12 py-4 bg-cyan-600 rounded-2xl font-black text-xl">REINITIALIZE</button>
        </div>
      )}

      {gameState === GameState.PRO_SUCCESS && (
        <div className="z-20 h-full w-full flex flex-col items-center justify-center bg-[#050510] text-center p-10">
          <h1 className="text-6xl font-black orbitron text-emerald-400 mb-6">PRO ACCESS ENABLED</h1>
          <button onClick={() => setGameState(GameState.INTRO)} className="px-16 py-5 bg-white/5 border border-white/20 rounded-2xl font-black orbitron text-xl">ENTER SIMULATION</button>
        </div>
      )}
    </div>
  );
};

export default App;