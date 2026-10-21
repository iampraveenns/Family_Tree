import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { EditLifeStatusModal } from '../src/components/genealogy/EditLifeStatusModal.tsx';
import { AddMemberModal } from '../src/components/genealogy/AddMemberModal.tsx';
import { FamilyMember } from '../src/types/index.ts';

// Mock reactflow Handle & icons
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
  MiniMap: () => <div data-testid="minimap" />,
}));

describe('Phase 47: FamilyRoots — Spouse Gen Removal, RIP Status & #FFF9D6 Popup Editbar', () => {
  const memberGen1: FamilyMember = {
    id: 'mem-primary-1',
    familyId: 'fam-1',
    firstName: 'Pattara',
    lastName: 'Senior',
    displayName: 'Pattara Senior',
    gender: 'MALE',
    dateOfBirth: '1945-03-12',
    dateOfDeath: '2020-05-10',
    isLiving: false,
    generation: 1,
    branchName: 'Root Lineage',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const spouseGen1: FamilyMember = {
    id: 'spouse-1',
    familyId: 'fam-1',
    firstName: 'Lakshmi',
    lastName: 'Pattara',
    displayName: 'Lakshmi Pattara',
    gender: 'FEMALE',
    dateOfBirth: '1948-07-22',
    isLiving: true,
    generation: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  describe('1. Gen 1 / Gen 2 / Gen 3 only for member, removed for spouse', () => {
    it('renders Gen 1 badge on primary member node', () => {
      const data: HeritageMemberNodeData = {
        member: memberGen1,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
        isSecondarySpouse: false,
      };

      const html = renderToString(<HeritageMemberNode data={data} id="node-1" {...({} as any)} />);

      expect(html).toContain('data-testid="node-gen-badge-mem-primary-1"');
      expect(html).toContain('Gen 1');
    });

    it('does NOT render Gen 1 badge on spouse node (isSecondarySpouse: true)', () => {
      const data: HeritageMemberNodeData = {
        member: spouseGen1,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
        isSecondarySpouse: true,
      };

      const html = renderToString(<HeritageMemberNode data={data} id="node-spouse-1" {...({} as any)} />);

      expect(html).not.toContain('data-testid="node-gen-badge-spouse-1"');
      expect(html).not.toContain('Gen 1');
    });
  });

  describe('2. Display RIP instead of Rest in Peace in nodes', () => {
    it('renders "RIP" status badge for deceased members in the node', () => {
      const data: HeritageMemberNodeData = {
        member: memberGen1,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
      };

      const html = renderToString(<HeritageMemberNode data={data} id="node-1" {...({} as any)} />);

      // Must display visible RIP badge
      expect(html).toContain('data-testid="rip-badge-mem-primary-1"');
      expect(html).toContain('RIP');
      expect(html).toContain('data-status="RIP"');
    });
  });

  describe('3. Popup editbar background color #FFF9D6 & text color #17233C', () => {
    it('renders floating action popup editbar on selected node with #FFF9D6 background and dark text color', () => {
      const data: HeritageMemberNodeData = {
        member: memberGen1,
        isSelected: true,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
      };

      const html = renderToString(<HeritageMemberNode data={data} id="node-1" {...({} as any)} />);

      // Popup editbar container
      expect(html).toContain('data-testid="node-popup-editbar-mem-primary-1"');
      expect(html).toMatch(/background-color:\s*(rgb\(255,\s*255,\s*30\)|#FFF9D6)/i);
      expect(html).toMatch(/(bg-\[rgb\(255,255,30\)\]|bg-\[#FFF9D6\])/);
      expect(html).toContain('text-[#17233C]');
      expect(html).toContain('Edit');
      expect(html).toContain('Profile');
      expect(html).toContain('Kinship');
    });

    it('renders EditLifeStatusModal with #FFF9D6 background and #17233C text color', () => {
      const html = renderToString(
        <EditLifeStatusModal
          isOpen={true}
          onClose={() => {}}
          member={memberGen1}
          onSave={async () => {}}
        />
      );

      expect(html).toContain('!bg-[#FFF9D6]');
      expect(html).toContain('background-color:#FFF9D6');
      expect(html).toContain('text-[#17233C]');
      expect(html).toContain('RIP');
    });

    it('renders AddMemberModal in edit mode with #FFF9D6 background and #17233C text color', () => {
      const html = renderToString(
        <AddMemberModal
          isOpen={true}
          onClose={() => {}}
          onSubmit={async () => {}}
          isRootAncestor={false}
          editMember={memberGen1}
        />
      );

      expect(html).toContain('!bg-[#FFF9D6]');
      expect(html).toContain('background-color:#FFF9D6');
      expect(html).toContain('text-[#17233C]');
      expect(html).toContain('Edit Profile:');
    });
  });
});
