import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ReadingTestContent, ListeningTestContent, WritingTask, SpeakingTask, EvaluationResult } from "../types";

// The API key must be obtained exclusively from the environment variable process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelGeneration = 'gemini-3-flash-preview';
const modelEvaluation = 'gemini-3-pro-preview';
const modelTTS = 'gemini-2.5-flash-preview-tts';

// Helper to clean JSON string if model wraps it in markdown
const cleanJson = (text: string) => {
  return text.replace(/```json\n?|\n?```/g, '').trim();
};

// Helper to inject randomness and variety into prompts
const getRandomContext = () => {
  const topics = [
    'Shopping', 'Family', 'Free time', 'Travel', 'Food', 'Daily routine', 
    'Weather', 'Housing', 'Work', 'Friends', 'Health', 'Holidays'
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  return `Focus: ${topic}. ID: ${Math.floor(Math.random() * 1000)}.`;
};

/**
 * RETRY LOGIC HELPER
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const runWithRetry = async <T>(operation: () => Promise<T>, retries = 3, baseDelay = 1500): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorMsg = (error.message || JSON.stringify(error)).toLowerCase();
      
      const isTransient = 
        errorMsg.includes('503') || 
        errorMsg.includes('overloaded') || 
        errorMsg.includes('unavailable') || 
        errorMsg.includes('quota') ||
        errorMsg.includes('429');
      
      if (isTransient && i < retries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.warn(`Gemini API busy (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

// --- Reading Module ---

export const generateReadingTest = async (): Promise<ReadingTestContent> => {
  return runWithRetry(async () => {
    try {
      const context = getRandomContext();
      
      const response = await ai.models.generateContent({
        model: modelGeneration,
        contents: `Create German A1 reading test. 2 parts. 
        Part 1: Email (40 words).
        Part 2: Notice/Sign (20 words).
        ${context}
        3 multiple-choice questions per part. Keep it simple and fast.`,
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

      if (!response.text) throw new Error("No text response from model");
      return JSON.parse(cleanJson(response.text)) as ReadingTestContent;
    } catch (error: any) {
      console.error("generateReadingTest Error:", error);
      throw error;
    }
  });
};

// --- Listening Module ---

export const generateListeningTestScript = async (): Promise<ListeningTestContent> => {
  return runWithRetry(async () => {
    try {
      const context = getRandomContext();
      
      const response = await ai.models.generateContent({
        model: modelGeneration,
        contents: `Create German A1 listening script. 2 parts.
        Part 1: Dialogue (30 words).
        Part 2: Announcement (20 words).
        ${context}
        Simple sentences. 3 questions per part.`,
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

      if (!response.text) throw new Error("No text response from model");
      const data = JSON.parse(cleanJson(response.text)) as ListeningTestContent;
      
      data.fullScript = data.parts.map((p, i) => `Teil ${i + 1}. ${p.type}. ... ${p.content}`).join(' ... ... ');
      return data;
    } catch (error: any) {
      console.error("generateListeningTestScript Error:", error);
      throw error;
    }
  });
};

export const generateAudioFromScript = async (script: string): Promise<string> => {
  return runWithRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: modelTTS,
        contents: [{ parts: [{ text: script }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        }
      });
      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) throw new Error("No audio data");
      return audioData;
    } catch (error: any) {
      console.error("generateAudioFromScript Error:", error);
      throw error;
    }
  });
};

export const preloadListeningTest = async (): Promise<{ content: ListeningTestContent, audioParts: string[] }> => {
  const content = await generateListeningTestScript();
  const audioPromises = content.parts.map((part, index) => {
      const textToSpeak = `Teil ${index + 1}. ${part.type}. ${part.content}`;
      return generateAudioFromScript(textToSpeak);
  });
  const audioParts = await Promise.all(audioPromises);
  return { content, audioParts };
};

// --- Writing Module ---

export const generateWritingTask = async (): Promise<WritingTask> => {
  return runWithRetry(async () => {
    try {
      const context = getRandomContext();

      const response = await ai.models.generateContent({
        model: modelGeneration,
        contents: `German A1 writing task. ${context} Ask user to write short email covering 3 points. Provide topic and instructions.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              instructions: { type: Type.STRING }
            }
          }
        }
      });

      if (!response.text) throw new Error("No text response from model");
      return JSON.parse(cleanJson(response.text)) as WritingTask;
    } catch (error: any) {
      console.error("generateWritingTask Error:", error);
      throw error;
    }
  });
};

export const evaluateWriting = async (task: WritingTask, userText: string): Promise<EvaluationResult> => {
  return runWithRetry(async () => {
    try {
      const response = await ai.models.generateContent({
        model: modelEvaluation,
        contents: `Task: ${task.instructions}\nUser Text: ${userText}\n\nEvaluate for German A1. Check 3 points. Score out of 100. Concise feedback (max 3 sentences). List corrections.`,
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

      if (!response.text) throw new Error("No text response from model");
      return JSON.parse(cleanJson(response.text)) as EvaluationResult;
    } catch (error: any) {
      console.error("evaluateWriting Error:", error);
      throw error;
    }
  });
};

// --- Speaking Module ---

export const generateSpeakingTask = async (): Promise<SpeakingTask> => {
  return runWithRetry(async () => {
    try {
      const context = getRandomContext();

      const response = await ai.models.generateContent({
        model: modelGeneration,
        contents: `German A1 speaking task. ${context} Ask user to speak about a topic covering 3 points. Instructions only.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              instructions: { type: Type.STRING }
            }
          }
        }
      });
      
      if (!response.text) throw new Error("No text response from model");
      return JSON.parse(cleanJson(response.text)) as SpeakingTask;
    } catch (error: any) {
      console.error("generateSpeakingTask Error:", error);
      throw error;
    }
  });
};

export const evaluateSpeaking = async (task: SpeakingTask, input: { audioBase64?: string, text?: string }): Promise<EvaluationResult> => {
  return runWithRetry(async () => {
    try {
      const parts: any[] = [];
      
      if (input.audioBase64) {
        parts.push({
          inlineData: { mimeType: 'audio/webm', data: input.audioBase64 }
        });
        parts.push({
          text: `Task: ${task.instructions}. Evaluate German A1 speech. Score (0-100), concise feedback (max 3 sentences) & corrections.`
        });
      } else if (input.text) {
        parts.push({
          text: `Task: ${task.instructions}. User wrote: "${input.text}". Evaluate German A1. Score (0-100), concise feedback (max 3 sentences) & corrections.`
        });
      } else {
        throw new Error("No input");
      }

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

      if (!response.text) throw new Error("No text response from model");
      return JSON.parse(cleanJson(response.text)) as EvaluationResult;
    } catch (error: any) {
      console.error("evaluateSpeaking Error:", error);
      throw error;
    }
  });
};