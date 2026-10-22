import React, { useState, useMemo, useRef } from 'react';
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
import { resolveMediaStreamUrl, getMemoryCoverUrl } from '../../utils/mediaUtils.ts';

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
    // 1. Check media assets inside first
    if (Array.isArray(mem.media) && mem.media.length > 0) {
      const hasVideo = mem.media.some((m) => m.mimeType?.startsWith('video/'));
      if (hasVideo) return 'VIDEO';
      const hasAudio = mem.media.some((m) => m.mimeType?.startsWith('audio/'));
      if (hasAudio) return 'AUDIO';
      const hasImage = mem.media.some((m) => m.mimeType?.startsWith('image/'));
      if (hasImage) return 'PHOTO';
    }

    // 2. Check memoryType string
    const type = (mem.memoryType || mem.type || '').toUpperCase();
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
            className="absolute right-0 top-0 bottom-0 w-84 sm:w-[420px] md:w-[440px] bg-white border-l-[1.5px] border-[#CBD5E1] shadow-2xl z-40 flex flex-col overflow-hidden text-[#0F172A]"
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

                <button
                  type="button"
                  onClick={() => setSelectedFilter('STORY_DOC')}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                    selectedFilter === 'STORY_DOC'
                      ? 'bg-[#2563EB] text-white shadow-xs font-semibold'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  <span>Stories & Docs ({counts.storyDocs})</span>
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

            {/* Memories Feed Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

                  // Resolve author member who added the memory post
                  const authorMember = (mem.addedByMemberId ? membersById.get(mem.addedByMemberId) : null) ||
                    (mem.memberIds && mem.memberIds.length > 0 ? membersById.get(mem.memberIds[0]) : null);
                  const authorName = mem.addedByMemberName ||
                    (authorMember ? (authorMember.displayName || `${authorMember.firstName} ${authorMember.lastName}`.trim()) : null) ||
                    'Family Member';

                  return (
                    <div
                      key={mem.id}
                      data-testid={`memory-card-${mem.id}`}
                      className="rounded-2xl border border-[#CBD5E1] bg-white p-3.5 shadow-xs hover:shadow-md transition-all group flex flex-col gap-2.5"
                    >
                      {/* 1. TOP OF POST: Author who added the post (Above photo/video/audio, date, and location) */}
                      <div
                        data-testid={`memory-author-${mem.id}`}
                        className="flex items-center justify-between pb-2 border-b border-slate-100"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <MemberAvatar
                            member={authorMember || ({ firstName: authorName.split(' ')[0] || 'F', lastName: authorName.split(' ')[1] || 'M' } as any)}
                            size="sm"
                            className="w-7 h-7 ring-1.5 ring-blue-500/20 shrink-0"
                          />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-[#0F172A] truncate">
                                {authorName}
                              </span>
                              {authorMember?.branchName && (
                                <span className="text-[10px] text-slate-500 hidden sm:inline truncate">
                                  • {authorMember.branchName}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-blue-600 font-medium leading-none">
                              {`Added by ${authorName}`}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                          Author
                        </span>
                      </div>

                      {/* 2. Media Display Block: Photo / Video / Audio */}
                      {category === 'PHOTO' && coverUrl && (
                        <div
                          className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 cursor-pointer group/img border border-slate-200"
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
                        <div
                          className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 cursor-pointer group/video flex items-center justify-center border border-slate-700"
                          onClick={() => setSelectedMemoryDetail(mem)}
                        >
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt={mem.title}
                              className="w-full h-full object-cover opacity-80"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4">
                              <Video className="w-10 h-10 text-indigo-400 mb-1 opacity-70" />
                              <span className="text-[11px] text-slate-300">Family Video Keepsake</span>
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-white/90 text-[#2563EB] flex items-center justify-center shadow-lg group-hover/video:scale-110 transition-transform">
                              <Play className="w-5 h-5 ml-0.5 fill-[#2563EB]" />
                            </div>
                          </div>
                        </div>
                      )}

                      {category === 'AUDIO' && (
                        <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/60 border border-emerald-200 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleAudio(mem.id)}
                                className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                                title={isAudioActive ? 'Pause audio' : 'Play audio recording'}
                              >
                                {isAudioActive ? (
                                  <Pause className="w-4 h-4 fill-white" />
                                ) : (
                                  <Play className="w-4 h-4 ml-0.5 fill-white" />
                                )}
                              </button>
                              <div>
                                <span className="text-xs font-bold text-emerald-950 block">
                                  Oral History & Voice
                                </span>
                                <span className="text-[10px] text-emerald-700">
                                  {isAudioActive ? 'Playing recording...' : 'Click to listen'}
                                </span>
                              </div>
                            </div>
                            <Volume2 className="w-4 h-4 text-emerald-600" />
                          </div>

                          {/* Stylized waveform visualizer */}
                          <div className="flex items-center gap-1 h-6 px-2 bg-white/80 rounded-lg">
                            {[40, 70, 30, 90, 50, 80, 60, 100, 45, 85, 65, 30, 95, 55, 75, 40, 80, 60, 35].map(
                              (height, i) => (
                                <span
                                  key={i}
                                  className={`w-1 rounded-full transition-all duration-150 ${
                                    isAudioActive ? 'bg-emerald-600 animate-pulse' : 'bg-emerald-300'
                                  }`}
                                  style={{
                                    height: `${isAudioActive ? Math.min(100, height + (i % 3) * 10) : height}%`,
                                    animationDelay: `${i * 70}ms`,
                                  }}
                                />
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {category === 'STORY_DOC' && !coverUrl && (
                        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5">
                          <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                              Preserved Family Archive
                            </span>
                            <p className="text-xs text-[#17233C] mt-0.5 line-clamp-2">
                              {mem.description || 'Ancestral documents, letters, or handwritten memories.'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 3. Date & Location Line (below photo/video/audio) */}
                      <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                        <div className="flex items-center gap-1.5">
                          {category === 'PHOTO' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-blue-700 bg-blue-50 border border-blue-200">
                              <ImageIcon className="w-3 h-3" />
                              Photo
                            </span>
                          )}
                          {category === 'VIDEO' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-purple-700 bg-purple-50 border border-purple-200">
                              <Video className="w-3 h-3" />
                              Video
                            </span>
                          )}
                          {category === 'AUDIO' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                              <Mic className="w-3 h-3" />
                              Audio
                            </span>
                          )}
                          {category === 'STORY_DOC' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-amber-700 bg-amber-50 border border-amber-200">
                              <FileText className="w-3 h-3" />
                              {mem.memoryType === 'RECIPE'
                                ? 'Recipe'
                                : mem.memoryType === 'STORY'
                                ? 'Story'
                                : 'Document'}
                            </span>
                          )}

                          {mem.eventDateApprox || mem.eventDate ? (
                            <span className="inline-flex items-center gap-1 text-[#475569]">
                              <Calendar className="w-3 h-3 text-[#94A3B8]" />
                              {mem.eventDateApprox || new Date(mem.eventDate!).getFullYear()}
                            </span>
                          ) : null}
                        </div>

                        {mem.location && (
                          <span
                            className="inline-flex items-center gap-1 text-[#475569] truncate max-w-[140px]"
                            title={mem.location}
                          >
                            <MapPin className="w-3 h-3 text-[#94A3B8] shrink-0" />
                            <span className="truncate">{mem.location}</span>
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h4
                          onClick={() => setSelectedMemoryDetail(mem)}
                          className="font-bold text-xs sm:text-sm text-[#0F172A] hover:text-[#2563EB] transition-colors cursor-pointer"
                        >
                          {mem.title}
                        </h4>
                        {mem.description && (
                          <p className="text-xs text-[#475569] mt-1 line-clamp-2 leading-relaxed">
                            {mem.description}
                          </p>
                        )}
                      </div>

                      {/* Tagged Family Members */}
                      {taggedMembers.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                          <span className="text-[10px] font-semibold text-[#64748B] flex items-center gap-1">
                            <span>Tagged in tree:</span>
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {taggedMembers.map((member) => (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => onSelectMember && onSelectMember(member.id)}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50/80 hover:bg-blue-100/90 text-[#1D4ED8] text-[11px] font-medium transition-colors cursor-pointer border border-blue-200"
                                title={`Focus ${member.displayName || member.firstName} in family tree`}
                              >
                                <MemberAvatar
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
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#64748B]">
                        <span>
                          Added by <strong className="text-slate-800">{authorName}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedMemoryDetail(mem)}
                          className="text-[#2563EB] hover:text-[#1D4ED8] font-semibold flex items-center gap-0.5 cursor-pointer"
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
      <AnimatePresence>
        {selectedMemoryDetail && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
            onClick={() => setSelectedMemoryDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              {(() => {
                const modalAuthor = (selectedMemoryDetail.addedByMemberId ? membersById.get(selectedMemoryDetail.addedByMemberId) : null) ||
                  (selectedMemoryDetail.memberIds && selectedMemoryDetail.memberIds.length > 0 ? membersById.get(selectedMemoryDetail.memberIds[0]) : null);
                const modalAuthorName = selectedMemoryDetail.addedByMemberName ||
                  (modalAuthor ? (modalAuthor.displayName || `${modalAuthor.firstName} ${modalAuthor.lastName}`.trim()) : null) ||
                  'Family Member';

                return (
                  <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-blue-100 text-[#2563EB]">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="font-bold text-sm text-[#0F172A]">{selectedMemoryDetail.title}</h3>
                        <p className="text-[11px] text-[#64748B]">
                          {selectedMemoryDetail.eventDateApprox || selectedMemoryDetail.location || 'Preserved memory'} • Added by <strong className="text-blue-700">{modalAuthorName}</strong>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMemoryDetail(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                );
              })()}

              {/* Modal Media Content */}
              <div className="p-6 overflow-y-auto space-y-4">
                {getMemoryCoverUrl(selectedMemoryDetail) && (
                  <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-200">
                    <img
                      src={getMemoryCoverUrl(selectedMemoryDetail)!}
                      alt={selectedMemoryDetail.title}
                      className="w-full max-h-96 object-contain mx-auto"
                    />
                  </div>
                )}

                <div>
                  <h4 className="font-bold text-base text-[#0F172A]">{selectedMemoryDetail.title}</h4>
                  {selectedMemoryDetail.description && (
                    <p className="text-xs text-[#334155] mt-2 whitespace-pre-wrap leading-relaxed">
                      {selectedMemoryDetail.description}
                    </p>
                  )}
                </div>

                {/* Information Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
                  {selectedMemoryDetail.eventDateApprox && (
                    <div className="p-2.5 rounded-xl bg-slate-50">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Date / Period</span>
                      <span className="font-semibold text-slate-800">{selectedMemoryDetail.eventDateApprox}</span>
                    </div>
                  )}

                  {selectedMemoryDetail.location && (
                    <div className="p-2.5 rounded-xl bg-slate-50">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Location</span>
                      <span className="font-semibold text-slate-800">{selectedMemoryDetail.location}</span>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-slate-50">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Type</span>
                    <span className="font-semibold text-slate-800">
                      {selectedMemoryDetail.memoryType || 'Photo'}
                    </span>
                  </div>
                </div>

                {/* Tagged Relatives in Detail */}
                {selectedMemoryDetail.memberIds && selectedMemoryDetail.memberIds.length > 0 && (
                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-700 block mb-2">
                      Tagged Family Members:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedMemoryDetail.memberIds.map((id) => {
                        const m = membersById.get(id);
                        if (!m) return null;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedMemoryDetail(null);
                              onClose();
                              onSelectMember && onSelectMember(m.id);
                            }}
                            className="flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 text-xs text-[#1D4ED8] transition-colors cursor-pointer"
                          >
                            <MemberAvatar
                              name={`${m.firstName} ${m.lastName}`}
                              src={m.profilePhoto || (m as any).profileImageUrl}
                              size="xs"
                            />
                            <span className="font-semibold">{m.displayName || `${m.firstName} ${m.lastName}`}</span>
                            <span className="text-[10px] text-blue-500">(Focus in Tree)</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#E2E8F0] bg-slate-50 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedMemoryDetail(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 font-semibold text-xs text-slate-700 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
