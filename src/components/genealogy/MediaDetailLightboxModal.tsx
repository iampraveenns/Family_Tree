import React, { useEffect } from 'react';
import {
  X,
  Calendar,
  MapPin,
  Tag,
  Download,
  Image as ImageIcon,
  Video,
  Headphones,
  BookOpen,
  FileText,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Memory, FamilyMember } from '../../types/index.ts';
import { MemberAvatar } from '../ui/MemberAvatar.tsx';
import { resolveMediaStreamUrl, getMemoryCoverUrl, getMemoryVideoUrl, getMemoryAudioUrl, resolveMemoryAuthor } from '../../utils/mediaUtils.ts';
import { formatSingleDate } from './HeritageMemberNode.tsx';

export interface MediaDetailLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory: Memory | null;
  members: FamilyMember[];
  onSelectMember?: (member: FamilyMember) => void;
}

export const MediaDetailLightboxModal: React.FC<MediaDetailLightboxModalProps> = ({
  isOpen,
  onClose,
  memory,
  members,
  onSelectMember,
}) => {
  // Prevent background page scrolling while lightbox is active
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !memory) return null;

  const mType = (memory.memoryType || (memory as any).type || 'PHOTO').toUpperCase();
  const coverUrl = getMemoryCoverUrl(memory);
  const formattedDate = formatSingleDate(memory.eventDate || (memory as any).date);

  const videoAsset = memory.media?.find((a) => a.mimeType?.startsWith('video/'));
  const audioAsset = memory.media?.find((a) => a.mimeType?.startsWith('audio/'));
  const videoUrl = getMemoryVideoUrl(memory) || (videoAsset ? resolveMediaStreamUrl(videoAsset, undefined, true) : null);
  const audioUrl = getMemoryAudioUrl(memory) || (audioAsset ? resolveMediaStreamUrl(audioAsset) : null);

  // Resolve tagged members
  const memberMap = new Map<string, FamilyMember>();
  members.forEach((m) => {
    memberMap.set(m.id, m);
    if ((m as any)._id) memberMap.set((m as any)._id.toString(), m);
  });
  const rawMemberIds = memory.memberIds || (memory as any).relatedMemberIds || [];
  const taggedMembers = rawMemberIds
    .map((id: any) => memberMap.get(id?.toString()))
    .filter(Boolean) as FamilyMember[];

  const { authorMember, authorName, authorPhoto } = resolveMemoryAuthor(memory, members, memberMap);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Media detail for ${memory.title}`}
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 pb-8 px-3 sm:px-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-[#FFF8D6] rounded-3xl overflow-hidden shadow-2xl flex flex-col h-auto max-h-[calc(100vh-6.5rem)] animate-in zoom-in-95 duration-150 border-2 border-[#F5E7A3] my-auto text-[#263449]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header - Fixed & Locked with Soft Butter-Yellow Styling */}
        <div className="flex items-center justify-between p-4 border-b border-[#F5E7A3] bg-[#FFF8D6] shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <MemberAvatar
              member={authorMember || ({ firstName: authorName.split(' ')[0] || 'F', lastName: authorName.split(' ')[1] || 'M' } as any)}
              src={authorPhoto || authorMember?.profilePhoto}
              gender={authorMember?.gender}
              size="sm"
              className="w-9 h-9 ring-2 ring-[#F5E7A3] shrink-0"
            />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#263449] leading-tight truncate">
                {memory.title}
              </h3>
              <p className="text-[11px] text-[#263449]/70 truncate">
                {mType} Memory {formattedDate ? `• ${formattedDate}` : ''} • Added by <strong className="text-[#263449] font-bold">{authorName}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 text-[#263449]/70 hover:text-[#263449] hover:bg-[#F5E7A3]/50 rounded-full transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Presentation Stage - Fixed & Positionally Stable */}
        <div className="shrink-0 w-full bg-black flex items-center justify-center overflow-hidden max-h-[50vh]">
          {videoUrl || mType === 'VIDEO' ? (
            <div className="w-full aspect-video max-h-[50vh] flex items-center justify-center bg-black">
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  poster={coverUrl || undefined}
                  className="w-full h-full max-h-[50vh] object-contain"
                />
              ) : coverUrl ? (
                <img
                  src={coverUrl}
                  alt={memory.title}
                  className="w-full h-full max-h-[50vh] object-contain"
                />
              ) : (
                <div className="p-12 text-center text-white/70">
                  <Video className="w-12 h-12 mx-auto mb-2 text-[#D4B83E]" />
                  <p className="text-sm">Video file recorded</p>
                </div>
              )}
            </div>
          ) : audioUrl || mType === 'AUDIO' ? (
            <div className="w-full p-6 bg-[#FFF8D6] border-b border-[#F5E7A3] flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#D4B83E] text-white flex items-center justify-center mb-3 shadow-md">
                <Headphones className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-[#263449] mb-1">Spoken Family Narrative</h4>
              <p className="text-xs text-[#263449]/80 mb-4 max-w-md">
                Listen to oral recollections and historical audio preserved by family members.
              </p>
              {audioUrl ? (
                <audio controls src={audioUrl} className="w-full max-w-md" autoPlay />
              ) : (
                <p className="text-xs text-[#263449]/60 italic">Audio recording preserved in vault.</p>
              )}
            </div>
          ) : coverUrl ? (
            <div className="w-full bg-slate-900 flex items-center justify-center max-h-[50vh] overflow-hidden">
              <img
                src={coverUrl}
                alt={memory.title}
                className="w-full h-full object-contain max-h-[50vh]"
              />
            </div>
          ) : null}
        </div>

        {/* Scrollable Chronicle & Tagged Members Details Area */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#FFF8D6]">
          {/* Metadata Details */}
          <div className="p-5 space-y-4">
            {/* Description */}
            {memory.description && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-[#263449]/70 mb-1">
                  Chronicle & Narrative
                </h5>
                <p className="text-sm text-[#263449] leading-relaxed whitespace-pre-line">
                  {memory.description}
                </p>
              </div>
            )}

            {/* Event Date and Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#F5E7A3] text-xs">
              {formattedDate && (
                <div className="flex items-center gap-2 text-[#263449]">
                  <Calendar className="w-4 h-4 text-[#D4B83E] shrink-0" />
                  <span><strong>Date:</strong> {formattedDate}</span>
                </div>
              )}
              {memory.location && (
                <div className="flex items-center gap-2 text-[#263449]">
                  <MapPin className="w-4 h-4 text-[#D4B83E] shrink-0" />
                  <span><strong>Location:</strong> {memory.location}</span>
                </div>
              )}
            </div>

            {/* Tagged Relatives */}
            {taggedMembers.length > 0 && (
              <div className="pt-3 border-t border-[#F5E7A3] flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-[#263449]/70 flex items-center gap-1">
                  <span>Tagged in tree:</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {taggedMembers.map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectMember?.(rel);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 hover:bg-[#FFF8D6] text-[#263449] text-[11px] font-medium transition-colors cursor-pointer border border-[#F5E7A3] shadow-2xs"
                      title={`Focus ${rel.displayName || `${rel.firstName} ${rel.lastName}`} in family tree`}
                    >
                      <MemberAvatar
                        member={rel}
                        name={`${rel.firstName} ${rel.lastName}`}
                        src={rel.profilePhoto || (rel as any).profileImageUrl}
                        gender={rel.gender}
                        size="xs"
                      />
                      <span>{rel.displayName || `${rel.firstName} ${rel.lastName}`}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {memory.tags && memory.tags.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-1.5 text-xs text-[#263449]/70">
                {memory.tags.map((t, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-white/80 border border-[#F5E7A3] text-[#263449]">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
