export enum ModuleType {
  READING = 'Reading',
  LISTENING = 'Listening',
  WRITING = 'Writing',
  SPEAKING = 'Speaking'
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface TestPart {
  id: string;
  type: string; // e.g., "Email", "Advertisement", "Dialogue", "Announcement"
  title: string;
  content: string; // The text or script segment
  questions: Question[];
}

export interface ReadingTestContent {
  parts: TestPart[];
}

export interface ListeningTestContent {
  parts: TestPart[];
  fullScript: string;
  audioBase64?: string; // Populated after TTS generation
}

export interface WritingTask {
  topic: string;
  instructions: string;
}

export interface SpeakingTask {
  topic: string;
  instructions: string;
}

export interface EvaluationResult {
  score: number; // 0-100
  feedback: string;
  corrections?: string[];
}

export enum AppState {
  HOME,
  LOADING,
  TEST_READING,
  TEST_LISTENING,
  TEST_WRITING,
  TEST_SPEAKING,
  USER_DETAILS_FORM,
  RESULTS
}