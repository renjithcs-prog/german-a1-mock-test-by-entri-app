import React, { useState, useEffect, useRef } from 'react';
import { generateListeningTestScript, generateAudioFromScript } from '../../services/geminiService';
import { decode, decodeAudioData, concatenateRawAudio } from '../../services/audioUtils';
import { ListeningTestContent, TestPart } from '../../types';
import { Play, CheckCircle, XCircle, Pause, Loader2, AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  onComplete: (score: number) => void;
  preloadedData?: { content: ListeningTestContent, audioParts: string[] } | null;
}

const ListeningModule: React.FC<Props> = ({ onComplete, preloadedData }) => {
  const [content, setContent] = useState<ListeningTestContent | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  
  // Detailed Loading States
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

      // Check if we have preloaded data (Both Script AND Audio)
      if (preloadedData) {
         setLoadingStep('processing');
         testContent = preloadedData.content;
         audioBase64Results = preloadedData.audioParts;
      } else {
         setLoadingStep('scripting');
         testContent = await generateListeningTestScript();
         
         setLoadingStep('synthesizing');
         const audioPromises = testContent.parts.map((part, index) => {
             const textToSpeak = `Teil ${index + 1}. ${part.type}. ${part.content}`;
             return generateAudioFromScript(textToSpeak);
         });
         audioBase64Results = await Promise.all(audioPromises);
      }
      
      setLoadingStep('processing');
      
      // Decode all parts to raw bytes
      const audioSegments = audioBase64Results.map(base64 => decode(base64));
      
      // Concatenate them with silence (2 seconds)
      const combinedRawBytes = concatenateRawAudio(audioSegments, 2);

      setContent(testContent);
      
      // Prepare Audio Context
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const buffer = await decodeAudioData(combinedRawBytes, audioContextRef.current);
      audioBufferRef.current = buffer;
      
      setLoadingStep('ready');

    } catch (e: any) {
      console.error(e);
      let errMsg = e.message || "Failed to initialize listening test.";
      try {
        if (errMsg.trim().startsWith('{')) {
          const parsed = JSON.parse(errMsg);
          if (parsed.error && parsed.error.message) errMsg = parsed.error.message;
        }
      } catch (err) {}
      
      setErrorMsg(errMsg);
      setLoadingStep('error');
    }
  };

  useEffect(() => {
    initTest();

    return () => {
      try {
        sourceRef.current?.stop();
        audioContextRef.current?.close();
      } catch (e) { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAudio = async () => {
    if (!audioContextRef.current || !audioBufferRef.current) return;

    if (isPlaying) {
      try {
        sourceRef.current?.stop();
      } catch (e) {}
      setIsPlaying(false);
      return;
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

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

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const getTotalQuestions = () => {
    if (!content) return 0;
    return content.parts.reduce((acc, part) => acc + part.questions.length, 0);
  };

  if (loadingStep === 'error') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6 animate-fade-in p-8 text-center max-w-lg mx-auto">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-2 shadow-sm border border-red-100">
                <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Test</h3>
                <p className="text-gray-600 mb-6 px-4 py-2 bg-red-50 rounded text-sm font-mono border border-red-100 inline-block max-w-full overflow-hidden text-ellipsis">{errorMsg}</p>
            </div>
            <button 
                onClick={initTest}
                className="px-8 py-3 bg-brand-600 text-white rounded-full font-bold hover:bg-brand-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center space-x-2"
            >
                <RotateCcw className="w-5 h-5" />
                <span>Try Again</span>
            </button>
        </div>
      );
  }

  if (loadingStep !== 'ready') {
    let message = "Preparing your test...";
    let subMessage = "Please wait a moment.";
    
    switch(loadingStep) {
        case 'scripting':
            message = "Step 1/3: Writing Scenarios";
            subMessage = "Creating unique dialogues and announcements...";
            break;
        case 'synthesizing':
            message = "Step 2/3: Recording Audio";
            subMessage = "Generating multiple audio tracks (this may take 10s)...";
            break;
        case 'processing':
            message = "Finalizing Audio";
            subMessage = "Stitching audio segments together...";
            break;
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8 animate-fade-in">
        <div className="w-64 h-64 relative">
            {/* @ts-ignore */}
            <lottie-player
            src="https://lottie.host/56722238-d636-4d22-9200-a885d590453e/Z7b84236e2.json"
            background="transparent"
            speed="1"
            loop
            autoplay
            ></lottie-player>
            <div className="absolute inset-0 flex items-center justify-center">
                 {(loadingStep === 'synthesizing' || loadingStep === 'processing') && <Loader2 className="w-12 h-12 text-brand-600 animate-spin" />}
            </div>
        </div>
        <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-gray-800">{message}</h3>
            <p className="text-gray-500">{subMessage}</p>
        </div>
        </div>
    );
  }

  if (!content) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-10">
      
      {/* Audio Player Header */}
      <div className="bg-white p-8 rounded-xl shadow-md border border-gray-100 flex flex-col items-center text-center overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-300 to-purple-400"></div>

        <h2 className="text-xl font-bold mb-4 text-brand-900 z-10">Hören (Listening)</h2>
        <p className="text-gray-600 mb-8 z-10">Listen to the audio track containing all parts and answer the questions below.</p>
        
        <div className="relative z-10">
          <button
            onClick={toggleAudio}
            className={`
              flex items-center justify-center w-24 h-24 rounded-full shadow-xl transition-all duration-300
              ${isPlaying ? 'bg-white border-4 border-brand-200 text-brand-600' : 'bg-brand-600 hover:bg-brand-700 text-white hover:scale-105'}
            `}
          >
            {isPlaying ? (
              <Pause className="w-10 h-10 fill-current" />
            ) : (
              <Play className="w-10 h-10 ml-1 fill-current" />
            )}
          </button>
        </div>

        {isPlaying && (
          <div className="flex items-end justify-center space-x-1 h-12 mt-8">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i}
                className="w-2 bg-brand-500 rounded-t-sm animate-equalizer"
                style={{ 
                  animationDuration: `${0.4 + Math.random() * 0.4}s`,
                  height: '20%'
                }}
              ></div>
            ))}
          </div>
        )}
        
        {!isPlaying && <div className="h-12 mt-8"></div>}

        <p className="mt-2 text-sm text-gray-500 font-medium">
            {isPlaying ? "Playing..." : "Click Play to Start"}
        </p>
      </div>

      {/* Questions Section */}
      {content.parts.map((part: TestPart, partIndex) => (
         <div key={partIndex} className="space-y-4">
             <div className="flex items-center space-x-2 my-6">
                <div className="h-px bg-gray-200 flex-1"></div>
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider">Part {partIndex + 1}: {part.type}</span>
                <div className="h-px bg-gray-200 flex-1"></div>
             </div>

             {part.questions.map((q, idx) => (
                <div 
                    key={q.id} 
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-fade-in-up"
                    style={{ animationDelay: `${idx * 150}ms`, animationFillMode: 'both' }}
                >
                    <p className="font-semibold text-gray-800 mb-4">{idx + 1}. {q.text}</p>
                    <div className="space-y-2">
                    {q.options.map((opt, i) => {
                        const isSelected = answers[q.id] === i;
                        const isCorrect = q.correctAnswerIndex === i;
                        let className = "w-full text-left p-3 rounded-lg border transition-all ";
                        
                        if (submitted) {
                        if (isCorrect) className += "bg-green-50 border-green-500 text-green-700 font-medium";
                        else if (isSelected && !isCorrect) className += "bg-red-50 border-red-500 text-red-700";
                        else className += "bg-gray-50 border-gray-200 text-gray-400";
                        } else {
                        if (isSelected) className += "bg-brand-100 border-brand-500 text-brand-800 transform scale-[1.02] shadow-sm";
                        else className += "hover:bg-gray-50 border-gray-200 text-gray-700 hover:border-brand-200";
                        }

                        return (
                        <button
                            key={i}
                            onClick={() => handleSelect(q.id, i)}
                            className={className}
                            disabled={submitted}
                        >
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
            <button
                onClick={handleSubmit}
                disabled={Object.keys(answers).length !== getTotalQuestions()}
                className="px-8 py-3 bg-brand-600 text-white rounded-lg font-semibold shadow-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                Submit Answers ({Object.keys(answers).length}/{getTotalQuestions()})
            </button>
            ) : (
            <button
                onClick={() => {
                    let correct = 0;
                    let total = 0;
                    content.parts.forEach(part => {
                        part.questions.forEach(q => {
                            if (answers[q.id] === q.correctAnswerIndex) correct++;
                            total++;
                        });
                    });
                    onComplete(total > 0 ? (correct / total) * 100 : 0);
                }}
                className="px-8 py-3 bg-gray-900 text-white rounded-lg font-semibold shadow-lg hover:bg-gray-800 transition-colors"
            >
                Next Module
            </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ListeningModule;