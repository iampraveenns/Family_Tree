import React, { useState, useEffect, useRef } from 'react';
import { GitFork, ChevronDown, ChevronUp, Loader2, Camera, UserPlus, CheckCircle2, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../ui/Modal.tsx';
import { Input } from '../ui/Input.tsx';
import { MemberAvatar } from '../ui/MemberAvatar.tsx';
import { FamilyMember, FamilyBranch } from '../../types/index.ts';

export interface MemberFormData {
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  relationshipType: string;
  marriageDate?: string;
  birthDate?: string;
  birthYear: string;
  exactBirthDate: string;
  deathDate: string;
  isLiving: boolean;
  registeredEmail?: string;
  occupation: string;
  birthPlace: string;
  houseName?: string;
  location?: string;
  photoUrl: string;
  maidenName: string;
  branchId: string;
  biography: string;
  notes: string;
}

export interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MemberFormData) => Promise<void>;
  isRootAncestor: boolean;
  referenceMember?: FamilyMember | null;
  referenceMemberHasSpouse?: boolean;
  initialRelationshipType?: string;
  branches?: FamilyBranch[];
  isSubmitting?: boolean;
  editMember?: FamilyMember | null;
  existingMarriageDate?: string | null;
  hasSpouse?: boolean;
  onEditSubmit?: (memberId: string, data: Partial<MemberFormData>) => Promise<void>;
  isFullscreen?: boolean;
  onRestoreFullscreen?: () => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isRootAncestor,
  referenceMember,
  referenceMemberHasSpouse,
  initialRelationshipType = 'CHILD',
  branches = [],
  isSubmitting = false,
  editMember = null,
  existingMarriageDate = null,
  hasSpouse = false,
  onEditSubmit,
  isFullscreen = false,
  onRestoreFullscreen,
}) => {
  // Helper for initial date formatting
  const getInitialDom = () => {
    if (!editMember) return '';
    const rawDom = (
      existingMarriageDate ||
      (editMember as any).dateOfMarriage ||
      (editMember as any).marriageDate ||
      ''
    ).trim();
    return rawDom.includes('T')
      ? rawDom.split('T')[0]
      : /^\d{4}$/.test(rawDom)
      ? `${rawDom}-01-01`
      : rawDom.slice(0, 10);
  };

  const getInitialDob = () => {
    if (!editMember?.dateOfBirth) return '';
    const rawDob = editMember.dateOfBirth.trim();
    return rawDob.includes('T')
      ? rawDob.split('T')[0]
      : /^\d{4}$/.test(rawDob)
      ? `${rawDob}-01-01`
      : rawDob.slice(0, 10);
  };

  // Stable isolated local form state
  const [firstName, setFirstName] = useState(() => editMember?.firstName || '');
  const [lastName, setLastName] = useState(() => editMember?.lastName || '');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN'>(
    () => editMember?.gender || 'MALE'
  );
  const [relationshipType, setRelationshipType] = useState(initialRelationshipType);
  const [marriageDate, setMarriageDate] = useState(getInitialDom);
  const [dateOfBirth, setDateOfBirth] = useState(getInitialDob);
  const [deathDate, setDeathDate] = useState(() => editMember?.dateOfDeath?.slice(0, 10) || '');
  const [isLiving, setIsLiving] = useState(() => editMember?.isLiving ?? true);
  const [occupation, setOccupation] = useState(() => editMember?.occupation || '');
  const [birthPlace, setBirthPlace] = useState(() => editMember?.birthPlace || '');
  const [houseName, setHouseName] = useState(
    () => editMember?.houseName || (editMember as any)?.housename || ''
  );
  const [location, setLocation] = useState(
    () => editMember?.location || editMember?.birthPlace || ''
  );
  const [photoUrl, setPhotoUrl] = useState(
    () => editMember?.profilePhoto || (editMember as any)?.profileImageUrl || ''
  );
  const [maidenName, setMaidenName] = useState('');
  const [branchId, setBranchId] = useState(() => editMember?.branchId || '');
  const [biography, setBiography] = useState(() => editMember?.biography || '');
  const [notes, setNotes] = useState(() => (editMember as any)?.notes || '');
  const [showMoreDetails, setShowMoreDetails] = useState(
    () => Boolean(editMember?.biography || (editMember as any)?.notes)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image file size exceeds the 5MB limit.');
      return;
    }
    setFormError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerPhotoUpload = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (typeof window !== 'undefined') {
      (window as any).__familyRootsPhotoUploadActive = true;
    }
    fileInputRef.current?.click();
  };

  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    const handleCancel = () => {
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          (window as any).__familyRootsPhotoUploadActive = false;
        }, 500);
      }
    };
    input.addEventListener('cancel', handleCancel);
    return () => {
      input.removeEventListener('cancel', handleCancel);
    };
  }, []);

  const handlePhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPhoto(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePhotoFile(e.dataTransfer.files[0]);
    }
  };

  // References to prevent re-initializing form on every keystroke or parent re-render
  const prevOpenRef = React.useRef(false);
  const prevEditIdRef = React.useRef<string | null>(null);
  const prevRefMemberIdRef = React.useRef<string | null>(null);

  // Sync state only when modal opens or member context transitions
  useEffect(() => {
    const isNowOpen = isOpen && !prevOpenRef.current;
    const isEditChanged = (editMember?.id || null) !== prevEditIdRef.current;
    const isRefChanged = (referenceMember?.id || null) !== prevRefMemberIdRef.current;

    prevOpenRef.current = isOpen;
    prevEditIdRef.current = editMember?.id || null;
    prevRefMemberIdRef.current = referenceMember?.id || null;

    if (!isOpen) return;

    if (isNowOpen || isEditChanged || isRefChanged) {
      setFormError(null);
      if (editMember) {
        setFirstName(editMember.firstName || '');
        setLastName(editMember.lastName || '');
        setGender(editMember.gender || 'UNKNOWN');
        const rawDom = (
          existingMarriageDate ||
          (editMember as any).dateOfMarriage ||
          (editMember as any).marriageDate ||
          ''
        ).trim();
        const formattedDom = rawDom.includes('T')
          ? rawDom.split('T')[0]
          : /^\d{4}$/.test(rawDom)
          ? `${rawDom}-01-01`
          : rawDom.slice(0, 10);
        setMarriageDate(formattedDom);
        const rawDob = editMember.dateOfBirth ? editMember.dateOfBirth.trim() : '';
        const formattedDob = rawDob.includes('T')
          ? rawDob.split('T')[0]
          : /^\d{4}$/.test(rawDob)
          ? `${rawDob}-01-01`
          : rawDob.slice(0, 10);
        setDateOfBirth(formattedDob);
        const rawDeathDate = editMember.dateOfDeath ? editMember.dateOfDeath.slice(0, 10) : '';
        setDeathDate(rawDeathDate);
        if (rawDeathDate) {
          setIsLiving(false);
          setShowMoreDetails(true);
        } else {
          setIsLiving(editMember.isLiving ?? true);
        }
        setOccupation(editMember.occupation || '');
        setBirthPlace(editMember.birthPlace || '');
        setHouseName(editMember.houseName || (editMember as any)?.housename || '');
        setLocation(editMember.location || editMember.birthPlace || '');
        setPhotoUrl(editMember.profilePhoto || (editMember as any).profileImageUrl || '');
        setBranchId(editMember.branchId || '');
        setBiography(editMember.biography || '');
        setNotes((editMember as any).notes || '');
        if (editMember.biography || (editMember as any).notes || editMember.branchId) {
          setShowMoreDetails(true);
        }
      } else {
        setRelationshipType(initialRelationshipType);
        setFirstName('');
        setLastName('');
        setMarriageDate('');

        // Opposite gender inheritance (Phase 30):
        // Male person → default spouse gender Female
        // Female person → default spouse gender Male
        // Unknown/unspecified → default neutral / unknown
        if (initialRelationshipType === 'SPOUSE' && referenceMember) {
          if (referenceMember.gender === 'MALE') {
            setGender('FEMALE');
          } else if (referenceMember.gender === 'FEMALE') {
            setGender('MALE');
          } else {
            setGender('UNKNOWN');
          }
        } else {
          setGender('MALE');
        }

        setDateOfBirth('');
        setDeathDate('');
        setIsLiving(true);
        setOccupation('');
        setBirthPlace('');
        setHouseName('');
        setLocation('');
        setPhotoUrl('');
        setMaidenName('');
        setBranchId('');
        setBiography('');
        setNotes('');
        setShowMoreDetails(false);
      }
    }
  }, [isOpen, editMember?.id, referenceMember?.id, initialRelationshipType]);

  // Reset form cleanly upon closure
  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!firstName.trim() || !lastName.trim() || !dateOfBirth.trim()) {
      setFormError('First Name, Last Name, and Date of Birth are mandatory.');
      return;
    }

    if (
      (relationshipType === 'CHILD' ||
        relationshipType === 'ADOPTED_CHILD' ||
        relationshipType === 'STEP_CHILD') &&
      referenceMember &&
      referenceMemberHasSpouse === false
    ) {
      setFormError(`Add a spouse to ${referenceMember.firstName} before adding a child.`);
      return;
    }

    if (relationshipType === 'SPOUSE' && !marriageDate.trim()) {
      setFormError('Marriage date (DOM) is compulsory when adding a spouse.');
      return;
    }

    if (editMember && hasSpouse && !marriageDate.trim()) {
      setFormError('Marriage date (DOM) is compulsory for a married member.');
      return;
    }

    const hasDeathDate = Boolean(deathDate && deathDate.trim());
    const effectiveLiving = hasDeathDate ? false : isLiving;
    const effectiveDeathDate = effectiveLiving ? '' : deathDate.trim();

    setFormError(null);
    try {

      const payload: MemberFormData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        relationshipType,
        marriageDate: editMember ? marriageDate.trim() : (marriageDate.trim() || undefined),
        birthDate: dateOfBirth.trim(),
        birthYear: dateOfBirth.trim() ? dateOfBirth.trim().slice(0, 4) : '',
        exactBirthDate: dateOfBirth.trim(),
        deathDate: effectiveDeathDate,
        isLiving: effectiveLiving,
        occupation: occupation.trim(),
        birthPlace: birthPlace.trim(),
        houseName: houseName.trim(),
        location: location.trim(),
        photoUrl: photoUrl.trim(),
        maidenName: maidenName.trim(),
        branchId: branchId.trim(),
        biography: biography.trim(),
        notes: notes.trim(),
      };

      if (editMember && onEditSubmit) {
        await onEditSubmit(editMember.id, payload);
      } else {
        await onSubmit(payload);
        // Clear fields only on successful creation
        setFirstName('');
        setLastName('');
        setMarriageDate('');
        setDateOfBirth('');
        setDeathDate('');
        setIsLiving(true);
        setOccupation('');
        setBirthPlace('');
        setHouseName('');
        setLocation('');
        setPhotoUrl('');
        setMaidenName('');
        setBranchId('');
        setBiography('');
        setNotes('');
        setShowMoreDetails(false);
      }
    } catch (err: any) {
      // Keep form open and retain all user inputs
      setFormError(err?.message || (editMember ? 'Failed to update member record' : 'Failed to create member record'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        editMember
          ? `Edit Profile: ${editMember.displayName || `${editMember.firstName} ${editMember.lastName}`}`
          : isRootAncestor
          ? 'Add Starting Relative (Root Ancestor Node)'
          : referenceMember
          ? `Add ${relationshipType.replace(/_/g, ' ').toLowerCase()} to ${referenceMember.firstName}`
          : 'Add Family Member'
      }
      description={
        editMember
          ? 'Update genealogical records, life dates, bio, or branch details'
          : isRootAncestor
          ? 'Add the founding root ancestor member node. Note: This creates an individual person node, distinct from the Family Tree Name.'
          : 'Graph-validated kinship link in your family chronicle'
      }
      id="add-member-modal"
      className={editMember ? '!bg-[#FFF9D6] !border-[#B8D4FF] text-[#17233C]' : ''}
      style={editMember ? { backgroundColor: '#FFF9D6', color: '#17233C' } : undefined}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
        {/* Form Error Banner if submission fails */}
        {formError && (
          <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 font-medium">
            {formError}
          </div>
        )}

        {editMember ? (
          /* ===================================================
             FINAL EDIT PROFILE / EDIT MEMBER FORM LAYOUT
             1. Profile Photo Upload
             2. First Name + Last Name (Same Row)
             3. Gender + Occupation (Same Row, Gender Dropdown ~38%, Occupation ~62%)
             4. Date of Birth + Marriage Date (DOM) (Same Row)
             5. Birthplace (Full Width)
             6. Additional Details (Collapsible: Bio, Notes)
             7. Action Buttons [Cancel] [Save]
             =================================================== */
          <div className="space-y-3.5">
            {/* 1. Profile Photo Upload */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingPhoto(true);
              }}
              onDragLeave={() => setIsDraggingPhoto(false)}
              onDrop={handlePhotoDrop}
              className={`p-4 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center ${
                editMember ? 'bg-[#FFF9D6]' : 'bg-white'
              } ${
                isDraggingPhoto
                  ? 'border-[#2563EB] bg-[#EFF6FF]'
                  : 'border-[#B8D4FF] hover:border-[#7EA7D9]'
              }`}
            >
              <div className="relative group mb-2.5">
                <MemberAvatar
                  src={photoUrl}
                  gender={gender}
                  name={`${firstName || 'New'} ${lastName || 'Member'}`}
                  size="lg"
                  isLiving={isLiving}
                  className="w-20 h-20 ring-4 ring-[#EFF6FF] shadow-xs"
                />
                <button
                  type="button"
                  onClick={handleTriggerPhotoUpload}
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#2563EB] text-white shadow-md hover:bg-[#1D4ED8] active:bg-[#1E40AF] transition-colors cursor-pointer"
                  title="Upload photo"
                  aria-label="Upload photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                ref={fileInputRef}
                id="edit-profile-photo-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                onClick={(e) => {
                  e.stopPropagation();
                  if (typeof window !== 'undefined') {
                    (window as any).__familyRootsPhotoUploadActive = true;
                  }
                }}
                onChange={(e) => {
                  e.stopPropagation();
                  if (e.target.files && e.target.files[0]) {
                    handlePhotoFile(e.target.files[0]);
                  }
                  if (onRestoreFullscreen) {
                    onRestoreFullscreen();
                  } else if (typeof document !== 'undefined' && !document.fullscreenElement) {
                    const container = document.querySelector('[data-family-tree-container]') as HTMLElement | null;
                    if (container && (isFullscreen || (window as any).__familyRootsWasFullscreen)) {
                      container.requestFullscreen?.().catch(() => {});
                    }
                  }
                  if (typeof window !== 'undefined') {
                    setTimeout(() => {
                      (window as any).__familyRootsPhotoUploadActive = false;
                    }, 500);
                  }
                }}
              />

              <button
                type="button"
                onClick={handleTriggerPhotoUpload}
                className="px-3.5 py-1.5 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] active:bg-[#BFDBFE] text-[#1D4ED8] text-xs font-semibold border border-[#B8D4FF] transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Camera className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>{photoUrl ? 'Replace Profile Photo' : 'Upload Profile Photo'}</span>
              </button>

              <p className="text-[11px] text-[#64748B] mt-1.5 font-medium">
                Click to upload or drag and drop
              </p>
              <p className="text-[10px] text-[#94A3B8]">
                JPG, PNG • Max 5MB
              </p>

              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl('')}
                  className="mt-2 text-[10.5px] text-red-600 hover:text-red-700 hover:underline font-medium cursor-pointer"
                >
                  Remove photo
                </button>
              )}
            </div>

            {/* 2. First Name + Last Name (Same Row, Two Equal Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                label="First Name"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <Input
                label="Last Name"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            {/* 3. Gender + Occupation (Same Row, Gender Dropdown ~38%, Occupation ~62%) */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="w-full sm:w-[38%] shrink-0">
                <label
                  htmlFor="member-gender"
                  className="text-xs font-semibold text-[#334155] mb-1.5 block"
                >
                  Gender
                </label>
                <div className="relative">
                  <select
                    id="member-gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm text-[#0F172A] font-medium transition duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#BFDBFE] focus-visible:border-[#2563EB] hover:border-[#7EA7D9] appearance-none pr-8 cursor-pointer"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#64748B] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="w-full sm:w-[62%] min-w-0">
                <Input
                  type="text"
                  placeholder="e.g. Architectural Photographer"
                  label="Occupation (Optional)"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                />
              </div>
            </div>

            {/* 4. Date of Birth + Marriage Date (DOM) (Same Row, Two Equal Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                type="date"
                label="Date of Birth *"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
              <Input
                type="date"
                label={hasSpouse ? 'Marriage Date (DOM) *' : 'Marriage Date (DOM)'}
                required={hasSpouse}
                value={marriageDate}
                onChange={(e) => setMarriageDate(e.target.value)}
              />
            </div>

            {/* 5. Housename & Location (Two Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                type="text"
                placeholder="e.g. Vadakke Tharavadu"
                label="Housename (Optional)"
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
              />
              <Input
                type="text"
                placeholder="e.g. Palakkad, Kerala"
                label="Location (Optional)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* 6. Birthplace (Full Width) */}
            <div>
              <Input
                type="text"
                placeholder="e.g. Bengaluru, Karnataka"
                label="Birthplace (Optional)"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
              />
            </div>

            {/* 6. Collapsible Additional Details (Bio & Notes Only) */}
            <div className="pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setShowMoreDetails(!showMoreDetails)}
                className="w-full flex items-center justify-between text-xs font-semibold text-[#2563EB] py-1 cursor-pointer hover:underline"
              >
                <span>
                  {showMoreDetails
                    ? 'Hide Additional Details'
                    : 'Additional Details (Biography, Notes)'}
                </span>
                {showMoreDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              <AnimatePresence>
                {showMoreDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 pt-3 overflow-hidden"
                  >
                    <div>
                      <label className="text-xs font-semibold text-[#334155] mb-1.5 block">
                        Biography
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Brief life chronicle or narrative..."
                        value={biography}
                        onChange={(e) => setBiography(e.target.value)}
                        className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:ring-2 focus:ring-[#BFDBFE] focus:border-[#2563EB] focus:outline-hidden resize-none transition-all placeholder-[#94A3B8]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[#334155] mb-1.5 block">
                        Notes
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Private family notes, anecdotes, or records..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs sm:text-sm text-[#0F172A] focus:ring-2 focus:ring-[#BFDBFE] focus:border-[#2563EB] focus:outline-hidden resize-none transition-all placeholder-[#94A3B8]"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          /* ===================================================
             ADD RELATIVE / ROOT ANCESTOR FORM
             =================================================== */
          <div className="space-y-3.5">
            {isRootAncestor ? (
              <div className="p-3 rounded-xl border border-blue-200 bg-[#EFF6FF] text-xs text-[#1D4ED8] font-medium flex items-center gap-2.5">
                <GitFork className="w-4 h-4 text-[#2563EB] shrink-0" />
                <span>Founding Person Node • Root Ancestor (Generation 1)</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[#334155] mb-1 block">
                    Reference Member
                  </label>
                  <div className="p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-medium text-[#0F172A] truncate">
                    {referenceMember
                      ? `${referenceMember.firstName} ${referenceMember.lastName} (${referenceMember.branchName || 'Root'})`
                      : 'Family Relative'}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#334155] mb-1 block">
                    Relationship Type
                  </label>
                  <select
                    value={relationshipType}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setRelationshipType(newType);
                      if (newType === 'SPOUSE' && referenceMember) {
                        if (referenceMember.gender === 'MALE') {
                          setGender('FEMALE');
                        } else if (referenceMember.gender === 'FEMALE') {
                          setGender('MALE');
                        }
                      }
                    }}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#0F172A] focus:ring-2 focus:ring-[#2563EB] focus:outline-hidden"
                  >
                    <option value="SPOUSE">Spouse</option>
                    <option
                      value="CHILD"
                      disabled={Boolean(referenceMember && referenceMemberHasSpouse === false)}
                    >
                      Child {referenceMember && referenceMemberHasSpouse === false ? '(Requires Spouse)' : ''}
                    </option>
                    <option value="PARENT">Parent</option>
                    <option value="SIBLING">Sibling</option>
                    <option
                      value="ADOPTED_CHILD"
                      disabled={Boolean(referenceMember && referenceMemberHasSpouse === false)}
                    >
                      Adopted Child {referenceMember && referenceMemberHasSpouse === false ? '(Requires Spouse)' : ''}
                    </option>
                    <option
                      value="STEP_CHILD"
                      disabled={Boolean(referenceMember && referenceMemberHasSpouse === false)}
                    >
                      Step-Child {referenceMember && referenceMemberHasSpouse === false ? '(Requires Spouse)' : ''}
                    </option>
                  </select>
                  {referenceMember && referenceMemberHasSpouse === false && (
                    <p className="text-[10px] text-amber-600 mt-1 font-medium leading-tight">
                      Add a spouse to {referenceMember.firstName} before adding children.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Direct Profile Photo Upload Section */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingPhoto(true);
              }}
              onDragLeave={() => setIsDraggingPhoto(false)}
              onDrop={handlePhotoDrop}
              className={`p-3 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center bg-white ${
                isDraggingPhoto
                  ? 'border-[#2563EB] bg-[#EFF6FF]'
                  : 'border-[#B8D4FF] hover:border-[#7EA7D9]'
              }`}
            >
              <div className="relative group mb-2">
                <MemberAvatar
                  src={photoUrl}
                  gender={gender}
                  name={`${firstName || 'New'} ${lastName || 'Member'}`}
                  size="md"
                  isLiving={isLiving}
                  className="w-16 h-16 ring-3 ring-[#EFF6FF] shadow-xs"
                />
                <button
                  type="button"
                  onClick={handleTriggerPhotoUpload}
                  className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#2563EB] text-white shadow-md hover:bg-[#1D4ED8] transition-colors cursor-pointer"
                  title="Upload photo"
                >
                  <Camera className="w-3 h-3" />
                </button>
              </div>

              <input
                ref={fileInputRef}
                id="add-member-photo-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                onClick={(e) => {
                  e.stopPropagation();
                  if (typeof window !== 'undefined') {
                    (window as any).__familyRootsPhotoUploadActive = true;
                  }
                }}
                onChange={(e) => {
                  e.stopPropagation();
                  if (e.target.files && e.target.files[0]) {
                    handlePhotoFile(e.target.files[0]);
                  }
                  if (onRestoreFullscreen) {
                    onRestoreFullscreen();
                  } else if (typeof document !== 'undefined' && !document.fullscreenElement) {
                    const container = document.querySelector('[data-family-tree-container]') as HTMLElement | null;
                    if (container && (isFullscreen || (window as any).__familyRootsWasFullscreen)) {
                      container.requestFullscreen?.().catch(() => {});
                    }
                  }
                  if (typeof window !== 'undefined') {
                    setTimeout(() => {
                      (window as any).__familyRootsPhotoUploadActive = false;
                    }, 500);
                  }
                }}
              />

              <button
                type="button"
                onClick={handleTriggerPhotoUpload}
                className="px-3 py-1 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-xs font-semibold border border-[#B8D4FF] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Camera className="w-3 h-3 text-[#2563EB]" />
                <span>{photoUrl ? 'Replace Photo' : 'Upload Photo'}</span>
              </button>
              <p className="text-[10px] text-[#64748B] mt-1">
                Click or drag and drop • JPG, PNG Max 5MB
              </p>
            </div>

            {/* First Name + Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                label="First Name"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoFocus
              />
              <Input
                label="Last Name"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            {/* Life Status */}
            <div className="p-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-[#0F172A] block">
                    Life Status
                  </label>
                  <p className="text-[11px] text-[#64748B]">
                    Specify whether this relative is currently living or an ancestor
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLiving(true);
                      setDeathDate('');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      isLiving
                        ? 'bg-[#2563EB] text-white shadow-xs font-semibold'
                        : 'bg-white text-[#475569] border border-[#CBD5E1]'
                    }`}
                  >
                    Living
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLiving(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      !isLiving
                        ? 'bg-[#475569] text-white shadow-xs font-semibold'
                        : 'bg-white text-[#475569] border border-[#CBD5E1]'
                    }`}
                  >
                    Deceased / Ancestor
                  </button>
                </div>
              </div>

              {!isLiving && (
                <div className="space-y-1">
                  <Input
                    type="date"
                    label="Date of Death (Compulsory for deceased relative)"
                    value={deathDate}
                    onChange={(e) => setDeathDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Gender + Occupation */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="w-full sm:w-[38%] shrink-0">
                <label
                  htmlFor="new-member-gender"
                  className="text-xs font-semibold text-[#334155] mb-1.5 block"
                >
                  Gender
                </label>
                <div className="relative">
                  <select
                    id="new-member-gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-sm text-[#0F172A] font-medium transition duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#BFDBFE] focus-visible:border-[#2563EB] hover:border-[#7EA7D9] appearance-none pr-8 cursor-pointer"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#64748B] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="w-full sm:w-[62%] min-w-0">
                <Input
                  type="text"
                  placeholder="e.g. Architect"
                  label="Occupation (Optional)"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                />
              </div>
            </div>

            {/* DOB & Marriage Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                type="date"
                label="Date of Birth *"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
              {relationshipType === 'SPOUSE' ? (
                <Input
                  type="date"
                  label="Marriage Date (DOM) *"
                  required
                  value={marriageDate}
                  onChange={(e) => setMarriageDate(e.target.value)}
                />
              ) : (
                <Input
                  type="date"
                  label="Marriage Date (DOM)"
                  value={marriageDate}
                  onChange={(e) => setMarriageDate(e.target.value)}
                />
              )}
            </div>

            {/* Housename & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Input
                type="text"
                placeholder="e.g. Vadakke Tharavadu"
                label="Housename (Optional)"
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
              />
              <Input
                type="text"
                placeholder="e.g. Palakkad, Kerala"
                label="Location (Optional)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* Birthplace */}
            <div>
              <Input
                type="text"
                placeholder="e.g. Chicago, IL"
                label="Birthplace (Optional)"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
              />
            </div>

            {/* Collapsible More Details for New Member */}
            <div className="pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setShowMoreDetails(!showMoreDetails)}
                className="w-full flex items-center justify-between text-xs font-semibold text-[#2563EB] py-1 cursor-pointer hover:underline"
              >
                <span>
                  {showMoreDetails
                    ? 'Hide Additional Details'
                    : 'More Details (Biography, Notes)'}
                </span>
                {showMoreDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              <AnimatePresence>
                {showMoreDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 pt-3 overflow-hidden"
                  >
                    <div>
                      <label className="text-xs font-semibold text-[#334155] mb-1 block">
                        Biography
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Brief life chronicle or narrative..."
                        value={biography}
                        onChange={(e) => setBiography(e.target.value)}
                        className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#0F172A] focus:ring-2 focus:ring-[#2563EB] focus:outline-hidden resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[#334155] mb-1 block">
                        Notes
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Private family notes, anecdotes, or records..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#0F172A] focus:ring-2 focus:ring-[#2563EB] focus:outline-hidden resize-none"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* 7. Action Buttons: [Cancel] [Save] */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#17233C] bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] hover:border-[#94A3B8] active:bg-[#F1F5F9] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs hover:shadow-md flex items-center gap-1.5"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>
              {editMember
                ? 'Save Profile Changes'
                : isRootAncestor
                ? 'Add Root Ancestor Node'
                : 'Save Relationship'}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
