import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  Image as ImageIcon,
  Video,
  Headphones,
  FileText,
  Calendar,
  MapPin,
  Tag,
  Plus,
  Play,
  Maximize2,
  ExternalLink,
  Sparkles,
  Filter,
  RefreshCw,
  FolderHeart,
  Volume2,
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import { Memory, FamilyMember, MemoryType } from '../../types/index.ts';
import { MemberAvatar } from '../ui/MemberAvatar.tsx';
import { resolveMediaStreamUrl, getMemoryCoverUrl, formatFamilyDisplayName } from '../../utils/mediaUtils.ts';
import { formatSingleDate } from './HeritageMemberNode.tsx';

export interface FamilyMemoriesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
  members: FamilyMember[];
  familyName?: string;
  onSelectMember?: (member: FamilyMember) => void;
  onOpenUploadModal: (member?: FamilyMember | null) => void;
  onRefreshMemories?: () => void;
  onViewMediaDetail?: (memory: Memory) => void;
}

export type MemoryFilterTab = 'ALL' | 'PHOTO' | 'VIDEO' | 'AUDIO' | 'STORY_DOC';

export const FamilyMemoriesSidebar: React.FC<FamilyMemoriesSidebarProps> = ({
  isOpen,
  onClose,
  memories,
  members,
  familyName,
  onSelectMember,
  onOpenUploadModal,
  onRefreshMemories,
  onViewMediaDetail,
}) => {
  const [activeTab, setActiveTab] = useState<MemoryFilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('ALL');
  const [expandedMemoryId, setExpandedMemoryId] = useState<string | null>(null);

  // Fast map of member by ID
  const memberMap = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    members.forEach((m) => {
      map.set(m.id, m);
      if ((m as any)._id) map.set((m as any)._id.toString(), m);
    });
    return map;
  }, [members]);

  // Counts by media type
  const counts = useMemo(() => {
    let photos = 0;
    let videos = 0;
    let audios = 0;
    let storiesDocs = 0;

    memories.forEach((m) => {
      const type = (m.memoryType || (m as any).type || '').toUpperCase();
      const hasVideo = m.media?.some((asset) => asset.mimeType?.startsWith('video/'));
      const hasAudio = m.media?.some((asset) => asset.mimeType?.startsWith('audio/'));

      if (type === 'VIDEO' || hasVideo) {
        videos++;
      } else if (type === 'AUDIO' || hasAudio) {
        audios++;
      } else if (type === 'PHOTO') {
        photos++;
      } else {
        storiesDocs++;
      }
    });

    return {
      all: memories.length,
      photos,
      videos,
      audios,
      storiesDocs,
    };
  }, [memories]);

  // Filtered memories list
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      const type = (m.memoryType || (m as any).type || '').toUpperCase();
      const hasVideo = m.media?.some((asset) => asset.mimeType?.startsWith('video/'));
      const hasAudio = m.media?.some((asset) => asset.mimeType?.startsWith('audio/'));

      // 1. Tab filter
      if (activeTab === 'PHOTO' && type !== 'PHOTO') return false;
      if (activeTab === 'VIDEO' && type !== 'VIDEO' && !hasVideo) return false;
      if (activeTab === 'AUDIO' && type !== 'AUDIO' && !hasAudio) return false;
      if (
        activeTab === 'STORY_DOC' &&
        type !== 'STORY' &&
        type !== 'DOCUMENT' &&
        type !== 'RECIPE' &&
        !['STORY', 'DOCUMENT', 'RECIPE'].includes(type)
      ) {
        return false;
      }

      // 2. Member filter
      if (selectedMemberId !== 'ALL') {
        const memIds = m.memberIds || (m as any).relatedMemberIds || [];
        const isTagged = memIds.some((id: any) => id?.toString() === selectedMemberId);
        if (!isTagged) return false;
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = m.title?.toLowerCase().includes(q);
        const descMatch = m.description?.toLowerCase().includes(q);
        const locMatch = m.location?.toLowerCase().includes(q);
        const tagMatch = m.tags?.some((t) => t.toLowerCase().includes(q));

        // Member name match
        const memIds = m.memberIds || (m as any).relatedMemberIds || [];
        const memberMatch = memIds.some((id: any) => {
          const person = memberMap.get(id?.toString());
          if (!person) return false;
          const fullName = `${person.firstName} ${person.lastName}`.toLowerCase();
          return fullName.includes(q);
        });

        if (!titleMatch && !descMatch && !locMatch && !tagMatch && !memberMatch) {
          return false;
        }
      }

      return true;
    });
  }, [memories, activeTab, selectedMemberId, searchQuery, memberMap]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="family-memories-sidebar"
        initial={{ x: 440, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 440, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        data-testid="family-memories-sidebar"
        className="absolute right-0 top-0 bottom-0 w-88 sm:w-[430px] bg-white/95 backdrop-blur-md border-l-[1.5px] border-[#CBD5E1] shadow-2xl z-32 flex flex-col overflow-hidden"
      >
        {/* =========================================================
            1. Chrome "Ask Gemini"-Style Header
            ========================================================= */}
        <div className="p-4 border-b border-[#E2E8F0] bg-white/90 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#60A5FA] text-white flex items-center justify-center shadow-xs shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#17233C] truncate tracking-tight">
                    Family Memories
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                    {counts.all}
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] truncate">
                  {formatFamilyDisplayName(familyName)} • Photos, Videos & Stories
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onRefreshMemories && (
                <button
                  type="button"
                  onClick={onRefreshMemories}
                  title="Refresh memories"
                  aria-label="Refresh memories"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-[#2563EB] hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenUploadModal(null)}
                title="Add new family memory"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Close Memories Sidebar"
                aria-label="Close Memories Sidebar"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* =========================================================
              2. Search Bar
              ========================================================= */}
          <div className="relative mt-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search memories, places, relatives, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#0F172A] placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* =========================================================
              3. Filter Tabs (Segmented Button Group)
              ========================================================= */}
          <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                activeTab === 'ALL'
                  ? 'bg-[#2563EB] text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <span>All</span>
              <span className={`text-[10px] px-1 rounded-full ${activeTab === 'ALL' ? 'bg-white/20' : 'bg-slate-200'}`}>
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PHOTO')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'PHOTO'
                  ? 'bg-[#2563EB] text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Photos</span>
              {counts.photos > 0 && (
                <span className={`text-[10px] px-1 rounded-full ${activeTab === 'PHOTO' ? 'bg-white/20' : 'bg-slate-200'}`}>
                  {counts.photos}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('VIDEO')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'VIDEO'
                  ? 'bg-[#2563EB] text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Videos</span>
              {counts.videos > 0 && (
                <span className={`text-[10px] px-1 rounded-full ${activeTab === 'VIDEO' ? 'bg-white/20' : 'bg-slate-200'}`}>
                  {counts.videos}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('AUDIO')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'AUDIO'
                  ? 'bg-[#2563EB] text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Audios</span>
              {counts.audios > 0 && (
                <span className={`text-[10px] px-1 rounded-full ${activeTab === 'AUDIO' ? 'bg-white/20' : 'bg-slate-200'}`}>
                  {counts.audios}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('STORY_DOC')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'STORY_DOC'
                  ? 'bg-[#2563EB] text-white font-semibold shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Stories & Docs</span>
              {counts.storiesDocs > 0 && (
                <span className={`text-[10px] px-1 rounded-full ${activeTab === 'STORY_DOC' ? 'bg-white/20' : 'bg-slate-200'}`}>
                  {counts.storiesDocs}
                </span>
              )}
            </button>
          </div>

          {/* Member Filter Selector */}
          {members.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2">
              <label htmlFor="filter-member-select" className="text-[11px] font-semibold text-slate-500 shrink-0 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                <span>Relative:</span>
              </label>
              <div className="relative flex-1 min-w-0">
                <select
                  id="filter-member-select"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full text-xs font-medium py-1 px-2.5 pr-7 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 truncate cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[#2563EB]"
                >
                  <option value="ALL">All Family Relatives</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} {m.branchName ? `(${m.branchName})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* =========================================================
            4. Memories Scrollable Content Feed
            ========================================================= */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredMemories.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-8 text-slate-500 mt-8">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mb-3">
                <FolderHeart className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#17233C] mb-1">No Memories Found</h4>
              <p className="text-xs text-slate-500 max-w-xs mb-4">
                {searchQuery
                  ? `No media matches "${searchQuery}". Try a different keyword.`
                  : 'Start capturing your family chronicle with photos, videos, spoken stories, and records.'}
              </p>
              <button
                type="button"
                onClick={() => onOpenUploadModal(null)}
                className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Upload First Memory</span>
              </button>
            </div>
          ) : (
            filteredMemories.map((memory) => {
              const coverUrl = getMemoryCoverUrl(memory);
              const mType = (memory.memoryType || (memory as any).type || 'PHOTO').toUpperCase();
              const isExpanded = expandedMemoryId === memory.id;
              const formattedDate = formatSingleDate(memory.eventDate || (memory as any).date);
              const rawMemberIds = memory.memberIds || (memory as any).relatedMemberIds || [];
              const taggedMembers = rawMemberIds
                .map((id: any) => memberMap.get(id?.toString()))
                .filter(Boolean) as FamilyMember[];

              // Media Assets checks
              const videoAsset = memory.media?.find((a) => a.mimeType?.startsWith('video/'));
              const audioAsset = memory.media?.find((a) => a.mimeType?.startsWith('audio/'));
              const videoUrl = videoAsset ? resolveMediaStreamUrl(videoAsset) : null;
              const audioUrl = audioAsset ? resolveMediaStreamUrl(audioAsset) : null;
              const authorMember = (memory.addedByMemberId ? memberMap.get(memory.addedByMemberId) : null) ||
                (rawMemberIds.length > 0 ? memberMap.get(rawMemberIds[0]?.toString()) : null);
              const authorName = memory.addedByMemberName ||
                (authorMember ? (authorMember.displayName || `${authorMember.firstName} ${authorMember.lastName}`.trim()) : null) ||
                'Family Member';

              return (
                <div
                  key={memory.id}
                  data-testid={`memory-card-${memory.id}`}
                  className="bg-white rounded-2xl border border-[#CBD5E1] shadow-2xs hover:shadow-md transition-all overflow-hidden group/card"
                >
                  {/* 1. TOP OF POST: Author who added the post (Above media, date, and location) */}
                  <div
                    data-testid={`memory-author-${memory.id}`}
                    className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/70"
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
                            <span className="text-[10px] text-slate-500 truncate">
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

                  {/* Media Preview Slot */}
                  {mType === 'VIDEO' || videoUrl ? (
                    <div className="relative w-full aspect-video bg-black/90 flex items-center justify-center overflow-hidden">
                      {videoUrl ? (
                        <video
                          src={videoUrl}
                          controls
                          preload="metadata"
                          className="w-full h-full object-contain"
                        />
                      ) : coverUrl ? (
                        <div className="relative w-full h-full cursor-pointer" onClick={() => onViewMediaDetail?.(memory)}>
                          <img
                            src={coverUrl}
                            alt={memory.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="w-11 h-11 rounded-full bg-white/90 text-[#2563EB] flex items-center justify-center shadow-lg group-hover/card:scale-110 transition-transform">
                              <Play className="w-5 h-5 ml-0.5 fill-[#2563EB]" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-white/80 p-6 text-center">
                          <Video className="w-8 h-8 mb-1.5 text-blue-400" />
                          <span className="text-xs font-semibold">Video Recording</span>
                        </div>
                      )}
                    </div>
                  ) : mType === 'AUDIO' || audioUrl ? (
                    <div className="p-3.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-[#CBD5E1]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                          <Volume2 className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-[#1E3A8A]">Audio Memory • Spoken Story</span>
                      </div>
                      {audioUrl ? (
                        <audio controls src={audioUrl} className="w-full h-9 rounded-lg" />
                      ) : (
                        <div className="text-[11px] text-slate-500 italic py-1">
                          Audio narrative recorded in family archive.
                        </div>
                      )}
                    </div>
                  ) : coverUrl ? (
                    <div
                      className="relative w-full aspect-4/3 bg-slate-100 overflow-hidden cursor-pointer"
                      onClick={() => onViewMediaDetail?.(memory)}
                    >
                      <img
                        src={coverUrl}
                        alt={memory.title}
                        className="w-full h-full object-cover group-hover/card:scale-102 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <Maximize2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ) : null}

                  {/* Memory Card Body */}
                  <div className="p-3.5">
                    {/* Header: Type & Date & Location */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5 text-[11px] text-[#64748B]">
                      <div className="flex items-center gap-1.5 font-semibold text-[#2563EB]">
                        {mType === 'PHOTO' && <ImageIcon className="w-3.5 h-3.5" />}
                        {mType === 'VIDEO' && <Video className="w-3.5 h-3.5" />}
                        {mType === 'AUDIO' && <Headphones className="w-3.5 h-3.5" />}
                        {mType === 'STORY' && <BookOpen className="w-3.5 h-3.5" />}
                        {mType === 'DOCUMENT' && <FileText className="w-3.5 h-3.5" />}
                        {mType === 'RECIPE' && <Sparkles className="w-3.5 h-3.5" />}
                        <span>{mType}</span>
                      </div>

                      {formattedDate && (
                        <div className="flex items-center gap-1 text-[#475569]">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formattedDate}</span>
                        </div>
                      )}
                    </div>

                    <h4
                      onClick={() => onViewMediaDetail?.(memory)}
                      className="text-sm font-bold text-[#17233C] group-hover/card:text-[#2563EB] transition-colors leading-snug cursor-pointer"
                    >
                      {memory.title}
                    </h4>

                    {memory.location && (
                      <div className="flex items-center gap-1 text-[11px] text-[#64748B] mt-1">
                        <MapPin className="w-3 h-3 text-[#2563EB] shrink-0" />
                        <span className="truncate">{memory.location}</span>
                      </div>
                    )}

                    {memory.description && (
                      <p className={`text-xs text-[#475569] mt-2 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                        {memory.description}
                      </p>
                    )}
                    {memory.description && memory.description.length > 100 && (
                      <button
                        type="button"
                        onClick={() => setExpandedMemoryId(isExpanded ? null : memory.id)}
                        className="text-[11px] text-[#2563EB] font-semibold mt-1 hover:underline cursor-pointer"
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}

                    {/* Tagged Relatives */}
                    {taggedMembers.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-[#F1F5F9]">
                        <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider block mb-1.5">
                          Relatives in Memory
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {taggedMembers.map((rel) => (
                            <button
                              key={rel.id}
                              type="button"
                              onClick={() => onSelectMember?.(rel)}
                              title={`Focus on ${rel.firstName} ${rel.lastName} on the family tree`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-[#2563EB] text-[11px] font-medium text-[#1E293B] border border-slate-200 transition-colors cursor-pointer"
                            >
                              <MemberAvatar
                                name={`${rel.firstName} ${rel.lastName}`}
                                src={rel.profilePhoto || (rel as any).profileImageUrl}
                                gender={rel.gender}
                                size="xs"
                                className="w-4 h-4 rounded-full"
                              />
                              <span>{rel.firstName}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover:text-[#2563EB]" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadata Tags */}
                    {memory.tags && memory.tags.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500">
                        {memory.tags.map((tag, tIdx) => (
                          <span key={tIdx} className="hover:text-slate-800">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* =========================================================
            5. Bottom Docked Action Bar
            ========================================================= */}
        <div className="p-3 bg-slate-50 border-t border-[#E2E8F0] flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredMemories.length}</strong> of {memories.length}
          </span>
          <button
            type="button"
            onClick={() => onOpenUploadModal(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Memory</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
