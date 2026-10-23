import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import {
  Heart,
  Plus,
  Eye,
  User,
  GitFork,
  Image as ImageIcon,
  Pencil,
  ZoomIn,
} from 'lucide-react';
import { FamilyMember } from '../../types/index.ts';
import { MemberAvatar } from '../ui/MemberAvatar.tsx';
import { Badge } from '../ui/Badge.tsx';
import { ProfilePhotoLightboxModal } from './ProfilePhotoLightboxModal.tsx';

export interface HeritageMemberNodeData {
  member: FamilyMember;
  isSelected: boolean;
  isFocused: boolean;
  isDimmed: boolean;
  isHovered: boolean;
  isHoverRelated?: boolean;
  isPathHighlighted?: boolean;
  hasSpouse?: boolean;
  isPrimaryPartner?: boolean;
  isSecondarySpouse?: boolean;
  hideRelationshipActions?: boolean;
  marriageDate?: string | null;
  onSelect?: (member: FamilyMember) => void;
  onHover?: (id: string | null) => void;
  onAddRelative?: (member: FamilyMember, relType: 'CHILD' | 'SPOUSE' | 'PARENT') => void;
  onOpenProfile?: (member: FamilyMember) => void;
  onExploreKinship?: (member: FamilyMember) => void;
  onEditProfile?: (member: FamilyMember) => void;
  onToggleLiving?: (member: FamilyMember) => void;
  onEditLifeStatus?: (member: FamilyMember) => void;
  onViewPhoto?: (member: FamilyMember, photoUrl: string) => void;
  onUploadMemory?: (member: FamilyMember) => void;
}

export function formatSingleDate(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed === '—' ||
    trimmed === 'unknown' ||
    trimmed === 'Unknown' ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === 'Present' ||
    trimmed === 'present' ||
    trimmed === 'Rest In Peace' ||
    trimmed === 'Rest in peace'
  ) {
    return null;
  }

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  // If already formatted like "19 May 1981" or "2 Feb 1999"
  if (/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // Try YYYY-MM-DD or YYYY/MM/DD (with optional time)
  const matchYMD = trimmed.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
  if (matchYMD) {
    const year = parseInt(matchYMD[1], 10);
    const month = parseInt(matchYMD[2], 10) - 1;
    const day = parseInt(matchYMD[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime()) && month >= 0 && month < 12) {
      return `${day} ${monthNames[month]} ${year}`;
    }
  }

  // Try DD-MM-YYYY or DD/MM/YYYY
  const matchDMY = trimmed.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/);
  if (matchDMY) {
    const day = parseInt(matchDMY[1], 10);
    const month = parseInt(matchDMY[2], 10) - 1;
    const year = parseInt(matchDMY[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime()) && month >= 0 && month < 12) {
      return `${day} ${monthNames[month]} ${year}`;
    }
  }

  // Fallback to Date parser
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1000) {
    return `${parsed.getDate()} ${monthNames[parsed.getMonth()]} ${parsed.getFullYear()}`;
  }

  // 4-digit year only
  const matchYear = trimmed.match(/^(\d{4})$/);
  if (matchYear) {
    return matchYear[1];
  }

  const anyYear = trimmed.match(/\b(\d{4})\b/);
  return anyYear ? anyYear[1] : null;
}

export interface NodeDateRow {
  label: 'DOB' | 'DOM' | 'DOD';
  text: string;
}

export function getNodeDateRows(
  member: {
    dateOfBirth?: string | null;
    dateOfDeath?: string | null;
    isLiving?: boolean;
    dateOfMarriage?: string | null;
    marriageDate?: string | null;
  },
  marriageDateOverride?: string | null,
  isSecondarySpouse?: boolean
): NodeDateRow[] {
  const isDeceased = !member.isLiving || Boolean(member.dateOfDeath);

  const formattedDob = formatSingleDate(member.dateOfBirth);
  // Show Date of Marriage (DOM) inside primary member's node instead of spouse node
  const rawDom = isSecondarySpouse
    ? null
    : (member.dateOfMarriage || member.marriageDate || marriageDateOverride);
  const formattedDom = formatSingleDate(rawDom);
  const formattedDod = isDeceased ? formatSingleDate(member.dateOfDeath) : null;

  const rows: NodeDateRow[] = [];

  // Required Order: 1. DOB -> 2. DOM -> 3. DOD
  // Only display a date if that date actually exists. Do not show empty placeholders.

  // 1. DOB (if exists)
  if (formattedDob) {
    rows.push({ label: 'DOB', text: `DOB: ${formattedDob}` });
  }

  // 2. DOM (if exists on primary member - never on spouse node)
  if (formattedDom) {
    rows.push({ label: 'DOM', text: `DOM: ${formattedDom}` });
  }

  // 3. DOD (if exists and member is Rest in Peace / deceased)
  if (formattedDod) {
    rows.push({ label: 'DOD', text: `DOD: ${formattedDod}` });
  }

  return rows;
}

export function formatMemberDates(
  dateOfBirth?: string | null,
  dateOfDeath?: string | null,
  isLiving = true,
  dateOfMarriage?: string | null
): { dob: string | null; dom: string | null; dod: string | null } {
  const isDeceased = !isLiving || Boolean(dateOfDeath);
  const formattedDob = formatSingleDate(dateOfBirth);
  const formattedDom = !isDeceased ? formatSingleDate(dateOfMarriage) : null;
  const formattedDod = isDeceased ? formatSingleDate(dateOfDeath) : null;

  return { dob: formattedDob, dom: formattedDom, dod: formattedDod };
}

export const HeritageMemberNode: React.FC<{ data: HeritageMemberNodeData }> = React.memo(({ data }) => {
  const {
    member,
    isSelected,
    isFocused,
    isDimmed,
    isHovered,
    isHoverRelated,
    isPathHighlighted,
    hasSpouse = false,
    isPrimaryPartner = true,
    isSecondarySpouse = false,
    hideRelationshipActions = false,
    onSelect,
    onHover,
    onAddRelative,
    onOpenProfile,
    onExploreKinship,
    onEditProfile,
    onToggleLiving,
    onEditLifeStatus,
    onUploadMemory,
  } = data;

  const shouldHideActions = Boolean(hideRelationshipActions || isSecondarySpouse);

  // Subtle branch accent color mapping using harmonious blue shades
  const getBranchConfig = () => {
    const branchKey = (member.branchName || member.branchId || '').toLowerCase();
    if (branchKey.includes('kumar')) {
      return {
        accent: '#2563EB', // Primary
        dot: 'bg-[#2563EB]',
        topBar: 'bg-[#2563EB]',
        borderColor: 'border-[#2563EB]',
      };
    }
    if (branchKey.includes('ravi')) {
      return {
        accent: '#3B82F6', // Blue
        dot: 'bg-[#3B82F6]',
        topBar: 'bg-[#3B82F6]',
        borderColor: 'border-[#3B82F6]',
      };
    }
    if (branchKey.includes('suresh')) {
      return {
        accent: '#0EA5E9', // Sky
        dot: 'bg-[#0EA5E9]',
        topBar: 'bg-[#0EA5E9]',
        borderColor: 'border-[#0EA5E9]',
      };
    }
    if (branchKey.includes('heritage') || branchKey.includes('ancient')) {
      return {
        accent: '#6366F1', // Indigo
        dot: 'bg-[#6366F1]',
        topBar: 'bg-[#6366F1]',
        borderColor: 'border-[#6366F1]',
      };
    }
    if (branchKey.includes('arun')) {
      return {
        accent: '#0D9488', // Teal
        dot: 'bg-[#0D9488]',
        topBar: 'bg-[#0D9488]',
        borderColor: 'border-[#0D9488]',
      };
    }
    if (branchKey.includes('ananth')) {
      return {
        accent: '#8B5CF6', // Purple
        dot: 'bg-[#8B5CF6]',
        topBar: 'bg-[#8B5CF6]',
        borderColor: 'border-[#8B5CF6]',
      };
    }
    if (branchKey.includes('meena')) {
      return {
        accent: '#EC4899', // Pink
        dot: 'bg-[#EC4899]',
        topBar: 'bg-[#EC4899]',
        borderColor: 'border-[#EC4899]',
      };
    }
    if (branchKey.includes('govindan') || branchKey.includes('patriarch')) {
      return {
        accent: '#475569', // Slate
        dot: 'bg-[#475569]',
        topBar: 'bg-[#475569]',
        borderColor: 'border-[#475569]',
      };
    }
    return {
      accent: '#1D4ED8', // Deep Blue
      dot: 'bg-[#1D4ED8]',
      topBar: 'bg-[#1D4ED8]',
      borderColor: 'border-[#2563EB]',
    };
  };

  const branchConfig = getBranchConfig();

  const isSpouseNode = Boolean(isSecondarySpouse || (hasSpouse && isPrimaryPartner === false));
  const effectiveMarriageDate = isSpouseNode ? null : (data.marriageDate || member.dateOfMarriage || member.marriageDate);
  const dateRows = getNodeDateRows(
    isSpouseNode
      ? { ...member, dateOfMarriage: null, marriageDate: null }
      : { ...member, dateOfMarriage: effectiveMarriageDate, marriageDate: effectiveMarriageDate },
    effectiveMarriageDate,
    isSpouseNode
  );
  const fullName = member.displayName || `${member.firstName} ${member.lastName}`;

  // Housename and location for member node (under DOB)
  const houseName = (member.houseName || (member as any).housename || (member as any).house)?.trim() || null;
  const location =
    (member.location !== undefined ? member.location : member.birthPlace)?.trim() || null;
  const showHouseAndLocation = !isSecondarySpouse && Boolean(houseName || location);

  // Check if branch name is present and not Root Lineage
  const hasCustomBranch = Boolean(
    member.branchName &&
      member.branchName.trim().length > 0 &&
      member.branchName.toLowerCase() !== 'root lineage' &&
      member.branchName.toLowerCase() !== 'rootlineage'
  );

  const isDeceased = !member.isLiving || Boolean(member.dateOfDeath);

  // Check if member has a custom uploaded profile photo
  const rawPhoto =
    member.profilePhoto ||
    (member as any).profileImageUrl ||
    (member as any).avatarUrl ||
    (member as any).avatar;
  const customPhotoUrl = typeof rawPhoto === 'string' && rawPhoto.trim().length > 0 ? rawPhoto.trim() : null;
  const hasCustomPhoto = Boolean(customPhotoUrl);

  const [isLocalPhotoViewerOpen, setIsLocalPhotoViewerOpen] = useState(false);
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<'bottom-left' | 'top-left' | 'bottom-right' | 'top-right'>('bottom-left');
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const photoMenuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside or Escape key
  useEffect(() => {
    if (!isPhotoMenuOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        photoMenuRef.current &&
        !photoMenuRef.current.contains(target) &&
        avatarButtonRef.current &&
        !avatarButtonRef.current.contains(target)
      ) {
        setIsPhotoMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsPhotoMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPhotoMenuOpen]);

  const handleTogglePhotoMenu = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!hasCustomPhoto || !customPhotoUrl) return;

    if (!isPhotoMenuOpen && avatarButtonRef.current) {
      const rect = avatarButtonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceRight = window.innerWidth - rect.right;
      const placeTop = spaceBelow < 65 && rect.top > 65;
      const placeRight = spaceRight < 185 && rect.left > 185;

      if (placeTop && placeRight) {
        setMenuPlacement('top-right');
      } else if (placeTop) {
        setMenuPlacement('top-left');
      } else if (placeRight) {
        setMenuPlacement('bottom-right');
      } else {
        setMenuPlacement('bottom-left');
      }
    }

    setIsPhotoMenuOpen((prev) => !prev);
  };

  const handleViewProfilePicture = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setIsPhotoMenuOpen(false);
    if (!customPhotoUrl) return;
    if (data.onViewPhoto) {
      data.onViewPhoto(member, customPhotoUrl);
    } else {
      setIsLocalPhotoViewerOpen(true);
    }
  };

  const placementClasses = {
    'bottom-left': 'top-full left-0 mt-1.5',
    'bottom-right': 'top-full right-0 mt-1.5',
    'top-left': 'bottom-full left-0 mb-1.5',
    'top-right': 'bottom-full right-0 mb-1.5',
  };

  return (
    <div
      onMouseEnter={() => onHover?.(member.id)}
      onMouseLeave={() => onHover?.(null)}
      tabIndex={0}
      role="region"
      style={{
        width: 280,
        height: 160,
        backgroundColor: '#fef08a',
      }}
      aria-label={`Family member ${fullName}, Generation ${member.generation}`}
      className={`group relative w-[280px] h-[160px] box-border rounded-2xl border-[1.5px] p-2.5 transition-all duration-200 ease-out cursor-default select-none outline-none flex flex-col justify-between bg-[#fef08a] ${
        isPhotoMenuOpen ? 'overflow-visible z-50' : 'overflow-hidden'
      } ${
        isPathHighlighted
          ? 'border-[#2563EB] shadow-[0_0_0_2px_#B8D4FF,0_8px_24px_rgba(37,99,235,0.18)] z-30'
          : isSelected
          ? 'border-[#2563EB] shadow-[0_0_0_2px_#B8D4FF,0_8px_24px_rgba(37,99,235,0.18)] -translate-y-0.5 z-30'
          : isFocused
          ? 'border-[#2563EB] shadow-[0_4px_16px_rgba(37,99,235,0.14)] z-20'
          : isHovered
          ? 'border-[#7EA7D9] -translate-y-0.5 shadow-[0_8px_24px_rgba(126,167,217,0.25)] z-20'
          : isHoverRelated
          ? 'border-[#7EA7D9] shadow-[0_4px_16px_rgba(126,167,217,0.18)]'
          : 'border-[#B8D4FF] shadow-[0_2px_10px_rgba(23,35,60,0.06)] hover:border-[#7EA7D9] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(126,167,217,0.2)]'
      } ${isDimmed ? 'opacity-55' : isHoverRelated || isFocused ? 'opacity-95' : 'opacity-100'}`}
    >
      {/* Top Handle (Parent connections) */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-2 !h-2 !bg-[#7EA7D9] !border-[1.5px] !border-white !-top-1"
      />

      {/* Left Handle (Spouse connection from Left) */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-1.5 !h-1.5 !bg-[#7EA7D9] !border-none !-left-1"
      />

      {/* Right Handle (Spouse connection to Right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-1.5 !h-1.5 !bg-[#7EA7D9] !border-none !-right-1"
      />

      {/* Bottom Handle (Child connections) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-2 !h-2 !bg-[#7EA7D9] !border-[1.5px] !border-white !-bottom-1"
      />

      {/* Floating Action Pill Menu for Selected Member (Popup editbar with #fef08a bg and correct text color) */}
      {isSelected && (
        <div
          onClick={(e) => e.stopPropagation()}
          data-testid={`node-popup-editbar-${member.id}`}
          style={{ backgroundColor: '#fef08a' }}
          className="absolute -top-11 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-1.5 py-1 rounded-xl bg-[#fef08a] shadow-lg border border-[#B8D4FF] text-[11px] whitespace-nowrap text-[#17233C]"
        >
          <button
            type="button"
            onClick={() => onOpenProfile?.(member)}
            className="px-2.5 py-1 rounded-lg hover:bg-[#FEF08A]/50 text-[#17233C] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="View Profile Details"
          >
            <User className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="text-[#17233C]">Profile</span>
          </button>
          <div className="w-[1px] h-3.5 bg-[#B8D4FF]" />
          <button
            type="button"
            onClick={() => onEditProfile?.(member)}
            className="px-2.5 py-1 rounded-lg hover:bg-[#FEF08A]/50 text-[#17233C] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Edit Member Profile"
          >
            <Pencil className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="text-[#17233C]">Edit</span>
          </button>
          <div className="w-[1px] h-3.5 bg-[#B8D4FF]" />
          <button
            type="button"
            onClick={() => onExploreKinship?.(member)}
            className="px-2.5 py-1 rounded-lg hover:bg-[#FEF08A]/50 text-[#17233C] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Calculate Kinship"
          >
            <GitFork className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="text-[#17233C]">Kinship</span>
          </button>
        </div>
      )}

      {/* Card Header: Generation Indicator (Top-Left) + Branch & Status Badges */}
      <div className="flex items-center justify-between gap-1 mb-1.5 pt-0.5">
        {/* Left top corner: Gen label (Gen 1, Gen 2, etc.) & Optional Branch - keep ONLY for member node, remove for spouse */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
          {!isSecondarySpouse && (
            <span
              data-testid={`node-gen-badge-${member.id}`}
              className="px-2 py-0.5 rounded-md bg-[#2563EB]/10 text-[#1D4ED8] border border-[#B8D4FF] text-[10px] font-bold tracking-tight uppercase shrink-0 shadow-2xs"
            >
              {`Gen ${member.generation || 1}`}
            </span>
          )}
          {hasCustomBranch && (
            <div className="flex items-center gap-1 min-w-0 truncate" data-testid={`node-branch-badge-${member.id}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${branchConfig.dot}`} />
              <span className="text-[10.5px] font-semibold text-[#17233C]/80 truncate">
                {member.branchName}
              </span>
            </div>
          )}
        </div>

        {/* Two Compact Status Badges: [Living / Death Circle Indicator] and [Single / Married] */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Badge 1: Living / Death circular indicator (Clickable to edit life status) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onEditLifeStatus) {
                onEditLifeStatus(member);
              } else if (onToggleLiving) {
                onToggleLiving(member);
              }
            }}
            title={`Edit life status for ${fullName} (${isDeceased ? 'Rest in Peace' : 'Living'})`}
            aria-label={`Edit life status for ${fullName}. Currently ${isDeceased ? 'RIP (Rest in Peace)' : 'Living'}`}
            data-status={isDeceased ? 'RIP' : 'Living'}
            data-testid={`life-status-indicator-${member.id}`}
            className={`w-[21px] h-[21px] inline-flex items-center justify-center rounded-full transition-colors cursor-pointer select-none shrink-0 ${
              !isDeceased
                ? 'bg-[#DCFCE7] border border-[#86EFAC] hover:bg-[#BBF7D0]'
                : 'bg-[#F1F5F9] border border-[#CBD5E1] hover:bg-[#E2E8F0]'
            }`}
          >
            {!isDeceased ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
                <span className="sr-only">Living</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[#64748B] shrink-0" />
                <span className="sr-only" data-testid={`rip-badge-${member.id}`}>RIP</span>
              </>
            )}
          </button>

          {/* Badge 2: Single / Married (Fixed-width area) */}
          <span
            className={`h-[21px] inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold transition-colors select-none shrink-0 ${
              hasSpouse
                ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#B8D4FF]'
                : 'bg-white/80 text-[#17233C]/80 border border-[#B8D4FF]'
            }`}
          >
            <span className="whitespace-nowrap">{hasSpouse ? 'Married' : 'Single'}</span>
          </span>
        </div>
      </div>

      {/* Member Body: Avatar + Name + Life Dates (Separated, Aligned Rows) */}
      <div className="flex items-start gap-2.5">
        {hasCustomPhoto && customPhotoUrl ? (
          <div className="relative shrink-0 w-10 h-10 mt-0.5">
            <button
              ref={avatarButtonRef}
              type="button"
              onClick={handleTogglePhotoMenu}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTogglePhotoMenu(e);
                }
              }}
              className="group/avatar relative w-full h-full rounded-full cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1 transition-all duration-150 hover:scale-105"
              title={`View photo options for ${fullName}`}
              aria-label={`View photo options for ${fullName}`}
              aria-haspopup="true"
              aria-expanded={isPhotoMenuOpen}
            >
              <MemberAvatar
                name={`${member.firstName} ${member.lastName}`}
                src={customPhotoUrl}
                gender={member.gender}
                member={member}
                size="sm"
                isLiving={member.isLiving}
                className="w-full h-full rounded-full transition-all duration-150 group-hover/avatar:ring-2 group-hover/avatar:ring-[#2563EB] group-hover/avatar:shadow-md"
              />
              {/* Subtle Zoom indicator on hover */}
              <span
                className="absolute inset-0 rounded-full bg-[#0F172A]/35 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-150 flex items-center justify-center text-white pointer-events-none"
                aria-hidden="true"
              >
                <ZoomIn className="w-3.5 h-3.5 drop-shadow-xs" />
              </span>
            </button>

            {/* Contextual Action Menu: "View Profile Picture" */}
            {isPhotoMenuOpen && (
              <div
                ref={photoMenuRef}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className={`absolute ${placementClasses[menuPlacement]} z-50 p-1 rounded-xl bg-white border border-[#B8D4FF] shadow-lg whitespace-nowrap select-none animate-in fade-in zoom-in-95 duration-150`}
              >
                <button
                  type="button"
                  onClick={handleViewProfilePicture}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleViewProfilePicture(e);
                    }
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#17233C] hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-colors cursor-pointer w-full text-left"
                  title={`View profile picture of ${fullName}`}
                  aria-label={`View profile picture of ${fullName}`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                  <span>View Profile Picture</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <MemberAvatar
            name={`${member.firstName} ${member.lastName}`}
            src=""
            gender={member.gender}
            member={member}
            size="sm"
            isLiving={member.isLiving}
            className="shrink-0 w-10 h-10 mt-0.5"
          />
        )}

        <div className="flex-1 min-w-0">
          <h4 className="text-[13.5px] font-bold text-[#17233C] truncate group-hover:text-[#2563EB] transition-colors leading-snug">
            {fullName}
          </h4>

          {/* Life Dates & Member Details: DOB, Housename, Location, DOM, DOD */}
          {(dateRows.length > 0 || showHouseAndLocation) && (
            <div className="mt-0.5 text-[10px] font-medium leading-[14px] space-y-0.5 flex flex-col justify-start">
              {/* 1. DOB field */}
              {dateRows
                .filter((r) => r.label === 'DOB')
                .map((row, idx) => (
                  <p
                    key={`dob-${idx}`}
                    className="truncate whitespace-nowrap text-[#17233C]"
                    title={row.text}
                  >
                    {row.text}
                  </p>
                ))}

              {/* 2. Housename and Location under DOB (only on member node, not under spouse) */}
              {!isSecondarySpouse && (
                <>
                  {houseName && (
                    <p
                      data-testid={`node-housename-${member.id}`}
                      className="truncate whitespace-nowrap text-[#17233C]"
                      title={`Housename: ${houseName}`}
                    >
                      Housename: {houseName}
                    </p>
                  )}
                  {location && (
                    <p
                      data-testid={`node-location-${member.id}`}
                      className="truncate whitespace-nowrap text-[#17233C]"
                      title={`Location: ${location}`}
                    >
                      Location: {location}
                    </p>
                  )}
                </>
              )}

              {/* 3. DOM & DOD fields (DOM displayed in same #17233C color as Location & DOB) */}
              {dateRows
                .filter((r) => r.label !== 'DOB')
                .map((row, idx) => (
                  <p
                    key={`other-${idx}`}
                    data-testid={`node-${row.label.toLowerCase()}-${member.id}`}
                    className={`truncate whitespace-nowrap ${
                      row.label === 'DOD'
                        ? 'text-[#64748B]'
                        : 'text-[#17233C]'
                    }`}
                    title={row.text}
                  >
                    {row.text}
                  </p>
                ))}
            </div>
          )}

          {/* Memories indicator: completely hidden when count is 0 */}
          {Boolean(member.memoryCount && member.memoryCount > 0) && (
            <div className="flex items-center gap-1 text-[9.5px] text-[#17233C]/80 mt-0.5">
              <ImageIcon className="w-2.5 h-2.5 text-[#2563EB] shrink-0" />
              <span>{`${member.memoryCount} ${member.memoryCount === 1 ? 'Memory' : 'Memories'}`}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer: Quick Add Relative Buttons */}
      <div className="pt-1 border-t border-[#B8D4FF]/60 flex items-center justify-between text-[11px] min-h-[30px]">
        {!shouldHideActions ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!hasSpouse}
              onClick={(e) => {
                e.stopPropagation();
                if (hasSpouse) {
                  onAddRelative?.(member, 'CHILD');
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (hasSpouse) {
                    onAddRelative?.(member, 'CHILD');
                  }
                }
              }}
              title={hasSpouse ? "Add Child to this member" : "Add a spouse before adding a child."}
              aria-label={hasSpouse ? `Add Child to ${fullName}` : `Add Child to ${fullName} (Requires spouse)`}
              className={`px-2 py-0.5 rounded font-medium text-[10.5px] transition-colors shadow-2xs select-none ${
                hasSpouse
                  ? "bg-white hover:bg-[#EFF6FF] hover:text-[#2563EB] hover:border-[#7EA7D9] text-[#17233C] border border-[#B8D4FF] cursor-pointer"
                  : "opacity-40 cursor-not-allowed bg-white/50 text-[#17233C]/40 border border-[#B8D4FF]/40"
              }`}
            >
              + Child
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddRelative?.(member, 'SPOUSE');
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onAddRelative?.(member, 'SPOUSE');
                }
              }}
              title="Add Spouse to this member"
              aria-label={`Add Spouse to ${fullName}`}
              className="px-2 py-0.5 rounded bg-white hover:bg-[#EFF6FF] hover:text-[#2563EB] hover:border-[#7EA7D9] text-[#17233C] border border-[#B8D4FF] font-medium text-[10.5px] transition-colors cursor-pointer shadow-2xs select-none"
            >
              + Spouse
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1" />
        )}

        <div className="flex items-center gap-0.5 ml-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditProfile?.(member);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            title="Edit Member Profile"
            aria-label="Edit Member Profile"
            className="p-1 rounded text-[#17233C]/70 hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenProfile?.(member);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            title="View Profile"
            aria-label="View Profile"
            className="p-1 rounded text-[#17233C]/70 hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Standalone Fallback Profile Photo Lightbox */}
      {hasCustomPhoto && isLocalPhotoViewerOpen && customPhotoUrl && (
        <ProfilePhotoLightboxModal
          isOpen={isLocalPhotoViewerOpen}
          onClose={() => setIsLocalPhotoViewerOpen(false)}
          member={member}
          photoUrl={customPhotoUrl}
        />
      )}
    </div>
  );
});

HeritageMemberNode.displayName = 'HeritageMemberNode';
