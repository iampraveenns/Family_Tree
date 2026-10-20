import React from 'react';

interface HighlightedTextProps {
  text: string;
  highlight?: string;
  className?: string;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  highlight,
  className = '',
}) => {
  if (!text) return null;
  if (!highlight || !highlight.trim()) {
    return <span className={className}>{text}</span>;
  }

  const query = highlight.trim();
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const isMatch = part.toLowerCase() === query.toLowerCase();
        return isMatch ? (
          <mark
            key={i}
            className="bg-blue-100 text-[#1D4ED8] px-0.5 rounded font-medium"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </span>
  );
};
