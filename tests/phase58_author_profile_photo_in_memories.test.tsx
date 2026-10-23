import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { resolveMemoryAuthor } from '../src/utils/mediaUtils.ts';
import { MemoriesSidePanel } from '../src/components/genealogy/MemoriesSidePanel.tsx';
import { FamilyMemoriesSidebar } from '../src/components/genealogy/FamilyMemoriesSidebar.tsx';
import { MediaDetailLightboxModal } from '../src/components/genealogy/MediaDetailLightboxModal.tsx';
import { Memory, FamilyMember } from '../src/types/index.ts';

describe('Phase 58: Arun Pattara Profile Photo Visibility in Memories Section', () => {
  const arunProfilePhoto = 'https://images.unsplash.com/photo-arun-portrait.jpg';

  const mockArunMember: FamilyMember = {
    id: 'member-arun-123',
    familyId: 'fam-pattara',
    firstName: 'Arun',
    lastName: 'Pattara',
    displayName: 'Arun Pattara',
    gender: 'MALE',
    isLiving: true,
    generation: 2,
    branchName: 'Arun Branch',
    branchId: 'branch-arun',
    profilePhoto: arunProfilePhoto,
    createdAt: '2026-01-01',
  };

  const otherMember: FamilyMember = {
    id: 'member-meena-456',
    familyId: 'fam-pattara',
    firstName: 'Meena',
    lastName: 'Pattara',
    displayName: 'Meena Pattara',
    gender: 'FEMALE',
    isLiving: true,
    generation: 2,
    branchName: 'Arun Branch',
    branchId: 'branch-arun',
    createdAt: '2026-01-01',
  };

  const membersList: FamilyMember[] = [mockArunMember, otherMember];
  const membersMap = new Map<string, FamilyMember>([
    [mockArunMember.id, mockArunMember],
    [otherMember.id, otherMember],
  ]);

  // Memory 1: Posted with addedByMemberId string ID
  const memoryWithId: Memory = {
    id: 'mem-1',
    familyId: 'fam-pattara',
    title: 'Festival Feast with Arun',
    description: 'Special holiday gathering.',
    memoryType: 'PHOTO',
    addedByMemberId: 'member-arun-123',
    addedByMemberName: 'Arun Pattara',
    coverMediaUrl: 'https://example.com/feast.jpg',
    eventDate: '2026-05-01',
    visibility: 'FAMILY',
    memberIds: [],
    branchIds: [],
    tags: [],
    createdAt: '2026-01-01',
    status: 'ACTIVE',
  };

  // Memory 2: Posted with only addedByMemberName: "Arun Pattara"
  const memoryWithNameOnly: Memory = {
    id: 'mem-2',
    familyId: 'fam-pattara',
    title: 'Courtyard Evening Discussion',
    description: 'Shared memories by Arun.',
    memoryType: 'STORY',
    addedByMemberName: 'Arun Pattara',
    visibility: 'FAMILY',
    memberIds: [],
    branchIds: [],
    tags: [],
    createdAt: '2026-01-01',
    status: 'ACTIVE',
  };

  // Memory 3: Backend populated addedByMemberId object
  const memoryWithPopulatedObject: Memory = {
    id: 'mem-3',
    familyId: 'fam-pattara',
    title: 'Monsoon Rain Stories',
    description: 'Memories of monsoon rains.',
    memoryType: 'AUDIO',
    addedByMemberId: {
      _id: 'member-arun-123',
      firstName: 'Arun',
      lastName: 'Pattara',
      displayName: 'Arun Pattara',
      profilePhoto: arunProfilePhoto,
      gender: 'MALE',
    } as any,
    addedByMemberName: 'Arun Pattara',
    visibility: 'FAMILY',
    memberIds: [],
    branchIds: [],
    tags: [],
    createdAt: '2026-01-01',
    status: 'ACTIVE',
  };

  describe('1. resolveMemoryAuthor helper resolution', () => {
    it('resolves author member and profile photo when memory has addedByMemberId string', () => {
      const res = resolveMemoryAuthor(memoryWithId, membersList, membersMap);
      expect(res.authorMember).toBeDefined();
      expect(res.authorName).toBe('Arun Pattara');
      expect(res.authorPhoto).toBe(arunProfilePhoto);
    });

    it('resolves author member and profile photo by matching name when addedByMemberId is absent', () => {
      const res = resolveMemoryAuthor(memoryWithNameOnly, membersList, membersMap);
      expect(res.authorMember).toBeDefined();
      expect(res.authorMember?.id).toBe('member-arun-123');
      expect(res.authorName).toBe('Arun Pattara');
      expect(res.authorPhoto).toBe(arunProfilePhoto);
    });

    it('resolves author member and profile photo when addedByMemberId is a populated object', () => {
      const res = resolveMemoryAuthor(memoryWithPopulatedObject, membersList, membersMap);
      expect(res.authorMember).toBeDefined();
      expect(res.authorName).toBe('Arun Pattara');
      expect(res.authorPhoto).toBe(arunProfilePhoto);
    });
  });

  describe('2. UI Visibility in MemoriesSidePanel', () => {
    it('displays Arun Pattara profile image in memory cards for posts made by Arun', () => {
      const html = renderToString(
        <MemoriesSidePanel
          isOpen={true}
          onClose={() => {}}
          memories={[memoryWithNameOnly]}
          members={membersList}
          familyName="Pattara Family"
          onOpenUploadModal={() => {}}
        />
      );

      // Verify author header exists
      expect(html).toContain('data-testid="memory-author-mem-2"');
      expect(html).toContain('Arun Pattara');
      expect(html).toContain('Added by Arun Pattara');

      // Crucial: The rendered image element must contain Arun's updated profile photo URL
      expect(html).toContain(`src="${arunProfilePhoto}"`);
      expect(html).toContain('alt="Arun Pattara"');
    });
  });

  describe('3. UI Visibility in FamilyMemoriesSidebar', () => {
    it('displays Arun Pattara profile image in FamilyMemoriesSidebar memory cards', () => {
      const html = renderToString(
        <FamilyMemoriesSidebar
          isOpen={true}
          onClose={() => {}}
          memories={[memoryWithId]}
          members={membersList}
          familyName="Pattara Family"
          onOpenUploadModal={() => {}}
        />
      );

      expect(html).toContain('data-testid="memory-author-mem-1"');
      expect(html).toContain('Arun Pattara');
      expect(html).toContain(`src="${arunProfilePhoto}"`);
      expect(html).toContain('alt="Arun Pattara"');
    });
  });

  describe('4. UI Visibility in MediaDetailLightboxModal', () => {
    it('displays Arun Pattara profile image in the MediaDetailLightboxModal header', () => {
      const html = renderToString(
        <MediaDetailLightboxModal
          isOpen={true}
          onClose={() => {}}
          memory={memoryWithId}
          members={membersList}
        />
      );

      expect(html).toContain('Added by <strong class="text-blue-700">Arun Pattara</strong>');
      expect(html).toContain(`src="${arunProfilePhoto}"`);
      expect(html).toContain('alt="Arun Pattara"');
    });
  });
});
