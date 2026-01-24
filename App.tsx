
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import GameView from './components/GameView';
import HUD from './components/HUD';
import MissionBriefing from './components/MissionBriefing';
import { GameState, CameraMode } from './types';
import { LEVELS as HARDCODED_LEVELS } from './constants';
import { supabase } from './lib/supabase';

/**
 * COMPONENT: AdminDashboard
 * Isolated view for mission control.
 * Fixed: Strict email filtering and state resetting on target change.
 */
const AdminDashboard: React.FC = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [adminQuestions, setAdminQuestions] = useState<any[]>([]); 
  const [registeredUsers, setRegisteredUsers] = useState<string[]>([]);
  const [activeAdminEmail, setActiveAdminEmail] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState({ type: '', msg: '' });
  const [adminFormData, setAdminFormData] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    correct_option: 'A'
  });

  // Fetch all users and summary data for the sidebar
  const fetchSidebarData = async () => {
    try {
      const { data: qData } = await supabase.from('custom_questions').select('assigned_to_email');
      if (qData) setAllQuestions(qData);
      const { data: pData } = await supabase.from('profiles').select('email');
      if (pData) setRegisteredUsers(pData.map(p => p.email).filter(e => e));
    } catch (err) { console.error("Admin Sidebar Fetch Error:", err); }
  };

  // Fetch questions for the currently active target with strict equality
  const fetchTargetQuestions = useCallback(async () => {
    setLoading(true);
    // CRITICAL: Clear current list before fetching new ones to prevent data overlap
    setAdminQuestions([]); 
    
    try {
      const cleanEmail = activeAdminEmail ? activeAdminEmail.trim().toLowerCase() : null;
      let query = supabase.from('custom_questions').select('*').order('created_at', { ascending: false });
      
      if (cleanEmail) {
        // Use .eq for strict matching instead of .ilike
        query = query.eq('assigned_to_email', cleanEmail);
      } else {
        query = query.is('assigned_to_email', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAdminQuestions(data || []);
    } catch (err) { 
      console.error("Target Questions Fetch Error:", err); 
    } finally {
      setLoading(false);
    }
  }, [activeAdminEmail]);

  // Handle Login Initializing
  useEffect(() => { 
    if (isAdminLoggedIn) {
      fetchSidebarData();
    }
  }, [isAdminLoggedIn]);

  // Auto-fetch and isolation on target change
  useEffect(() => {
    if (isAdminLoggedIn) {
      fetchTargetQuestions();
    }
  }, [activeAdminEmail, isAdminLoggedIn, fetchTargetQuestions]);

  const handleDeleteQuestion = async (id: number) => {
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا السؤال نهائياً؟")) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('custom_questions').delete().eq('id', id);
      if (error) throw error;
      
      setAdminQuestions(prev => prev.filter(q => q.id !== id));
      setAdminStatus({ type: 'success', msg: 'تم الحذف بنجاح' });
      fetchSidebarData(); 
    } catch (err: any) {
      alert("حدث خطأ أثناء الحذف: " + err.message);
    } finally {
      setLoading(false);
      setTimeout(() => setAdminStatus({ type: '', msg: '' }), 2000);
    }
  };

  const userList = useMemo(() => {
    const fromQuestions = allQuestions.map(q => q.assigned_to_email).filter((ema): ema is string => !!ema);
    return Array.from(new Set([...registeredUsers, ...fromQuestions])).sort();
  }, [allQuestions, registeredUsers]);

  const handleSubmit = async (e: React.FormEvent, shouldClear: boolean = false) => {
    if(e) e.preventDefault();
    if(!adminFormData.question_text) return;

    setLoading(true);
    const targetEmail = activeAdminEmail ? activeAdminEmail.trim().toLowerCase() : null;
    const payload = { 
      question_text: adminFormData.question_text,
      option_a: adminFormData.option_a,
      option_b: adminFormData.option_b,
      option_c: adminFormData.option_c,
      correct_option: adminFormData.correct_option,
      assigned_to_email: targetEmail
    };
    
    try {
      const { data: inserted, error } = await supabase
        .from('custom_questions')
        .insert([payload])
        .select();

      if (error) throw error;
      
      setAdminStatus({ type: 'success', msg: 'تم الحفظ والمزامنة!' });
      
      // Update the list only if it's still the active user
      if (inserted && inserted.length > 0) {
        const q = inserted[0];
        const qEmail = q.assigned_to_email ? q.assigned_to_email.toLowerCase() : null;
        if (qEmail === targetEmail) {
          setAdminQuestions(prev => [q, ...prev]);
        }
      }

      if (shouldClear) {
        setAdminFormData({ question_text: '', option_a: '', option_b: '', option_c: '', correct_option: 'A' });
      }
      
      fetchSidebarData();
    } catch (err: any) {
      setAdminStatus({ type: 'error', msg: 'خطأ: ' + err.message });
    } finally {
      setLoading(false);
      setTimeout(() => setAdminStatus({ type: '', msg: '' }), 3000);
    }
  };

  if (!isAdminLoggedIn) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#050510] flex items-center justify-center p-6" dir="rtl">
        <div className="bg-[#0a0a20] border border-cyan-500/30 p-12 rounded-[3rem] text-center w-full max-w-md shadow-2xl">
          <h2 className="text-3xl font-black text-white mb-8 orbitron">SECURE ACCESS</h2>
          <input 
            type="password" 
            placeholder="ACCESS KEY" 
            value={adminPassInput} 
            onChange={e => setAdminPassInput(e.target.value)} 
            className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center text-xl outline-none focus:border-cyan-500 mb-6 text-white" 
          />
          <button 
            onClick={() => { if(adminPassInput === 'ADMIN_9RA_2025') setIsAdminLoggedIn(true); }}
            className="w-full py-5 bg-cyan-600 rounded-2xl font-black orbitron"
          >
            INITIATE LINK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#050510] flex flex-col overflow-y-auto p-4 md:p-10" dir="rtl">
      <div className="max-w-7xl mx-auto w-full space-y-8">
        <header className="flex justify-between items-center bg-white/5 p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-md">
          <div className="text-right">
            <h1 className="text-3xl font-black orbitron">MISSION CONTROL</h1>
            <p className="text-cyan-400 text-xs font-bold tracking-widest uppercase">Admin Management Dashboard</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => { fetchSidebarData(); fetchTargetQuestions(); }} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-black hover:bg-white/10">REFRESH</button>
            <button onClick={() => window.location.hash = ''} className="px-8 py-3 bg-red-500/10 text-red-500 border border-red-500/30 rounded-full font-black">EXIT</button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-3 bg-white/5 p-6 rounded-[2rem] border border-white/10">
            <h3 className="orbitron text-[10px] text-cyan-400 mb-6 tracking-widest font-black uppercase">Users & Targets</h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <button onClick={() => setActiveAdminEmail(null)} className={`w-full text-right p-4 rounded-2xl transition-all ${activeAdminEmail === null ? 'bg-cyan-600 text-white' : 'hover:bg-white/5 text-gray-500'}`}>الأسئلة العامة</button>
              {userList.map(ema => (
                <button key={ema} onClick={() => setActiveAdminEmail(ema)} className={`w-full text-right p-4 rounded-2xl transition-all truncate text-sm font-bold ${activeAdminEmail === ema ? 'bg-purple-600 text-white' : 'hover:bg-white/5 text-gray-400'}`}>{ema}</button>
              ))}
            </div>
          </aside>

          <main className="lg:col-span-9 space-y-8">
            <section className="bg-white/5 p-10 rounded-[2.5rem] border border-white/10">
              <h2 className="text-2xl font-black mb-8">إضافة سؤال لـ: <span className="text-cyan-400">{activeAdminEmail || 'القطاع العام'}</span></h2>
              <form onSubmit={e => handleSubmit(e)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <textarea required placeholder="نص السؤال..." className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl text-lg font-bold outline-none text-white focus:border-cyan-500 h-32" value={adminFormData.question_text} onChange={e => setAdminFormData({...adminFormData, question_text: e.target.value})} />
                </div>
                <div className="space-y-4">
                  <input required placeholder="Option A" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white outline-none" value={adminFormData.option_a} onChange={e => setAdminFormData({...adminFormData, option_a: e.target.value})} />
                  <input required placeholder="Option B" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white outline-none" value={adminFormData.option_b} onChange={e => setAdminFormData({...adminFormData, option_b: e.target.value})} />
                  <input required placeholder="Option C" className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white outline-none" value={adminFormData.option_c} onChange={e => setAdminFormData({...adminFormData, option_c: e.target.value})} />
                </div>
                <div className="flex flex-col justify-between">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase">Correct Key</label>
                    <select className="w-full bg-black border border-white/10 p-4 rounded-xl text-white outline-none orbitron font-bold" value={adminFormData.correct_option} onChange={e => setAdminFormData({...adminFormData, correct_option: e.target.value})}>
                      <option value="A">OPTION A</option>
                      <option value="B">OPTION B</option>
                      <option value="C">OPTION C</option>
                    </select>
                  </div>
                  <div className="mt-8 flex flex-col gap-4">
                    {adminStatus.msg && <div className={`text-center p-3 rounded-xl text-xs font-black ${adminStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{adminStatus.msg}</div>}
                    <div className="flex gap-4">
                      <button type="submit" disabled={loading} className="flex-1 py-5 bg-cyan-600 rounded-2xl font-black orbitron hover:bg-cyan-500">{loading ? '...' : 'SAVE'}</button>
                      <button type="button" onClick={(e) => handleSubmit(e, true)} className="flex-1 py-5 bg-[#00FF41] text-black rounded-2xl font-black orbitron shadow-[0_0_20px_rgba(0,255,65,0.4)]">SAVE & ADD ANOTHER</button>
                    </div>
                  </div>
                </div>
              </form>
            </section>

            <section className="bg-white/5 p-10 rounded-[2.5rem] border border-white/10">
              <h3 className="orbitron text-center text-gray-500 mb-8 font-black uppercase">إدارة الأسئلة النشطة</h3>
              <div className="space-y-4">
                {adminQuestions.length > 0 ? (
                  adminQuestions.map(q => (
                    <div key={q.id} className="bg-black/40 p-6 rounded-[2rem] flex justify-between items-center border border-white/5 hover:border-cyan-500/30 transition-all duration-300">
                      <div className="flex-1 text-right">
                        <p className="font-bold text-lg text-white mb-4">{q.question_text}</p>
                        <div className="flex flex-wrap gap-3 justify-end">
                          {['A','B','C'].map(k => (
                            <div key={k} className={`px-4 py-2 rounded-xl text-[10px] font-bold border ${q.correct_option === k ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-black/30 border-white/5 text-gray-500'}`}>
                              {k}: {q['option_'+k.toLowerCase()]}
                            </div>
                          ))}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteQuestion(q.id)} 
                        className="mr-6 px-6 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl hover:bg-red-500 hover:text-white transition-all font-black text-xs orbitron"
                      >
                        DELETE
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-16 text-center text-gray-600 font-bold border-2 border-dashed border-white/5 rounded-[2.5rem]">
                    {loading ? 'جاري جلب البيانات...' : 'لا توجد أسئلة مضافة لهذا القطاع حالياً.'}
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

/**
 * MAIN COMPONENT: App
 * Handles game state, auth, and routing to admin.
 */
const App: React.FC = () => {
  const [isAdminRoute, setIsAdminRoute] = useState(window.location.hash === '#admin');
  const [gameState, setGameState] = useState<GameState>(GameState.LANDING);
  const [isPremium, setIsPremium] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [activeLevels, setActiveLevels] = useState(HARDCODED_LEVELS);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [levelIndex, setLevelIndex] = useState(0);
  const [ammo, setAmmo] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<{ type: 'success' | 'fail', message: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const handleHash = () => setIsAdminRoute(window.location.hash === '#admin');
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

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

  const syncQuestions = async (target: string | null) => {
    try {
      const cleanEmail = target?.trim().toLowerCase() || null;
      if (cleanEmail) {
        const { data: userQuestions, error: userError } = await supabase
          .from('custom_questions')
          .select('*')
          .eq('assigned_to_email', cleanEmail);
        
        if (!userError && userQuestions && userQuestions.length > 0) { 
          mapQuestionsToLevels(userQuestions); 
          return; 
        }
      }
      const { data: genQuestions, error: genError } = await supabase
        .from('custom_questions')
        .select('*')
        .is('assigned_to_email', null);
      
      if (!genError && genQuestions && genQuestions.length > 0) {
        mapQuestionsToLevels(genQuestions);
      } else {
        setActiveLevels(HARDCODED_LEVELS);
      }
    } catch (err) { 
      console.error("Sync Logic Error:", err);
      setActiveLevels(HARDCODED_LEVELS); 
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsPremium(!!session);
      setUserEmail(session?.user.email || null);
      syncQuestions(session?.user.email || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsPremium(!!session);
      setUserEmail(session?.user.email || null);
      syncQuestions(session?.user.email || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setAuthError(null);
    try {
      if (authMode === 'signup') {
        const { error, data } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) await supabase.from('profiles').insert([{ id: data.user.id, email: data.user.email }]);
        setShowAuthModal(false); setGameState(GameState.PRO_SUCCESS);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setShowAuthModal(false); setGameState(GameState.PRO_SUCCESS);
      }
    } catch (err: any) { setAuthError(err.message); }
    finally { setLoading(false); }
  };

  const startGame = () => {
    setScore(0); setLives(3); setLevelIndex(0); setAmmo(0);
    setGameState(GameState.BRIEFING);
  };

  if (isAdminRoute) return <AdminDashboard />;

  return (
    <div className="relative w-full h-screen bg-[#050510] text-white flex flex-col overflow-hidden text-right" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1a1a3a_0%,#050510_100%)] z-0"></div>
      
      {gameState === GameState.LANDING && (
        <div className="relative z-20 h-full w-full flex flex-col items-center justify-center p-6 text-center animate-fade-in pointer-events-auto">
          <div className="relative mb-12">
            <div className="absolute -inset-10 bg-cyan-500/10 blur-3xl rounded-full"></div>
            <h1 className="text-8xl md:text-[12rem] font-black orbitron text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-emerald-400 leading-none mb-2">9</h1>
            <h1 className="text-5xl md:text-7xl font-black orbitron text-white tracking-tighter">RA <span className="text-emerald-400">O</span> NCHT</h1>
            <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 to-transparent mt-2 rounded-full"></div>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-300 mb-16 max-w-2xl leading-relaxed">أول منصة تعليمية تجمع بين المغامرة والتحصيل الدراسي</h2>
          <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
            <button onClick={() => setGameState(GameState.INTRO)} className="flex-1 py-5 px-10 bg-white/5 border border-white/10 rounded-2xl text-xl font-bold hover:bg-white/10 transition-all active:scale-95 shadow-lg">النسخة المجانية</button>
            <button onClick={() => setShowAuthModal(true)} className="flex-1 py-5 px-10 bg-gradient-to-r from-cyan-600 to-blue-700 rounded-2xl text-xl font-black hover:from-cyan-500 hover:to-blue-600 transition-all active:scale-95 shadow-[0_0_30px_rgba(8,145,178,0.5)]">النسخة المدفوعة</button>
          </div>
          {showAuthModal && (
            <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" dir="ltr">
              <div className="bg-[#0a0a20] border border-cyan-500/30 w-full max-w-md rounded-[2.5rem] p-8 relative shadow-2xl">
                <button onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white text-2xl">✕</button>
                <h3 className="text-3xl font-black orbitron text-center mb-6 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">AUTH PORTAL</h3>
                <div className="flex bg-white/5 rounded-xl p-1 mb-8">
                  <button onClick={() => setAuthMode('signup')} className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${authMode === 'signup' ? 'bg-cyan-600 text-white' : 'text-gray-500'}`}>Signup</button>
                  <button onClick={() => setAuthMode('login')} className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${authMode === 'login' ? 'bg-cyan-600 text-white' : 'text-gray-500'}`}>Login</button>
                </div>
                <form onSubmit={handleAuth} className="space-y-4">
                  <input type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none focus:border-cyan-500 text-white" />
                  <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none focus:border-cyan-500 text-white" />
                  {authError && <p className="text-red-500 text-[10px] font-bold">{authError}</p>}
                  <button disabled={loading} className="w-full py-4 bg-cyan-600 rounded-xl font-black orbitron mt-4">{loading ? 'PROCESSING...' : 'CONFIRM LINK'}</button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
      {gameState === GameState.INTRO && (
        <div className="z-20 h-full w-full flex flex-col items-center justify-center p-4 text-center">
            <h1 className="text-7xl font-black orbitron mb-10">RA <span className="text-emerald-400">O</span> NCHT</h1>
            <div className="p-10 bg-black/40 border border-white/10 rounded-[3rem] backdrop-blur-md">
              <button onClick={startGame} className="px-16 py-5 bg-blue-600 rounded-2xl font-black orbitron text-3xl shadow-xl hover:bg-blue-500 active:scale-95 transition-all">START MISSION</button>
            </div>
        </div>
      )}
      {gameState === GameState.BRIEFING && <MissionBriefing level={levelIndex + 1} question={activeLevels[levelIndex].question} onEngage={() => setGameState(GameState.PLAYING)} />}
      {gameState === GameState.PLAYING && (
        <div className="relative w-full h-full flex flex-col z-10 pointer-events-auto">
          <HUD score={score} lives={lives} level={levelIndex + 1} question={activeLevels[levelIndex].question} ammo={ammo} onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)} isSettingsOpen={isSettingsOpen} />
          <div className="flex-1 w-full relative">
            <GameView levelData={activeLevels[levelIndex]} onCorrect={() => { setScore(s => s + 500); setLastFeedback({ type: 'success', message: 'ACCESS GRANTED' }); setTimeout(() => { setLastFeedback(null); if (levelIndex < activeLevels.length - 1) { setLevelIndex(i => i + 1); setGameState(GameState.BRIEFING); } else setGameState(GameState.RESULT); }, 2000); }} onIncorrect={() => { setLastFeedback({ type: 'fail', message: 'WRONG SECTOR' }); setTimeout(() => setLastFeedback(null), 1500); }} onEnemyHit={() => { setLives(l => { const next = l - 1; if (next <= 0) { setGameState(GameState.GAME_OVER); return 0; } return next; }); setLastFeedback({ type: 'fail', message: 'INTEGRITY FAIL' }); setTimeout(() => setLastFeedback(null), 1500); }} onAmmoChange={setAmmo} cameraMode={CameraMode.CHASE} />
          </div>
          {lastFeedback && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className={`px-16 py-10 rounded-[2.5rem] border-b-8 shadow-2xl animate-bounce ${lastFeedback.type === 'success' ? 'bg-green-600/30 border-green-500 text-green-400' : 'bg-red-600/30 border-red-500 text-red-400'}`}>
                <h2 className="text-6xl font-black orbitron uppercase">{lastFeedback.message}</h2>
              </div>
            </div>
          )}
        </div>
      )}
      {(gameState === GameState.RESULT || gameState === GameState.GAME_OVER) && (
        <div className="z-30 h-full w-full flex flex-col items-center justify-center bg-[#050510] p-10">
            <h1 className={`text-6xl md:text-8xl font-black mb-12 orbitron ${gameState === GameState.GAME_OVER ? 'text-red-500' : 'text-green-500'}`}>{gameState === GameState.GAME_OVER ? 'SYSTEM FAILURE' : 'MISSION COMPLETE'}</h1>
            <p className="text-4xl font-black orbitron mb-12">DATA ACQUIRED: {score.toString().padStart(6, '0')}</p>
            <button onClick={() => setGameState(GameState.LANDING)} className="px-16 py-5 bg-cyan-600 rounded-2xl font-black text-xl orbitron shadow-lg active:scale-95">RETURN TO BASE</button>
        </div>
      )}
      {gameState === GameState.PRO_SUCCESS && (
        <div className="z-30 h-full w-full flex flex-col items-center justify-center bg-[#050510] text-center p-10 animate-fade-in">
          <div className="mb-10 text-emerald-400"><svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
          <h1 className="text-5xl md:text-7xl font-black orbitron text-white mb-6">PRO STATUS ACTIVE</h1>
          <p className="text-xl text-gray-400 mb-12">تم تفعيل النسخة الاحترافية بنجاح. استمتع بمزايا التخصيص.</p>
          <button onClick={() => setGameState(GameState.INTRO)} className="px-20 py-5 bg-emerald-600 rounded-2xl font-black orbitron text-xl hover:bg-emerald-500 transition-all">ENTER SIMULATION</button>
        </div>
      )}
    </div>
  );
};

export default App;
