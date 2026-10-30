import { useCallback, useState } from 'react';
import { useProjectStore, useTimelineStore } from '../store';
import { Search, Image, Plus, Loader2, X, Check, Download, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import type { BRollAsset, BRollSuggestion } from '../types';

interface BRollPanelProps {
  suggestions?: BRollSuggestion[];
  onInsertBRoll?: (asset: BRollAsset, timestamp: number) => void;
}

export function BRollPanel({ suggestions = [], onInsertBRoll }: BRollPanelProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BRollAsset[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSource, setSelectedSource] = useState<'local' | 'pexels' | 'pixabay'>('local');
  const [localAssets, setLocalAssets] = useState<BRollAsset[]>([]);
  const { currentProject } = useProjectStore();
  const { tracks, addClip } = useTimelineStore();

  // Load local B-roll assets from project
  const loadLocalAssets = useCallback(() => {
    if (!currentProject) return;
    const assets: BRollAsset[] = currentProject.sourceVideos
      .filter((v) => v.name.toLowerCase().includes('broll') || v.name.toLowerCase().includes('b-roll'))
      .map((v) => ({
        id: v.id,
        url: URL.createObjectURL(v.file),
        source: 'local' as const,
        previewUrl: v.thumbnail,
        duration: v.duration,
        tags: ['local'],
      }));
    setLocalAssets(assets);
  }, [currentProject]);

  // Search stock footage (Pexels/Pixabay)
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      // TODO: Implement actual API calls to Pexels/Pixabay
      // For now, return mock results
      const mockResults: BRollAsset[] = Array.from({ length: 12 }, (_, i) => ({
        id: `stock-${Date.now()}-${i}`,
        url: `https://picsum.photos/seed/${query}-${i}/640/360`,
        source: selectedSource,
        previewUrl: `https://picsum.photos/seed/${query}-${i}/320/180`,
        duration: 10 + Math.random() * 20,
        tags: [query, selectedSource],
      }));
      setSearchResults(mockResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [query, selectedSource]);

  // Handle asset selection
  const handleAssetClick = useCallback(
    (asset: BRollAsset) => {
      if (onInsertBRoll) {
        const playheadPosition = useTimelineStore.getState().playheadPosition;
        onInsertBRoll(asset, playheadPosition);
      }
    },
    [onInsertBRoll]
  );

  // Insert B-roll at playhead
  const insertBRollAtPlayhead = useCallback(
    (asset: BRollAsset) => {
      const playheadPosition = useTimelineStore.getState().playheadPosition;
      const brollTrack = tracks.find((t) => t.type === 'broll');

      if (brollTrack) {
        addClip(brollTrack.id, {
          id: crypto.randomUUID(),
          assetId: asset.id,
          trackId: brollTrack.id,
          start: playheadPosition,
          end: playheadPosition + Math.min(asset.duration, 10),
          sourceStart: 0,
          sourceEnd: Math.min(asset.duration, 10),
        });
      } else {
        // Create B-roll track if it doesn't exist
        const newTrackId = `track-broll-${Date.now()}`;
        useTimelineStore.getState().addTrack({
          id: newTrackId,
          type: 'broll',
          clips: [
            {
              id: crypto.randomUUID(),
              assetId: asset.id,
              trackId: newTrackId,
              start: playheadPosition,
              end: playheadPosition + Math.min(asset.duration, 10),
              sourceStart: 0,
              sourceEnd: Math.min(asset.duration, 10),
            },
          ],
        });
      }
    },
    [tracks, addClip]
  );

  // Get all available assets
  const allAssets = useCallback(() => {
    const assets: BRollAsset[] = [];

    // Add local assets
    assets.push(...localAssets);

    // Add search results
    assets.push(...searchResults);

    // Add AI suggestions
    suggestions.forEach((suggestion) => {
      assets.push(...suggestion.matchedAssets);
    });

    return assets;
  }, [localAssets, searchResults, suggestions]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">B-Roll Library</h2>
        <div className="flex items-center gap-2">
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value as 'local' | 'pexels' | 'pixabay')}
            className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="local">📁 Local</option>
            <option value="pexels">📷 Pexels</option>
            <option value="pixabay">🎨 Pixabay</option>
          </select>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search stock footage..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-500 animate-spin" />
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="mt-2 px-4 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Search
        </button>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
            <span className="text-primary-600">✨</span>
            AI Suggestions
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {suggestions.flatMap((s) => s.matchedAssets).slice(0, 6).map((asset) => (
              <BRollAssetCard
                key={asset.id}
                asset={asset}
                onClick={handleAssetClick}
                onInsert={insertBRollAtPlayhead}
                isSuggestion
              />
            ))}
          </div>
        </div>
      )}

      {/* Asset Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {localAssets.length === 0 && searchResults.length === 0 && suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <Image className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg">No B-Roll assets found</p>
            <p className="text-sm mt-1">
              {selectedSource === 'local'
                ? 'Upload videos with "broll" in the name, or search stock footage'
                : 'Search for stock footage or switch to Local'}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allAssets().map((asset) => (
              <BRollAssetCard
                key={asset.id}
                asset={asset}
                onClick={handleAssetClick}
                onInsert={insertBRollAtPlayhead}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface BRollAssetCardProps {
  asset: BRollAsset;
  onClick: (asset: BRollAsset) => void;
  onInsert: (asset: BRollAsset) => void;
  isSuggestion?: boolean;
}

function BRollAssetCard({ asset, onClick, onInsert, isSuggestion }: BRollAssetCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={clsx(
        'group relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer transition-all hover:shadow-lg',
        isSuggestion && 'ring-2 ring-primary-500/50'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(asset)}
    >
      <div className="aspect-video relative overflow-hidden">
        <img
          src={asset.previewUrl}
          alt={`B-Roll: ${asset.tags.join(', ')}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {/* Duration badge */}
        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
          {Math.floor(asset.duration)}s
        </div>

        {/* Source badge */}
        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs font-medium bg-white/90 dark:bg-gray-900/90">
          {asset.source === 'local' && '📁'}
          {asset.source === 'pexels' && '📷'}
          {asset.source === 'pixabay' && '🎨'}
          {asset.source === 'generated' && '🤖'}
        </div>

        {/* Hover overlay */}
        {hovered && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInsert(asset);
              }}
              className="p-2 bg-white text-gray-900 rounded-full hover:bg-primary-500 hover:text-white transition-colors"
              title="Insert at playhead"
            >
              <Plus className="h-5 w-5" />
            </button>
            <a
              href={asset.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-white text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
              title="Open source"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
          </div>
        )}
      </div>

      <div className="p-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {asset.tags.slice(0, 3).join(', ') || 'Untitled'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <span>{asset.source}</span>
          {isSuggestion && <span className="text-primary-600">• AI suggested</span>}
        </p>
      </div>
    </div>
  );
}