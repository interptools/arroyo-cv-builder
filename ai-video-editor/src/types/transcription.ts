// Transcription
export interface TranscriptionResult {
  segments: TranscriptSegment[];
  language: string;
  fullText: string;
}

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  confidence: number;
  words?: WordTimestamp[];
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence: number;
}