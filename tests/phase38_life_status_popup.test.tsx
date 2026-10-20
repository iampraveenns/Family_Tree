import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { EditLifeStatusModal } from '../src/components/genealogy/EditLifeStatusModal.tsx';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
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

describe('Phase 38: FamilyRoots — Living / Deceased Status Edit Popup', () => {
  const livingMember: FamilyMember = {
    id: 'mem-living-1',
    familyId: 'fam-status-test',
    firstName: 'Rani',
    lastName: 'Mukherjee',
    displayName: 'Rani M',
    gender: 'FEMALE',
    isLiving: true,
    dateOfBirth: '1985-10-01',
    dateOfMarriage: '2012-10-02',
    dateOfDeath: null,
    generation: 2,
    branchName: 'Ravi Branch',
    createdAt: '2026-01-01T00:00:00.000Z',
    memoryCount: 3,
  };

  const deceasedMember: FamilyMember = {
    id: 'mem-deceased-1',
    familyId: 'fam-status-test',
    firstName: 'Dev',
    lastName: 'Sharma',
    gender: 'MALE',
    isLiving: false,
    dateOfBirth: '1940-02-12',
    dateOfMarriage: '1965-04-18',
    dateOfDeath: '2024-05-18',
    generation: 1,
    branchName: 'Kumar Branch',
    createdAt: '2026-01-01T00:00:00.000Z',
    memoryCount: 1,
  };

  describe('1. HeritageMemberNode Status Badge & Memory Count', () => {
    it('displays ● Living for living member and does NOT display Alive or Deceased', () => {
      const nodeData: HeritageMemberNodeData = {
        member: livingMember,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
        hasSpouse: true,
        marriageDate: '2012-10-02',
      };

      const html = renderToString(<HeritageMemberNode data={nodeData} />);

      // Badge must show "Living"
      expect(html).toContain('Living');
      expect(html).toContain('bg-[#16A34A]'); // Green dot

      // Must NOT contain Deceased or Alive
      expect(html).not.toContain('Deceased');
      expect(html).not.toContain('Alive');
    });

    it('displays ● Rest in Peace on one line for deceased member and does NOT display Deceased or Alive', () => {
      const nodeData: HeritageMemberNodeData = {
        member: deceasedMember,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
        hasSpouse: true,
        marriageDate: '1965-04-18',
      };

      const html = renderToString(<HeritageMemberNode data={nodeData} />);

      // Badge must show "Rest in Peace"
      expect(html).toContain('Rest in Peace');
      expect(html).toContain('whitespace-nowrap');
      expect(html).toContain('bg-[#64748B]'); // Slate dot

      // Must NOT contain Deceased or Alive
      expect(html).not.toContain('Deceased');
      expect(html).not.toContain('Alive');
    });

    it('completely hides the Memories row when memoryCount is 0', () => {
      const memberWithZeroMemories: FamilyMember = {
        ...livingMember,
        id: 'mem-zero',
        memoryCount: 0,
      };

      const html = renderToString(
        <HeritageMemberNode
          data={{
            member: memberWithZeroMemories,
            isSelected: false,
            isFocused: false,
            isDimmed: false,
            isHovered: false,
          }}
        />
      );

      // Must NOT contain "0 Memories" or "0 Memory"
      expect(html).not.toContain('0 Memories');
      expect(html).not.toContain('0 Memory');
    });

    it('shows 1 Memory when memoryCount is 1 and X Memories when > 1', () => {
      const memberWithOneMemory: FamilyMember = {
        ...livingMember,
        id: 'mem-one',
        memoryCount: 1,
      };

      const htmlOne = renderToString(
        <HeritageMemberNode
          data={{
            member: memberWithOneMemory,
            isSelected: false,
            isFocused: false,
            isDimmed: false,
            isHovered: false,
          }}
        />
      );
      expect(htmlOne).toContain('1 Memory');
      expect(htmlOne).not.toContain('1 Memories');

      const memberWithThreeMemories: FamilyMember = {
        ...livingMember,
        id: 'mem-three',
        memoryCount: 3,
      };

      const htmlThree = renderToString(
        <HeritageMemberNode
          data={{
            member: memberWithThreeMemories,
            isSelected: false,
            isFocused: false,
            isDimmed: false,
            isHovered: false,
          }}
        />
      );
      expect(htmlThree).toContain('3 Memories');
    });
  });

  describe('2. EditLifeStatusModal Rendering & Isolation', () => {
    it('modal contains ONLY Title, Status radio buttons, and action buttons for living member', () => {
      const html = renderToString(
        <EditLifeStatusModal
          isOpen={true}
          onClose={() => {}}
          member={livingMember}
          onSave={async () => {}}
        />
      );

      // Title
      expect(html).toContain('Edit Life Status');

      // Status radio buttons (NO select dropdown)
      expect(html).toContain('Status');
      expect(html).toContain('Living');
      expect(html).toContain('Rest in Peace');
      expect(html).not.toContain('<span>Deceased</span>');
      expect(html).not.toContain('<select');
      expect(html).toContain('type="radio"');
      expect(html).toContain('value="LIVING"');
      expect(html).toContain('value="DECEASED"');
      expect(html).toContain('checked=""'); // Living radio is checked

      // Buttons
      expect(html).toContain('Cancel');
      expect(html).toContain('Save');

      // For Living member, Death Date (DOD) input must NOT be shown
      expect(html).not.toContain('Death Date (DOD)');

      // Must NOT contain any full edit member fields
      expect(html).not.toContain('First Name');
      expect(html).not.toContain('Last Name');
      expect(html).not.toContain('Gender');
      expect(html).not.toContain('Biography');
      expect(html).not.toContain('Birthplace');
      expect(html).not.toContain('Occupation');
      expect(html).not.toContain('Branch Assignment');
      expect(html).not.toContain('Photo URL');
    });

    it('modal loads Deceased radio checked and prefilled Death Date (DOD) directly below Status', () => {
      const html = renderToString(
        <EditLifeStatusModal
          isOpen={true}
          onClose={() => {}}
          member={deceasedMember}
          onSave={async () => {}}
        />
      );

      // Title & Status
      expect(html).toContain('Edit Life Status');
      expect(html).toContain('Status');
      expect(html).not.toContain('<select');
      expect(html).toContain('type="radio"');

      // Death Date (DOD) input must be visible for Deceased member
      expect(html).toContain('Death Date (DOD)');
      expect(html).toContain('2024-05-18');

      // Verify order: Status appears before Death Date (DOD)
      const statusIdx = html.indexOf('Status');
      const dodIdx = html.indexOf('Death Date (DOD)');
      expect(statusIdx).toBeGreaterThan(-1);
      expect(dodIdx).toBeGreaterThan(statusIdx);
    });
  });

  describe('3. Three Separate Interactions Integrity', () => {
    it('Status badge, Eye icon, and Edit icon are distinct and preserved', () => {
      const nodeData: HeritageMemberNodeData = {
        member: livingMember,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
        hasSpouse: true,
      };

      const html = renderToString(<HeritageMemberNode data={nodeData} />);

      // Interaction 1: Dedicated life status badge button
      expect(html).toContain('aria-label="Edit life status for Rani M. Currently Living"');

      // Interaction 2: Edit profile button
      expect(html).toContain('title="Edit Member Profile"');
      expect(html).toContain('aria-label="Edit Member Profile"');

      // Interaction 3: View profile (Eye icon) button
      expect(html).toContain('title="View Profile"');
      expect(html).toContain('aria-label="View Profile"');
    });
  });
});
