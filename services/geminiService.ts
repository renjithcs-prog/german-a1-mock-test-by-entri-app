import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ReadingTestContent, ListeningTestContent, WritingTask, SpeakingTask, EvaluationResult } from "../types.ts";

const modelGeneration = 'gemini-3-flash-preview';
const modelEvaluation = 'gemini-3-flash-preview'; // Switched to flash for standard text evaluation
const modelTTS = 'gemini-2.5-flash-preview-tts';

// Helper to initialize AI right before use using the mandated environment variable
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const cleanJson = (text: string) => text.replace(/```json\n?|\n?```/g, '').trim();

const getRandomContext = () => {
  const topics = ['Shopping', 'Family', 'Free time', 'Travel', 'Food', 'Daily routine', 'Weather', 'Housing', 'Work', 'Friends', 'Health', 'Holidays'];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  return `Focus: ${topic}. ID: ${Math.floor(Math.random() * 1000)}.`;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const runWithRetry = async <T>(operation: () => Promise<T>, retries = 3, baseDelay = 1500): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorMsg = (error.message || JSON.stringify(error)).toLowerCase();
      const isTransient = errorMsg.includes('503') || errorMsg.includes('overloaded') || errorMsg.includes('unavailable') || errorMsg.includes('quota') || errorMsg.includes('429');
      if (isTransient && i < retries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

export const generateReadingTest = async (): Promise<ReadingTestContent> => {
  return runWithRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: modelGeneration,
      contents: `Create German A1 reading test. 2 parts. Part 1: Email (40 words). Part 2: Notice/Sign (20 words). ${getRandomContext()} 3 multiple-choice questions per part.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            parts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING },
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        text: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctAnswerIndex: { type: Type.INTEGER }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!response.text) throw new Error("No text response");
    return JSON.parse(cleanJson(response.text)) as ReadingTestContent;
  });
};

export const generateListeningTestScript = async (): Promise<ListeningTestContent> => {
  return runWithRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: modelGeneration,
      contents: `Create German A1 listening script. 2 parts. Part 1: Dialogue. Part 2: Announcement. ${getRandomContext()} Simple sentences. 3 questions per part.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            parts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING },
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        text: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctAnswerIndex: { type: Type.INTEGER }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!response.text) throw new Error("No text response");
    const data = JSON.parse(cleanJson(response.text)) as ListeningTestContent;
    data.fullScript = data.parts.map((p, i) => `Teil ${i + 1}. ${p.type}. ... ${p.content}`).join(' ... ... ');
    return data;
  });
};

export const generateAudioFromScript = async (script: string): Promise<string> => {
  return runWithRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: modelTTS,
      contents: [{ parts: [{ text: script }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      }
    });
    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) throw new Error("No audio data");
    return audioData;
  });
};

export const preloadListeningTest = async (): Promise<{ content: ListeningTestContent, audioParts: string[] }> => {
  const content = await generateListeningTestScript();
  const audioParts = await Promise.all(content.parts.map((part, index) => generateAudioFromScript(`Teil ${index + 1}. ${part.type}. ${part.content}`)));
  return { content, audioParts };
};

export const generateWritingTask = async (): Promise<WritingTask> => {
  return runWithRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: modelGeneration,
      contents: `German A1 writing task. ${getRandomContext()} Ask user to write short email covering 3 points.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { topic: { type: Type.STRING }, instructions: { type: Type.STRING } }
        }
      }
    });
    if (!response.text) throw new Error("No text response");
    return JSON.parse(cleanJson(response.text)) as WritingTask;
  });
};

export const evaluateWriting = async (task: WritingTask, userText: string): Promise<EvaluationResult> => {
  return runWithRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: modelEvaluation,
      contents: `Task: ${task.instructions}\nUser Text: ${userText}\n\nEvaluate for German A1. Score out of 100. Feedback & corrections.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            feedback: { type: Type.STRING },
            corrections: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    if (!response.text) throw new Error("No text response");
    return JSON.parse(cleanJson(response.text)) as EvaluationResult;
  });
};

export const generateSpeakingTask = async (): Promise<SpeakingTask> => {
  return runWithRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: modelGeneration,
      contents: `German A1 speaking task. ${getRandomContext()} Instructions only.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { topic: { type: Type.STRING }, instructions: { type: Type.STRING } }
        }
      }
    });
    if (!response.text) throw new Error("No text response");
    return JSON.parse(cleanJson(response.text)) as SpeakingTask;
  });
};

export const evaluateSpeaking = async (task: SpeakingTask, input: { audioBase64?: string, text?: string }): Promise<EvaluationResult> => {
  return runWithRetry(async () => {
    const ai = getAI();
    const parts: any[] = [];
    if (input.audioBase64) parts.push({ inlineData: { mimeType: 'audio/webm', data: input.audioBase64 } });
    if (input.text) parts.push({ text: `User text: ${input.text}` });
    parts.push({ text: `Task: ${task.instructions}. Evaluate German A1 speech. Score (0-100), feedback & corrections.` });
    const response = await ai.models.generateContent({
      model: modelEvaluation,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            feedback: { type: Type.STRING },
            corrections: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    if (!response.text) throw new Error("No text response");
    return JSON.parse(cleanJson(response.text)) as EvaluationResult;
  });
};