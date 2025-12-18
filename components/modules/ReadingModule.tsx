import React, { useState, useEffect } from 'react';
import { generateReadingTest } from '../../services/geminiService';
import { ReadingTestContent, TestPart } from '../../types';
import { CheckCircle, XCircle, AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  onComplete: (score: number) => void;
  preloadedData?: ReadingTestContent | null;
}

const ReadingModule: React.FC<Props> = ({ onComplete, preloadedData }) => {
  const [content, setContent] = useState<ReadingTestContent | null>(preloadedData || null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(!preloadedData);
  const [error, setError] = useState<string | null>(null);

  const fetchTest = async () => {
    if (preloadedData) return; // Already have data
    setLoading(true);
    setError(null);
    try {
      const data = await generateReadingTest();
      setContent(data);
    } catch (e: any) {
      console.error(e);
      let errMsg = e.message || "Failed to load reading test.";
      try {
        if (errMsg.trim().startsWith('{')) {
          const parsed = JSON.parse(errMsg);
          if (parsed.error && parsed.error.message) {
             errMsg = parsed.error.message;
          }
        }
      } catch (parseErr) {}
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!preloadedData) {
      fetchTest();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadedData]);

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
        <h3 className="text-xl font-bold text-gray-800">Generating Reading Test...</h3>
        <p className="text-gray-500">Curating emails, ads, and questions for you.</p>
        <p className="text-xs text-gray-400 mt-2">This may take a few seconds.</p>
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
            <p className="text-gray-600 mb-6 px-4 py-2 bg-red-50 rounded text-sm font-mono border border-red-100 inline-block max-w-full overflow-hidden text-ellipsis">{error}</p>
        </div>
        <button 
            onClick={fetchTest}
            className="px-8 py-3 bg-brand-600 text-white rounded-full font-bold hover:bg-brand-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center space-x-2"
        >
            <RotateCcw className="w-5 h-5" />
            <span>Try Again</span>
        </button>
      </div>
    );
  }

  if (!content) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-12 animate-fade-in pb-10">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-brand-900">Lesen (Reading)</h2>
        <p className="text-gray-600">Read the texts and answer the questions below.</p>
      </div>

      {content.parts.map((part: TestPart, partIndex) => (
        <div key={partIndex} className="space-y-6">
           {/* Text Section */}
           <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
             <div className="flex items-center space-x-2 mb-4">
               <span className="bg-brand-100 text-brand-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Part {partIndex + 1}</span>
               <h3 className="text-lg font-bold text-gray-800">{part.title || part.type}</h3>
             </div>
             <div className="prose prose-lg text-gray-700 bg-brand-50 p-6 rounded-lg border-l-4 border-brand-500">
               <p className="whitespace-pre-line">{part.content}</p>
             </div>
           </div>

           {/* Questions Section */}
           <div className="space-y-4">
             {part.questions.map((q, qIndex) => (
               <div 
                 key={q.id} 
                 className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-fade-in-up"
                 style={{ animationDelay: `${qIndex * 100}ms` }}
               >
                 <p className="font-semibold text-gray-800 mb-4">{qIndex + 1}. {q.text}</p>
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

export default ReadingModule;