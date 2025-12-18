import React, { useState, useEffect } from 'react';
import { AppState } from './types.ts';
import ReadingModule from './components/modules/ReadingModule.tsx';
import ListeningModule from './components/modules/ListeningModule.tsx';
import WritingModule from './components/modules/WritingModule.tsx';
import SpeakingModule from './components/modules/SpeakingModule.tsx';
import { submitTestResults } from './services/submissionService.ts';
import { generateReadingTest, preloadListeningTest, generateWritingTask, generateSpeakingTask } from './services/geminiService.ts';
import { BookOpen, Headphones, PenTool, Mic, Award, RotateCcw, ArrowRight, Star, Sparkles, User, Phone, Globe, Lightbulb, Loader2, AlertCircle } from 'lucide-react';

const App = () => {
  const [state, setState] = useState<AppState>(AppState.HOME);
  const [scores, setScores] = useState({
    reading: 0,
    listening: 0,
    writing: 0,
    speaking: 0
  });
  const [userDetails, setUserDetails] = useState({
    name: '',
    phone: '',
    language: 'Malayalam'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // --- PRELOADING STATE ---
  const [preloadedReading, setPreloadedReading] = useState<any>(null);
  const [preloadedListening, setPreloadedListening] = useState<any>(null);
  const [preloadedWriting, setPreloadedWriting] = useState<any>(null);
  const [preloadedSpeaking, setPreloadedSpeaking] = useState<any>(null);

  // --- PRELOADING LOGIC ---
  useEffect(() => {
    if (state === AppState.HOME && !preloadedReading) {
      generateReadingTest().then(setPreloadedReading).catch(e => console.error("BG Load Reading Failed", e));
    }
    if (state === AppState.TEST_READING && !preloadedListening) {
      preloadListeningTest().then(setPreloadedListening).catch(e => console.error("BG Load Listening Failed", e));
    }
    if (state === AppState.TEST_LISTENING && !preloadedWriting) {
      generateWritingTask().then(setPreloadedWriting).catch(e => console.error("BG Load Writing Failed", e));
    }
    if (state === AppState.TEST_WRITING && !preloadedSpeaking) {
      generateSpeakingTask().then(setPreloadedSpeaking).catch(e => console.error("BG Load Speaking Failed", e));
    }
  }, [state, preloadedReading, preloadedListening, preloadedWriting, preloadedSpeaking]);

  const updateScore = (module: keyof typeof scores, score: number) => {
    setScores(prev => ({ ...prev, [module]: score }));
    if (module === 'reading') setState(AppState.TEST_LISTENING);
    if (module === 'listening') setState(AppState.TEST_WRITING);
    if (module === 'writing') setState(AppState.TEST_SPEAKING);
    if (module === 'speaking') setState(AppState.USER_DETAILS_FORM);
  };

  const getAverageScore = () => {
    return Math.round((scores.reading + scores.listening + scores.writing + scores.speaking) / 4);
  };

  const getExamTips = (score: number) => {
    if (score >= 90) {
      return {
        title: "Ready for the Exam! (Sehr Gut)",
        content: "Your performance is outstanding! You are well-prepared for the real A1 exam. To ensure a perfect score, double-check article genders (der/die/das) and read every question carefully to avoid silly mistakes. Viel Glück!",
        color: "text-green-800",
        bg: "bg-green-50",
        border: "border-green-200",
        iconColor: "text-green-600"
      };
    } else if (score >= 80) {
      return {
        title: "Very Good Performance (Gut)",
        content: "You have a solid grasp of the basics. To push for 100%, review plural forms and irregular verb conjugations. Practice speaking aloud to improve your confidence and fluency. You're doing great!",
        color: "text-blue-800",
        bg: "bg-blue-50",
        border: "border-blue-200",
        iconColor: "text-blue-600"
      };
    } else if (score >= 60) {
      return {
        title: "Good Start - Keep Practicing (Befriedigend)",
        content: "You are passing, but there's room for improvement. Focus on the 'Akkusativ' case and modal verbs (können, wollen, müssen). Try listening to German radio or podcasts to get used to the speed of native speakers.",
        color: "text-yellow-800",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        iconColor: "text-yellow-600"
      };
    } else {
      return {
        title: "Needs More Preparation (Ausreichend)",
        content: "Don't be discouraged! Focus on building your daily vocabulary (numbers, days, family members) and basic sentence structure. Regular practice with flashcards and repeating audio exercises will help immensely. You can do this!",
        color: "text-red-800",
        bg: "bg-red-50",
        border: "border-red-200",
        iconColor: "text-red-600"
      };
    }
  };

  useEffect(() => {
    if (state === AppState.RESULTS) {
      const duration = 3000;
      const end = Date.now() + duration;
      const frame = () => {
        (window as any).confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#2563eb', '#9333ea', '#db2777']
        });
        (window as any).confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#2563eb', '#9333ea', '#db2777']
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [state]);

  const validatePhone = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) return "Phone number must be exactly 10 digits.";
    if (cleanPhone.startsWith('0')) return "Phone number cannot start with 0.";
    const blockList = ['1234567890', '9876543210', '0123456789'];
    if (blockList.includes(cleanPhone)) return "Please enter a valid, real phone number.";
    if (/^(\d)\1+$/.test(cleanPhone)) return "Please enter a valid phone number (not repeated digits).";
    return null;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!userDetails.name.trim()) {
      setFormError("Please enter your full name.");
      return;
    }
    const phoneError = validatePhone(userDetails.phone);
    if (phoneError) {
      setFormError(phoneError);
      return;
    }
    if (userDetails.name && userDetails.phone) {
      setIsSubmitting(true);
      const average = getAverageScore();
      const submissionData = {
        name: userDetails.name,
        phone: userDetails.phone,
        language: userDetails.language,
        readingScore: Math.round(scores.reading),
        listeningScore: Math.round(scores.listening),
        writingScore: Math.round(scores.writing),
        speakingScore: Math.round(scores.speaking),
        averageScore: average,
        timestamp: new Date().toLocaleString()
      };
      await submitTestResults(submissionData);
      setIsSubmitting(false);
      setState(AppState.RESULTS);
    }
  };

  const renderContent = () => {
    switch (state) {
      case AppState.HOME:
        return (
          <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-60">
              <div className="absolute top-0 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
              <div className="absolute top-0 right-10 w-72 h-72 bg-brand-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
              <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full max-w-7xl mx-auto py-12 px-4 lg:px-8">
              <div className="space-y-8 animate-fade-in-up z-10 text-center lg:text-left">
                <div className="flex flex-col items-center lg:items-start gap-4">
                  <div className="flex flex-col items-center lg:items-start space-y-1">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Powered by</span>
                      <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm p-2 pr-4 rounded-xl border border-white/50 shadow-sm transition-transform hover:scale-105">
                          <div className="w-8 h-8 bg-[#2563eb] rounded-md flex items-center justify-center shadow-sm relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-700"></div>
                              <div className="relative flex items-center justify-center z-10">
                                <span className="text-white font-black text-lg leading-none pt-0.5 ml-0.5 font-sans">E</span>
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white"><path d="M8 5v14l11-7z" /></svg>
                              </div>
                          </div>
                          <span className="text-xl font-bold text-[#2563eb] tracking-tight font-sans">german</span>
                      </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <div className="w-3 h-3 rounded-full bg-gray-900 animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-3 h-3 rounded-full bg-red-600 animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500 animate-bounce"></div>
                  </div>
                </div>
                <h1 className="text-5xl lg:text-7xl font-extrabold text-gray-900 leading-tight tracking-tight">
                  Test Your <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-purple-600">
                    German A1 Proficiency
                  </span>
                  <div className="mt-6 flex flex-row items-center justify-center lg:justify-start gap-3">
                     <div className="bg-white p-2 rounded-xl shadow-md animate-bounce">
                         <Sparkles className="w-6 h-6 text-brand-500" />
                     </div>
                     <span className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-brand-600 via-purple-500 to-brand-600 bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
                       Quick AI Assessment
                     </span>
                  </div>
                </h1>
                <p className="text-xl text-gray-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  Prepare with confidence using our comprehensive mock test. 
                  We simulate the real exam structure for Reading, Listening, Writing, and Speaking using advanced AI to grade you instantly.
                </p>
                <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 justify-center lg:justify-start">
                  <button
                    onClick={() => setState(AppState.TEST_READING)}
                    className="group relative px-8 py-4 bg-brand-600 text-white text-lg font-bold rounded-full shadow-xl hover:bg-brand-700 transition-all hover:scale-105 hover:shadow-2xl overflow-hidden w-full sm:w-auto"
                  >
                    <span className="relative z-10 flex items-center justify-center space-x-2">
                      <span>Start Mock Test</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </button>
                </div>
              </div>
              <div className="relative animate-fade-in-up delay-200 hidden lg:block h-[500px]">
                {/* @ts-ignore */}
                <lottie-player
                  src="https://lottie.host/56722238-d636-4d22-9200-a885d590453e/Z7b84236e2.json"
                  background="transparent"
                  speed="1"
                  loop
                  autoplay
                  class="w-full h-full drop-shadow-2xl"
                ></lottie-player>
                 <div className="absolute -z-10 inset-10 bg-gradient-to-tr from-brand-100 to-purple-100 rounded-full blur-3xl opacity-50"></div>
              </div>
            </div>
            <div className="max-w-7xl mx-auto px-4 lg:px-8 pb-12 w-full mt-10">
               <p className="text-center text-gray-400 font-medium uppercase tracking-widest text-sm mb-8">What's included in the test</p>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: BookOpen, label: 'Lesen (Reading)', desc: 'Comprehension of texts & emails', color: 'text-blue-500', bg: 'bg-blue-50' },
                  { icon: Headphones, label: 'Hören (Listening)', desc: 'Understanding dialogues & announcements', color: 'text-purple-500', bg: 'bg-purple-50' },
                  { icon: PenTool, label: 'Schreiben (Writing)', desc: 'Form filling & short messages', color: 'text-pink-500', bg: 'bg-pink-50' },
                  { icon: Mic, label: 'Sprechen (Speaking)', desc: 'Self-introduction & conversation', color: 'text-orange-500', bg: 'bg-orange-50' }
                ].map((item, i) => (
                  <div key={i} className="group bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default">
                    <div className={`w-12 h-12 ${item.bg} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <item.icon className={`w-6 h-6 ${item.color}`} />
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">{item.label}</h3>
                    <p className="text-gray-500 text-sm">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case AppState.TEST_READING:
        return <ReadingModule preloadedData={preloadedReading} onComplete={(s) => updateScore('reading', s)} />;
      case AppState.TEST_LISTENING:
        return <ListeningModule preloadedData={preloadedListening} onComplete={(s) => updateScore('listening', s)} />;
      case AppState.TEST_WRITING:
        return <WritingModule preloadedTask={preloadedWriting} onComplete={(s) => updateScore('writing', s)} />;
      case AppState.TEST_SPEAKING:
        return <SpeakingModule preloadedTask={preloadedSpeaking} onComplete={(s) => updateScore('speaking', s)} />;
      case AppState.USER_DETAILS_FORM:
        return (
          <div className="min-h-[600px] flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white p-8 rounded-2xl shadow-xl border border-gray-100 animate-fade-in-up">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600">
                  <User className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Final Step</h2>
                <p className="text-gray-600 mt-2">Enter your details to generate your score report.</p>
              </div>
              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={userDetails.name}
                    onChange={(e) => {
                       setUserDetails({ ...userDetails, name: e.target.value });
                       setFormError(null);
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                    placeholder="Enter your full name"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={userDetails.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 15) setUserDetails({ ...userDetails, phone: val });
                      setFormError(null);
                    }}
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-brand-500 outline-none transition-all ${formError && formError.includes('Phone') ? 'border-red-500 bg-red-50 focus:border-red-500' : 'border-gray-300 focus:border-brand-500'}`}
                    placeholder="Enter 10-digit phone number"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Preferred Language
                  </label>
                  <select
                    value={userDetails.language}
                    onChange={(e) => setUserDetails({ ...userDetails, language: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all bg-white"
                    disabled={isSubmitting}
                  >
                    <option value="Malayalam">Malayalam</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm animate-fade-in-up">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 mt-4 flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Generating Report...</span>
                    </>
                  ) : (
                    <span>View My Results</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        );
      case AppState.RESULTS:
        const average = getAverageScore();
        const tips = getExamTips(average);
        return (
          <div className="flex flex-col items-center max-w-2xl mx-auto space-y-8 animate-fade-in py-10 relative px-4">
            <div className="text-center space-y-4 mb-8">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-yellow-100 rounded-full animate-ping opacity-20"></div>
                <Award className="w-24 h-24 text-yellow-500 relative z-10 drop-shadow-lg" />
              </div>
              <div>
                <h2 className="text-4xl font-extrabold text-gray-900">Herzlichen Glückwunsch, <br/><span className="text-brand-600">{userDetails.name}</span>!</h2>
                <p className="text-lg text-gray-600 mt-2">You have completed the full A1 Mock Test.</p>
              </div>
            </div>
            <div className="w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-100 transform hover:scale-[1.01] transition-transform duration-500">
               <div className="flex flex-col md:flex-row justify-between items-center mb-8 pb-8 border-b border-gray-100">
                  <div className="text-center md:text-left mb-4 md:mb-0">
                    <span className="block text-gray-500 text-sm font-semibold uppercase tracking-wider">Overall Score</span>
                    <span className="text-3xl font-bold text-gray-800">Gesamtnote</span>
                  </div>
                  <div className={`flex items-center justify-center w-32 h-32 rounded-full border-8 ${average >= 60 ? 'border-green-500 text-green-600 bg-green-50' : 'border-red-500 text-red-600 bg-red-50'}`}>
                    <span className="text-4xl font-extrabold">{average}%</span>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {[
                   { label: 'Reading (Lesen)', score: scores.reading, icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50' },
                   { label: 'Listening (Hören)', score: scores.listening, icon: Headphones, color: 'text-purple-500', bg: 'bg-purple-50' },
                   { label: 'Writing (Schreiben)', score: scores.writing, icon: PenTool, color: 'text-pink-500', bg: 'bg-pink-50' },
                   { label: 'Speaking (Sprechen)', score: scores.speaking, icon: Mic, color: 'text-orange-500', bg: 'bg-orange-50' },
                 ].map((mod, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                     <div className="flex items-center space-x-3">
                       <div className={`p-2 ${mod.bg} rounded-lg`}>
                         <mod.icon className={`w-5 h-5 ${mod.color}`} />
                       </div>
                       <span className="font-semibold text-gray-700">{mod.label}</span>
                     </div>
                     <span className={`font-bold ${mod.score >= 60 ? 'text-green-600' : 'text-red-500'}`}>{Math.round(mod.score)}%</span>
                   </div>
                 ))}
               </div>
            </div>
            <div className={`w-full p-6 rounded-2xl border ${tips.border} ${tips.bg} shadow-md animate-fade-in-up delay-150`}>
              <div className="flex items-start space-x-4">
                <div className={`p-3 bg-white rounded-full shadow-sm flex-shrink-0 ${tips.iconColor}`}>
                   <Lightbulb className="w-6 h-6" />
                </div>
                <div>
                   <h3 className={`text-lg font-bold mb-2 ${tips.color}`}>{tips.title}</h3>
                   <p className={`${tips.color} opacity-90 leading-relaxed`}>{tips.content}</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setScores({ reading: 0, listening: 0, writing: 0, speaking: 0 });
                setUserDetails({ name: '', phone: '', language: 'Malayalam' });
                setState(AppState.HOME);
                setPreloadedReading(null);
                setPreloadedListening(null);
                setPreloadedWriting(null);
                setPreloadedSpeaking(null);
              }}
              className="mt-8 flex items-center space-x-2 px-10 py-4 bg-brand-600 text-white rounded-full font-bold hover:bg-brand-700 transition-all shadow-lg hover:shadow-2xl hover:-translate-y-1"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Take Test Again</span>
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand-200">
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer group" onClick={() => setState(AppState.HOME)}>
             <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold group-hover:bg-brand-700 transition-colors shadow-sm">G</div>
             <span className="font-bold text-xl tracking-tight text-gray-900">German A1 <span className="text-brand-600">Mock Test</span></span>
          </div>
          {state !== AppState.HOME && state !== AppState.RESULTS && state !== AppState.USER_DETAILS_FORM && (
             <div className="hidden md:flex items-center space-x-2 text-sm font-medium text-gray-500">
                <span className={`px-2 py-1 rounded ${state === AppState.TEST_READING ? 'bg-brand-50 text-brand-700' : ''}`}>Lesen</span>
                <span className="text-gray-300">&rarr;</span>
                <span className={`px-2 py-1 rounded ${state === AppState.TEST_LISTENING ? 'bg-brand-50 text-brand-700' : ''}`}>Hören</span>
                <span className="text-gray-300">&rarr;</span>
                <span className={`px-2 py-1 rounded ${state === AppState.TEST_WRITING ? 'bg-brand-50 text-brand-700' : ''}`}>Schreiben</span>
                <span className="text-gray-300">&rarr;</span>
                <span className={`px-2 py-1 rounded ${state === AppState.TEST_SPEAKING ? 'bg-brand-50 text-brand-700' : ''}`}>Sprechen</span>
             </div>
          )}
        </div>
      </header>
      <main className="w-full">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;