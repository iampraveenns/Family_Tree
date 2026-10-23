import React from 'react';
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
import { resolveMediaStreamUrl, getMemoryCoverUrl, getMemoryVideoUrl, resolveMemoryAuthor } from '../../utils/mediaUtils.ts';
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
  if (!isOpen || !memory) return null;

  const mType = (memory.memoryType || (memory as any).type || 'PHOTO').toUpperCase();
  const coverUrl = getMemoryCoverUrl(memory);
  const formattedDate = formatSingleDate(memory.eventDate || (memory as any).date);

  const videoAsset = memory.media?.find((a) => a.mimeType?.startsWith('video/'));
  const audioAsset = memory.media?.find((a) => a.mimeType?.startsWith('audio/'));
  const videoUrl = getMemoryVideoUrl(memory) || (videoAsset ? resolveMediaStreamUrl(videoAsset) : null);
  const audioUrl = audioAsset ? resolveMediaStreamUrl(audioAsset) : null;

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <MemberAvatar
              member={authorMember || ({ firstName: authorName.split(' ')[0] || 'F', lastName: authorName.split(' ')[1] || 'M' } as any)}
              src={authorPhoto || authorMember?.profilePhoto}
              gender={authorMember?.gender}
              size="sm"
              className="w-8 h-8 ring-1.5 ring-blue-500/20 shrink-0"
            />
            <div>
              <h3 className="text-base font-bold text-[#0F172A] leading-tight truncate">
                {memory.title}
              </h3>
              <p className="text-[11px] text-slate-500">
                {mType} Memory {formattedDate ? `• ${formattedDate}` : ''} • Added by <strong className="text-blue-700">{authorName}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Presentation Stage */}
        <div className="flex-1 overflow-y-auto">
          {videoUrl || mType === 'VIDEO' ? (
            <div className="w-full bg-black aspect-video flex items-center justify-center">
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
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
                  <Video className="w-12 h-12 mx-auto mb-2 text-blue-400" />
                  <p className="text-sm">Video file recorded</p>
                </div>
              )}
            </div>
          ) : audioUrl || mType === 'AUDIO' ? (
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-slate-200 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center mb-3 shadow-md">
                <Headphones className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-[#1E3A8A] mb-1">Spoken Family Narrative</h4>
              <p className="text-xs text-slate-600 mb-4 max-w-md">
                Listen to oral recollections and historical audio preserved by family members.
              </p>
              {audioUrl ? (
                <audio controls src={audioUrl} className="w-full max-w-md" autoPlay />
              ) : (
                <p className="text-xs text-slate-500 italic">Audio recording preserved in vault.</p>
              )}
            </div>
          ) : coverUrl ? (
            <div className="w-full bg-slate-900 flex items-center justify-center max-h-[55vh] overflow-hidden">
              <img
                src={coverUrl}
                alt={memory.title}
                className="w-full h-full object-contain max-h-[55vh]"
              />
            </div>
          ) : null}

          {/* Metadata Details */}
          <div className="p-5 space-y-4">
            {/* Description */}
            {memory.description && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Chronicle & Narrative
                </h5>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {memory.description}
                </p>
              </div>
            )}

            {/* Event Date and Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
              {formattedDate && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-[#2563EB] shrink-0" />
                  <span><strong>Date:</strong> {formattedDate}</span>
                </div>
              )}
              {memory.location && (
                <div className="flex items-center gap-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-[#2563EB] shrink-0" />
                  <span><strong>Location:</strong> {memory.location}</span>
                </div>
              )}
            </div>

            {/* Tagged Relatives */}
            {taggedMembers.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Relatives Linked to this Memory
                </h5>
                <div className="flex flex-wrap gap-2">
                  {taggedMembers.map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectMember?.(rel);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-[#2563EB] text-xs font-medium text-slate-800 border border-slate-200 transition-colors cursor-pointer"
                    >
                      <MemberAvatar
                        name={`${rel.firstName} ${rel.lastName}`}
                        src={rel.profilePhoto || (rel as any).profileImageUrl}
                        gender={rel.gender}
                        size="xs"
                        className="w-5 h-5 rounded-full"
                      />
                      <span>{rel.firstName} {rel.lastName}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {memory.tags && memory.tags.length > 0 && (
              <div className="pt-2 flex flex-wrap gap-1.5 text-xs text-slate-500">
                {memory.tags.map((t, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
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
