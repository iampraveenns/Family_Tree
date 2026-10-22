import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { UploadNodeMemoryModal } from '../src/components/genealogy/UploadNodeMemoryModal.tsx';
import { MemoryRouter } from 'react-router-dom';
import { FamilyMember } from '../src/types/index.ts';

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
  MarkerType: {
    ArrowClosed: 'arrowclosed',
    Arrow: 'arrow',
  },
}));

describe('Phase 47: Node Memory Button Removal & Direct Sidebar Memory Management', () => {
  const mockMember: FamilyMember = {
    id: 'mem-101',
    familyId: 'fam-1',
    firstName: 'Devan',
    lastName: 'Pattara',
    displayName: 'Devan Pattara',
    gender: 'MALE',
    isLiving: true,
    dateOfBirth: '1960-04-12',
    houseName: 'Pattara Tharavadu',
    location: 'Kerala, India',
    generation: 2,
    memoryCount: 3,
  };

  const mockSpouse: FamilyMember = {
    id: 'mem-102',
    familyId: 'fam-1',
    firstName: 'Lakshmi',
    lastName: 'Pattara',
    displayName: 'Lakshmi Pattara',
    gender: 'FEMALE',
    isLiving: true,
    dateOfBirth: '1965-08-20',
    generation: 2,
  };

  it('removes Memories button from Member node footer while retaining + Child and + Spouse', () => {
    const nodeData: HeritageMemberNodeData = {
      member: mockMember,
      isSelected: false,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: true,
      isSecondarySpouse: false,
    };

    const html = renderToString(
      <HeritageMemberNode
        data={nodeData}
      />
    );

    // Verify Child and Spouse buttons are present
    expect(html).toContain('+ Child');
    expect(html).toContain('+ Spouse');

    // Verify Memory button has been removed from node
    expect(html).not.toContain('+ Memories');
    expect(html).not.toContain('data-testid="node-memories-btn-mem-101"');
    expect(html).not.toContain('data-action="upload-memory"');
  });

  it('removes Memories button on Spouse node', () => {
    const spouseNodeData: HeritageMemberNodeData = {
      member: mockSpouse,
      isSelected: false,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: true,
      isSecondarySpouse: true, // Marked as secondary spouse node
    };

    const html = renderToString(
      <HeritageMemberNode
        data={spouseNodeData}
      />
    );

    // Spouse node does not have + Memories button
    expect(html).not.toContain('+ Memories');
    expect(html).not.toContain('data-testid="node-memories-btn-mem-102"');
    expect(html).not.toContain('data-action="upload-memory"');
  });

  it('removes Memories button from popup editbar when node is selected', () => {
    const selectedNodeData: HeritageMemberNodeData = {
      member: mockMember,
      isSelected: true,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: true,
      isSecondarySpouse: false,
    };

    const html = renderToString(
      <HeritageMemberNode
        data={selectedNodeData}
      />
    );

    expect(html).toContain('data-testid="node-popup-editbar-mem-101"');
    expect(html).toContain('Profile');
    expect(html).toContain('Edit');
    expect(html).toContain('Kinship');
    // Memories button is removed from popup editbar
    expect(html).not.toContain('title="Upload Memories (Photos/Videos)"');
  });

  it('renders UploadNodeMemoryModal displaying Add Memory title, author selector, Date datepicker, and photos, videos, and audios upload capabilities', () => {
    const html = renderToString(
      <MemoryRouter>
        <UploadNodeMemoryModal
          isOpen={true}
          member={mockMember}
          members={[mockMember, mockSpouse]}
          familyId="fam-1"
          onClose={() => {}}
        />
      </MemoryRouter>
    );

    // Modal title & subtitle
    expect(html).toContain('Add Memory');
    expect(html).toContain('Devan');

    // Author selector present
    expect(html).toContain('Added By (Memory Contributor)');
    expect(html).toContain('data-testid="author-member-select"');

    // Drag and drop photo, video, or audio
    expect(html).toContain('Upload Photo, Video, or Audio');
    expect(html).toContain('accept="image/*,video/*,audio/*"');

    // Date datepicker
    expect(html).toContain('type="date"');
    expect(html).toContain('Date');

    // Form buttons
    expect(html).toContain('Add to Memories');
  });
});
