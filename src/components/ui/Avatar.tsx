import React from 'react';

export interface AvatarProps {
  key?: React.Key;
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  statusRing?: 'primary' | 'emerald' | 'coral' | 'amber' | 'lavender' | 'sky' | 'stone';
  id?: string;
}

export const Avatar = ({
  src,
  name,
  size = 'md',
  className = '',
  statusRing,
  id,
}: AvatarProps) => {
  const [hasError, setHasError] = React.useState(false);

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

  const sizeStyles = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm font-medium',
    lg: 'w-14 h-14 text-base font-semibold',
    xl: 'w-20 h-20 text-xl font-bold',
  };

  const ringStyles = {
    primary: 'ring-2 ring-[#2563EB] ring-offset-2 ring-offset-white',
    emerald: 'ring-2 ring-[#16A34A] ring-offset-2 ring-offset-white',
    coral: 'ring-2 ring-[#E9785B] ring-offset-2 ring-offset-white',
    amber: 'ring-2 ring-[#F59E0B] ring-offset-2 ring-offset-white',
    lavender: 'ring-2 ring-[#8B7CF6] ring-offset-2 ring-offset-white',
    sky: 'ring-2 ring-[#3B82F6] ring-offset-2 ring-offset-white',
    stone: 'ring-2 ring-[#E2E8F0] ring-offset-2 ring-offset-white',
  };

  return (
    <div
      id={id}
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden select-none font-medium ${
        sizeStyles[size]
      } ${statusRing ? ringStyles[statusRing] : ''} ${className}`}
    >
      {src && !hasError ? (
        <img
          src={src}
          alt={name}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-medium">
          {initials || '?'}
        </div>
      )}
    </div>
  );
};
