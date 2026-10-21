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

describe('Phase 47: Family Tree Node Memories Button & Upload Flow', () => {
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

  it('renders Memories button near the Spouse button on Member node with matching styling', () => {
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

    // Verify Child, Spouse, and Memories buttons are all present
    expect(html).toContain('+ Child');
    expect(html).toContain('+ Spouse');
    expect(html).toContain('+ Memories');

    // Verify testid and data-action attributes
    expect(html).toContain('data-testid="node-memories-btn-mem-101"');
    expect(html).toContain('data-action="upload-memory"');

    // Verify Memories button has the identical button styling classes
    expect(html).toContain('px-2 py-0.5 rounded bg-white hover:bg-[#EFF6FF] hover:text-[#2563EB]');
    expect(html).toContain('text-[#17233C] border border-[#B8D4FF] font-medium text-[10.5px]');
  });

  it('renders Memories button on the left bottom corner for Spouse node, without + Child or + Spouse', () => {
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

    // Spouse node MUST NOT have + Child or + Spouse
    expect(html).not.toContain('+ Child');
    expect(html).not.toContain('+ Spouse');

    // Spouse node MUST have + Memories on the left bottom corner
    expect(html).toContain('+ Memories');
    expect(html).toContain('data-testid="node-memories-btn-mem-102"');
    expect(html).toContain('data-action="upload-memory"');
    expect(html).toContain('px-2 py-0.5 rounded bg-white hover:bg-[#EFF6FF] hover:text-[#2563EB]');
  });

  it('renders Memories button in popup editbar with #FFF9D6 background when node is selected', () => {
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
    expect(html).toMatch(/background-color:\s*(rgb\(255,\s*255,\s*30\)|#FFF9D6)/i);
    expect(html).toContain('title="Upload Memories (Photos/Videos)"');
    expect(html).toContain('Memories</span>');
  });

  it('renders UploadNodeMemoryModal displaying Add Memories title, Date datepicker, and photos, videos, and audios upload capabilities without yellow banner', () => {
    const html = renderToString(
      <MemoryRouter>
        <UploadNodeMemoryModal
          isOpen={true}
          member={mockMember}
          familyId="fam-1"
          onClose={() => {}}
        />
      </MemoryRouter>
    );

    // Modal title & subtitle
    expect(html).toContain('Add Memories');
    expect(html).toContain('Devan Pattara');
    expect(html).not.toContain('Upload Memories for');

    // Yellow banner callout next to heading is removed
    expect(html).not.toContain('Preserve in Family Memories:');

    // Drag and drop photo, video, or audio
    expect(html).toContain('Select Photo, Video, or Audio');
    expect(html).toContain('Drag and drop photos, videos, or audios here');
    expect(html).toContain('accept="image/*,video/*,audio/*"');

    // Date datepicker (not just regular text input)
    expect(html).toContain('type="date"');
    expect(html).toContain('Date');
    expect(html).not.toContain('Date or Year (Optional)');

    // Form buttons
    expect(html).toContain('Add to Memories');
  });
});
