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
  ExternalLink,
  Loader2,
  Sparkles,
  ArrowRight,
  Folder,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FamilyMember, MemoryType } from '../../types/index.ts';
import { useMemoryStore } from '../../stores/useMemoryStore.ts';
import { useToastStore } from '../../stores/useToastStore.ts';
import { Modal } from '../ui/Modal.tsx';
import { MemberAvatar } from '../ui/MemberAvatar.tsx';
import { Button } from '../ui/Button.tsx';

export interface UploadNodeMemoryModalProps {
  isOpen: boolean;
  member: FamilyMember | null;
  familyId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const UploadNodeMemoryModal: React.FC<UploadNodeMemoryModalProps> = ({
  isOpen,
  member,
  familyId,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const {
    createMemory,
    checkDuplicateMedia,
    openDetail,
    fetchMemories,
    fetchCollections,
    fetchStats,
    collections,
  } = useMemoryStore();
  const { success: showToastSuccess, error: showToastError } = useToastStore();

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
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

  // Load collections if not already present
  useEffect(() => {
    if (familyId && (!collections || collections.length === 0)) {
      fetchCollections(familyId);
    }
  }, [familyId]);

  // Initialize or reset when member or open state changes
  useEffect(() => {
    if (isOpen && member) {
      const defaultTitle = `${member.displayName || `${member.firstName} ${member.lastName}`}'s Memory`;
      setTitle(defaultTitle);
      setDescription('');
      setEventDate('');
      setLocation(member.location || member.birthPlace || '');
      setMediaFile(null);
      setPreviewUrl(null);
      setFileType(null);
      setFormError(null);
      setDuplicateWarning(null);

      // Auto-suggest collection if member matches
      if (collections && collections.length > 0) {
        if (member.generation && member.generation <= 2) {
          const grandCol = collections.find((c) =>
            c.title.toLowerCase().includes('grand')
          );
          if (grandCol) {
            setSelectedCollectionId(grandCol.id);
            return;
          }
        }
        // default to first collection or empty
        setSelectedCollectionId(collections[0]?.id || '');
      } else {
        setSelectedCollectionId('');
      }
    }
  }, [isOpen, member, collections]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen || !member) return null;

  const memberFullName = member.displayName || `${member.firstName} ${member.lastName}`;

  const processSelectedFile = async (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setFormError('Please select a valid photo or video file (JPEG, PNG, WebP, MP4, MOV, WebM, etc.).');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setMediaFile(file);
    setPreviewUrl(objectUrl);
    setFileType(isImage ? 'image' : 'video');
    setFormError(null);
    setDuplicateWarning(null);

    // Auto update title if still matching previous generic default
    if (!title || title.endsWith("'s Memory")) {
      const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(`${member.firstName} — ${cleanFileName}`);
    }

    // Check duplicate media checksum
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaFile) {
      setFormError('Please choose a photo or video to upload.');
      return;
    }

    if (!title.trim()) {
      setFormError('Please provide a title for this memory.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const memoryType: MemoryType = fileType === 'video' ? 'PHOTO' : 'PHOTO';

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        memoryType,
        eventDate: eventDate.trim() || undefined,
        location: location.trim() || undefined,
        visibility: 'FAMILY' as const,
        memberIds: [member.id],
        branchIds: member.branchId ? [member.branchId] : undefined,
        collectionId: selectedCollectionId || undefined,
      };

      const result = await createMemory(familyId, payload, mediaFile);

      if (result) {
        showToastSuccess(
          `Memory successfully uploaded for ${memberFullName}! Visible now in the Memories section.`
        );
        // Refresh memory store and collections so it immediately updates in the Memories tab
        await Promise.all([
          fetchMemories(familyId),
          fetchCollections(familyId),
          fetchStats(familyId),
        ]);
        onSuccess?.();
        onClose();
      } else {
        setFormError('Failed to upload memory. Please check file format and try again.');
      }
    } catch (err: any) {
      console.error('Failed to upload memory from tree node:', err);
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
              Upload Memories for {memberFullName}
            </h3>
            <p className="text-[11px] text-[#475569] font-normal">
              Photos & videos will be permanently preserved and visible in the Memories section
            </p>
          </div>
        </div>
      }
      maxWidth="md"
      id="upload-node-memory-modal"
      className="!bg-[#FFF9D6] !border-[#B8D4FF] text-[#17233C]"
      style={{ backgroundColor: '#FFF9D6', color: '#17233C' }}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1" noValidate={false}>
        {/* Banner about visibility in Memories Section */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#FEF08A]/45 border border-[#FDE047] text-[#854D0E] text-xs">
          <ImageIcon className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          <div className="flex-1 text-[11.5px] leading-relaxed">
            <span className="font-semibold">Preserve in Family Memories:</span> Media uploaded here is tagged directly to{' '}
            <strong className="font-semibold text-[#17233C]">{memberFullName}</strong> and will appear in the{' '}
            <span className="font-semibold text-[#2563EB]">Memories section</span> and collections for all family members to view.
          </div>
        </div>

        {formError && (
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            {formError}
          </div>
        )}

        {/* File Drag & Drop / Upload Area */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#17233C] flex items-center justify-between">
            <span>Select Photo or Video <span className="text-red-500">*</span></span>
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
            className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
              dragActive
                ? 'border-[#2563EB] bg-[#EFF6FF]'
                : 'border-[#CBD5E1] hover:border-[#94A3B8] bg-[#F8FAFC]'
            }`}
          >
            {mediaFile && previewUrl ? (
              <div className="space-y-3">
                {/* Media Preview Box */}
                <div className="relative rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center max-h-56">
                  {fileType === 'image' ? (
                    <img
                      src={previewUrl}
                      alt="Upload preview"
                      className="max-h-56 w-auto object-contain mx-auto"
                    />
                  ) : (
                    <video
                      src={previewUrl}
                      controls
                      playsInline
                      className="max-h-56 w-full object-contain bg-slate-100"
                    />
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
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-[#17233C] px-1">
                  <div className="flex items-center gap-1.5 truncate">
                    {fileType === 'video' ? (
                      <Video className="w-4 h-4 text-[#2563EB] shrink-0" />
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
              <div className="py-2">
                <div className="w-10 h-10 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mx-auto mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs text-[#17233C] font-medium">
                  Drag and drop a photo or video here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[#2563EB] font-bold hover:underline cursor-pointer"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-[10px] text-[#64748B] mt-1">
                  Supports JPEG, PNG, WebP, GIF, MP4, WebM, MOV up to 50MB
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileInputChange}
              accept="image/*,video/*"
            />
          </div>
        </div>

        {/* Title Input */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#17233C] block">
            Memory Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`e.g. ${member.firstName}'s graduation snapshot, wedding portrait, family story...`}
            className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs text-[#17233C] focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
          />
        </div>

        {/* Date and Location (2 columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#17233C] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#64748B]" />
              <span>Date or Year (Optional)</span>
            </label>
            <input
              type="text"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              placeholder="e.g. 1984, or 15 Aug 1990"
              className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs text-[#17233C] focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
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
              className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs text-[#17233C] focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
            />
          </div>
        </div>

        {/* Collection Inclusion */}
        {collections && collections.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#17233C] flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Heritage Collection</span>
              </span>
              <span className="text-[10px] text-[#64748B] font-normal">
                Includes in Memories Collections
              </span>
            </label>
            <select
              value={selectedCollectionId}
              onChange={(e) => setSelectedCollectionId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white/95 text-xs text-[#17233C] focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
            >
              <option value="">General Family Memories</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title} ({col.memoryCount || (col.memoryIds?.length || 0)} items)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Description / Story text */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#17233C] block">
            Story or Notes (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Share context, memories, names of people in the photo or video..."
            className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-xs text-[#17233C] focus:ring-2 focus:ring-[#2563EB] focus:outline-none resize-none"
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
            disabled={isSubmitting || !mediaFile || !title.trim()}
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
                <span>Upload & Save to Memories</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
