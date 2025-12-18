import React, { useState, useEffect, useRef } from 'react';
import { generateSpeakingTask, evaluateSpeaking } from '../../services/geminiService';
import { blobToBase64 } from '../../services/audioUtils';
import { SpeakingTask, EvaluationResult } from '../../types';
import { Loader2, Mic, Square, Send, AlertCircle, Keyboard, RotateCcw } from 'lucide-react';

interface Props {
  onComplete: (score: number) => void;
  preloadedTask?: SpeakingTask | null;
}

const SpeakingModule: React.FC<Props> = ({ onComplete, preloadedTask }) => {
  const [task, setTask] = useState<SpeakingTask | null>(preloadedTask || null);
  const [loading, setLoading] = useState(!preloadedTask);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [useTextFallback, setUseTextFallback] = useState(false);
  const [textInput, setTextInput] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const fetchTask = async () => {
    if (preloadedTask) return;
    setLoading(true);
    setInitError(null);
    try {
      const data = await generateSpeakingTask();
      setTask(data);
    } catch (e: any) {
      console.error(e);
      setInitError(e.message || "Failed to generate speaking task.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!preloadedTask) {
        fetchTask();
    } else {
        setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadedTask]);

  const startRecording = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support audio recording.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        chunksRef.current = [];
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err: any) {
      setRecording(false);
      
      let errorMessage = "Could not access microphone.";
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || (err.message && err.message.toLowerCase().includes('permission denied'))) {
        errorMessage = "Microphone permission denied.";
        // Don't console.error for expected permission denials to keep logs clean
        console.warn("Microphone access denied by user.");
      } else if (err.name === 'NotFoundError') {
        errorMessage = "No microphone found.";
      } else {
        console.error("Microphone Access Error:", err);
      }
      
      setError(errorMessage);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleSubmit = async () => {
    if (!task) return;
    if (!useTextFallback && !audioBlob) return;
    if (useTextFallback && !textInput.trim()) return;

    setEvaluating(true);
    setError(null);
    
    try {
      let evalResult: EvaluationResult;
      
      if (useTextFallback) {
         evalResult = await evaluateSpeaking(task, { text: textInput });
      } else if (audioBlob) {
         const base64 = await blobToBase64(audioBlob);
         evalResult = await evaluateSpeaking(task, { audioBase64: base64 });
      } else {
        throw new Error("No input provided");
      }
      
      setResult(evalResult);
    } catch (e: any) {
      console.error(e);
      setError("Failed to evaluate submission. " + (e.message || ""));
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8 animate-fade-in">
      <div className="w-64 h-64">
        {/* @ts-ignore */}
        <lottie-player
          src="https://lottie.host/56722238-d636-4d22-9200-a885d590453e/Z7b84236e2.json"
          background="transparent"
          speed="1"
          loop
          autoplay
        ></lottie-player>
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold text-gray-800">Generating Speaking Task...</h3>
        <p className="text-gray-500">Preparing a conversation topic for you.</p>
      </div>
    </div>
  );

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6 animate-fade-in p-8 text-center max-w-lg mx-auto">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-2 shadow-sm border border-red-100">
            <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong</h3>
            <p className="text-gray-600 mb-6">{initError}</p>
        </div>
        <button 
            onClick={fetchTask}
            className="px-8 py-3 bg-brand-600 text-white rounded-full font-bold hover:bg-brand-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center space-x-2"
        >
            <RotateCcw className="w-5 h-5" />
            <span>Try Again</span>
        </button>
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
       <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h2 className="text-xl font-bold mb-2 text-brand-900">Sprechen (Speaking)</h2>
        <div className="bg-brand-50 p-4 rounded-lg border border-brand-100">
          <h3 className="font-semibold text-brand-800">Topic: {task.topic}</h3>
          <p className="text-gray-700 mt-2">{task.instructions}</p>
        </div>
      </div>
      
      {error && !useTextFallback && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start justify-between">
          <div className="flex items-start space-x-3">
             <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
             <div>
                <p className="font-semibold">{error}</p>
                <p className="text-sm mt-1">Please check your browser settings or use the text fallback.</p>
             </div>
          </div>
          <button 
            onClick={() => { setError(null); setUseTextFallback(true); }}
            className="text-sm bg-white border border-red-300 px-3 py-1 rounded hover:bg-red-50 transition-colors"
          >
            Type Answer Instead
          </button>
        </div>
      )}

      {!result ? (
        <div className="flex flex-col items-center space-y-6 py-10 bg-white rounded-xl border border-dashed border-gray-300 transition-all relative overflow-hidden">
          
          {!useTextFallback ? (
            <>
                {!audioBlob && !recording && (
                    <p className="text-gray-500 z-10">Click microphone to start recording your answer.</p>
                )}

                {audioBlob && !recording && (
                    <div className="w-full max-w-sm z-10">
                        <audio controls src={URL.createObjectURL(audioBlob)} className="w-full" />
                        <button 
                        onClick={() => setAudioBlob(null)} 
                        className="text-sm text-red-500 mt-2 hover:underline w-full text-center"
                        >
                        Delete and record again
                        </button>
                    </div>
                )}

                {!audioBlob && (
                    <div className="relative">
                        {recording && (
                             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -z-10 flex items-center justify-center">
                                <div className="w-32 h-32 bg-red-100 rounded-full animate-pulse-ring"></div>
                                <div className="w-32 h-32 bg-red-100 rounded-full animate-pulse-ring delay-300"></div>
                             </div>
                        )}
                        <button
                            onClick={recording ? stopRecording : startRecording}
                            className={`
                                flex items-center justify-center w-24 h-24 rounded-full transition-all shadow-xl z-10 relative
                                ${recording ? 'bg-red-500 animate-pulse' : 'bg-brand-600 hover:bg-brand-700'}
                            `}
                        >
                            {recording ? (
                                <Square className="w-10 h-10 text-white" fill="currentColor" />
                            ) : (
                                <Mic className="w-10 h-10 text-white" />
                            )}
                        </button>
                    </div>
                )}

                {!audioBlob && !recording && (
                    <button 
                        onClick={() => setUseTextFallback(true)}
                        className="flex items-center space-x-2 text-gray-400 hover:text-brand-600 transition-colors mt-4 text-sm z-10"
                    >
                        <Keyboard className="w-4 h-4" />
                        <span>Can't speak? Type your answer</span>
                    </button>
                )}
            </>
          ) : (
            <div className="w-full max-w-xl px-6 z-10">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Type your response (Simulation)</label>
                    <button 
                        onClick={() => setUseTextFallback(false)}
                        className="text-sm text-brand-600 hover:underline"
                    >
                        Switch to Microphone
                    </button>
                </div>
                <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Ich heiße..."
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                />
            </div>
          )}

          {(audioBlob || (useTextFallback && textInput.length > 0)) && (
              <button
              onClick={handleSubmit}
              disabled={evaluating}
              className="flex items-center space-x-2 px-8 py-3 bg-brand-600 text-white rounded-lg font-semibold shadow-lg hover:bg-brand-700 disabled:opacity-50 transition-colors z-10"
            >
              {evaluating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Evaluating...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Answer</span>
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in-up">
           <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-lg font-bold text-gray-900">Evaluation Result</h3>
               <div className="px-4 py-1 bg-brand-100 text-brand-800 rounded-full font-bold">
                 Score: {result.score}/100
               </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-700">Feedback:</h4>
                <p className="text-gray-600">{result.feedback}</p>
              </div>
              
              {result.corrections && result.corrections.length > 0 && (
                <div>
                   <h4 className="font-semibold text-gray-700 mb-2">Suggestions:</h4>
                   <ul className="list-disc list-inside space-y-1 text-gray-600">
                     {result.corrections.map((c, i) => <li key={i}>{c}</li>)}
                   </ul>
                </div>
              )}
            </div>
           </div>

           <div className="flex justify-end">
             <button
                onClick={() => onComplete(result.score)}
                className="px-8 py-3 bg-gray-900 text-white rounded-lg font-semibold shadow-lg hover:bg-gray-800 transition-colors"
             >
                Finish Test
             </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default SpeakingModule;