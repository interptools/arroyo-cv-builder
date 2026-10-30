import { useCallback, useMemo, useState } from 'react';
import { useProjectStore, useTimelineStore, useSettingsStore } from '../store';
import {
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  GripVertical,
  Download,
  Upload,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  SliderHorizontal,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { TranscriptSegment, CaptionStyle, TimelineClip, TimelineTrack } from '../types';

export function CaptionEditor() {
  const { currentProject } = useProjectStore();
  const { tracks, addTrack, addClip, updateClip, removeClip } = useTimelineStore();
  const { defaultProjectSettings, updateDefaultProjectSettings } = useSettingsStore();

  const [editingSegment, setEditingSegment] = useState<TranscriptSegment | null>(null);
  const [editText, setEditText] = useState('');
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(defaultProjectSettings.captionStyle);
  const [showStyleEditor, setShowStyleEditor] = useState(false);

  // Get transcription segments from current project
  const segments = useMemo(() => {
    if (!currentProject) return [];
    return currentProject.sourceVideos.flatMap((v) => v.transcription?.segments || []);
  }, [currentProject]);

  // Get caption track
  const captionTrack = tracks.find((t) => t.type === 'caption');

  // Handle editing a segment
  const handleEdit = useCallback((segment: TranscriptSegment) => {
    setEditingSegment(segment);
    setEditText(segment.text);
  }, []);

  const handleSave = useCallback(() => {
    if (!editingSegment) return;
    // Update the segment in the project
    // This would require updating the project store with the new transcription
    setEditingSegment(null);
    setEditText('');
  }, [editingSegment]);

  const handleCancel = useCallback(() => {
    setEditingSegment(null);
    setEditText('');
  }, []);

  // Create caption track from transcription
  const handleGenerateCaptions = useCallback(() => {
    if (segments.length === 0) return;

    let track = captionTrack;
    if (!track) {
      const newTrack: TimelineTrack = {
        id: `track-caption-${Date.now()}`,
        type: 'caption',
        clips: [],
      };
      addTrack(newTrack);
      track = newTrack;
    }

    // Clear existing caption clips
    track.clips.forEach((clip) => removeClip(track.id, clip.id));

    // Add new caption clips from segments
    segments.forEach((segment) => {
      addClip(track.id, {
        id: crypto.randomUUID(),
        assetId: `caption-${segment.id}`,
        trackId: track.id,
        start: segment.start,
        end: segment.end,
        sourceStart: 0,
        sourceEnd: segment.end - segment.start,
      });
    });
  }, [segments, captionTrack, addTrack, addClip, removeClip]);

  // Export captions as SRT
  const handleExportSRT = useCallback(() => {
    if (segments.length === 0) return;

    const srtContent = segments
      .map((segment, index) => {
        const start = formatSRTTime(segment.start);
        const end = formatSRTTime(segment.end);
        return `${index + 1}\n${start} --> ${end}\n${segment.text}\n`;
      })
      .join('\n');

    downloadFile(srtContent, 'captions.srt', 'text/plain');
  }, [segments]);

  // Export captions as VTT
  const handleExportVTT = useCallback(() => {
    if (segments.length === 0) return;

    const vttContent = `WEBVTT\n\n${segments
      .map((segment) => {
        const start = formatVTTTime(segment.start);
        const end = formatVTTTime(segment.end);
        return `${start} --> ${end}\n${segment.text}\n`;
      })
      .join('\n\n')}`;

    downloadFile(vttContent, 'captions.vtt', 'text/vtt');
  }, [segments]);

  // Import captions
  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      // TODO: Parse SRT/VTT and update segments
      console.log('Imported captions:', content);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Type className="h-5 w-5" />
          Captions
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowStyleEditor(!showStyleEditor)}
            className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Caption Style"
          >
            <Palette className="h-5 w-5" />
          </button>
          <button
            onClick={handleGenerateCaptions}
            disabled={segments.length === 0}
            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Generate from Transcription
          </button>
        </div>
      </div>

      {/* Style Editor */}
      {showStyleEditor && (
        <CaptionStyleEditor
          style={captionStyle}
          onChange={setCaptionStyle}
          onSave={(style) => {
            updateDefaultProjectSettings({ captionStyle: style });
            setShowStyleEditor(false);
          }}
          onCancel={() => setShowStyleEditor(false)}
        />
      )}

      {/* Segments List */}
      <div className="flex-1 overflow-y-auto p-3">
        {segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <Type className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg">No transcription available</p>
            <p className="text-sm mt-1">Transcribe a video first to edit captions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Export/Import actions */}
            <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <button
                onClick={handleExportSRT}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
              >
                <Download className="h-4 w-4" />
                Export SRT
              </button>
              <button
                onClick={handleExportVTT}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
              >
                <Download className="h-4 w-4" />
                Export VTT
              </button>
              <input
                type="file"
                accept=".srt,.vtt"
                onChange={handleImport}
                className="sr-only"
                id="caption-import"
              />
              <label
                htmlFor="caption-import"
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                Import
              </label>
            </div>

            {/* Segment list */}
            <div className="space-y-1 max-h-[calc(100%-120px)] overflow-y-auto">
              {segments.map((segment) => (
                <CaptionSegmentRow
                  key={segment.id}
                  segment={segment}
                  isEditing={editingSegment?.id === segment.id}
                  editText={editText}
                  onEdit={handleEdit}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  onTextChange={setEditText}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CaptionSegmentRowProps {
  segment: TranscriptSegment;
  isEditing: boolean;
  editText: string;
  onEdit: (segment: TranscriptSegment) => void;
  onSave: () => void;
  onCancel: () => void;
  onTextChange: (text: string) => void;
}

function CaptionSegmentRow({
  segment,
  isEditing,
  editText,
  onEdit,
  onSave,
  onCancel,
  onTextChange,
}: CaptionSegmentRowProps) {
  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-all',
        isEditing && 'ring-2 ring-primary-500 border-transparent'
      )}
    >
      {isEditing ? (
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono w-20">
              {formatTime(segment.start)} → {formatTime(segment.end)}
            </span>
            <input
              type="text"
              value={editText}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave();
                if (e.key === 'Escape') onCancel();
              }}
              autoFocus
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button onClick={onSave} className="p-2 text-green-500 hover:bg-green-50 rounded-lg">
              <Save className="h-5 w-5" />
            </button>
            <button onClick={onCancel} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Confidence: {Math.round(segment.confidence * 100)}%</span>
            {segment.words && (
              <span>{segment.words.length} words</span>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => onEdit(segment)}
          className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-start gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono w-20 mt-1">
              {formatTime(segment.start)} → {formatTime(segment.end)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 dark:text-gray-100">{segment.text}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>Confidence: {Math.round(segment.confidence * 100)}%</span>
                {segment.words && <span>{segment.words.length} words</span>}
              </div>
            </div>
            <Edit className="h-4 w-4 text-gray-400 hover:text-primary-500 transition-colors flex-shrink-0 mt-1" />
          </div>
        </button>
      )}
    </div>
  );
}

interface CaptionStyleEditorProps {
  style: CaptionStyle;
  onChange: (style: CaptionStyle) => void;
  onSave: (style: CaptionStyle) => void;
  onCancel: () => void;
}

function CaptionStyleEditor({ style, onChange, onSave, onCancel }: CaptionStyleEditorProps) {
  const [localStyle, setLocalStyle] = useState(style);

  const handleChange = useCallback(
    (key: keyof CaptionStyle, value: string | number) => {
      const newStyle = { ...localStyle, [key]: value };
      setLocalStyle(newStyle);
      onChange(newStyle);
    },
    [localStyle, onChange]
  );

  return (
    <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">Caption Style</h3>
        <div className="flex gap-1">
          <button
            onClick={() => onCancel()}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(localStyle)}
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Save
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Font Size */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Font Size</label>
          <input
            type="range"
            min={12}
            max={48}
            value={localStyle.fontSize}
            onChange={(e) => handleChange('fontSize', Number(e.target.value))}
            className="w-full h-1 accent-primary-600"
          />
          <span className="text-sm text-gray-900 dark:text-gray-100">{localStyle.fontSize}px</span>
        </div>

        {/* Font Family */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Font Family</label>
          <select
            value={localStyle.fontFamily}
            onChange={(e) => handleChange('fontFamily', e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="Inter, sans-serif">Inter</option>
            <option value="Roboto, sans-serif">Roboto</option>
            <option value="Open Sans, sans-serif">Open Sans</option>
            <option value="Montserrat, sans-serif">Montserrat</option>
            <option value="system-ui, sans-serif">System UI</option>
          </select>
        </div>

        {/* Text Color */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Text Color</label>
          <input
            type="color"
            value={localStyle.color}
            onChange={(e) => handleChange('color', e.target.value)}
            className="w-full h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
          />
        </div>

        {/* Background Color */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Background</label>
          <input
            type="color"
            value={localStyle.backgroundColor}
            onChange={(e) => handleChange('backgroundColor', e.target.value)}
            className="w-full h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
          />
        </div>

        {/* Position */}
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Position</label>
          <div className="flex gap-2">
            {(['bottom', 'top', 'center'] as CaptionStyle['position'][]).map((pos) => (
              <button
                key={pos}
                onClick={() => handleChange('position', pos)}
                className={clsx(
                  'flex-1 py-2 rounded-lg border transition-colors',
                  localStyle.position === pos
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                {pos.charAt(0).toUpperCase() + pos.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Animation */}
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Animation</label>
          <div className="flex gap-2 flex-wrap">
            {(['none', 'fade', 'typewriter', 'karaoke'] as CaptionStyle['animation'][]).map((anim) => (
              <button
                key={anim}
                onClick={() => handleChange('animation', anim)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg border text-sm transition-colors',
                  localStyle.animation === anim
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                {anim.charAt(0).toUpperCase() + anim.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}