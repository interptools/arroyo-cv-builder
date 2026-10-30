import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VideoProject, VideoAsset } from '../types';

interface ProjectState {
  projects: VideoProject[];
  currentProject: VideoProject | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  createProject: (name: string) => VideoProject;
  loadProject: (id: string) => void;
  saveProject: (project: VideoProject) => void;
  deleteProject: (id: string) => void;
  updateProject: (updates: Partial<VideoProject>) => void;
  addVideoAsset: (asset: VideoAsset) => void;
  removeVideoAsset: (assetId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProject: null,
      isLoading: false,
      error: null,

      createProject: (name: string) => {
        const newProject: VideoProject = {
          id: crypto.randomUUID(),
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sourceVideos: [],
          timeline: [],
          settings: {
            captionStyle: {
              fontSize: 24,
              fontFamily: 'Inter, sans-serif',
              color: '#ffffff',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              position: 'bottom',
              animation: 'none',
            },
            defaultVoice: 'en-US-1',
            brollSources: ['local', 'pexels'],
            exportQuality: '1080p',
          },
        };
        set((state) => ({
          projects: [...state.projects, newProject],
          currentProject: newProject,
        }));
        return newProject;
      },

      loadProject: (id: string) => {
        const project = get().projects.find((p) => p.id === id);
        if (project) {
          set({ currentProject: project });
        }
      },

      saveProject: (project: VideoProject) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === project.id ? { ...project, updatedAt: Date.now() } : p
          ),
          currentProject:
            state.currentProject?.id === project.id
              ? { ...project, updatedAt: Date.now() }
              : state.currentProject,
        }));
      },

      deleteProject: (id: string) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProject: state.currentProject?.id === id ? null : state.currentProject,
        }));
      },

      updateProject: (updates: Partial<VideoProject>) => {
        set((state) => {
          if (!state.currentProject) return state;
          const updated = { ...state.currentProject, ...updates, updatedAt: Date.now() };
          return {
            projects: state.projects.map((p) =>
              p.id === updated.id ? updated : p
            ),
            currentProject: updated,
          };
        });
      },

      addVideoAsset: (asset: VideoAsset) => {
        set((state) => {
          if (!state.currentProject) return state;
          const updated = {
            ...state.currentProject,
            sourceVideos: [...state.currentProject.sourceVideos, asset],
            updatedAt: Date.now(),
          };
          return {
            projects: state.projects.map((p) =>
              p.id === updated.id ? updated : p
            ),
            currentProject: updated,
          };
        });
      },

      removeVideoAsset: (assetId: string) => {
        set((state) => {
          if (!state.currentProject) return state;
          const updated = {
            ...state.currentProject,
            sourceVideos: state.currentProject.sourceVideos.filter((a) => a.id !== assetId),
            updatedAt: Date.now(),
          };
          return {
            projects: state.projects.map((p) =>
              p.id === updated.id ? updated : p
            ),
            currentProject: updated,
          };
        });
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),
    }),
    {
      name: 'video-editor-projects',
      partialize: (state) => ({ projects: state.projects }),
    }
  )
);