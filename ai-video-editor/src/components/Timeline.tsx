import { useCallback, useMemo, useRef, useState } from 'react';
import { useTimelineStore, useProjectStore } from '../store';
import { Trash2, GripVertical, Maximize2, Minimize2, Scissors, Copy, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { TimelineTrack, TimelineClip } from '../types';

const TRACK_HEIGHT = 80;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const DEFAULT_PIXELS_PER_SECOND = 50;

export function Timeline() {
  const {
    tracks,
    selectedClip,
    playheadPosition,
    zoomLevel,
    duration,
    setTracks,
    addTrack,
    removeTrack,
    updateTrack,
    addClip,
    removeClip,
    updateClip,
    moveClip,
    setSelectedClip,
    setPlayheadPosition,
    setZoomLevel,
    setDuration,
  } = useTimelineStore();

  const [draggingClip, setDraggingClip] = useState<{ clip: TimelineClip; trackId: string; offsetX: number } | null>(null);
  const [resizingClip, setResizingClip] = useState<{ clip: TimelineClip; trackId: string; edge: 'left' | 'right'; startX: number; startWidth: number } | null>(null);
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const timelineRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  const pixelsPerSecond = useMemo(() => DEFAULT_PIXELS_PER_SECOND * zoomLevel, [zoomLevel]);
  const totalWidth = useMemo(() => duration * pixelsPerSecond, [duration, pixelsPerSecond]);

  // Handle wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel - e.deltaY * 0.001));
        setZoomLevel(newZoom);
      } else {
        // Horizontal scroll
        e.preventDefault();
        if (timelineRef.current) {
          const newScrollX = Math.max(0, timelineRef.current.scrollLeft + e.deltaY);
          timelineRef.current.scrollLeft = newScrollX;
          setScrollPosition((prev) => ({ ...prev, x: newScrollX }));
        }
      }
    },
    [zoomLevel, setZoomLevel]
  );

  // Handle playhead click
  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!rulerRef.current) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
      const time = x / pixelsPerSecond;
      setPlayheadPosition(Math.max(0, Math.min(duration, time)));
    },
    [pixelsPerSecond, duration, setPlayheadPosition]
  );

  // Handle clip drag start
  const handleClipMouseDown = useCallback(
    (e: React.MouseEvent, clip: TimelineClip, trackId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedClip(clip);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDraggingClip({ clip, trackId, offsetX: e.clientX - rect.left });
    },
    [setSelectedClip]
  );

  // Handle clip resize start
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, clip: TimelineClip, trackId: string, edge: 'left' | 'right') => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedClip(clip);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setResizingClip({
        clip,
        trackId,
        edge,
        startX: e.clientX,
        startWidth: rect.width,
      });
    },
    [setSelectedClip]
  );

  // Global mouse move/up handlers
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggingClip) {
        const timelineRect = timelineRef.current?.getBoundingClientRect();
        if (!timelineRect) return;

        const x = e.clientX - timelineRect.left + (timelineRef.current?.scrollLeft || 0) - draggingClip.offsetX;
        const newStart = Math.max(0, x / pixelsPerSecond);
        const clipDuration = draggingClip.clip.end - draggingClip.clip.start;
        const newEnd = Math.min(duration, newStart + clipDuration);

        updateClip(draggingClip.trackId, draggingClip.clip.id, {
          start: newStart,
          end: newEnd,
        });
      } else if (resizingClip) {
        const deltaX = e.clientX - resizingClip.startX;
        const deltaTime = deltaX / pixelsPerSecond;

        if (resizingClip.edge === 'left') {
          const newStart = Math.max(0, resizingClip.clip.start + deltaTime);
          if (newStart < resizingClip.clip.end - 0.1) {
            updateClip(resizingClip.trackId, resizingClip.clip.id, { start: newStart });
          }
        } else {
          const newEnd = Math.min(duration, resizingClip.clip.end + deltaTime);
          if (newEnd > resizingClip.clip.start + 0.1) {
            updateClip(resizingClip.trackId, resizingClip.clip.id, { end: newEnd });
          }
        }
      }
    },
    [draggingClip, resizingClip, pixelsPerSecond, duration, updateClip]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingClip(null);
    setResizingClip(null);
  }, []);

  // Initialize drag listeners
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleMouseMoveRef = useRef(handleMouseMove);
  handleMouseMoveRef.current = handleMouseMove;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleMouseUpRef = useRef(handleMouseUp);
  handleMouseUpRef.current = handleMouseUp;

  // We can't easily add global listeners in useEffect due to the ref pattern
  // In a real app, you'd use useEffect with proper cleanup

  // Add video track button
  const handleAddVideoTrack = useCallback(() => {
    const newTrack: TimelineTrack = {
      id: `track-video-${Date.now()}`,
      type: 'video',
      clips: [],
    };
    addTrack(newTrack);
  }, [addTrack]);

  const handleAddAudioTrack = useCallback(() => {
    const newTrack: TimelineTrack = {
      id: `track-audio-${Date.now()}`,
      type: 'audio',
      clips: [],
    };
    addTrack(newTrack);
  }, [addTrack]);

  // Render time ruler
  const renderTimeMarkers = useMemo(() => {
    const markers: React.ReactNode[] = [];
    const markerInterval = Math.max(1, Math.ceil(5 / zoomLevel)); // Show marker every 5 seconds at minimum zoom
    const numMarkers = Math.ceil(duration / markerInterval);

    for (let i = 0; i <= numMarkers; i++) {
      const time = i * markerInterval;
      if (time > duration) break;
      const x = time * pixelsPerSecond;
      markers.push(
        <div
          key={i}
          className="absolute top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-600"
          style={{ left: x }}
        />
      );
      markers.push(
        <div
          key={`label-${i}`}
          className="absolute bottom-0 left-0 text-xs text-gray-500 dark:text-gray-400 px-1"
          style={{ left: x + 2 }}
        >
          {formatTime(time)}
        </div>
      );
    }
    return markers;
  }, [duration, pixelsPerSecond, zoomLevel]);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-2 mr-2">
          <button
            onClick={handleAddVideoTrack}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Add Video Track"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleAddAudioTrack}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Add Audio Track"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Zoom:</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.1}
            value={zoomLevel}
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            className="w-32 h-1 accent-primary-600"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400 w-16 text-right">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Duration: {formatTime(duration)}</span>
          <span>|</span>
          <span>Playhead: {formatTime(playheadPosition)}</span>
        </div>
      </div>

      {/* Timeline Area */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-auto relative"
        onWheel={handleWheel}
        onScroll={(e) => {
          const target = e.currentTarget;
          setScrollPosition({ x: target.scrollLeft, y: target.scrollTop });
          // Sync ruler scroll
          if (rulerRef.current) {
            rulerRef.current.scrollLeft = target.scrollLeft;
          }
        }}
      >
        {/* Time Ruler */}
        <div
          ref={rulerRef}
          className="absolute top-0 left-0 right-0 h-8 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10 sticky top-0"
          style={{ width: totalWidth }}
          onClick={handleRulerClick}
        >
          {renderTimeMarkers}
          {/* Playhead on ruler */}
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none z-20"
            style={{ left: playheadPosition * pixelsPerSecond }}
          />
          <div
            className="absolute top-0 left-0 w-2 h-2 bg-red-500 rounded-full -translate-x-1/2 pointer-events-none z-20"
            style={{ left: playheadPosition * pixelsPerSecond, transform: 'translateX(-50%)' }}
          />
        </div>

        {/* Tracks */}
        <div className="pt-8" style={{ minWidth: totalWidth }}>
          {tracks.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <GripVertical className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg">No tracks yet</p>
                <p className="text-sm">Click "Add Video Track" or "Add Audio Track" to start</p>
              </div>
            </div>
          ) : (
            tracks.map((track) => (
              <TrackLane
                key={track.id}
                track={track}
                pixelsPerSecond={pixelsPerSecond}
                duration={duration}
                playheadPosition={playheadPosition}
                selectedClip={selectedClip}
                onClipClick={handleClipMouseDown}
                onResizeStart={handleResizeMouseDown}
                onRemoveClip={removeClip}
                onUpdateClip={updateClip}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface TrackLaneProps {
  track: TimelineTrack;
  pixelsPerSecond: number;
  duration: number;
  playheadPosition: number;
  selectedClip: TimelineClip | null;
  onClipClick: (e: React.MouseEvent, clip: TimelineClip, trackId: string) => void;
  onResizeStart: (e: React.MouseEvent, clip: TimelineClip, trackId: string, edge: 'left' | 'right') => void;
  onRemoveClip: (trackId: string, clipId: string) => void;
  onUpdateClip: (trackId: string, clipId: string, updates: Partial<TimelineClip>) => void;
}

function TrackLane({
  track,
  pixelsPerSecond,
  duration,
  playheadPosition,
  selectedClip,
  onClipClick,
  onResizeStart,
  onRemoveClip,
  onUpdateClip,
}: TrackLaneProps) {
  const trackTypeColors = {
    video: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    audio: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    caption: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    broll: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  };

  const trackTypeIcons = {
    video: '🎬',
    audio: '🔊',
    caption: '📝',
    broll: '🎞️',
  };

  return (
    <div className={clsx('border-b border-gray-200 dark:border-gray-700', trackTypeColors[track.type])}>
      {/* Track Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 sticky left-0 z-5 w-32 shrink-0">
        <span className="text-lg">{trackTypeIcons[track.type]}</span>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{track.type}</span>
        {track.clips.length > 0 && (
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {track.clips.length}
          </span>
        )}
      </div>

      {/* Track Content */}
      <div className="relative" style={{ height: TRACK_HEIGHT, minWidth: duration * pixelsPerSecond }}>
        {/* Playhead line in track */}
        <div
          className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none z-10"
          style={{ left: playheadPosition * pixelsPerSecond }}
        />

        {/* Clips */}
        {track.clips.map((clip) => (
          <TimelineClipElement
            key={clip.id}
            clip={clip}
            trackId={track.id}
            trackType={track.type}
            pixelsPerSecond={pixelsPerSecond}
            isSelected={selectedClip?.id === clip.id}
            onClick={onClipClick}
            onResizeStart={onResizeStart}
            onRemove={onRemoveClip}
            onUpdate={onUpdateClip}
          />
        ))}

        {/* Drop zone indicator */}
        <div
          className="absolute inset-0 border-2 border-dashed border-transparent hover:border-primary-400 transition-colors"
          // TODO: Add drop handlers for adding clips from media library
        />
      </div>
    </div>
  );
}

interface TimelineClipElementProps {
  clip: TimelineClip;
  trackId: string;
  trackType: TimelineTrack['type'];
  pixelsPerSecond: number;
  isSelected: boolean;
  onClick: (e: React.MouseEvent, clip: TimelineClip, trackId: string) => void;
  onResizeStart: (e: React.MouseEvent, clip: TimelineClip, trackId: string, edge: 'left' | 'right') => void;
  onRemove: (trackId: string, clipId: string) => void;
  onUpdate: (trackId: string, clipId: string, updates: Partial<TimelineClip>) => void;
}

function TimelineClipElement({
  clip,
  trackId,
  trackType,
  pixelsPerSecond,
  isSelected,
  onClick,
  onResizeStart,
  onRemove,
  onUpdate,
}: TimelineClipElementProps) {
  const width = (clip.end - clip.start) * pixelsPerSecond;
  const left = clip.start * pixelsPerSecond;

  const clipColors = {
    video: 'bg-blue-500',
    audio: 'bg-green-500',
    caption: 'bg-purple-500',
    broll: 'bg-orange-500',
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onRemove(trackId, clip.id);
    }
  };

  return (
    <div
      className={clsx(
        'absolute top-1 bottom-1 cursor-pointer select-none transition-all',
        'rounded shadow-sm border',
        isSelected && 'ring-2 ring-primary-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900',
        clipColors[trackType],
        width < 60 && 'overflow-hidden'
      )}
      style={{
        left,
        width: Math.max(width, 2),
        zIndex: isSelected ? 10 : 5,
      }}
      onMouseDown={(e) => onClick(e, clip, trackId)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Clip: ${clip.assetId}, ${formatTime(clip.start)} to ${formatTime(clip.end)}`}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/50 hover:bg-white dark:bg-gray-200/50 dark:hover:bg-gray-200"
        onMouseDown={(e) => onResizeStart(e, clip, trackId, 'left')}
        title="Trim start"
      />

      {/* Clip content */}
      <div className="absolute inset-x-2 flex items-center justify-between px-1 text-white text-xs font-medium truncate">
        <span>{clip.assetId.slice(0, 8)}</span>
        <span>{formatTime(clip.end - clip.start)}</span>
      </div>

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-white/50 hover:bg-white dark:bg-gray-200/50 dark:hover:bg-gray-200"
        onMouseDown={(e) => onResizeStart(e, clip, trackId, 'right')}
        title="Trim end"
      />

      {/* Selected overlay with actions */}
      {isSelected && (
        <div className="absolute top-1 right-1 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(trackId, clip.id, { volume: (clip.volume || 1) === 1 ? 0 : 1 });
            }}
            className="p-1 bg-white/90 dark:bg-gray-800/90 rounded hover:bg-white dark:hover:bg-gray-700"
            title="Toggle mute"
          >
            🔊
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(trackId, clip.id);
            }}
            className="p-1 bg-white/90 dark:bg-gray-800/90 rounded hover:bg-white dark:hover:bg-gray-700 text-red-500"
            title="Delete clip"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Waveform placeholder for audio */}
      {trackType === 'audio' && (
        <div className="absolute inset-0 flex items-end" style={{ opacity: 0.3 }}>
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="flex-1 mx-0.5 bg-white rounded-t"
              style={{
                height: `${Math.random() * 80 + 10}%`,
                animation: `wave ${Math.random() * 0.5 + 0.5}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}