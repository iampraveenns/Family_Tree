import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Search,
  Plus,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  Calendar,
  MapPin,
  Tag,
  Maximize2,
  Play,
  Pause,
  Volume2,
  RefreshCw,
  ExternalLink,
  Layers,
  Compass,
} from 'lucide-react';
import { Memory, FamilyMember, MediaAsset } from '../../types/index.ts';
import { MemberAvatar } from '../ui/MemberAvatar.tsx';
import { resolveMediaStreamUrl, getMemoryCoverUrl, getMemoryVideoUrl, getMemoryAudioUrl, resolveMemoryAuthor, getVideoPreviewSrc } from '../../utils/mediaUtils.ts';
import { formatSingleDate } from './HeritageMemberNode.tsx';
import { MediaDetailLightboxModal } from './MediaDetailLightboxModal.tsx';

export interface MemoriesSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
  members: FamilyMember[];
  familyName?: string;
  onSelectMember?: (memberId: string) => void;
  onOpenUploadModal: () => void;
  onRefreshMemories?: () => void;
  isLoading?: boolean;
}

type MediaFilterCategory = 'ALL' | 'PHOTO' | 'VIDEO' | 'AUDIO' | 'STORY_DOC';

export interface VideoMemoryCardPlayerProps {
  memory: Memory;
  onOpenFullView: () => void;
}

export const VideoMemoryCardPlayer: React.FC<VideoMemoryCardPlayerProps> = ({
  memory,
  onOpenFullView,
}) => {
  const [hasError, setHasError] = useState(false);

  const videoUrl = useMemo(() => {
    return getMemoryVideoUrl(memory) || '';
  }, [memory]);

  const coverUrl = useMemo(() => {
    return getMemoryCoverUrl(memory) || '';
  }, [memory]);

  useEffect(() => {
    setHasError(false);
  }, [videoUrl]);

  return (
    <div
      data-testid={`video-card-player-${memory.id}`}
      onClick={onOpenFullView}
      className="relative aspect-video rounded-xl overflow-hidden bg-black/95 group/video flex items-center justify-center border border-slate-700 shadow-inner cursor-pointer"
    >
      {/* First-frame video preview or Poster/Thumbnail image */}
      {videoUrl && !hasError ? (
        <video
          src={getVideoPreviewSrc(videoUrl)}
          muted
          playsInline
          preload="metadata"
          className="w-full h-full object-cover group-hover/video:scale-105 transition-transform duration-300 pointer-events-none"
          onError={() => setHasError(true)}
        />
      ) : coverUrl && !hasError ? (
        <img
          src={coverUrl}
          alt={memory.title}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover group-hover/video:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4">
          <Video className="w-10 h-10 text-indigo-400 mb-1 opacity-70" />
          <span className="text-[11px] text-slate-300">Family Video Keepsake</span>
        </div>
      )}

      {/* Video duration/type badge */}
      <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-white text-[10px] font-medium flex items-center gap-1 backdrop-blur-xs z-10">
        <Video className="w-3 h-3 text-blue-400" />
        <span>Video Keepsake</span>
      </div>

      {/* Floating "Open Full View" button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenFullView();
        }}
        className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-black/75 hover:bg-[#2563EB] text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-md backdrop-blur-xs transition-all cursor-pointer opacity-90 group-hover/video:opacity-100 z-10"
        title="Open Full View"
        aria-label="Open Full View"
      >
        <Maximize2 className="w-3.5 h-3.5" />
        <span>Open Full View</span>
      </button>

      {/* Center play icon overlay (No hover autoplay - click opens lightbox) */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover/video:bg-black/35 transition-colors pointer-events-none">
        <div className="w-12 h-12 rounded-full bg-white/95 text-[#2563EB] flex items-center justify-center shadow-xl group-hover/video:scale-110 transition-transform">
          <Play className="w-5 h-5 ml-0.5 fill-[#2563EB]" />
        </div>
      </div>
    </div>
  );
};

export const AudioMemoryCardPlayer: React.FC<{
  memory: Memory;
  onOpenFullView?: () => void;
}> = ({ memory, onOpenFullView }) => {
  const audioUrl = getMemoryAudioUrl(memory);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn('Audio play request failed or blocked:', err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/70 border border-emerald-200/80 flex flex-col gap-2.5 shadow-xs"
      data-testid={`audio-player-${memory.id}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!audioUrl}
            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xs transition-transform active:scale-95 cursor-pointer ${
              audioUrl
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-emerald-300 text-white/80 cursor-not-allowed'
            }`}
            title={isPlaying ? 'Pause audio recording' : 'Play audio recording'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 ml-0.5 fill-white" />
            )}
          </button>
          <div>
            <span className="text-xs font-bold text-emerald-950 block">
              Oral History & Voice
            </span>
            <span className="text-[10px] text-emerald-700 font-medium">
              {isPlaying
                ? `Playing • ${formatSeconds(currentTime)} / ${formatSeconds(duration)}`
                : audioUrl
                ? duration > 0 ? `Click to listen (${formatSeconds(duration)})` : 'Click to listen'
                : 'Audio recording saved'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Volume2 className={`w-4 h-4 ${isPlaying ? 'text-emerald-700 animate-pulse' : 'text-emerald-600'}`} />
          {onOpenFullView && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFullView();
              }}
              className="p-1 text-emerald-700 hover:text-emerald-900 rounded-md hover:bg-emerald-200/50 cursor-pointer"
              title="Open full detail"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Actual HTML5 Audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          className="w-full h-8 mt-1 accent-emerald-600"
          controls
        />
      )}

      {/* Stylized waveform visualizer */}
      <div className="flex items-center gap-1 h-5 px-2 bg-white/90 rounded-lg">
        {[40, 70, 30, 90, 50, 80, 60, 100, 45, 85, 65, 30, 95, 55, 75, 40, 80, 60, 35].map(
          (height, i) => (
            <span
              key={i}
              className={`w-1 rounded-full transition-all duration-150 ${
                isPlaying ? 'bg-emerald-600 animate-pulse' : 'bg-emerald-300'
              }`}
              style={{
                height: `${isPlaying ? Math.min(100, height + (i % 3) * 10) : height}%`,
                animationDelay: `${i * 70}ms`,
              }}
            />
          )
        )}
      </div>
    </div>
  );
};

export const MemoriesSidePanel: React.FC<MemoriesSidePanelProps> = ({
  isOpen,
  onClose,
  memories,
  members,
  familyName = 'Family',
  onSelectMember,
  onOpenUploadModal,
  onRefreshMemories,
  isLoading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<MediaFilterCategory>('ALL');
  const [selectedMemoryDetail, setSelectedMemoryDetail] = useState<Memory | null>(null);
  const [activeAudioPlayingId, setActiveAudioPlayingId] = useState<string | null>(null);

  // Map of members by id for instant lookups
  const membersById = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    members.forEach((m) => {
      map.set(m.id, m);
    });
    return map;
  }, [members]);

  // Categorize helper
  const getMemoryCategory = (mem: Memory): MediaFilterCategory => {
    // 1. Check if memory has a video URL
    if (getMemoryVideoUrl(mem)) return 'VIDEO';

    // 2. Check media assets inside first
    if (Array.isArray(mem.media) && mem.media.length > 0) {
      const hasVideo = mem.media.some((m) => m.mimeType?.startsWith('video/'));
      if (hasVideo) return 'VIDEO';
      const hasAudio = mem.media.some((m) => m.mimeType?.startsWith('audio/'));
      if (hasAudio) return 'AUDIO';
      const hasImage = mem.media.some((m) => m.mimeType?.startsWith('image/'));
      if (hasImage) return 'PHOTO';
    }

    // 3. Check memoryType string
    const type = (mem.memoryType || mem.type || '').toUpperCase();
    if (type === 'VIDEO') return 'VIDEO';
    if (type === 'PHOTO') return 'PHOTO';
    if (type === 'AUDIO') return 'AUDIO';
    if (type === 'DOCUMENT' || type === 'STORY' || type === 'RECIPE') {
      return 'STORY_DOC';
    }

    return 'PHOTO';
  };

  // Counts for filter pills
  const counts = useMemo(() => {
    let photos = 0;
    let videos = 0;
    let audio = 0;
    let storyDocs = 0;

    memories.forEach((mem) => {
      const cat = getMemoryCategory(mem);
      if (cat === 'PHOTO') photos++;
      else if (cat === 'VIDEO') videos++;
      else if (cat === 'AUDIO') audio++;
      else if (cat === 'STORY_DOC') storyDocs++;
    });

    return {
      all: memories.length,
      photos,
      videos,
      audio,
      storyDocs,
    };
  }, [memories]);

  // Filtered & searched memories
  const filteredMemories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return memories.filter((mem) => {
      // Category filter
      if (selectedFilter !== 'ALL') {
        const cat = getMemoryCategory(mem);
        if (cat !== selectedFilter) return false;
      }

      if (!q) return true;

      // Text search in title, description, tags, location
      if (mem.title?.toLowerCase().includes(q)) return true;
      if (mem.description?.toLowerCase().includes(q)) return true;
      if (mem.location?.toLowerCase().includes(q)) return true;
      if (mem.eventDateApprox?.toLowerCase().includes(q)) return true;
      if (mem.tags?.some((t) => t.toLowerCase().includes(q))) return true;

      // Search in tagged member names
      const taggedMembers = (mem.memberIds || [])
        .map((id) => membersById.get(id))
        .filter(Boolean);
      if (
        taggedMembers.some(
          (m) =>
            m?.firstName.toLowerCase().includes(q) ||
            m?.lastName.toLowerCase().includes(q) ||
            m?.displayName?.toLowerCase().includes(q)
        )
      ) {
        return true;
      }

      return false;
    });
  }, [memories, selectedFilter, searchQuery, membersById]);

  const toggleAudio = (id: string) => {
    setActiveAudioPlayingId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="memories-side-panel"
            initial={{ x: 440, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 440, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed top-14 bottom-0 right-0 h-[calc(100vh-3.5rem)] w-84 sm:w-[420px] md:w-[440px] bg-white border-l-[1.5px] border-[#CBD5E1] shadow-2xl z-50 flex flex-col overflow-hidden text-[#0F172A]"
            data-testid="memories-right-sidebar"
          >
            {/* Ask Gemini Style Header */}
            <div className="p-4 border-b border-[#E2E8F0] bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-sm ring-2 ring-indigo-100">
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm text-[#17233C] tracking-tight">
                        Family Memories
                      </h3>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                        {memories.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B]">
                      Photos, videos, audios & media added by {familyName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {onRefreshMemories && (
                    <button
                      type="button"
                      onClick={onRefreshMemories}
                      disabled={isLoading}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Refresh memories"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Close Memories Sidebar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#94A3B8]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search photos, videos, audios, relatives..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] shadow-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-[#94A3B8] hover:text-[#0F172A]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Media Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                    selectedFilter === 'ALL'
                      ? 'bg-[#2563EB] text-white shadow-xs font-semibold'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>All ({counts.all})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedFilter('PHOTO')}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                    selectedFilter === 'PHOTO'
                      ? 'bg-[#2563EB] text-white shadow-xs font-semibold'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  <span>Photos ({counts.photos})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedFilter('VIDEO')}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                    selectedFilter === 'VIDEO'
                      ? 'bg-[#2563EB] text-white shadow-xs font-semibold'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Video className="w-3 h-3" />
                  <span>Videos ({counts.videos})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedFilter('AUDIO')}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                    selectedFilter === 'AUDIO'
                      ? 'bg-[#2563EB] text-white shadow-xs font-semibold'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Mic className="w-3 h-3" />
                  <span>Audio ({counts.audio})</span>
                </button>
              </div>
            </div>

            {/* Quick Add Memory Bar */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-[#E2E8F0] flex items-center justify-between text-xs shrink-0">
              <span className="text-[#64748B] font-medium">
                Showing {filteredMemories.length} preserved keepsake{filteredMemories.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={onOpenUploadModal}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Memory</span>
              </button>
            </div>

            {/* Memories Feed Content with generous bottom padding for last card visibility */}
            <div className="flex-1 overflow-y-auto min-h-[480px] p-4 space-y-4 overscroll-contain scroll-smooth pb-32">
              {filteredMemories.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-amber-500" />
                  </div>
                  <h4 className="font-bold text-sm text-[#0F172A]">No memories found</h4>
                  <p className="text-xs text-[#64748B] mt-1 max-w-xs">
                    {searchQuery
                      ? 'No preserved memories match your query. Try adjusting your search or filters.'
                      : 'Preserve cherished family photos, voice recordings, heirloom documents, and stories.'}
                  </p>
                  <button
                    type="button"
                    onClick={onOpenUploadModal}
                    className="mt-4 px-3.5 py-1.5 rounded-xl bg-[#2563EB] text-white font-semibold text-xs shadow-xs hover:bg-[#1D4ED8] transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Memory</span>
                  </button>
                </div>
              ) : (
                filteredMemories.map((mem) => {
                  const category = getMemoryCategory(mem);
                  const coverUrl = getMemoryCoverUrl(mem);
                  const taggedMembers = (mem.memberIds || [])
                    .map((id) => membersById.get(id))
                    .filter(Boolean) as FamilyMember[];

                  const isAudioActive = activeAudioPlayingId === mem.id;

                  // Resolve author member and latest profile photo
                  const { authorMember, authorName, authorPhoto } = resolveMemoryAuthor(mem, members, membersById);

                  return (
                    <div
                      key={mem.id}
                      data-testid={`memory-card-${mem.id}`}
                      className="rounded-2xl border border-[#F5E7A3] bg-[#FFF8D6] p-4 shadow-xs hover:shadow-md transition-all group flex flex-col gap-3 text-[#263449]"
                    >
                      {/* 1. TOP OF POST: Author who added the post (Above photo/video/audio, date, and location) */}
                      <div
                        data-testid={`memory-author-${mem.id}`}
                        className="flex items-center justify-between pb-2.5 pt-0.5 border-b border-[#F5E7A3]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <MemberAvatar
                            member={authorMember || ({ firstName: authorName.split(' ')[0] || 'F', lastName: authorName.split(' ')[1] || 'M' } as any)}
                            src={authorPhoto || authorMember?.profilePhoto}
                            gender={authorMember?.gender}
                            size="sm"
                            className="w-9 h-9 ring-2 ring-[#F5E7A3] shrink-0"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-[#263449] truncate">
                              {authorName}
                            </span>
                            <span className="text-[11px] text-[#263449]/70 font-medium leading-tight">
                              {`Added by ${authorName}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 2. Media Display Block: Photo / Video / Audio */}
                      {category === 'PHOTO' && coverUrl && (
                        <div
                          className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 cursor-pointer group/img border border-[#F5E7A3]"
                          onClick={() => setSelectedMemoryDetail(mem)}
                        >
                          <img
                            src={coverUrl}
                            alt={mem.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="px-2.5 py-1 rounded-lg bg-black/60 text-white text-[11px] font-medium flex items-center gap-1 backdrop-blur-xs">
                              <Maximize2 className="w-3 h-3" />
                              View Photo
                            </span>
                          </div>
                        </div>
                      )}

                      {category === 'VIDEO' && (
                        <VideoMemoryCardPlayer
                          memory={mem}
                          onOpenFullView={() => setSelectedMemoryDetail(mem)}
                        />
                      )}

                      {category === 'AUDIO' && (
                        <AudioMemoryCardPlayer
                          memory={mem}
                          onOpenFullView={() => setSelectedMemoryDetail(mem)}
                        />
                      )}

                      {category === 'STORY_DOC' && !coverUrl && (
                        <div className="p-3 rounded-xl bg-white/80 border border-[#F5E7A3] flex items-start gap-2.5">
                          <div className="p-2 rounded-lg bg-[#FFF8D6] border border-[#F5E7A3] text-[#263449] shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#263449]/70 block">
                              Preserved Family Archive
                            </span>
                            <p className="text-xs text-[#263449] mt-0.5 line-clamp-2">
                              {mem.description || 'Ancestral documents, letters, or handwritten memories.'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 3. Date & Location Line (below photo/video/audio) */}
                      <div className="flex items-center justify-between text-[11px] text-[#263449]/70">
                        <div className="flex items-center gap-1.5">
                          {category === 'PHOTO' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[#263449] bg-white/90 border border-[#F5E7A3]">
                              <ImageIcon className="w-3 h-3 text-[#D4B83E]" />
                              Photo
                            </span>
                          )}
                          {category === 'VIDEO' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[#263449] bg-white/90 border border-[#F5E7A3]">
                              <Video className="w-3 h-3 text-[#D4B83E]" />
                              Video
                            </span>
                          )}
                          {category === 'AUDIO' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[#263449] bg-white/90 border border-[#F5E7A3]">
                              <Mic className="w-3 h-3 text-[#D4B83E]" />
                              Audio
                            </span>
                          )}
                          {category === 'STORY_DOC' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[#263449] bg-white/90 border border-[#F5E7A3]">
                              <FileText className="w-3 h-3 text-[#D4B83E]" />
                              {mem.memoryType === 'RECIPE'
                                ? 'Recipe'
                                : mem.memoryType === 'STORY'
                                ? 'Story'
                                : 'Document'}
                            </span>
                          )}

                          {mem.eventDate || mem.eventDateApprox ? (
                            <span className="inline-flex items-center gap-1 text-[#263449]/80 font-medium">
                              <Calendar className="w-3 h-3 text-[#D4B83E]" />
                              {formatSingleDate(mem.eventDate) || (mem.eventDateApprox && !/^\d{4}$/.test(mem.eventDateApprox) ? mem.eventDateApprox : formatSingleDate(mem.eventDateApprox)) || mem.eventDateApprox || mem.eventDate}
                            </span>
                          ) : null}
                        </div>

                        {mem.location && (
                          <span
                            className="inline-flex items-center gap-1 text-[#263449]/80 truncate max-w-[140px] font-medium"
                            title={mem.location}
                          >
                            <MapPin className="w-3 h-3 text-[#D4B83E] shrink-0" />
                            <span className="truncate">{mem.location}</span>
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h4
                          onClick={() => setSelectedMemoryDetail(mem)}
                          className="font-bold text-xs sm:text-sm text-[#263449] hover:underline transition-colors cursor-pointer"
                        >
                          {mem.title}
                        </h4>
                        {mem.description && (
                          <p className="text-xs text-[#263449]/80 mt-1 line-clamp-2 leading-relaxed">
                            {mem.description}
                          </p>
                        )}
                      </div>

                      {/* Tagged Family Members */}
                      {taggedMembers.length > 0 && (
                        <div className="pt-2 border-t border-[#F5E7A3] flex flex-col gap-1.5">
                          <span className="text-[10px] font-semibold text-[#263449]/70 flex items-center gap-1">
                            <span>Tagged in tree:</span>
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {taggedMembers.map((member) => (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => onSelectMember && onSelectMember(member.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 hover:bg-[#FFF8D6] text-[#263449] text-[11px] font-medium transition-colors cursor-pointer border border-[#F5E7A3] shadow-2xs"
                                title={`Focus ${member.displayName || member.firstName} in family tree`}
                              >
                                <MemberAvatar
                                  member={member}
                                  name={`${member.firstName} ${member.lastName}`}
                                  src={member.profilePhoto || (member as any).profileImageUrl}
                                  gender={member.gender}
                                  size="xs"
                                />
                                <span>{member.displayName || `${member.firstName} ${member.lastName}`}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contributor / Added by & Details Link */}
                      <div className="pt-2 border-t border-[#F5E7A3] flex items-center justify-between text-[11px] text-[#263449]/75">
                        <span>
                          Added by <strong className="text-[#263449]">{authorName}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedMemoryDetail(mem)}
                          className="text-[#263449] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Details</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Memory Full Detail Modal / Lightbox */}
      <MediaDetailLightboxModal
        isOpen={Boolean(selectedMemoryDetail)}
        onClose={() => setSelectedMemoryDetail(null)}
        memory={selectedMemoryDetail}
        members={members}
        onSelectMember={(m) => {
          setSelectedMemoryDetail(null);
          onClose();
          onSelectMember && onSelectMember(m.id);
        }}
      />
    </>
  );
};
