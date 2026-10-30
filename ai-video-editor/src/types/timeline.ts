// Timeline
export interface TimelineTrack {
  id: string;
  type: 'video' | 'audio' | 'caption' | 'broll';
  clips: TimelineClip[];
}

export interface TimelineClip {
  id: string;
  assetId: string;
  trackId: string;
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  volume?: number;
  opacity?: number;
  effects?: ClipEffect[];
}

export interface ClipEffect {
  type: 'fade' | 'transition' | 'color' | 'crop';
  params: Record<string, unknown>;
}

// TTS
export interface VoiceOverSegment {
  id: string;
  text: string;
  voiceId: string;
  start: number;
  end: number;
  audioUrl?: string;
}

// Settings
export interface ProjectSettings {
  captionStyle: CaptionStyle;
  defaultVoice: string;
  brollSources: string[];
  exportQuality: '720p' | '1080p' | '4k';
  targetDuration?: number;
}

export interface CaptionStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  position: 'bottom' | 'top' | 'center';
  animation: 'none' | 'fade' | 'typewriter' | 'karaoke';
}