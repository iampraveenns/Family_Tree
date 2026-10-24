import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { resolveMemoryAuthor, getMemoryAudioUrl } from '../src/utils/mediaUtils.ts';
import { formatSingleDate } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { MemoriesSidePanel, AudioMemoryCardPlayer } from '../src/components/genealogy/MemoriesSidePanel.tsx';
import { FamilyMemoriesSidebar } from '../src/components/genealogy/FamilyMemoriesSidebar.tsx';
import { MediaDetailLightboxModal } from '../src/components/genealogy/MediaDetailLightboxModal.tsx';
import { NotificationBell } from '../src/components/navigation/NotificationBell.tsx';
import { AppLayout } from '../src/layouts/AppLayout.tsx';
import { Memory, FamilyMember } from '../src/types/index.ts';

// Mock react-router-dom for AppLayout test
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Outlet: () => React.createElement('div', { 'data-testid': 'mock-outlet' }),
}));

describe('Phase 59: Notifications, Auth Linking, Audio Player & Date Formatting', () => {
  const mockMember: FamilyMember = {
    id: 'member-arun-123',
    familyId: 'fam-pattara',
    firstName: 'Arun',
    lastName: 'Pattara',
    displayName: 'Arun Pattara',
    gender: 'MALE',
    isLiving: true,
    generation: 2,
    branchName: 'Arun Branch',
    profilePhoto: 'https://images.unsplash.com/photo-arun.jpg',
    createdAt: '2026-01-01',
  };

  const membersList: FamilyMember[] = [mockMember];
  const membersMap = new Map<string, FamilyMember>([[mockMember.id, mockMember]]);

  describe('1. Full Date Display Format (e.g., 10 Jan 2026)', () => {
    it('formats YYYY-MM-DD date to "10 Jan 2026"', () => {
      expect(formatSingleDate('2026-01-10')).toBe('10 Jan 2026');
    });

    it('formats ISO timestamp to "15 May 2026"', () => {
      expect(formatSingleDate('2026-05-15T10:30:00.000Z')).toBe('15 May 2026');
    });

    it('displays full formatted date on memory card in MemoriesSidePanel', () => {
      const memory: Memory = {
        id: 'mem-date-1',
        familyId: 'fam-pattara',
        title: 'Harvest Day Gathering',
        description: 'Annual family harvest.',
        memoryType: 'PHOTO',
        addedByMemberId: 'member-arun-123',
        addedByMemberName: 'Arun Pattara',
        eventDate: '2026-01-10',
        visibility: 'FAMILY',
        memberIds: [],
        branchIds: [],
        tags: [],
        createdAt: '2026-01-01',
        status: 'ACTIVE',
      };

      const html = renderToString(
        React.createElement(MemoriesSidePanel, {
          isOpen: true,
          onClose: () => {},
          memories: [memory],
          members: membersList,
          onOpenUploadModal: () => {},
        })
      );

      expect(html).toContain('10 Jan 2026');
      expect(html).not.toContain('<span class="inline-flex items-center gap-1 text-[#475569]"><Calendar class="w-3 h-3 text-[#94A3B8]" />2026</span>');
    });
  });

  describe('2. Audio Memory Playback & Player Component', () => {
    it('resolves audio URL from memory properties or media array', () => {
      const audioMemory: Memory = {
        id: 'mem-audio-1',
        familyId: 'fam-pattara',
        title: 'Oral History Recording',
        description: 'Recollections of grandmother.',
        memoryType: 'AUDIO',
        addedByMemberId: 'member-arun-123',
        addedByMemberName: 'Arun Pattara',
        eventDate: '2026-02-14',
        visibility: 'FAMILY',
        coverMediaUrl: '/api/media/audio-asset-123/stream',
        memberIds: [],
        branchIds: [],
        tags: [],
        createdAt: '2026-01-01',
        status: 'ACTIVE',
      };

      const resolved = getMemoryAudioUrl(audioMemory);
      expect(resolved).toBe('/api/media/audio-asset-123/stream');
    });

    it('renders HTML5 audio controls element with resolved audio source', () => {
      const audioMemory: Memory = {
        id: 'mem-audio-2',
        familyId: 'fam-pattara',
        title: 'Courtyard Evening Discussion',
        memoryType: 'AUDIO',
        addedByMemberName: 'Arun Pattara',
        eventDate: '2026-03-20',
        visibility: 'FAMILY',
        audioUrl: '/api/media/rec-456/stream',
        memberIds: [],
        branchIds: [],
        tags: [],
        createdAt: '2026-01-01',
        status: 'ACTIVE',
      };

      const html = renderToString(
        React.createElement(AudioMemoryCardPlayer, {
          memory: audioMemory,
        })
      );

      expect(html).toContain('Oral History &amp; Voice');
      expect(html).toContain('<audio');
      expect(html).toContain('/api/media/rec-456/stream');
    });
  });

  describe('3. Notification Bell Icon in Top Navigation Bar', () => {
    it('renders the NotificationBell component without crashing', () => {
      const html = renderToString(React.createElement(NotificationBell));
      expect(html).toContain('title="Family notifications"');
      expect(html).toContain('lucide-bell');
    });

    it('places Notification Bell to the left of Sign Out button in AppLayout', () => {
      const html = renderToString(React.createElement(AppLayout));
      expect(html).toContain('FamilyTree');
      expect(html).toContain('title="Family notifications"');
      expect(html).toContain('Sign Out');

      // Check relative order in DOM: NotificationBell comes before Sign Out
      const notifIndex = html.indexOf('title="Family notifications"');
      const signOutIndex = html.indexOf('Sign Out');
      expect(notifIndex).toBeGreaterThan(-1);
      expect(signOutIndex).toBeGreaterThan(-1);
      expect(notifIndex).toBeLessThan(signOutIndex);
    });
  });
});
