
import React, { useState, useCallback, useEffect } from 'react';
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

  // SMART FETCH LOGIC
  const syncCustomQuestions = async (targetEmail: string | null) => {
    try {
      let query = supabase.from('custom_questions').select('*');
      
      // Step A & B: Check for specific user questions
      if (targetEmail) {
        const { data: userQuestions, error: userError } = await query.eq('assigned_to_email', targetEmail);
        if (!userError && userQuestions && userQuestions.length > 0) {
          mapQuestionsToLevels(userQuestions);
          return;
        }
      }

      // Step C: Result empty? Fetch general questions (assigned_to_email is NULL)
      const { data: generalQuestions, error: genError } = await supabase
        .from('custom_questions')
        .select('*')
        .is('assigned_to_email', null);
      
      if (!genError && generalQuestions && generalQuestions.length > 0) {
        mapQuestionsToLevels(generalQuestions);
      } else {
        // Fallback to defaults if DB is totally empty
        setActiveLevels(HARDCODED_LEVELS);
      }
    } catch (err) {
      console.error("Critical: Smart Fetch Failure", err);
      setActiveLevels(HARDCODED_LEVELS);
    }
  };

  const mapQuestionsToLevels = (questions: any[]) => {
    // Map DB rows to the structure needed by GameView
    const mapped = questions.map((q, idx) => {
      // Use templates from HARDCODED_LEVELS to ensure maze/enemies are valid
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

  // Check for existing session on mount
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
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setIsPremium(true);
        setShowAuthModal(false);
        setGameState(GameState.PRO_SUCCESS);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
            <button 
              onClick={() => { setIsPremium(false); setGameState(GameState.INTRO); }}
              className="flex-1 py-5 px-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xl font-bold group"
            >
              <span className="text-gray-400 block text-xs uppercase tracking-widest mb-1">ابدأ الآن</span>
              النسخة المجانية
              <span className="block text-[10px] text-gray-500 mt-1 uppercase">Limited to 5 sectors</span>
            </button>
            
            <button 
              onClick={() => setShowAuthModal(true)}
              className="flex-1 py-5 px-8 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 transition-all text-xl font-black shadow-[0_0_30px_rgba(8,145,178,0.4)] relative overflow-hidden group"
            >
               <div className="absolute top-0 left-0 p-1">
                 <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
               </div>
               <span className="text-cyan-200 block text-xs uppercase tracking-widest mb-1">بريميوم</span>
               النسخة المدفوعة
               <span className="block text-[10px] text-cyan-100/60 mt-1 uppercase">Unlimited access</span>
            </button>
          </div>

          <div className="absolute bottom-8 left-8 flex items-center gap-3 text-cyan-400/60 animate-pulse">
            <svg className="w-6 h-6 animate-[rotate-phone_4s_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
            <p className="text-[10px] font-bold uppercase tracking-tighter">ينصح بالوضع الأفقي</p>
          </div>

          {/* Auth Modal Integrates Supabase */}
          {showAuthModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" dir="ltr">
              <div className="bg-[#0a0a20] border border-cyan-500/30 w-full max-w-md rounded-[2.5rem] p-8 shadow-[0_0_100px_rgba(0,255,255,0.15)] relative overflow-hidden animate-fade-in">
                <button onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l18 18"></path></svg>
                </button>
                
                <h3 className="text-3xl font-black font-['Orbitron'] text-center mb-4 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 uppercase tracking-widest">
                  {authMode === 'signup' ? 'Access Portal' : 'Login Protocol'}
                </h3>

                <div className="flex bg-white/5 rounded-xl p-1 mb-6">
                  <button 
                    onClick={() => setAuthMode('signup')}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all ${authMode === 'signup' ? 'bg-cyan-600 text-white' : 'text-gray-500'}`}
                  >Register</button>
                  <button 
                    onClick={() => setAuthMode('login')}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all ${authMode === 'login' ? 'bg-cyan-600 text-white' : 'text-gray-500'}`}
                  >Login</button>
                </div>

                <form onSubmit={handleAuth} className="space-y-4 mb-6 text-left">
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-cyan-500 outline-none transition-all" 
                  />
                  <input 
                    type="password" 
                    placeholder="Password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-cyan-500 outline-none transition-all" 
                  />
                  {authError && <p className="text-red-500 text-xs font-bold text-center">{authError}</p>}
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-xl font-black text-lg shadow-lg transition-all"
                  >
                    {loading ? 'PROCESSING...' : (authMode === 'signup' ? 'CREATE ACCOUNT' : 'AUTHENTICATE')}
                  </button>
                </form>

                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-4">للاشتراك وتفعيل الحساب، راسلنا عبر الواتساب</p>
                  <a 
                    href="https://wa.me/212708876825" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 rounded-full hover:bg-emerald-600 hover:text-white transition-all text-sm font-bold"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.672 1.433 5.661 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Chat with Activation Center
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRO ACCESS ENABLED SCREEN */}
      {gameState === GameState.PRO_SUCCESS && (
        <div className="z-10 h-full w-full flex flex-col items-center justify-center animate-fade-in p-6 text-center bg-[#050510]">
          <div className="relative mb-8 transform scale-110">
            <div className="absolute -inset-10 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
            <h1 className="text-6xl md:text-8xl font-black font-['Orbitron'] bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500">
              PRO ACCESS ENABLED
            </h1>
          </div>

          <p className="text-xl md:text-2xl font-bold text-gray-300 mb-12 max-w-2xl leading-relaxed">
            تم تفعيل عضويتك الذهبية بنجاح! يمكنك الآن الوصول إلى كافة المستويات وتحميل دروسك الخاصة.
          </p>

          <div className="flex flex-col gap-6 w-full max-w-md">
            <a 
              href="https://wa.me/212708876825" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 rounded-3xl font-black text-3xl shadow-[0_0_40px_rgba(16,185,129,0.4)] transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-4 border-2 border-emerald-400/30"
            >
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.672 1.433 5.661 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              حمل دروسك
            </a>

            <button 
              onClick={() => setGameState(GameState.INTRO)}
              className="w-full py-5 bg-white/5 border border-white/20 hover:bg-white/10 rounded-2xl font-black text-xl uppercase tracking-widest transition-all"
            >
              دخول المحاكاة
            </button>
          </div>
        </div>
      )}

      {/* 2. INTRO SCREEN (START BUTTON) */}
      {gameState === GameState.INTRO && (
        <div className="z-10 h-full w-full flex flex-col items-center justify-start lg:justify-center animate-fade-in p-4 overflow-y-auto">
          <div className="flex flex-col items-center w-full max-w-4xl py-8">
            <div className="relative group mb-4 flex flex-col items-center">
              <div className="absolute -inset-6 bg-gradient-to-r from-cyan-600 via-blue-500 to-emerald-400 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <div className="relative flex items-center gap-2 md:gap-4 flex-row-reverse">
                 <span className="text-7xl md:text-[8rem] lg:text-[10rem] font-black font-['Orbitron'] text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 via-blue-500 to-cyan-300 drop-shadow-[0_0_25px_rgba(34,211,238,0.5)] leading-none">9</span>
                 <div className="flex flex-col -ml-1 md:-ml-2 text-right">
                   <h1 className="text-3xl md:text-5xl lg:text-7xl font-black text-white font-['Orbitron'] tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] uppercase">
                     RA <span className="text-emerald-400">O</span> NCHT
                   </h1>
                   <div className="h-1 md:h-1.5 w-full bg-gradient-to-r from-cyan-500 via-blue-400 to-emerald-500 rounded-full mt-1"></div>
                 </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 mb-6 text-center animate-pulse w-full">
              <div className="flex items-center gap-3 text-cyan-400 bg-cyan-400/5 px-6 py-2 rounded-xl border border-cyan-400/20 backdrop-blur-sm">
                 <svg className="w-6 h-6 animate-[rotate-phone_3s_ease-in-out_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                 <p className="text-[12px] md:text-base font-bold tracking-wide">من أجل تجربة مميزة، قم بجعل الهاتف بوضع أفقي</p>
              </div>
            </div>
            
            <div className="w-full max-w-lg bg-black/60 backdrop-blur-2xl border border-white/10 p-6 md:p-8 rounded-[2rem] shadow-[0_25px_60px_rgba(0,0,0,0.6)] text-center relative overflow-hidden">
              <p className="text-[#4a90e2] text-[10px] md:text-xs font-black tracking-[0.2em] uppercase mb-2 md:mb-4">
                {isPremium ? 'PRO ACCESS ENABLED' : 'FREE TRIAL ACTIVE'}
              </p>
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
          question={activeLevels[levelIndex].question} 
          onEngage={engageMission} 
        />
      )}

      {gameState === GameState.PLAYING && (
        <div className="relative w-full h-full flex flex-col z-10">
          <div className="absolute top-4 left-4 z-50 flex gap-3 pointer-events-auto">
            <button 
              onClick={() => setGameState(GameState.LANDING)}
              title="Abort Mission"
              className="w-10 h-10 flex items-center justify-center bg-red-950/20 border border-red-500/30 text-red-500 rounded-full hover:bg-red-600 hover:text-white hover:border-red-400 transition-all active:scale-90 shadow-[0_0_15px_rgba(239,68,68,0.2)] backdrop-blur-md"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <HUD 
            score={score} 
            lives={lives} 
            level={levelIndex + 1} 
            question={activeLevels[levelIndex].question} 
            ammo={ammo}
            onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
            isSettingsOpen={isSettingsOpen}
          />

          {isSettingsOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
              <div className="w-72 bg-black/95 border-2 border-blue-500/50 rounded-[2rem] backdrop-blur-2xl p-6 shadow-[0_0_60px_rgba(59,130,246,0.3)] animate-fade-in pointer-events-auto">
                <h3 className="text-blue-400 text-[10px] font-black tracking-[0.3em] uppercase mb-6 text-center border-b border-white/10 pb-3">Vision Protocols</h3>
                <div className="flex flex-col gap-3">
                  {[
                    { id: CameraMode.CHASE, label: 'Chase Cam', desc: 'Tactical Precision' },
                    { id: CameraMode.FIELD, label: 'Field Array', desc: 'Strategic Overview' },
                    { id: CameraMode.MOBILE, label: 'Visual Fit', desc: 'Landscape Optimization' }
                  ].map(mode => (
                    <button 
                      key={mode.id}
                      onClick={() => { setCameraMode(mode.id); setIsSettingsOpen(false); }}
                      className={`flex flex-col items-start p-4 rounded-2xl transition-all border-2 ${cameraMode === mode.id ? 'bg-blue-600/30 border-blue-400 text-white shadow-inner' : 'hover:bg-white/5 border-transparent text-gray-400'}`}
                    >
                      <span className="text-sm font-black font-['Orbitron'] tracking-tighter uppercase">{mode.label}</span>
                      <span className="text-[9px] opacity-60 uppercase tracking-widest">{mode.desc}</span>
                    </button>
                  ))}
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="mt-4 w-full py-2 text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-[0.2em] transition-colors"
                  >
                    Close Array
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 w-full relative">
            <GameView 
              levelData={activeLevels[levelIndex]} 
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
              {gameState === GameState.GAME_OVER ? 'SYSTEM FAILURE' : 'MISSION COMPLETE'}
            </h1>
            
            <div className="mb-12">
              <p className="text-gray-400 text-sm uppercase tracking-[0.4em] mb-2">Final Data Score</p>
              <p className="text-6xl md:text-8xl font-black text-white font-['Orbitron']">{score.toString().padStart(6, '0')}</p>
            </div>

            <div className="flex flex-col md:flex-row gap-6 justify-center">
              <button 
                onClick={startGame}
                className="px-12 py-4 bg-cyan-600 hover:bg-cyan-500 rounded-2xl font-black text-xl transition-all shadow-[0_0_30px_rgba(0,210,255,0.3)]"
              >
                REINITIALIZE
              </button>
              <button 
                onClick={() => setGameState(GameState.LANDING)}
                className="px-12 py-4 bg-white/5 border border-white/10 hover:bg-white/20 rounded-2xl font-black text-xl transition-all"
              >
                EXIT TO BASE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Added missing default export to fix "Module has no default export" error in index.tsx
export default App;
