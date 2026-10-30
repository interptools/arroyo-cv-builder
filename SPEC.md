# AI Video Editor for Vlogging - Specification

## Overview
A browser-based, local-first AI video editor that helps vloggers automatically edit videos with:
- AI transcription & captions (Whisper)
- AI video analysis & highlight detection
- Auto B-roll selection & insertion
- AI voice-over generation (TTS)
- Timeline editing & export

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Video Processing**: FFmpeg.wasm (browser-based)
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **AI Models**: 
  - Local: Whisper.cpp (WASM), Llama.cpp (WASM) via WebGPU
  - Cloud: Gemini API (free tier) for analysis/summarization
  - TTS: Local (piper/coqui) or Cloud (ElevenLabs free tier, Gemini TTS)
- **Storage**: IndexedDB (idb) for local video/assets
- **Workers**: Web Workers for heavy processing

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React App (Main Thread)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Upload  │ │ Timeline │ │ Preview  │ │ Settings │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
      │  Worker:    │ │  Worker:    │ │  Worker:    │
      │ Transcribe  │ │  Analyze    │ │   TTS       │
      │ (Whisper)   │ │  (Llama/    │ │  (Local/    │
      │             │ │   Gemini)   │ │   Cloud)    │
      └─────────────┘ └─────────────┘ └─────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                    ┌─────────────────┐
                    │  FFmpeg.wasm    │
                    │  (Video Assembly)│
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   IndexedDB     │
                    │  (Assets/Projects)│
                    └─────────────────┘
```

## File Structure

```
ai-video-editor/
├── public/
│   ├── models/              # WASM model files (whisper, llama)
│   ├── ffmpeg/              # FFmpeg.wasm core files
│   └── workers/             # Web Worker scripts
├── src/
│   ├── components/
│   │   ├── UploadZone.tsx
│   │   ├── Timeline.tsx
│   │   ├── PreviewPlayer.tsx
│   │   ├── BRollPanel.tsx
│   │   ├── CaptionEditor.tsx
│   │   ├── VoiceOverPanel.tsx
│   │   ├── ExportModal.tsx
│   │   └── SettingsPanel.tsx
│   ├── hooks/
│   │   ├── useVideoProject.ts
│   │   ├── useTranscription.ts
│   │   ├── useAnalysis.ts
│   │   ├── useTTS.ts
│   │   └── useFFmpeg.ts
│   ├── workers/
│   │   ├── transcription.worker.ts
│   │   ├── analysis.worker.ts
│   │   └── tts.worker.ts
│   ├── services/
│   │   ├── ffmpeg.ts
│   │   ├── whisper.ts
│   │   ├── llama.ts
│   │   ├── gemini.ts
│   │   ├── tts.ts
│   │   ├── broll.ts
│   │   └── storage.ts
│   ├── store/
│   │   ├── projectStore.ts
│   │   ├── timelineStore.ts
│   │   └── settingsStore.ts
│   ├── types/
│   │   ├── video.ts
│   │   ├── transcription.ts
│   │   ├── analysis.ts
│   │   └── timeline.ts
│   ├── utils/
│   │   ├── time.ts
│   │   ├── video.ts
│   │   └── download.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## Data Types

```typescript
// Video Project
interface VideoProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sourceVideos: VideoAsset[];
  timeline: TimelineTrack[];
  settings: ProjectSettings;
}

// Video Asset
interface VideoAsset {
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

// Transcription
interface TranscriptionResult {
  segments: TranscriptSegment[];
  language: string;
  fullText: string;
}

interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  confidence: number;
  words?: WordTimestamp[];
}

// Analysis
interface AnalysisResult {
  highlights: Highlight[];
  scenes: Scene[];
  topics: Topic[];
  suggestedScript: string;
  brollSuggestions: BRollSuggestion[];
}

interface Highlight {
  id: string;
  start: number;
  end: number;
  score: number;
  reason: string;
  type: 'engagement' | 'information' | 'emotion' | 'visual';
}

interface Scene {
  start: number;
  end: number;
  description: string;
  type: 'talking_head' | 'broll' | 'screen' | 'transition';
}

// B-Roll
interface BRollSuggestion {
  timestamp: number;
  duration: number;
  query: string;
  matchedAssets: BRollAsset[];
}

interface BRollAsset {
  id: string;
  url: string;
  source: 'local' | 'pexels' | 'pixabay' | 'generated';
  previewUrl: string;
  duration: number;
  tags: string[];
}

// Timeline
interface TimelineTrack {
  id: string;
  type: 'video' | 'audio' | 'caption' | 'broll';
  clips: TimelineClip[];
}

interface TimelineClip {
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

// TTS
interface VoiceOverSegment {
  id: string;
  text: string;
  voiceId: string;
  start: number;
  end: number;
  audioUrl?: string;
}

// Settings
interface ProjectSettings {
  captionStyle: CaptionStyle;
  defaultVoice: string;
  brollSources: string[];
  exportQuality: '720p' | '1080p' | '4k';
  targetDuration?: number;
}

interface CaptionStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  position: 'bottom' | 'top' | 'center';
  animation: 'none' | 'fade' | 'typewriter' | 'karaoke';
}
```

## AI Pipeline

### 1. Transcription (Whisper.cpp WASM)
- Input: Video file → Extract audio → Whisper
- Output: Timestamped segments with word-level timestamps
- Model: whisper-base.en (or tiny for speed) compiled to WASM
- Runs in Web Worker

### 2. Analysis (Llama.cpp WASM + Gemini)
- Input: Full transcription + video metadata
- Local: Llama for highlight detection, topic extraction
- Cloud: Gemini for script generation, B-roll queries
- Output: Highlights, scenes, topics, suggested script, B-roll queries

### 3. B-Roll Selection
- Local library: User's uploaded B-roll folder
- Stock APIs: Pexels, Pixabay (free, no key needed for basic)
- AI-generated: Stable Diffusion (optional, local)
- Matching: Semantic search using embeddings

### 4. Voice-Over (TTS)
- Local: Piper TTS (WASM) - fast, good quality
- Cloud: ElevenLabs (free tier), Gemini TTS
- Input: Script (user-provided or AI-generated)
- Output: Audio segments with timestamps

### 5. Assembly (FFmpeg.wasm)
- Combine: Video tracks + B-roll + Voice-over + Captions + Music
- Effects: Transitions, color correction, captions burn-in
- Export: MP4 (H.264) or WebM

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Project setup: Vite + React + TypeScript + Tailwind
- [ ] FFmpeg.wasm integration
- [ ] IndexedDB storage layer
- [ ] Basic UI: Upload, Project list, Settings
- [ ] Video asset management

### Phase 2: Transcription (Week 1-2)
- [ ] Whisper.cpp WASM integration
- [ ] Transcription worker
- [ ] Caption editor UI
- [ ] Export SRT/VTT

### Phase 3: Analysis (Week 2)
- [ ] Llama.cpp WASM integration
- [ ] Analysis worker
- [ ] Gemini API integration (free tier)
- [ ] Highlights, scenes, topics UI

### Phase 4: B-Roll & TTS (Week 2-3)
- [ ] B-Roll panel with stock search
- [ ] Local B-Roll library
- [ ] TTS integration (Piper WASM + cloud fallback)
- [ ] Voice-over panel

### Phase 5: Timeline & Export (Week 3)
- [ ] Timeline editor (drag-drop, trim, split)
- [ ] Real-time preview
- [ ] FFmpeg assembly pipeline
- [ ] Export with progress

### Phase 6: Polish (Week 3-4)
- [ ] Keyboard shortcuts
- [ ] Presets/templates
- [ ] Performance optimization
- [ ] Documentation

## Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.0",
    "idb": "^8.0.0",
    "@ffmpeg/ffmpeg": "^0.12.0",
    "@ffmpeg/util": "^0.12.0",
    "tailwindcss": "^3.4.0",
    "lucide-react": "^0.300.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

## Model Files Needed (download to public/models/)

- `whisper-tiny.en.bin` (~39 MB) - Fast transcription
- `whisper-base.en.bin` (~142 MB) - Better quality
- `ggml-tiny-llama.bin` (~300 MB) - Analysis (or use Gemini only)
- `piper-voices/*.onnx` - TTS voices

## Environment Variables

```env
VITE_GEMINI_API_KEY=your_gemini_key
VITE_ELEVENLABS_API_KEY=your_elevenlabs_key (optional)
VITE_PEXELS_API_KEY=your_pexels_key (optional)
```

## Key Features Priority

| Feature | Priority | Implementation |
|---------|----------|----------------|
| Video Upload & Management | P0 | Phase 1 |
| Transcription (Whisper) | P0 | Phase 2 |
| Caption Editor | P0 | Phase 2 |
| AI Analysis (Highlights) | P1 | Phase 3 |
| B-Roll Search & Insert | P1 | Phase 4 |
| Voice-Over (TTS) | P1 | Phase 4 |
| Timeline Editor | P0 | Phase 5 |
| Video Export | P0 | Phase 5 |
| Project Save/Load | P1 | Phase 1 |
| Templates/Presets | P2 | Phase 6 |