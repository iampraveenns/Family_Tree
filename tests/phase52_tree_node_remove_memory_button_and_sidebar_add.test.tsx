import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { MemoriesSidePanel } from '../src/components/genealogy/MemoriesSidePanel.tsx';
import { UploadNodeMemoryModal } from '../src/components/genealogy/UploadNodeMemoryModal.tsx';
import { FamilyMember, Memory } from '../src/types/index.ts';

// Mock reactflow
vi.mock('reactflow', () => ({
  Handle: ({ id, type, position, className }: any) => (
    <div data-testid={`handle-${type}-${position}-${id || 'default'}`} className={className} />
  ),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}));

describe('Phase 52: Remove Memory Button from Family Tree & Direct Add in Memories Sidebar', () => {
  const livingMember: FamilyMember = {
    id: 'mem-1',
    familyId: 'fam-1',
    firstName: 'Aarav',
    lastName: 'Sharma',
    displayName: 'Aarav Sharma',
    gender: 'MALE',
    isLiving: true,
    generation: 1,
    dateOfBirth: '1980-01-15',
  };

  const deceasedMember: FamilyMember = {
    id: 'mem-2',
    familyId: 'fam-1',
    firstName: 'Devi',
    lastName: 'Sharma',
    displayName: 'Devi Sharma',
    gender: 'FEMALE',
    isLiving: false,
    dateOfDeath: '2020-03-10',
    generation: 1,
    dateOfBirth: '1950-05-12',
  };

  const testMemory: Memory = {
    id: 'mem-post-1',
    familyId: 'fam-1',
    title: 'Family Summer Gathering',
    description: 'Golden memories from our gathering in Kerala',
    memoryType: 'PHOTO',
    eventDate: '2019-06-15',
    location: 'Kerala, India',
    addedByMemberId: 'mem-1',
    addedByMemberName: 'Aarav Sharma',
    memberIds: ['mem-1', 'mem-2'],
    branchIds: [],
    tags: [],
    visibility: 'FAMILY' as any,
    status: 'ACTIVE' as any,
    createdAt: '2026-01-01T00:00:00.000Z',
    media: [
      {
        id: 'asset-1',
        url: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=600',
        mimeType: 'image/jpeg',
        originalFileName: 'gathering.jpg',
      } as any,
    ],
  };

  it('1. Family Tree node has NO Memory button (neither in popup editbar nor in footer)', () => {
    const nodeData: HeritageMemberNodeData = {
      member: livingMember,
      isSelected: true,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: true,
      isSecondarySpouse: false,
    };

    const html = renderToString(<HeritageMemberNode data={nodeData} />);

    // Popup editbar has Profile, Edit, Kinship but NO Memories button
    expect(html).toContain('data-testid="node-popup-editbar-mem-1"');
    expect(html).toContain('Profile');
    expect(html).toContain('Edit');
    expect(html).toContain('Kinship');
    expect(html).not.toContain('title="Upload Memories (Photos/Videos)"');

    // Footer has + Child and + Spouse but NO + Memories button
    expect(html).toContain('+ Child');
    expect(html).toContain('+ Spouse');
    expect(html).not.toContain('+ Memories');
    expect(html).not.toContain('data-testid="node-memories-btn-mem-1"');
  });

  it('2. Spouse node also has NO Memory button', () => {
    const spouseData: HeritageMemberNodeData = {
      member: deceasedMember,
      isSelected: false,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: true,
      isSecondarySpouse: true,
    };

    const html = renderToString(<HeritageMemberNode data={spouseData} />);

    expect(html).not.toContain('+ Memories');
    expect(html).not.toContain('data-testid="node-memories-btn-mem-2"');
  });

  it('3. Memories Sidebar displays "Add Memory" and "Add First Memory" buttons', () => {
    // When memories list is empty: shows "Add First Memory"
    const emptyHtml = renderToString(
      <MemoriesSidePanel
        isOpen={true}
        onClose={() => {}}
        memories={[]}
        members={[livingMember, deceasedMember]}
        onOpenUploadModal={() => {}}
      />
    );
    expect(emptyHtml).toContain('Add Memory');
    expect(emptyHtml).toContain('Add First Memory');

    // When memories exist: shows "Add Memory" button
    const filledHtml = renderToString(
      <MemoriesSidePanel
        isOpen={true}
        onClose={() => {}}
        memories={[testMemory]}
        members={[livingMember, deceasedMember]}
        onOpenUploadModal={() => {}}
      />
    );
    expect(filledHtml).toContain('Add Memory');
  });

  it('4. Memories Sidebar prominently displays the person who added the post at the top of the memory card', () => {
    const html = renderToString(
      <MemoriesSidePanel
        isOpen={true}
        onClose={() => {}}
        memories={[testMemory]}
        members={[livingMember, deceasedMember]}
        onOpenUploadModal={() => {}}
      />
    );

    // Shows Author header at the top
    expect(html).toContain('data-testid="memory-author-mem-post-1"');
    expect(html).toContain('Aarav Sharma');
    expect(html).toContain('Added by Aarav Sharma');
    expect(html).toContain('Author');
  });

  it('5. UploadNodeMemoryModal allows directly adding a memory from sidebar with author selection and tagging', () => {
    const html = renderToString(
      <MemoryRouter>
        <UploadNodeMemoryModal
          isOpen={true}
          member={null} // Opened directly from sidebar without a preselected member
          members={[livingMember, deceasedMember]}
          familyId="fam-1"
          onClose={() => {}}
        />
      </MemoryRouter>
    );

    // Modal renders properly
    expect(html).toContain('Add Memory');
    expect(html).toContain('Added By (Memory Contributor)');
    expect(html).toContain('data-testid="author-member-select"');
    expect(html).toContain('Aarav Sharma');
    expect(html).toContain('Devi Sharma');

    // Tag Relatives selector
    expect(html).toContain('Tag Relatives in this Memory');

    // File upload and form inputs
    expect(html).toContain('Memory Title');
    expect(html).toContain('Add to Memories');
  });
});
