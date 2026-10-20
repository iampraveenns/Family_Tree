import React, { useState } from 'react';

export interface MemberAvatarProps {
  src?: string;
  avatarUrl?: string;
  imageUrl?: string;
  name?: string;
  member?: any;
  gender?: any;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  generation?: number;
  isLiving?: boolean;
  branchColor?: string;
  statusRing?: string;
  className?: string;
  id?: string;
}

/**
 * Default Male Profile Logo SVG
 */
export const MaleProfileLogo: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Male profile avatar"
  >
    {/* Background Circle */}
    <circle cx="32" cy="32" r="32" fill="#E8F1F5" />
    {/* Shoulders & Torso with masculine collar */}
    <path
      d="M14 56.5C14 47.939 21.388 41 30.5 41H33.5C42.612 41 50 47.939 50 56.5V64H14V56.5Z"
      fill="#4A7B9D"
    />
    {/* Collar / V-neck inner detail */}
    <path
      d="M26 41L32 49L38 41H26Z"
      fill="#D4E4ED"
    />
    {/* Neck */}
    <rect x="28" y="32" width="8" height="11" rx="2" fill="#E4BA97" />
    {/* Head */}
    <ellipse cx="32" cy="24.5" rx="9" ry="10.5" fill="#F3CCA8" />
    {/* Male Hair Contour (short, styled side parting) */}
    <path
      d="M22 23C21.8 17.5 25 12 32 12C38 12 42 15 42 20C42 22.5 41 24.5 40 25C39.5 22 37.5 16.5 32 16.5C27 16.5 24 19 23 23.5L22 23Z"
      fill="#2C3E50"
    />
    <path
      d="M22.5 21C22 17 25 13 32 13C37.5 13 41.5 16 41.5 19.5C39 16.5 35 15.5 31 16.5C26 17.5 23.5 20 22.5 21Z"
      fill="#1A252F"
    />
    {/* Ears */}
    <circle cx="22.5" cy="24.5" r="2.2" fill="#E4BA97" />
    <circle cx="41.5" cy="24.5" r="2.2" fill="#E4BA97" />
  </svg>
);

/**
 * Default Female Profile Logo SVG
 */
export const FemaleProfileLogo: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Female profile avatar"
  >
    {/* Background Circle */}
    <circle cx="32" cy="32" r="32" fill="#FDF0EE" />
    {/* Back hair flowing behind shoulders */}
    <path
      d="M20 24C19 32 20 42 23 46H41C44 42 45 32 44 24C44 14 39 12 32 12C25 12 20 14 20 24Z"
      fill="#52322E"
    />
    {/* Shoulders & Torso with curved graceful neckline */}
    <path
      d="M16 56.5C16 48.492 23.163 42 32 42C40.837 42 48 48.492 48 56.5V64H16V56.5Z"
      fill="#C1695E"
    />
    {/* Soft Neckline Curve */}
    <path
      d="M27 42C27 45.5 29.239 47 32 47C34.761 47 37 45.5 37 42H27Z"
      fill="#F6D5CE"
    />
    {/* Neck */}
    <rect x="28.5" y="32" width="7" height="11" rx="2" fill="#E8BFA0" />
    {/* Head */}
    <ellipse cx="32" cy="25" rx="8.5" ry="10" fill="#F7D3B5" />
    {/* Female Hair Silhouette (flowing side parting & swept bangs) */}
    <path
      d="M21 24C21 16 25 12 32 12C39 12 43 16 43 24C43 28 41.5 33 40.5 35C39 31 39.5 23 35 18C30.5 13 25 18 23 23C22 25.5 22 32 21.5 35C21 32 21 27 21 24Z"
      fill="#402421"
    />
    {/* Ears */}
    <circle cx="23" cy="25.5" r="2" fill="#E8BFA0" />
    <circle cx="41.5" cy="25.5" r="2" fill="#E8BFA0" />
    {/* Small earring accent */}
    <circle cx="22.8" cy="28" r="0.9" fill="#F2B84B" />
    <circle cx="41.2" cy="28" r="0.9" fill="#F2B84B" />
  </svg>
);

/**
 * Default Neutral Profile Logo SVG
 */
export const NeutralProfileLogo: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Neutral profile avatar"
  >
    <circle cx="32" cy="32" r="32" fill="#EEF2EF" />
    <path
      d="M16 57C16 48.716 23.163 42 32 42C40.837 42 48 48.716 48 57V64H16V57Z"
      fill="#71807A"
    />
    <rect x="28.5" y="32" width="7" height="11" rx="2" fill="#C5D1CC" />
    <ellipse cx="32" cy="24" rx="9" ry="10" fill="#DCE5E1" />
  </svg>
);

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  src,
  avatarUrl,
  imageUrl,
  name,
  member,
  gender,
  size = 'md',
  generation,
  isLiving,
  branchColor,
  statusRing,
  className = '',
  id,
}) => {
  const [hasError, setHasError] = useState(false);

  // Directly accept image from given URL
  const rawSrc =
    src ||
    avatarUrl ||
    imageUrl ||
    member?.profilePhoto ||
    member?.avatarUrl ||
    member?.profileImageUrl ||
    member?.avatar;

  const effectiveSrc = typeof rawSrc === 'string' && rawSrc.trim().length > 0 ? rawSrc.trim() : null;

  const effectiveName =
    name ||
    member?.displayName ||
    (member?.firstName ? `${member.firstName} ${member.lastName || ''}`.trim() : '') ||
    'Family Member';

  // Determine gender: MALE vs FEMALE for default profile logo
  const rawGender = (gender || member?.gender || '').toString().toUpperCase();
  const isFemale = rawGender === 'FEMALE';
  const isMale = rawGender === 'MALE';

  const sizeClasses = {
    xs: 'w-7 h-7 text-[10px]',
    sm: 'w-9 h-9 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base font-semibold',
    xl: 'w-20 h-20 text-lg font-bold',
    '2xl': 'w-28 h-28 text-2xl font-bold',
  };

  return (
    <div id={id} className={`relative inline-block shrink-0 select-none ${className}`}>
      <div
        className={`relative rounded-full overflow-hidden flex items-center justify-center border-2 border-[#D6E4FF] ring-2 ring-[#2563EB]/15 bg-[#EFF6FF] shadow-xs ${sizeClasses[size]}`}
        style={branchColor ? { borderColor: branchColor } : undefined}
      >
        {effectiveSrc && !hasError ? (
          <img
            src={effectiveSrc}
            alt={effectiveName}
            loading="lazy"
            decoding="async"
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        ) : isMale ? (
          <MaleProfileLogo className="w-full h-full object-cover" />
        ) : isFemale ? (
          <FemaleProfileLogo className="w-full h-full object-cover" />
        ) : (
          <NeutralProfileLogo className="w-full h-full object-cover" />
        )}
      </div>

      {/* Generation indicator badge */}
      {generation !== undefined && (size === 'lg' || size === 'xl' || size === '2xl') && (
        <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#2563EB] text-white text-[9px] font-bold shadow-xs">
          G{generation}
        </span>
      )}

      {/* Living / Rest In Peace status dot */}
      {isLiving !== undefined && (size === 'md' || size === 'lg' || size === 'xl') && (
        <span
          className={`absolute top-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
            isLiving ? 'bg-[#16A34A]' : 'bg-[#94A3B8]'
          }`}
          title={isLiving ? 'Alive' : 'Rest In Peace'}
        />
      )}
    </div>
  );
};
