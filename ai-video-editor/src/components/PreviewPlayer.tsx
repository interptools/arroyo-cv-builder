import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimelineStore, useProjectStore } from '../store';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  Settings,
  Camera,
} from 'lucide-react';
import { clsx } from 'clsx';

export function PreviewPlayer() {
  const { playheadPosition, setPlayheadPosition, duration, tracks } = useTimelineStore();
  const { currentProject } = useProjectStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(null);
  const lastFrameTime = useRef(0);

  // Build media stream from timeline
  const mediaSources = useCallback(() => {
    if (!currentProject) return [];
    const videoTracks = tracks.filter((t) => t.type === 'video' || t.type === 'broll');
    const audioTracks = tracks.filter((t) => t.type === 'audio');

    // For now, we'll just play the first video track
    // In a real implementation, you'd use FFmpeg.wasm to compose the timeline
    const firstVideoTrack = videoTracks[0];
    if (!firstVideoTrack || firstVideoTrack.clips.length === 0) return [];

    return firstVideoTrack.clips.map((clip) => {
      const asset = currentProject.sourceVideos.find((a) => a.id === clip.assetId);
      return asset?.file;
    }).filter(Boolean) as File[];
  }, [currentProject, tracks]);

  // Initialize video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = isMuted ? 0 : volume;
    video.playbackRate = playbackRate;

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration);
      setError(null);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      setPlayheadPosition(video.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setPlayheadPosition(0);
      video.currentTime = 0;
    };

    const handleError = () => {
      setError('Failed to load video');
      setIsPlaying(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [isMuted, volume, playbackRate, setPlayheadPosition]);

  // Sync playhead position to video
  useEffect(() => {
    const video = videoRef.current;
    if (video && Math.abs(video.currentTime - playheadPosition) > 0.5) {
      video.currentTime = playheadPosition;
    }
  }, [playheadPosition]);

  // Play/pause logic
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setPlayheadPosition(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, [setPlayheadPosition]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
  }, []);

  const handleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.fullscreenElement) {
      video.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  }, []);

  const handleCaptureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const link = document.createElement('a');
      link.download = `frame-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  }, []);

  const handleReset = useCallback(() => {
    setPlayheadPosition(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [setPlayheadPosition]);

  // Get the current video file to play
  const videoFile = mediaSources()[0];
  const videoUrl = videoFile ? URL.createObjectURL(videoFile) : null;

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  return (
    <div className="flex flex-col h-full bg-black relative">
      {/* Video Display Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-red-400 p-4 text-center z-10">
            <div>
              <p className="text-lg font-medium">Unable to play video</p>
              <p className="text-sm opacity-75 mt-1">{error}</p>
              <p className="text-xs opacity-50 mt-2">Add video clips to the timeline to preview</p>
            </div>
          </div>
        )}

        {!videoUrl && !error && (
          <div className="text-center text-gray-500 p-8">
            <div className="text-6xl mb-4">🎬</div>
            <p className="text-lg">No video to preview</p>
            <p className="text-sm opacity-75">Add video clips to the timeline</p>
          </div>
        )}

        <video
          ref={videoRef}
          src={videoUrl || undefined}
          className={clsx(
            'max-w-full max-h-full object-contain',
            videoUrl ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          playsInline
          muted={isMuted}
        />
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none opacity-0" />
      </div>

      {/* Controls Bar */}
      <div className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 p-3">
        {/* Progress Bar */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs text-gray-400 w-16 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={videoDuration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 appearance-none bg-gray-700 rounded-full accent-primary-500 cursor-pointer"
            step="0.1"
          />
          <span className="text-xs text-gray-400 w-16">
            {formatTime(videoDuration || duration)}
          </span>
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-1 mb-2">
          <button
            onClick={handleReset}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title="Restart (Home)"
            aria-label="Restart"
          >
            <RotateCcw className="h-5 w-5" />
          </button>

          <button
            onClick={() => setPlayheadPosition(Math.max(0, playheadPosition - 5))}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title="Rewind 5s (←)"
            aria-label="Rewind 5 seconds"
          >
            <SkipBack className="h-5 w-5" />
          </button>

          <button
            onClick={togglePlay}
            className="p-3 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors bg-gray-800"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </button>

          <button
            onClick={() => setPlayheadPosition(Math.min(duration, playheadPosition + 5))}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            title="Forward 5s (→)"
            aria-label="Forward 5 seconds"
          >
            <SkipForward className="h-5 w-5" />
          </button>

          <div className="w-px h-8 bg-gray-700 mx-2" />

          {/* Volume */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMute}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 appearance-none bg-gray-700 rounded-full accent-primary-500 cursor-pointer"
            />
          </div>

          <div className="w-px h-8 bg-gray-700 mx-2" />

          {/* Playback Rate */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="Playback Speed"
              aria-label="Playback Speed"
            >
              <span className="text-xs font-mono">{playbackRate}x</span>
            </button>
            {showSettings && (
              <div className="absolute bottom-full right-0 mb-2 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-1 z-20">
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      handlePlaybackRateChange(rate);
                      setShowSettings(false);
                    }}
                    className={clsx(
                      'w-20 px-3 py-1.5 text-left text-sm hover:bg-gray-700 transition-colors',
                      playbackRate === rate && 'bg-primary-600 text-white'
                    )}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Capture Frame */}
          <button
            onClick={handleCaptureFrame}
            disabled={!videoUrl || isPlaying}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Capture Frame (C)"
            aria-label="Capture Frame"
          >
            <Camera className="h-5 w-5" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            disabled={!videoUrl}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Fullscreen (F)"
            aria-label="Fullscreen"
          >
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>

        {/* Info Bar */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {videoFile ? `Playing: ${videoFile.name}` : 'No video loaded'}
          </span>
          <span>
            {videoRef.current?.videoWidth}x{videoRef.current?.videoHeight} • {playbackRate}x
          </span>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}