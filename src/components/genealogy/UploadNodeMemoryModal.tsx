import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  X,
  FileCheck,
  Image as ImageIcon,
  Video,
  Calendar,
  MapPin,
  AlertTriangle,
  Loader2,
  Sparkles,
  Mic,
  FileText,
  User,
  Users,
  Check,
} from 'lucide-react';
import { FamilyMember, MemoryType } from '../../types/index.ts';
import { useMemoryStore } from '../../stores/useMemoryStore.ts';
import { useToastStore } from '../../stores/useToastStore.ts';
import { Modal } from '../ui/Modal.tsx';
import { MemberAvatar } from '../ui/MemberAvatar.tsx';
import { Button } from '../ui/Button.tsx';

export interface UploadNodeMemoryModalProps {
  isOpen: boolean;
  member?: FamilyMember | null;
  familyId: string;
  members?: FamilyMember[];
  onClose: () => void;
  onSuccess?: () => void;
}

export const UploadNodeMemoryModal: React.FC<UploadNodeMemoryModalProps> = ({
  isOpen,
  member = null,
  familyId,
  members = [],
  onClose,
  onSuccess,
}) => {
  const {
    createMemory,
    checkDuplicateMedia,
    fetchMemories,
    fetchStats,
    error: storeError,
  } = useMemoryStore();
  const { success: showToastSuccess, error: showToastError } = useToastStore();

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | 'audio' | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [authorMemberId, setAuthorMemberId] = useState<string>('');
  const [customAuthorName, setCustomAuthorName] = useState<string>('');
  const [selectedTaggedIds, setSelectedTaggedIds] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    isDuplicate: boolean;
    existingMedia?: any;
    existingMemory?: any;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset when open state or member changes
  useEffect(() => {
    if (isOpen) {
      const defaultAuthor = member || members[0] || null;
      setAuthorMemberId(defaultAuthor?.id || '');
      setCustomAuthorName('');
      setSelectedTaggedIds(member ? [member.id] : []);

      if (member) {
        setTitle(`${member.displayName || `${member.firstName} ${member.lastName}`.trim()}'s Memory`);
        setLocation(member.location || member.birthPlace || '');
      } else {
        setTitle('');
        setLocation('');
      }

      setDescription('');
      setEventDate('');
      setMediaFile(null);
      setPreviewUrl(null);
      setFileType(null);
      setFormError(null);
      setDuplicateWarning(null);
    }
  }, [isOpen, member, members]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const processSelectedFile = async (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');

    if (!isImage && !isVideo && !isAudio) {
      setFormError('Please select a photo, video, or audio file (JPEG, PNG, WebP, MP4, MOV, MP3, WAV, etc.).');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setMediaFile(file);
    setPreviewUrl(objectUrl);
    setFileType(isImage ? 'image' : isVideo ? 'video' : 'audio');
    setFormError(null);
    setDuplicateWarning(null);

    // Auto set title if empty
    if (!title.trim() || title.endsWith("'s Memory")) {
      const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      if (member) {
        setTitle(`${member.firstName} — ${cleanFileName}`);
      } else {
        setTitle(cleanFileName.charAt(0).toUpperCase() + cleanFileName.slice(1));
      }
    }

    // Check duplicate media checksum if familyId is valid
    if (familyId) {
      try {
        setIsCheckingDuplicate(true);
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

        const res = await checkDuplicateMedia(familyId, hex);
        if (res.isDuplicate) {
          setDuplicateWarning(res);
        }
      } catch (err) {
        console.warn('Duplicate checksum check failed, proceeding:', err);
      } finally {
        setIsCheckingDuplicate(false);
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const toggleTagMember = (mId: string) => {
    setSelectedTaggedIds((prev) =>
      prev.includes(mId) ? prev.filter((id) => id !== mId) : [...prev, mId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setFormError('Please provide a title for this memory.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      // Determine memoryType
      let memoryType: MemoryType = 'PHOTO';
      if (fileType === 'audio') {
        memoryType = 'AUDIO';
      } else if (fileType === 'video') {
        memoryType = 'PHOTO'; // Supported type in backend enum
      } else if (!mediaFile && description.trim()) {
        memoryType = 'STORY';
      }

      // Determine author
      const selectedAuthor = members.find((m) => m.id === authorMemberId) || member;
      const authorFullName =
        customAuthorName.trim() ||
        (selectedAuthor
          ? selectedAuthor.displayName || `${selectedAuthor.firstName} ${selectedAuthor.lastName}`.trim()
          : 'Family Member');

      // Tagged member IDs
      const allMemberIds = Array.from(
        new Set([
          ...selectedTaggedIds,
          ...(selectedAuthor?.id ? [selectedAuthor.id] : []),
          ...(member?.id ? [member.id] : []),
        ])
      ).filter(Boolean);

      // Validate 24-character hex ObjectId for branchIds to prevent backend validation errors
      const isValidObjectId = (id?: string) => Boolean(id && /^[0-9a-fA-F]{24}$/.test(id));
      const branchIds =
        selectedAuthor?.branchId && isValidObjectId(selectedAuthor.branchId)
          ? [selectedAuthor.branchId]
          : member?.branchId && isValidObjectId(member.branchId)
          ? [member.branchId]
          : undefined;

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        memoryType,
        eventDate: eventDate.trim() || undefined,
        location: location.trim() || undefined,
        visibility: 'FAMILY' as const,
        addedByMemberId: selectedAuthor?.id || member.id,
        addedByMemberName: authorFullName,
        memberIds: allMemberIds.length > 0 ? allMemberIds : undefined,
        branchIds,
      };

      const result = await createMemory(familyId, payload, mediaFile || undefined);

      if (result) {
        showToastSuccess(`Memory "${title.trim()}" successfully saved! Visible now in the Memories sidebar.`);
        // Refresh memory store and stats so it immediately appears
        await Promise.all([
          fetchMemories(familyId),
          fetchStats(familyId),
        ]);
        onSuccess?.();
        onClose();
      } else {
        setFormError(useMemoryStore.getState().error || 'Failed to save memory. Please check details and try again.');
      }
    } catch (err: any) {
      console.error('Failed to create memory:', err);
      setFormError(err?.message || 'Error occurred while saving memory.');
      showToastError(err?.message || 'Failed to preserve memory');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#2563EB]/15 text-[#2563EB] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#17233C] leading-snug">
              Add Memory
            </h3>
            <p className="text-[11px] text-[#475569] font-normal">
              {member
                ? `Preserve photos, videos, audios, and stories for ${member.displayName || member.firstName} in family archives`
                : 'Preserve cherished photos, videos, audios, and stories in family archives'}
            </p>
          </div>
        </div>
      }
      maxWidth="md"
      id="upload-node-memory-modal"
      className="!bg-[#FFF9D6] !border-[#B8D4FF] text-[#17233C]"
      style={{ backgroundColor: '#FFF9D6', color: '#17233C' }}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 pt-1" noValidate={false}>
        {formError && (
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {formError}
          </div>
        )}

        {/* 1. Person Adding Memory / Author Selector */}
        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#17233C] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Added By (Memory Contributor)</span>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                Author
              </span>
            </span>
            <span className="text-[10px] text-slate-500">Displayed at top of memory post</span>
          </div>

          <div className="space-y-1.5">
            {members && members.length > 0 ? (
              <select
                id="author-member-select"
                data-testid="author-member-select"
                value={authorMemberId}
                onChange={(e) => {
                  setAuthorMemberId(e.target.value);
                  if (e.target.value) setCustomAuthorName('');
                }}
                className="w-full text-xs font-medium py-1.5 px-2.5 pr-8 bg-white border border-blue-300 rounded-lg text-[#17233C] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="">Select family member as author...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName || `${m.firstName} ${m.lastName}`.trim()} {m.branchName ? `(${m.branchName})` : ''}
                  </option>
                ))}
              </select>
            ) : null}

            {/* Custom Author Name Input if needed */}
            <input
              type="text"
              placeholder="Or enter author's name (e.g. Grandma, Uncle Joe, or your name)..."
              value={customAuthorName}
              onChange={(e) => setCustomAuthorName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white text-xs text-[#17233C] placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 2. File Drag & Drop / Upload Area */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#17233C] flex items-center justify-between">
            <span>Upload Photo, Video, or Audio (Optional for story posts)</span>
            {mediaFile && (
              <span className="text-[10px] text-[#64748B] font-normal">
                {(mediaFile.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            )}
          </label>

          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-3.5 text-center transition-all ${
              dragActive
                ? 'border-[#2563EB] bg-[#EFF6FF]'
                : 'border-[#CBD5E1] hover:border-[#94A3B8] bg-[#F8FAFC]'
            }`}
          >
            {mediaFile && previewUrl ? (
              <div className="space-y-2.5">
                {/* Media Preview Box */}
                <div className="relative rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center max-h-52">
                  {fileType === 'image' ? (
                    <img
                      src={previewUrl}
                      alt="Upload preview"
                      className="max-h-52 w-auto object-contain mx-auto"
                    />
                  ) : fileType === 'video' ? (
                    <video
                      src={previewUrl}
                      controls
                      playsInline
                      className="max-h-52 w-full object-contain bg-slate-100"
                    />
                  ) : (
                    <div className="p-4 flex flex-col items-center justify-center w-full">
                      <Mic className="w-8 h-8 text-emerald-600 mb-1.5" />
                      <audio src={previewUrl} controls className="w-full max-w-xs" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMediaFile(null);
                      setPreviewUrl(null);
                      setFileType(null);
                      setDuplicateWarning(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-slate-700 hover:bg-white border border-slate-200 shadow-sm transition-colors cursor-pointer"
                    title="Remove selected file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-[#17233C] px-1">
                  <div className="flex items-center gap-1.5 truncate">
                    {fileType === 'video' ? (
                      <Video className="w-4 h-4 text-[#2563EB] shrink-0" />
                    ) : fileType === 'audio' ? (
                      <Mic className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-[#2563EB] shrink-0" />
                    )}
                    <span className="truncate font-medium">{mediaFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[#2563EB] hover:underline text-[11px] font-semibold cursor-pointer shrink-0 ml-2"
                  >
                    Change file
                  </button>
                </div>

                {isCheckingDuplicate && (
                  <div className="text-[11px] text-[#2563EB] flex items-center justify-center gap-1.5 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Checking for duplicate uploads in archives...
                  </div>
                )}

                {duplicateWarning && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-left space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Duplicate File Detected</span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      This file already exists in your family vault:
                      {duplicateWarning.existingMemory?.title && (
                        <strong className="block mt-0.5 font-semibold">
                          "{duplicateWarning.existingMemory.title}"
                        </strong>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-1.5">
                <div className="w-9 h-9 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mx-auto mb-1.5">
                  <Upload className="w-4 h-4" />
                </div>
                <p className="text-xs text-[#17233C] font-medium">
                  Drag and drop photos, videos, or audios, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[#2563EB] font-bold hover:underline cursor-pointer"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-[10px] text-[#64748B] mt-0.5">
                  Supports JPEG, PNG, WebP, GIF, MP4, WebM, MOV, MP3, WAV up to 50MB
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileInputChange}
              accept="image/*,video/*,audio/*"
            />
          </div>
        </div>

        {/* 3. Title Input */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#17233C] block">
            Memory Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Golden Wedding Anniversary, Childhood Photo, Family Reunion 1985..."
            className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#17233C] focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
          />
        </div>

        {/* 4. Tag Relatives in Memory (Optional) */}
        {members && members.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#17233C] flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Tag Relatives in this Memory</span>
              </span>
              <span className="text-[10px] text-slate-500">
                {selectedTaggedIds.length} selected
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-white/70 rounded-lg border border-[#CBD5E1]">
              {members.map((m) => {
                const isTagged = selectedTaggedIds.includes(m.id);
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => toggleTagMember(m.id)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      isTagged
                        ? 'bg-[#2563EB] text-white shadow-2xs'
                        : 'bg-white hover:bg-slate-100 text-[#17233C] border border-slate-200'
                    }`}
                  >
                    {isTagged && <Check className="w-3 h-3" />}
                    <span>{m.displayName || `${m.firstName} ${m.lastName}`.trim()}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Date and Location (2 columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="memory-event-date" className="text-xs font-semibold text-[#17233C] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#64748B]" />
              <span>Date (Optional)</span>
            </label>
            <input
              id="memory-event-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#17233C] focus:ring-2 focus:ring-[#2563EB] focus:outline-none cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#17233C] flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#64748B]" />
              <span>Location (Optional)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Ancestral Home, Kerala"
              className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#17233C] focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
            />
          </div>
        </div>

        {/* 6. Description / Story text */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#17233C] flex items-center gap-1">
            <FileText className="w-3 h-3 text-[#64748B]" />
            <span>Story or Notes (Optional)</span>
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Share the story, precious words, memories, and who is in the picture..."
            className="w-full px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#17233C] focus:ring-2 focus:ring-[#2563EB] focus:outline-none resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-between border-t border-[#D8CE8E]">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs text-[#475569] hover:text-[#17233C]"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Preserving Memory...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Add to Memories</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
