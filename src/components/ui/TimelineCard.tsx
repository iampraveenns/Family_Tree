import React, { useState } from 'react';
import {
  Calendar,
  MapPin,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
} from 'lucide-react';
import { Badge } from './Badge.tsx';
import { Avatar } from './Avatar.tsx';
import { FamilyMember } from '../../types/index.ts';

export interface TimelineCardProps {
  id?: string;
  title: string;
  date: string;
  eventType?: string;
  category?: string;
  description?: string;
  location?: string;
  era?: string;
  mediaUrls?: string[];
  members?: FamilyMember[];
  isHighlighted?: boolean;
  onSelect?: () => void;
  className?: string;
}

export const TimelineCard: React.FC<TimelineCardProps> = ({
  id,
  title,
  date,
  eventType = 'MILESTONE',
  description,
  location,
  era,
  mediaUrls = [],
  members = [],
  isHighlighted = false,
  onSelect,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formattedDate = date
    ? new Date(date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Historical Record';

  return (
    <div
      id={id}
      className={`group relative rounded-2xl border transition-all duration-200 bg-white p-5 sm:p-6 ${
        isHighlighted
          ? 'border-[#2563EB] shadow-md ring-2 ring-[#2563EB]/20'
          : 'border-[#E2E8F0] hover:border-[#2563EB]/50 hover:shadow-md'
      } ${className}`}
    >
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="amber" size="sm">
            {eventType.replace(/_/g, ' ')}
          </Badge>
          {era && (
            <span className="text-[10px] font-semibold tracking-wider uppercase text-[#475569] bg-[#F1F5F9] px-2 py-0.5 rounded-md">
              {era}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[#64748B] font-medium">
          <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Main Title & Location */}
      <h3
        onClick={onSelect}
        className={`text-base sm:text-lg font-bold text-[#0F172A] leading-snug tracking-tight ${
          onSelect ? 'cursor-pointer hover:text-[#2563EB] transition-colors' : ''
        }`}
      >
        {title}
      </h3>

      {location && (
        <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-1">
          <MapPin className="w-3 h-3 text-[#2563EB]" />
          <span>{location}</span>
        </div>
      )}

      {/* Description / Story Snippet */}
      {description && (
        <p
          className={`mt-2.5 text-xs sm:text-sm text-[#475569] leading-relaxed ${
            !isExpanded && 'line-clamp-2'
          }`}
        >
          {description}
        </p>
      )}

      {/* Associated Members & Media Thumbnails */}
      <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
        {members.length > 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {members.slice(0, 4).map((m) => (
                <Avatar
                  key={m.id}
                  name={`${m.firstName} ${m.lastName}`}
                  size="sm"
                  className="ring-2 ring-white"
                />
              ))}
            </div>
            <span className="text-[11px] text-[#64748B]">
              {members.length} {members.length === 1 ? 'relative' : 'relatives'}
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-[#64748B] italic">
            Family record
          </div>
        )}

        <div className="flex items-center gap-2">
          {mediaUrls.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-[#2563EB] font-medium">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{mediaUrls.length} {mediaUrls.length === 1 ? 'photo' : 'photos'}</span>
            </span>
          )}

          {description && description.length > 120 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
            >
              {isExpanded ? (
                <>
                  <span>Less</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Read story</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
