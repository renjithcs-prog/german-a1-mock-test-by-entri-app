import React, { useState, useEffect, useRef } from 'react';
import { generateListeningTestScript, generateAudioFromScript } from '../../services/geminiService.ts';
import { decode, decodeAudioData, concatenateRawAudio } from '../../services/audioUtils.ts';
import { ListeningTestContent, TestPart } from '../../types.ts';
import { Play, CheckCircle, XCircle, Pause, Loader2, AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  onComplete: (score: number) => void;
  preloadedData?: { content: ListeningTestContent, audioParts: string[] } | null;
}

const ListeningModule: React.FC<Props> = ({ onComplete, preloadedData }) => {
  const [content, setContent] = useState<ListeningTestContent | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('initializing'); 
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const initTest = async () => {
    try {
      setErrorMsg(null);
      let testContent: ListeningTestContent;
      let audioBase64Results: string[] = [];

      if (preloadedData) {
         setLoadingStep('processing');
         testContent = preloadedData.content;
         audioBase64Results = preloadedData.audioParts;
      } else {
         setLoadingStep('scripting');
         testContent = await generateListeningTestScript();
         setLoadingStep('synthesizing');
         audioBase64Results = await Promise.all(testContent.parts.map((part, index) => generateAudioFromScript(`Teil ${index + 1}. ${part.type}. ${part.content}`)));
      }
      
      setLoadingStep('processing');
      const audioSegments = audioBase64Results.map(base64 => decode(base64));
      const combinedRawBytes = concatenateRawAudio(audioSegments, 2);
      setContent(testContent);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const buffer = await decodeAudioData(combinedRawBytes, audioContextRef.current);
      audioBufferRef.current = buffer;
      setLoadingStep('ready');
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Failed to load listening test.");
      setLoadingStep('error');
    }
  };

  useEffect(() => {
    initTest();
    return () => {
      sourceRef.current?.stop();
      audioContextRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAudio = async () => {
    if (!audioContextRef.current || !audioBufferRef.current) return;
    if (isPlaying) {
      sourceRef.current?.stop();
      setIsPlaying(false);
      return;
    }
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(audioContextRef.current.destination);
    source.onended = () => setIsPlaying(false);
    sourceRef.current = source;
    setIsPlaying(true);
    source.start();
  };

  const handleSelect = (questionId: string, optionIndex: number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const getTotalQuestions = () => {
    if (!content) return 0;
    return content.parts.reduce((acc, part) => acc + part.questions.length, 0);
  };

  if (loadingStep === 'error') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6 p-8 text-center max-w-lg mx-auto">
            <AlertCircle className="w-16 h-16 text-red-500" />
            <h3 className="text-2xl font-bold text-gray-800">Error Loading Test</h3>
            <p className="text-gray-600 mb-6">{errorMsg}</p>
            <button onClick={initTest} className="px-8 py-3 bg-brand-600 text-white rounded-full font-bold transition-all flex items-center space-x-2">
                <RotateCcw className="w-5 h-5" />
                <span>Try Again</span>
            </button>
        </div>
      );
  }

  if (loadingStep !== 'ready') {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8 animate-fade-in">
          <div className="w-64 h-64">
              {/* @ts-ignore */}
              <lottie-player src="https://lottie.host/56722238-d636-4d22-9200-a885d590453e/Z7b84236e2.json" background="transparent" speed="1" loop autoplay></lottie-player>
          </div>
          <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-gray-800">Preparing Listening Tracks...</h3>
              <p className="text-gray-500">Generating audio content for the test.</p>
          </div>
        </div>
    );
  }

  if (!content) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-10">
      <div className="bg-white p-8 rounded-xl shadow-md border border-gray-100 flex flex-col items-center text-center">
        <h2 className="text-xl font-bold mb-4 text-brand-900">Hören (Listening)</h2>
        <button
          onClick={toggleAudio}
          className={`flex items-center justify-center w-24 h-24 rounded-full shadow-xl transition-all duration-300 ${isPlaying ? 'bg-white border-4 border-brand-200 text-brand-600' : 'bg-brand-600 text-white'}`}
        >
          {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1" />}
        </button>
        <p className="mt-4 text-sm text-gray-500">{isPlaying ? "Playing..." : "Click Play to Start"}</p>
      </div>

      {content.parts.map((part: TestPart, partIndex) => (
         <div key={partIndex} className="space-y-4">
             <div className="flex items-center space-x-2 my-6">
                <div className="h-px bg-gray-200 flex-1"></div>
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold uppercase">Part {partIndex + 1}</span>
                <div className="h-px bg-gray-200 flex-1"></div>
             </div>
             {part.questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <p className="font-semibold text-gray-800 mb-4">{idx + 1}. {q.text}</p>
                    <div className="space-y-2">
                    {q.options.map((opt, i) => {
                        const isSelected = answers[q.id] === i;
                        const isCorrect = q.correctAnswerIndex === i;
                        let className = "w-full text-left p-3 rounded-lg border transition-all ";
                        if (submitted) {
                          if (isCorrect) className += "bg-green-50 border-green-500 text-green-700";
                          else if (isSelected) className += "bg-red-50 border-red-500 text-red-700";
                          else className += "bg-gray-50 text-gray-400";
                        } else if (isSelected) className += "bg-brand-100 border-brand-500 text-brand-800";
                        else className += "hover:bg-gray-50";

                        return (
                          <button key={i} onClick={() => handleSelect(q.id, i)} className={className} disabled={submitted}>
                              <div className="flex items-center justify-between">
                                <span>{opt}</span>
                                {submitted && isCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
                                {submitted && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-600" />}
                              </div>
                          </button>
                        );
                    })}
                    </div>
                </div>
            ))}
         </div>
      ))}

      <div className="sticky bottom-6 flex justify-center pt-4">
        <div className="bg-white/90 backdrop-blur px-6 py-4 rounded-2xl shadow-2xl border border-gray-200">
            {!submitted ? (
              <button onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length !== getTotalQuestions()} className="px-8 py-3 bg-brand-600 text-white rounded-lg font-semibold shadow-lg hover:bg-brand-700 disabled:opacity-50">
                  Submit Answers ({Object.keys(answers).length}/{getTotalQuestions()})
              </button>
            ) : (
              <button onClick={() => {
                  let correct = 0;
                  content.parts.forEach(part => part.questions.forEach(q => { if (answers[q.id] === q.correctAnswerIndex) correct++; }));
                  onComplete((correct / getTotalQuestions()) * 100);
              }} className="px-8 py-3 bg-gray-900 text-white rounded-lg font-semibold shadow-lg">
                  Next Module
              </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ListeningModule;