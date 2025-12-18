import React, { useState, useEffect } from 'react';
import { generateWritingTask, evaluateWriting } from '../../services/geminiService';
import { WritingTask, EvaluationResult } from '../../types';
import { Loader2, Send, AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  onComplete: (score: number) => void;
  preloadedTask?: WritingTask | null;
}

const WritingModule: React.FC<Props> = ({ onComplete, preloadedTask }) => {
  const [task, setTask] = useState<WritingTask | null>(preloadedTask || null);
  const [userText, setUserText] = useState("");
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(!preloadedTask);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const fetchTask = async () => {
    if (preloadedTask) return;
    setLoading(true);
    setError(null);
    try {
      const data = await generateWritingTask();
      setTask(data);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load writing task");
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

  const handleSubmit = async () => {
    if (!task || !userText.trim()) return;
    setEvaluating(true);
    setSubmissionError(null);
    try {
      const evalResult = await evaluateWriting(task, userText);
      setResult(evalResult);
    } catch (e: any) {
      console.error(e);
      setSubmissionError(e.message || "Failed to evaluate writing. Please try again.");
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
        <h3 className="text-xl font-bold text-gray-800">Generating Writing Task...</h3>
        <p className="text-gray-500">Creating a unique scenario for you to practice.</p>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6 animate-fade-in p-8 text-center max-w-lg mx-auto">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-2 shadow-sm border border-red-100">
            <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong</h3>
            <p className="text-gray-600 mb-6">{error}</p>
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
        <h2 className="text-xl font-bold mb-2 text-brand-900">Schreiben (Writing)</h2>
        <div className="bg-brand-50 p-4 rounded-lg border border-brand-100">
          <h3 className="font-semibold text-brand-800">Topic: {task.topic}</h3>
          <p className="text-gray-700 mt-2">{task.instructions}</p>
        </div>
      </div>

      {!result ? (
        <div className="space-y-4">
          <textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder="Schreiben Sie Ihren Text hier..."
            className="w-full h-48 p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none shadow-sm"
          />
          
          {submissionError && (
             <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{submissionError}</span>
             </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={evaluating || userText.length < 10}
              className="flex items-center space-x-2 px-8 py-3 bg-brand-600 text-white rounded-lg font-semibold shadow-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {evaluating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Evaluating...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit for Grading</span>
                </>
              )}
            </button>
          </div>
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
                   <h4 className="font-semibold text-gray-700 mb-2">Corrections & Improvements:</h4>
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
                Next Module
             </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default WritingModule;