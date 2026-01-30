
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import GameView from './components/GameView';
import HUD from './components/HUD';
import MissionBriefing from './components/MissionBriefing';
import MissionTransition from './components/MissionTransition';
import { GameState, CameraMode } from './types';
import { LEVELS as HARDCODED_LEVELS } from './constants';
import { supabase } from './lib/supabase';

/**
 * MOCK DATA: طيارون وهميون لملء القائمة
 */
const MOCK_LEADERBOARD = [
  { email: 'CYBER_GHOST@INTERNAL', high_score: 28500 },
  { email: 'NEURAL_ACE@SYSTEM', high_score: 24200 },
  { email: 'ALPHA_STRIKER@CORE', high_score: 21900 },
  { email: 'VOID_RUNNER@SIM', high_score: 18550 },
  { email: 'Z_PILOT_99@HUB', high_score: 15400 },
  { email: 'KRYPTO_KING@NET', high_score: 12100 },
  { email: 'MATRIX_BOY@INTERNAL', high_score: 9800 },
  { email: 'OMEGA_POINT@SIM', high_score: 7600 },
  { email: 'DATA_SHARK@CORE', high_score: 5400 },
  { email: 'ROOKIE_X@HUB', high_score: 3200 },
];

/**
 * COMPONENT: AdminDashboard
 */
const AdminDashboard: React.FC = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [adminQuestions, setAdminQuestions] = useState<any[]>([]); 
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [activeAdminEmail, setActiveAdminEmail] = useState<string | null>(null);
  const [adminFormData, setAdminFormData] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    correct_option: 'A'
  });

  const fetchSidebarData = async () => {
    try {
      const { data: qData } = await supabase.from('custom_questions').select('*');
      if (qData) setAllQuestions(qData);
      const { data: pData } = await supabase.from('profiles').select('*');
      if (pData) setRegisteredUsers(pData);
    } catch (err) { console.error(err); }
  };

  const fetchTargetQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const cleanEmail = activeAdminEmail ? activeAdminEmail.trim().toLowerCase() : null;
      let query = supabase.from('custom_questions').select('*').order('created_at', { ascending: false });
      if (cleanEmail) query = query.eq('assigned_to_email', cleanEmail);
      else query = query.is('assigned_to_email', null);
      const { data, error } = await query;
      if (error) throw error;
      setAdminQuestions(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [activeAdminEmail]);

  useEffect(() => { if (isAdminLoggedIn) fetchSidebarData(); }, [isAdminLoggedIn]);
  useEffect(() => { if (isAdminLoggedIn) fetchTargetQuestions(); }, [activeAdminEmail, isAdminLoggedIn, fetchTargetQuestions]);

  const handleDeleteQuestion = async (id: number) => {
    if (!window.confirm("حذف السؤال؟")) return;
    setLoading(true);
    try {
      await supabase.from('custom_questions').delete().eq('id', id);
      setAdminQuestions(prev => prev.filter(q => q.id !== id));
      fetchSidebarData(); 
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const userList = useMemo(() => {
    const fromQuestions = allQuestions.map(q => String(q.assigned_to_email || '').trim().toLowerCase()).filter(Boolean);
    const fromProfiles = registeredUsers.map(p => String(p.email || '').trim().toLowerCase()).filter(Boolean);
    return Array.from(new Set([...fromProfiles, ...fromQuestions])).sort();
  }, [allQuestions, registeredUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const currentTarget = activeAdminEmail ? activeAdminEmail.trim().toLowerCase() : null;
    try {
      const { data: insertedData, error } = await supabase
        .from('custom_questions')
        .insert([{ ...adminFormData, assigned_to_email: currentTarget }])
        .select();
      if (error) throw error;
      if (insertedData) setAdminQuestions(prev => [insertedData[0], ...prev]);
      setAdminFormData({ question_text: '', option_a: '', option_b: '', option_c: '', correct_option: 'A' });
      fetchSidebarData();
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  if (!isAdminLoggedIn) {
    return (
      <div className="fixed inset-0 z-[500] bg-black flex items-center justify-center p-6" dir="rtl">
        <div className="bg-[#0a0a20] border border-cyan-500/30 p-12 rounded-[3rem] text-center w-full max-w-md shadow-2xl">
          <h2 className="text-2xl font-black text-white mb-8 orbitron tracking-tighter">MISSION ADMIN</h2>
          <input type="password" placeholder="SECURITY KEY" value={adminPassInput} onChange={e => setAdminPassInput(e.target.value)} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-center text-white mb-4 outline-none orbitron" />
          <button onClick={() => adminPassInput === 'ADMIN_9RA_2025' && setIsAdminLoggedIn(true)} className="w-full py-4 bg-cyan-600 rounded-xl font-bold orbitron">INITIALIZE ACCESS</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] bg-[#050510] flex flex-col p-6 overflow-y-auto" dir="rtl">
      <header className="flex justify-between items-center mb-8 p-6 bg-white/5 rounded-2xl border border-white/10">
        <h1 className="text-xl font-black orbitron">CORE SYSTEMS CONTROL</h1>
        <button onClick={() => window.location.hash = ''} className="px-6 py-2 bg-red-500/20 text-red-500 border border-red-500/40 rounded-full font-bold">DISCONNECT</button>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="bg-white/5 p-4 rounded-xl border border-white/10 h-fit">
          <h3 className="text-xs text-cyan-400 font-black mb-4 uppercase orbitron tracking-widest">Pilots Registry</h3>
          <div className="space-y-2">
            <button onClick={() => setActiveAdminEmail(null)} className={`w-full text-right p-3 rounded-lg text-sm orbitron ${activeAdminEmail === null ? 'bg-cyan-600' : 'bg-white/5 hover:bg-white/10'}`}>[ GLOBAL ]</button>
            {userList.map(ema => (
              <button key={ema} onClick={() => setActiveAdminEmail(ema)} className={`w-full text-right p-3 rounded-lg text-xs truncate ${activeAdminEmail === ema ? 'bg-purple-600' : 'bg-white/5 hover:bg-white/10'}`}>{ema}</button>
            ))}
          </div>
        </aside>
        <main className="lg:col-span-3 space-y-6">
          <form onSubmit={handleSubmit} className="bg-white/5 p-8 rounded-xl border border-white/10 space-y-4 shadow-xl">
            <h2 className="text-cyan-400 font-bold mb-4">إضافة سؤال جديد لنظام {activeAdminEmail || 'العالمي'}</h2>
            <textarea placeholder="نص السؤال الدراسي..." required className="w-full bg-black/40 p-4 rounded-xl border border-white/10 text-white outline-none min-h-[100px]" value={adminFormData.question_text} onChange={e => setAdminFormData({...adminFormData, question_text: e.target.value})} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input placeholder="خيار أ" required className="bg-white/5 p-3 rounded-lg border border-white/10 text-white" value={adminFormData.option_a} onChange={e => setAdminFormData({...adminFormData, option_a: e.target.value})} />
              <input placeholder="خيار ب" required className="bg-white/5 p-3 rounded-lg border border-white/10 text-white" value={adminFormData.option_b} onChange={e => setAdminFormData({...adminFormData, option_b: e.target.value})} />
              <input placeholder="خيار ج" required className="bg-white/5 p-3 rounded-lg border border-white/10 text-white" value={adminFormData.option_c} onChange={e => setAdminFormData({...adminFormData, option_c: e.target.value})} />
            </div>
            <div className="flex flex-col md:flex-row gap-4 pt-4">
              <select className="bg-black border border-white/10 p-3 rounded-lg text-white font-bold" value={adminFormData.correct_option} onChange={e => setAdminFormData({...adminFormData, correct_option: e.target.value})}>
                <option value="A">الخيار الصحيح: أ</option>
                <option value="B">الخيار الصحيح: ب</option>
                <option value="C">الخيار الصحيح: ج</option>
              </select>
              <button type="submit" disabled={loading} className="flex-1 bg-cyan-600 py-3 rounded-lg font-black orbitron shadow-lg shadow-cyan-900/20 active:scale-95 transition-all">UPLOAD DATA</button>
            </div>
          </form>
          <div className="grid grid-cols-1 gap-4">
            <h2 className="text-gray-500 text-xs font-black uppercase tracking-widest orbitron">Active Modules In This Sector</h2>
            {adminQuestions.length > 0 ? adminQuestions.map(q => (
              <div key={q.id} className="bg-white/5 p-5 rounded-xl border border-white/10 flex justify-between items-center group hover:border-cyan-500/40 transition-all">
                <div className="flex-1">
                  <p className="text-sm font-bold text-white mb-1">{q.question_text}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Correct: {q.correct_option}</p>
                </div>
                <button onClick={() => handleDeleteQuestion(q.id)} className="px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-black orbitron hover:bg-red-500 hover:text-white transition-all">PURGE</button>
              </div>
            )) : <div className="text-center py-20 text-gray-600 border-2 border-dashed border-white/5 rounded-3xl">No data detected in this sector.</div>}
          </div>
        </main>
      </div>
    </div>
  );
};

/**
 * MAIN APP
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
  const [cameraMode, setCameraMode] = useState<CameraMode>(CameraMode.CHASE);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Leaderboard logic
  const [leaderboard, setLeaderboard] = useState<any[]>(MOCK_LEADERBOARD);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState(MOCK_LEADERBOARD.length);

  const fetchGlobalStats = useCallback(async (currentUserEmail: string | null) => {
    try {
      // 1. جلب البيانات الحقيقية من Supabase
      const { data: board, error: boardError } = await supabase
        .from('profiles')
        .select('email, high_score')
        .order('high_score', { ascending: false })
        .limit(10);
      
      if (boardError) throw boardError;

      // 2. دمج البيانات الحقيقية مع الوهمية لضمان امتلاء القائمة
      const realData = board || [];
      const combined = [...realData, ...MOCK_LEADERBOARD]
        .sort((a, b) => b.high_score - a.high_score)
        .filter((v, i, a) => a.findIndex(t => (t.email === v.email)) === i) // إزالة التكرار
        .slice(0, 10);

      setLeaderboard(combined);
      
      const { count, error: countError } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      if (countError) throw countError;
      setTotalUsers((count || 0) + MOCK_LEADERBOARD.length);

      if (currentUserEmail) {
        // حساب الترتيب العالمي (مدمج)
        const { data: allScores } = await supabase.from('profiles').select('email, high_score').order('high_score', { ascending: false });
        const allCombined = [...(allScores || []), ...MOCK_LEADERBOARD].sort((a,b) => b.high_score - a.high_score);
        const rank = allCombined.findIndex(s => s.email?.toLowerCase() === currentUserEmail.toLowerCase()) ?? -1;
        setUserRank(rank !== -1 ? rank + 1 : null);
      }
    } catch (err) { 
      // في حال فشل الاتصال، نكتفي بالقائمة الوهمية
      setLeaderboard(MOCK_LEADERBOARD);
      setTotalUsers(MOCK_LEADERBOARD.length);
    }
  }, []);

  const syncQuestions = async (target: string | null) => {
    try {
      const cleanEmail = target?.trim().toLowerCase() || null;
      let query = supabase.from('custom_questions').select('*');
      if (cleanEmail) {
        const { data: userQ } = await query.eq('assigned_to_email', cleanEmail);
        if (userQ && userQ.length > 0) { 
          updateLevels(userQ); 
          return; 
        }
      }
      const { data: genQ } = await supabase.from('custom_questions').select('*').is('assigned_to_email', null);
      if (genQ && genQ.length > 0) updateLevels(genQ);
      else setActiveLevels(HARDCODED_LEVELS);
    } catch (err) { setActiveLevels(HARDCODED_LEVELS); }
  };

  const updateLevels = (qs: any[]) => {
    const mapped = qs.map((q, idx) => {
      const template = HARDCODED_LEVELS[idx % HARDCODED_LEVELS.length];
      return {
        ...template,
        question: q.question_text,
        options: [
          { text: q.option_a, isCorrect: q.correct_option === 'A', pos: template.options[0]?.pos || {x:1, y:1} },
          { text: q.option_b, isCorrect: q.correct_option === 'B', pos: template.options[1]?.pos || {x:13, y:1} },
          { text: q.option_c, isCorrect: q.correct_option === 'C', pos: template.options[2]?.pos || {x:7, y:9} },
        ].filter(o => o.text)
      };
    });
    setActiveLevels(mapped);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user.email || null;
      setIsPremium(!!session);
      setUserEmail(email);
      syncQuestions(email);
      fetchGlobalStats(email);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user.email || null;
      setIsPremium(!!session);
      setUserEmail(email);
      syncQuestions(email);
      fetchGlobalStats(email);
    });
    return () => subscription.unsubscribe();
  }, [fetchGlobalStats]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setAuthError(null);
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password });
        if (error) throw error;
      }
      setShowAuthModal(false); 
      setGameState(GameState.PRO_SUCCESS);
      fetchGlobalStats(email);
    } catch (err: any) { setAuthError(err.message); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setGameState(GameState.LANDING);
  };

  const onMissionEnd = async (isGameOver: boolean) => {
    if (isPremium && userEmail) {
      const { data: profile } = await supabase.from('profiles').select('high_score').eq('email', userEmail.toLowerCase()).single();
      if (score > (profile?.high_score || 0)) {
        await supabase.from('profiles').update({ high_score: score }).eq('email', userEmail.toLowerCase());
      }
    }
    await fetchGlobalStats(userEmail);
    setGameState(isGameOver ? GameState.GAME_OVER : GameState.RESULT);
  };

  if (isAdminRoute) return <AdminDashboard />;

  return (
    <div className="relative w-full h-screen bg-[#050510] text-white flex flex-col overflow-hidden text-right select-none" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1a1a3a_0%,#050510_100%)] z-0"></div>
      
      {isTransitioning && <MissionTransition />}

      {isPremium && (
        <button 
          onClick={handleLogout}
          className="fixed top-4 left-4 z-[400] px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-500 rounded-full text-[10px] font-black orbitron hover:bg-red-500 hover:text-white transition-all backdrop-blur-md"
        >
          LOGOUT SYSTEM
        </button>
      )}

      {gameState === GameState.LANDING && (
        <div className="relative z-20 h-full w-full flex flex-col items-center justify-center p-8 animate-fade-in">
          <h1 className="text-5xl md:text-7xl font-black orbitron text-white mb-2 tracking-tighter text-center">9RA O NCHT</h1>
          <h2 className="text-sm md:text-xl font-bold text-cyan-400 mb-12 max-w-lg text-center orbitron uppercase tracking-[0.3em]">Neural Learning Simulation</h2>
          
          <div className="flex flex-col items-center gap-8 w-full">
            <button 
              onClick={() => setGameState(GameState.INTRO)} 
              className="group relative py-8 px-20 bg-cyan-600 rounded-[2.5rem] font-black orbitron text-3xl shadow-[0_0_50px_rgba(0,210,255,0.4)] hover:scale-105 active:scale-95 transition-all text-white animate-pulse"
            >
              النسخة المجانية
              <div className="absolute inset-0 rounded-[2.5rem] bg-cyan-400/20 blur-xl opacity-0 group-hover:opacity-100"></div>
            </button>
            
            {!isPremium ? (
              <button 
                onClick={() => setShowAuthModal(true)} 
                className="group relative px-10 py-4 bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border border-cyan-500/40 rounded-2xl hover:scale-105 transition-all shadow-xl overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:animate-shimmer"></div>
                <div className="flex items-center gap-3 relative z-10">
                  <span className="bg-cyan-500 text-black text-[9px] font-black px-2 py-0.5 rounded orbitron">PRO</span>
                  <span className="text-cyan-400 text-sm font-black tracking-wide">النسخة المميزة للعباقرة</span>
                </div>
              </button>
            ) : (
              <div className="bg-white/5 border border-white/10 px-6 py-2 rounded-full backdrop-blur-md flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                <span className="text-emerald-400 text-xs font-bold orbitron uppercase">{userEmail?.split('@')[0]} : AUTHORIZED</span>
              </div>
            )}
          </div>

          {showAuthModal && (
            <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6" dir="ltr">
              <div className="bg-[#0a0a20] border border-cyan-500/30 w-full max-w-sm rounded-[2.5rem] p-8 relative shadow-2xl">
                <button onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 text-gray-500 text-xl hover:text-white">✕</button>
                <h3 className="text-xl font-black orbitron text-center mb-6 text-cyan-400 tracking-tighter uppercase">Neural Link Sync</h3>
                <div className="flex bg-white/5 rounded-xl p-1 mb-6">
                  <button onClick={() => setAuthMode('signup')} className={`flex-1 py-2 rounded-lg text-xs font-bold orbitron transition-all ${authMode === 'signup' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-400'}`}>REGISTER</button>
                  <button onClick={() => setAuthMode('login')} className={`flex-1 py-2 rounded-lg text-xs font-bold orbitron transition-all ${authMode === 'login' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-400'}`}>LOGIN</button>
                </div>
                <form onSubmit={handleAuth} className="space-y-4">
                  <input type="email" placeholder="NEURAL EMAIL" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:border-cyan-500 orbitron" />
                  <input type="password" placeholder="SECURE KEY" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm outline-none focus:border-cyan-500 orbitron" />
                  {authError && <p className="text-red-500 text-[10px] font-bold text-center animate-pulse">{authError}</p>}
                  <button disabled={loading} className="w-full py-5 bg-cyan-600 rounded-xl font-black orbitron text-white shadow-xl shadow-cyan-900/40 hover:bg-cyan-500 transition-all">{loading ? 'SYNCING...' : 'CONFIRM LINK'}</button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {gameState === GameState.INTRO && (
        <div className="z-20 h-full w-full flex flex-col items-center justify-center animate-fade-in p-8">
          <div className="max-w-md bg-black/40 border border-white/10 p-8 rounded-3xl text-center backdrop-blur-md mb-12">
            <h2 className="text-2xl font-black orbitron mb-4 text-cyan-400">MISSION ADVISORY</h2>
            <p className="text-sm text-gray-300 leading-relaxed mb-6">
              مرحباً بك أيها الطيار. هدفك هو فك شفرات الأسئلة الدراسية المفقودة في المتاهة. ابحث عن منطقة الإجابة الصحيحة وتجنب الحراس السايبورغ. 
              <br/><br/>
              استخدم السهام أو [WASD] للتحرك، والمسافة [SPACE] للإطلاق إذا كان لديك ذخيرة.
            </p>
          </div>
          <button onClick={() => setGameState(GameState.BRIEFING)} className="px-20 py-8 bg-cyan-600 rounded-full font-black orbitron text-2xl shadow-[0_0_40px_rgba(0,210,255,0.4)] animate-pulse">ENGAGE SIMULATION</button>
        </div>
      )}

      {gameState === GameState.BRIEFING && (
        <MissionBriefing 
          level={levelIndex + 1} 
          question={activeLevels[levelIndex]?.question || "..."} 
          onEngage={() => setGameState(GameState.PLAYING)} 
        />
      )}

      {gameState === GameState.PLAYING && (
        <div className="relative w-full h-full flex flex-col z-10">
          <HUD 
            score={score} lives={lives} level={levelIndex + 1} 
            question={activeLevels[levelIndex]?.question || "..."} 
            ammo={ammo} onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)} 
            isSettingsOpen={isSettingsOpen} cameraMode={cameraMode}
            onCameraModeChange={setCameraMode}
          />
          <div className="flex-1 w-full relative">
            <GameView 
              levelData={activeLevels[levelIndex]} 
              isTransitioning={isTransitioning}
              cameraMode={cameraMode}
              onAmmoChange={setAmmo}
              onCorrect={() => {
                setScore(s => s + 500); setLastFeedback({ type: 'success', message: 'DATA RECOVERED' });
                setTimeout(() => {
                  setLastFeedback(null);
                  if (levelIndex < activeLevels.length - 1) { 
                    setLevelIndex(l => l + 1); setGameState(GameState.BRIEFING); 
                  } else { 
                    onMissionEnd(false); 
                  }
                }, 2000);
              }}
              onIncorrect={() => { setLastFeedback({ type: 'fail', message: 'WRONG SECTOR' }); setTimeout(() => setLastFeedback(null), 1500); }}
              onEnemyHit={() => {
                setLives(l => {
                  const n = l - 1;
                  if (n <= 0) { onMissionEnd(true); return 0; }
                  return n;
                });
                setLastFeedback({ type: 'fail', message: 'SHIELD COLLAPSE' });
                setTimeout(() => setLastFeedback(null), 1500);
              }}
            />
          </div>
          {lastFeedback && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-none transition-all duration-300">
              <div className={`px-16 py-10 rounded-[3rem] border-b-8 shadow-2xl animate-bounce ${lastFeedback.type === 'success' ? 'bg-emerald-600/30 border-emerald-500 text-emerald-400' : 'bg-red-600/30 border-red-500 text-red-400'}`}>
                <h2 className="text-4xl md:text-6xl font-black orbitron uppercase tracking-widest">{lastFeedback.message}</h2>
              </div>
            </div>
          )}
        </div>
      )}

      {(gameState === GameState.RESULT || gameState === GameState.GAME_OVER) && (
        <div className="z-30 h-full w-full flex flex-col items-center justify-start bg-[#050510] p-8 text-center overflow-y-auto pt-[10vh] animate-fade-in custom-scrollbar pb-20">
          <h1 className={`text-5xl md:text-7xl font-black orbitron mb-6 ${gameState === GameState.GAME_OVER ? 'text-red-500' : 'text-emerald-500'}`}>
            {gameState === GameState.GAME_OVER ? 'SYSTEM FAILURE' : 'MISSION COMPLETE'}
          </h1>
          
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 w-full max-w-2xl mb-10 shadow-2xl backdrop-blur-xl">
            <p className="text-7xl font-black orbitron text-white mb-2 tracking-tighter">{score.toString().padStart(6, '0')}</p>
            <p className="text-cyan-400 font-bold mb-8 orbitron text-xs tracking-[0.5em] uppercase">Total Credits Recovered</p>
            
            <div className="space-y-4 text-gray-300 font-bold text-sm leading-relaxed border-t border-white/10 pt-8">
              <p className="text-white text-xl orbitron">PILOT STANDING</p>
              <p className="text-cyan-400 text-lg uppercase tracking-wider">{userRank ? `GLOBAL RANK: #${userRank} / ${totalUsers}` : 'ANALYZING PERFORMANCE...'}</p>
            </div>
          </div>

          <div className="w-full max-w-2xl bg-black/40 border border-white/10 rounded-[3rem] p-8 mb-10 shadow-xl overflow-hidden relative">
            <h3 className="text-cyan-400 font-black orbitron text-[10px] mb-8 uppercase tracking-[0.6em] opacity-80">Global Hall of Fame</h3>
            
            <div className="space-y-4">
              {leaderboard.map((u, i) => (
                <div key={i} className={`flex justify-between items-center p-6 rounded-[1.5rem] border transition-all duration-500 ${u.email?.toLowerCase() === userEmail?.toLowerCase() ? 'bg-cyan-500/20 border-cyan-500 scale-105 shadow-[0_0_20px_rgba(0,210,255,0.2)]' : 'bg-white/5 border-white/5'}`}>
                  <div className="flex items-center gap-6">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center orbitron font-black text-xl ${i === 0 ? 'bg-yellow-400 text-black shadow-[0_0_10px_rgba(250,204,21,0.4)]' : i === 1 ? 'bg-gray-300 text-black' : i === 2 ? 'bg-orange-500 text-black' : 'text-gray-500'}`}>
                      {i + 1}
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-sm md:text-base font-bold orbitron uppercase tracking-tighter text-white">
                        {u.email.split('@')[0]}
                      </span>
                      {u.email.includes('@') && u.email.split('@')[1] === 'SYSTEM' && (
                        <span className="text-[6px] text-cyan-400 font-black orbitron opacity-50">SIMULATED ENTITY</span>
                      )}
                    </div>
                  </div>
                  <span className="orbitron font-black text-cyan-400 text-xl tracking-tighter">{u.high_score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => setGameState(GameState.LANDING)} className="px-24 py-7 bg-cyan-600 rounded-[2rem] font-black orbitron text-white shadow-[0_0_40px_rgba(0,210,255,0.4)] hover:bg-cyan-500 transition-all mb-20 active:scale-95 group relative overflow-hidden">
            <span className="relative z-10">REBOOT HUB</span>
          </button>
        </div>
      )}

      {gameState === GameState.PRO_SUCCESS && (
        <div className="z-30 h-full w-full flex flex-col items-center justify-center bg-[#050510] p-8 text-center animate-fade-in">
          <div className="w-32 h-32 bg-emerald-500/20 border-4 border-emerald-500 text-emerald-500 rounded-full flex items-center justify-center mb-10 animate-bounce shadow-[0_0_50px_rgba(16,185,129,0.3)]">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h1 className="text-5xl font-black orbitron text-white mb-4 tracking-tighter">DATA LINK ESTABLISHED</h1>
          <p className="text-gray-400 mb-10 max-w-sm font-bold leading-relaxed">أهلاً بك أيها العبقري. بصمتك الرقمية أصبحت جزءاً من النظام الآن. سيتم تسجيل كل إنجازاتك في لوحة الشرف.</p>
          <button onClick={() => setGameState(GameState.INTRO)} className="px-20 py-6 bg-emerald-600 rounded-2xl font-black orbitron text-white shadow-2xl hover:bg-emerald-500 transition-all active:scale-95">PROCEED TO HUB</button>
        </div>
      )}
    </div>
  );
};

export default App;
