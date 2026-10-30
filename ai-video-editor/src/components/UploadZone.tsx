import { useCallback, useRef, useState } from 'react';
import { useProjectStore } from '../store';
import { Upload, FileVideo, X, Loader2, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import type { VideoAsset } from '../types';

interface UploadZoneProps {
  onUploadComplete?: (assets: VideoAsset[]) => void;
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addVideoAsset = useProjectStore((state) => state.addVideoAsset);

  const generateThumbnail = useCallback((file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadeddata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          video.currentTime = Math.min(1, video.duration / 2);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          resolve('');
        }
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
    });
  }, []);

  const getVideoDuration = useCallback((file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve(video.duration);
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
    });
  }, []);

  const getVideoDimensions = useCallback((file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve({ width: video.videoWidth, height: video.videoHeight });
        URL.revokeObjectURL(video.src);
      });
      video.src = URL.createObjectURL(file);
    });
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) => f.type.startsWith('video/'));
      if (fileArray.length === 0) return;

      setUploading(true);
      const newAssets: VideoAsset[] = [];

      for (const file of fileArray) {
        setProgress((prev) => ({ ...prev, [file.name]: 0 }));

        try {
          const [duration, dimensions, thumbnail] = await Promise.all([
            getVideoDuration(file),
            getVideoDimensions(file),
            generateThumbnail(file),
          ]);

          const asset: VideoAsset = {
            id: crypto.randomUUID(),
            file,
            name: file.name,
            duration,
            width: dimensions.width,
            height: dimensions.height,
            thumbnail,
          };

          addVideoAsset(asset);
          newAssets.push(asset);
          setProgress((prev) => ({ ...prev, [file.name]: 100 }));
        } catch (error) {
          console.error(`Failed to process ${file.name}:`, error);
          setProgress((prev) => ({ ...prev, [file.name]: -1 }));
        }
      }

      setUploading(false);
      setProgress({});
      onUploadComplete?.(newAssets);
    },
    [addVideoAsset, generateThumbnail, getVideoDuration, getVideoDimensions, onUploadComplete]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
      e.target.value = '';
    },
    [handleFiles]
  );

  const handleRemoveAsset = useCallback(
    (assetId: string) => {
      useProjectStore.getState().removeVideoAsset(assetId);
    },
    []
  );

  const currentProject = useProjectStore((state) => state.currentProject);
  const assets = currentProject?.sourceVideos || [];

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={clsx(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
          isDragOver
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />

        <div className="relative z-10">
          <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
            Drag & drop video files here
          </p>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            or click to browse (MP4, WebM, MOV, AVI)
          </p>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileVideo className="h-4 w-4" />
            Select Videos
          </button>
        </div>

        {uploading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 rounded-xl flex items-center justify-center z-20">
            <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
          </div>
        )}
      </div>

      {/* Upload Progress */}
      {Object.keys(progress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(progress).map(([fileName, prog]) => (
            <div key={fileName} className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full transition-all duration-300',
                    prog === -1 ? 'bg-red-500' : 'bg-primary-600'
                  )}
                  style={{ width: `${Math.max(0, prog)}%` }}
                />
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400 w-48 truncate">
                {fileName}
              </span>
              {prog === 100 && (
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              )}
              {prog === -1 && (
                <span className="text-sm text-red-500 flex-shrink-0">Failed</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Assets List */}
      {assets.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Uploaded Videos ({assets.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="relative group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="aspect-video relative">
                  {asset.thumbnail ? (
                    <img
                      src={asset.thumbnail}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                      <FileVideo className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {Math.floor(asset.duration / 60)}:{String(Math.floor(asset.duration % 60)).padStart(2, '0')}
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {asset.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {asset.width}×{asset.height} • {formatFileSize(asset.file.size)}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveAsset(asset.id)}
                  className="absolute top-1 right-1 p-1 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  aria-label="Remove video"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}