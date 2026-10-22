import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import { useMemoryStore } from '../src/stores/useMemoryStore.ts';
import { MemoriesSidePanel } from '../src/components/genealogy/MemoriesSidePanel.tsx';
import { FamilyMemoriesSidebar } from '../src/components/genealogy/FamilyMemoriesSidebar.tsx';
import { Memory, FamilyMember } from '../src/types/index.ts';

describe('Phase 55: Clear Memories (0 Posts) and Prominent Author on Top of Post', () => {
  const seedFilePath = path.resolve(__dirname, '../server/src/scripts/seed.ts');
  const serverFilePath = path.resolve(__dirname, '../server.ts');
  const memoriesSidePanelPath = path.resolve(__dirname, '../src/components/genealogy/MemoriesSidePanel.tsx');
  const uploadNodeMemoryModalPath = path.resolve(__dirname, '../src/components/genealogy/UploadNodeMemoryModal.tsx');

  const seedContent = fs.readFileSync(seedFilePath, 'utf-8');
  const serverContent = fs.readFileSync(serverFilePath, 'utf-8');
  const sidePanelContent = fs.readFileSync(memoriesSidePanelPath, 'utf-8');
  const uploadModalContent = fs.readFileSync(uploadNodeMemoryModalPath, 'utf-8');

  describe('1. Clear memory posts to 0 initial posts', () => {
    it('verifies seed.ts has sampleMemoriesData set to empty array (0 sample posts)', () => {
      expect(seedContent).toMatch(/const\s+sampleMemoriesData:\s*any\[\]\s*=\s*\[\];/);
    });

    it('verifies server.ts purges existing memory and media records on bootstrap', () => {
      expect(serverContent).toContain('await Memory.deleteMany({})');
      expect(serverContent).toContain('await Media.deleteMany({})');
      expect(serverContent).toContain('Cleared memories: 0 memory posts in vault');
    });

    it('verifies useMemoryStore initial state has 0 memories', () => {
      const state = useMemoryStore.getState();
      expect(state.memories).toEqual([]);
      expect(state.memories.length).toBe(0);
    });
  });

  describe('2. Author is displayed at the TOP of memory post above media, date, and location', () => {
    const mockMembers: FamilyMember[] = [
      {
        id: 'member-kiran-1',
        familyId: 'fam-1',
        firstName: 'Kiran',
        lastName: 'Pattara',
        displayName: 'Kiran Pattara',
        gender: 'MALE',
        isLiving: true,
        generation: 3,
        branchName: 'Kiran Branch',
        branchId: 'branch-kiran',
        createdAt: '2026-01-01',
      },
      {
        id: 'member-ananya-2',
        familyId: 'fam-1',
        firstName: 'Ananya',
        lastName: 'Pattara',
        displayName: 'Ananya Pattara',
        gender: 'FEMALE',
        isLiving: true,
        generation: 3,
        branchName: 'Ananya Branch',
        branchId: 'branch-ananya',
        createdAt: '2026-01-01',
      },
    ];

    const mockMemory: Memory = {
      id: 'mem-101',
      familyId: 'fam-1',
      title: 'Monsoon Courtyard Harvest',
      description: 'Annual gathering during the seasonal harvest celebration.',
      memoryType: 'PHOTO',
      addedByMemberId: 'member-kiran-1',
      addedByMemberName: 'Kiran Pattara',
      coverMediaUrl: 'https://example.com/harvest.jpg',
      eventDate: '2024-07-15T00:00:00.000Z',
      eventDateApprox: 'Monsoon 2024',
      location: 'Palakkad Courtyard',
      visibility: 'FAMILY',
      memberIds: ['member-kiran-1', 'member-ananya-2'],
      branchIds: ['branch-kiran'],
      tags: ['harvest', 'monsoon'],
      status: 'ACTIVE',
      createdAt: '2026-10-21T00:00:00.000Z',
    };

    it('renders author header at the top of the memory card in MemoriesSidePanel', () => {
      const html = renderToString(
        <MemoriesSidePanel
          isOpen={true}
          onClose={() => {}}
          memories={[mockMemory]}
          members={mockMembers}
          familyName="Pattara Family"
          onOpenUploadModal={() => {}}
        />
      );

      // Verify card exists
      expect(html).toContain('data-testid="memory-card-mem-101"');

      // Verify author header exists with data-testid
      expect(html).toContain('data-testid="memory-author-mem-101"');

      // Verify the person name and "Added by Kiran Pattara" is in the author header
      expect(html).toContain('Kiran Pattara');
      expect(html).toContain('Added by Kiran Pattara');

      // Verify order in HTML: author header comes BEFORE photo/video/audio, date, and location
      const authorIndex = html.indexOf('data-testid="memory-author-mem-101"');
      const photoIndex = html.indexOf('alt="Monsoon Courtyard Harvest"');
      const locationIndex = html.indexOf('Palakkad Courtyard');

      expect(authorIndex).toBeGreaterThan(-1);
      expect(photoIndex).toBeGreaterThan(-1);
      expect(locationIndex).toBeGreaterThan(-1);

      // Author header must appear before photo
      expect(authorIndex).toBeLessThan(photoIndex);
      // Author header must appear before date and location
      expect(authorIndex).toBeLessThan(locationIndex);
    });

    it('renders author header at the top of the memory card in FamilyMemoriesSidebar', () => {
      const html = renderToString(
        <FamilyMemoriesSidebar
          isOpen={true}
          onClose={() => {}}
          memories={[mockMemory]}
          members={mockMembers}
          familyName="Pattara Family"
          onOpenUploadModal={() => {}}
        />
      );

      expect(html).toContain('data-testid="memory-card-mem-101"');
      expect(html).toContain('data-testid="memory-author-mem-101"');
      expect(html).toContain('Kiran Pattara');
      expect(html).toContain('Added by Kiran Pattara');

      const authorIndex = html.indexOf('data-testid="memory-author-mem-101"');
      const photoIndex = html.indexOf('alt="Monsoon Courtyard Harvest"');

      expect(authorIndex).toBeLessThan(photoIndex);
    });

    it('verifies UploadNodeMemoryModal allows selecting the author member and stores addedByMemberId and addedByMemberName', () => {
      expect(uploadModalContent).toContain('data-testid="author-member-select"');
      expect(uploadModalContent).toContain('Added By (Memory Contributor)');
      expect(uploadModalContent).toContain('addedByMemberId: selectedAuthor?.id || member.id');
      expect(uploadModalContent).toContain('addedByMemberName: authorFullName');
    });
  });
});
