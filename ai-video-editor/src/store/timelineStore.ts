import { create } from 'zustand';
import type { TimelineTrack, TimelineClip } from '../types';

interface TimelineState {
  tracks: TimelineTrack[];
  selectedClip: TimelineClip | null;
  playheadPosition: number;
  zoomLevel: number;
  duration: number;

  // Actions
  setTracks: (tracks: TimelineTrack[]) => void;
  addTrack: (track: TimelineTrack) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;
  addClip: (trackId: string, clip: TimelineClip) => void;
  removeClip: (trackId: string, clipId: string) => void;
  updateClip: (trackId: string, clipId: string, updates: Partial<TimelineClip>) => void;
  moveClip: (clipId: string, newTrackId: string, newStart: number) => void;
  setSelectedClip: (clip: TimelineClip | null) => void;
  setPlayheadPosition: (position: number) => void;
  setZoomLevel: (zoom: number) => void;
  setDuration: (duration: number) => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  tracks: [],
  selectedClip: null,
  playheadPosition: 0,
  zoomLevel: 1,
  duration: 0,

  setTracks: (tracks) => set({ tracks }),
  addTrack: (track) => set((state) => ({ tracks: [...state.tracks, track] })),
  removeTrack: (trackId) =>
    set((state) => ({ tracks: state.tracks.filter((t) => t.id !== trackId) })),
  updateTrack: (trackId, updates) =>
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, ...updates } : t)),
    })),

  addClip: (trackId, clip) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
      ),
    })),
  removeClip: (trackId, clipId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) } : t
      ),
    })),
  updateClip: (trackId, clipId, updates) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)) }
          : t
      ),
    })),
  moveClip: (clipId, newTrackId, newStart) =>
    set((state) => {
      let movingClip: TimelineClip | null = null;
      const newTracks = state.tracks.map((t) => {
        const clipIndex = t.clips.findIndex((c) => c.id === clipId);
        if (clipIndex !== -1) {
          movingClip = t.clips[clipIndex];
          return { ...t, clips: t.clips.filter((c) => c.id !== clipId) };
        }
        return t;
      });

      if (movingClip) {
        const duration = movingClip.end - movingClip.start;
        const updatedClip = { ...movingClip, trackId: newTrackId, start: newStart, end: newStart + duration };
        return {
          tracks: newTracks.map((t) =>
            t.id === newTrackId ? { ...t, clips: [...t.clips, updatedClip] } : t
          ),
        };
      }
      return { tracks: newTracks };
    }),

  setSelectedClip: (clip) => set({ selectedClip: clip }),
  setPlayheadPosition: (position) => set({ playheadPosition: position }),
  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),
  setDuration: (duration) => set({ duration }),
}));