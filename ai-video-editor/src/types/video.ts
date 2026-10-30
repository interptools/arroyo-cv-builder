// Video Project
export interface VideoProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sourceVideos: VideoAsset[];
  timeline: TimelineTrack[];
  settings: ProjectSettings;
}

// Video Asset
export interface VideoAsset {
  id: string;
  file: File;
  name: string;
  duration: number;
  width: number;
  height: number;
  thumbnail: string;
  transcription?: TranscriptionResult;
  analysis?: AnalysisResult;
}