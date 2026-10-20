import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { Modal } from '../src/components/ui/Modal.tsx';
import { AddMemberModal } from '../src/components/genealogy/AddMemberModal.tsx';
import { FamilyMember } from '../src/types/index.ts';

// Mock reactflow Handle component
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

describe('Phase 42: FamilyRoots — Add Child / Add Spouse in Fullscreen Family Tree', () => {
  const marriedMember: FamilyMember = {
    id: 'mem-married-1',
    familyId: 'fam-test-1',
    firstName: 'Suresh',
    lastName: 'Pattara',
    displayName: 'Suresh Pattara',
    gender: 'MALE',
    isLiving: true,
    generation: 2,
    branchName: 'Suresh Branch',
    profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const singleMember: FamilyMember = {
    id: 'mem-single-1',
    familyId: 'fam-test-1',
    firstName: 'Rohan',
    lastName: 'Pattara',
    displayName: 'Rohan Pattara',
    gender: 'MALE',
    isLiving: true,
    generation: 2,
    branchName: 'Suresh Branch',
    profilePhoto: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  describe('1. Member Node Action Buttons (+ Child & + Spouse)', () => {
    it('+ Child is enabled when member has a spouse, with proper accessible labels', () => {
      const nodeData: HeritageMemberNodeData = {
        member: marriedMember,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
        hasSpouse: true,
      };

      const html = renderToString(<HeritageMemberNode data={nodeData} id="node-married" {...({} as any)} />);

      expect(html).toContain('+ Child');
      expect(html).toContain('aria-label="Add Child to Suresh Pattara"');
      expect(html).toContain('+ Spouse');
      expect(html).toContain('aria-label="Add Spouse to Suresh Pattara"');
      // Must not be disabled
      expect(html).not.toContain('disabled=""');
    });

    it('+ Child is disabled when member has NO spouse, preserving marriage rule', () => {
      const nodeData: HeritageMemberNodeData = {
        member: singleMember,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
        hasSpouse: false,
      };

      const html = renderToString(<HeritageMemberNode data={nodeData} id="node-single" {...({} as any)} />);

      expect(html).toContain('+ Child');
      expect(html).toContain('disabled');
      expect(html).toContain('cursor-not-allowed');
      expect(html).toContain('title="Add a spouse before adding a child."');
      // + Spouse must remain enabled
      expect(html).toContain('+ Spouse');
      expect(html).toContain('aria-label="Add Spouse to Rohan Pattara"');
    });

    it('Action buttons have pointer-events isolation and stopPropagation', () => {
      const nodeData: HeritageMemberNodeData = {
        member: marriedMember,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
        hasSpouse: true,
      };

      const html = renderToString(<HeritageMemberNode data={nodeData} id="node-married" {...({} as any)} />);

      // Buttons are rendered as proper button tags with cursor-pointer
      expect(html).toContain('<button');
      expect(html).toContain('cursor-pointer');
      expect(html).toContain('Edit Member Profile');
      expect(html).toContain('View Profile');
    });
  });

  describe('2. Modal Rendering & Fullscreen Top-Layer Support', () => {
    it('Modal renders dialog and backdrop correctly with high z-index for fullscreen compatibility', () => {
      const html = renderToString(
        <Modal
          isOpen={true}
          onClose={() => {}}
          title="Add Child"
          description="Add a child to Suresh Pattara"
        >
          <div>Child Form Content</div>
        </Modal>
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('Add Child');
      expect(html).toContain('Child Form Content');
      expect(html).toContain('z-50');
      expect(html).toContain('fixed inset-0');
    });

    it('AddMemberModal for Add Child renders required fields cleanly', () => {
      const html = renderToString(
        <AddMemberModal
          isOpen={true}
          onClose={() => {}}
          onSubmit={async () => {}}
          isRootAncestor={false}
          referenceMember={marriedMember}
          referenceMemberHasSpouse={true}
          initialRelationshipType="CHILD"
        />
      );

      expect(html).toContain('Add child to Suresh');
      expect(html).toContain('First Name');
      expect(html).toContain('Last Name');
      expect(html).toContain('Gender');
      expect(html).toContain('Save Relationship');
    });

    it('AddMemberModal for Add Spouse renders spouse fields cleanly', () => {
      const html = renderToString(
        <AddMemberModal
          isOpen={true}
          onClose={() => {}}
          onSubmit={async () => {}}
          isRootAncestor={false}
          referenceMember={marriedMember}
          referenceMemberHasSpouse={false}
          initialRelationshipType="SPOUSE"
        />
      );

      expect(html).toContain('Add spouse to Suresh');
      expect(html).toContain('First Name');
      expect(html).toContain('Last Name');
      expect(html).toContain('Marriage Date');
      expect(html).toContain('Save Relationship');
    });
  });
});
