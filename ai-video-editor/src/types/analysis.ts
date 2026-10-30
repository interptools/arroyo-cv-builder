// Analysis
export interface AnalysisResult {
  highlights: Highlight[];
  scenes: Scene[];
  topics: Topic[];
  suggestedScript: string;
  brollSuggestions: BRollSuggestion[];
}

export interface Highlight {
  id: string;
  start: number;
  end: number;
  score: number;
  reason: string;
  type: 'engagement' | 'information' | 'emotion' | 'visual';
}

export interface Scene {
  start: number;
  end: number;
  description: string;
  type: 'talking_head' | 'broll' | 'screen' | 'transition';
}

export interface Topic {
  id: string;
  name: string;
  start: number;
  end: number;
  keywords: string[];
}

// B-Roll
export interface BRollSuggestion {
  timestamp: number;
  duration: number;
  query: string;
  matchedAssets: BRollAsset[];
}

export interface BRollAsset {
  id: string;
  url: string;
  source: 'local' | 'pexels' | 'pixabay' | 'generated';
  previewUrl: string;
  duration: number;
  tags: string[];
}