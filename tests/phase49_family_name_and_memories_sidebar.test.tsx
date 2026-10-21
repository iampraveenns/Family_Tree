import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { formatFamilyDisplayName } from '../src/utils/mediaUtils.ts';
import { MemoriesSidePanel } from '../src/components/genealogy/MemoriesSidePanel.tsx';
import { Memory, FamilyMember } from '../src/types/index.ts';

// Mock framer-motion/motion
vi.mock('framer-motion', () => ({
  motion: {
    aside: ({ children, className, ...props }: any) => (
      <aside className={className} {...props}>
        {children}
      </aside>
    ),
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('Phase 49: Family Name Formatting & Memories Right Sidebar', () => {
  describe('1. Family Name display formatting (e.g. Pattara family or Sikawath family)', () => {
    it('formats Pattara to "Pattara family"', () => {
      expect(formatFamilyDisplayName('Pattara')).toBe('Pattara family');
    });

    it('formats Pattara Family to "Pattara family"', () => {
      expect(formatFamilyDisplayName('Pattara Family')).toBe('Pattara family');
    });

    it('formats Sikawath to "Sikawath family"', () => {
      expect(formatFamilyDisplayName('Sikawath')).toBe('Sikawath family');
    });

    it('formats Sikawath Family to "Sikawath family"', () => {
      expect(formatFamilyDisplayName('Sikawath Family')).toBe('Sikawath family');
    });

    it('handles empty or null by returning "Pattara family"', () => {
      expect(formatFamilyDisplayName('')).toBe('Pattara family');
      expect(formatFamilyDisplayName(null)).toBe('Pattara family');
      expect(formatFamilyDisplayName(undefined)).toBe('Pattara family');
    });
  });

  describe('2. Memories Side Panel (Ask Gemini style)', () => {
    const mockMembers: FamilyMember[] = [
      {
        id: 'mem-1',
        familyId: 'fam-1',
        firstName: 'Govindan',
        lastName: 'Pattara',
        displayName: 'Govindan Pattara',
        gender: 'MALE',
        isLiving: false,
        generation: 1,
        createdAt: '2026-01-01',
      },
      {
        id: 'mem-2',
        familyId: 'fam-1',
        firstName: 'Priya',
        lastName: 'Pattara',
        displayName: 'Priya Pattara',
        gender: 'FEMALE',
        isLiving: true,
        generation: 2,
        createdAt: '2026-01-01',
      },
    ];

    const mockMemories: Memory[] = [
      {
        id: 'mem-photo-1',
        familyId: 'fam-1',
        title: 'Courtyard Heritage Gathering',
        description: 'Annual gathering in the ancestral courtyard with ancient jackfruit tree.',
        memoryType: 'PHOTO',
        location: 'Palakkad, Kerala',
        eventDateApprox: '1970',
        memberIds: ['mem-1'],
        branchIds: [],
        tags: ['heritage', 'gathering'],
        coverMediaUrl: 'https://example.com/photo.jpg',
        status: 'ACTIVE',
        visibility: 'FAMILY',
        createdAt: '2026-01-01',
      },
      {
        id: 'mem-audio-1',
        familyId: 'fam-1',
        title: 'Oral History of Nilgiri Plantations',
        description: 'Audio recording reminiscing about the early tea harvest stories.',
        memoryType: 'AUDIO',
        location: 'Nilgiris, Tamil Nadu',
        eventDateApprox: '1985',
        memberIds: ['mem-2'],
        branchIds: [],
        tags: ['audio', 'history'],
        status: 'ACTIVE',
        visibility: 'FAMILY',
        createdAt: '2026-01-01',
      },
      {
        id: 'mem-video-1',
        familyId: 'fam-1',
        title: 'Festival Procession and Chenda Melam',
        description: 'Video recording of the annual temple procession and percussion.',
        memoryType: 'PHOTO', // contains video media
        media: [
          {
            id: 'asset-video-1',
            familyId: 'fam-1',
            memoryId: 'mem-video-1',
            originalFileName: 'festival.mp4',
            mimeType: 'video/mp4',
            fileSize: 10485760,
            processingStatus: 'READY',
            visibility: 'FAMILY',
            createdAt: '2026-01-01',
          },
        ],
        location: 'Palakkad, Kerala',
        eventDateApprox: '2015',
        memberIds: ['mem-1', 'mem-2'],
        branchIds: [],
        tags: ['festival', 'video'],
        status: 'ACTIVE',
        visibility: 'FAMILY',
        createdAt: '2026-01-01',
      },
    ];

    it('renders sidebar with Gemini style header, counts, and filters', () => {
      const html = renderToString(
        <MemoriesSidePanel
          isOpen={true}
          onClose={vi.fn()}
          memories={mockMemories}
          members={mockMembers}
          familyName="Pattara family"
          onOpenUploadModal={vi.fn()}
        />
      );

      // Header and branding
      expect(html).toContain('Family Memories');
      expect(html).toContain('Photos, videos, audios');
      expect(html).toContain('Pattara family');
      expect(html).toContain('data-testid="memories-right-sidebar"');

      // Filter chips
      expect(html).toContain('Photos');
      expect(html).toContain('Videos');
      expect(html).toContain('Audio');

      // Media items rendered
      expect(html).toContain('Courtyard Heritage Gathering');
      expect(html).toContain('Oral History of Nilgiri Plantations');
      expect(html).toContain('Festival Procession and Chenda Melam');

      // Media information tags & locations
      expect(html).toContain('Palakkad, Kerala');
      expect(html).toContain('Nilgiris, Tamil Nadu');
      expect(html).toContain('Govindan Pattara');
      expect(html).toContain('Priya Pattara');

      // Audio waveform and audio indicators
      expect(html).toContain('Oral History &amp; Voice');
      expect(html).toContain('Click to listen');
    });

    it('renders empty state when no memories are present', () => {
      const html = renderToString(
        <MemoriesSidePanel
          isOpen={true}
          onClose={vi.fn()}
          memories={[]}
          members={mockMembers}
          familyName="Sikawath family"
          onOpenUploadModal={vi.fn()}
        />
      );

      expect(html).toContain('No memories found');
      expect(html).toContain('Add First Memory');
    });
  });
});
