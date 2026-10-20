import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { AddMemberModal } from '../src/components/genealogy/AddMemberModal.tsx';
import { FamilyMember } from '../src/types/index.ts';

// Mock reactflow Handle & MiniMap
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

describe('Phase 45: FamilyRoots — Housename and Location Display on Member Node & Form Input', () => {
  const memberWithHouseAndLoc: FamilyMember = {
    id: 'mem-house-1',
    familyId: 'fam-1',
    firstName: 'Pattara',
    lastName: 'Senior',
    displayName: 'Pattara Senior',
    gender: 'MALE',
    dateOfBirth: '1950-01-15',
    isLiving: true,
    generation: 1,
    houseName: 'Rosewood Villa',
    location: 'Bengaluru, Karnataka',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const spouseMember: FamilyMember = {
    id: 'mem-spouse-1',
    familyId: 'fam-1',
    firstName: 'Lakshmi',
    lastName: 'Pattara',
    displayName: 'Lakshmi Pattara',
    gender: 'FEMALE',
    dateOfBirth: '1955-03-20',
    dateOfMarriage: '1975-05-10',
    isLiving: true,
    generation: 1,
    houseName: 'Rosewood Villa',
    location: 'Bengaluru, Karnataka',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  describe('1. Member Node Display: Housename and location under DOB', () => {
    it('renders Housename and Location directly under the DOB field on member node', () => {
      const data: HeritageMemberNodeData = {
        member: memberWithHouseAndLoc,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
        isSecondarySpouse: false,
      };

      const html = renderToString(<HeritageMemberNode data={data} id="node-1" {...({} as any)} />);

      // DOB exists
      expect(html).toContain('DOB: 15 Jan 1950');

      // Housename and location exist
      expect(html).toContain('Housename: Rosewood Villa');
      expect(html).toContain('Location: Bengaluru, Karnataka');
      expect(html).toContain('data-testid="node-housename-mem-house-1"');
      expect(html).toContain('data-testid="node-location-mem-house-1"');

      // Under DOB: DOB comes first, then Housename, then Location
      const dobIndex = html.indexOf('DOB: 15 Jan 1950');
      const houseIndex = html.indexOf('Housename: Rosewood Villa');
      const locIndex = html.indexOf('Location: Bengaluru, Karnataka');

      expect(dobIndex).toBeGreaterThan(-1);
      expect(houseIndex).toBeGreaterThan(dobIndex);
      expect(locIndex).toBeGreaterThan(houseIndex);
    });

    it('does NOT render Housename or Location under the spouse node (isSecondarySpouse = true)', () => {
      const data: HeritageMemberNodeData = {
        member: spouseMember,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
        hasSpouse: true,
        isSecondarySpouse: true, // Marked as the spouse in the couple
      };

      const html = renderToString(<HeritageMemberNode data={data} id="node-2" {...({} as any)} />);

      // Spouse DOB is rendered
      expect(html).toContain('DOB: 20 Mar 1955');

      // But Housename and Location must NOT be displayed on the spouse node
      expect(html).not.toContain('Housename: Rosewood Villa');
      expect(html).not.toContain('node-housename-mem-spouse-1');
      expect(html).not.toContain('node-location-mem-spouse-1');
    });

    it('does NOT render Housename or Location if not specified on the member node', () => {
      const memberWithoutHouse: FamilyMember = {
        id: 'mem-no-house',
        familyId: 'fam-1',
        firstName: 'Anand',
        lastName: 'Pattara',
        gender: 'MALE',
        dateOfBirth: '1990-08-12',
        isLiving: true,
        generation: 2,
      };

      const data: HeritageMemberNodeData = {
        member: memberWithoutHouse,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
        isSecondarySpouse: false,
      };

      const html = renderToString(<HeritageMemberNode data={data} id="node-3" {...({} as any)} />);

      expect(html).toContain('DOB: 12 Aug 1990');
      expect(html).not.toContain('Housename:');
      expect(html).not.toContain('node-housename-');
      expect(html).not.toContain('node-location-');
    });
  });

  describe('2. AddMemberModal Profile Inputs for Housename and Location', () => {
    it('provides Housename and Location inputs in Edit Profile mode with prefilled values', () => {
      const html = renderToString(
        <AddMemberModal
          isOpen={true}
          onClose={() => {}}
          onSubmit={async () => {}}
          isRootAncestor={false}
          editMember={memberWithHouseAndLoc}
        />
      );

      expect(html).toContain('Housename (Optional)');
      expect(html).toContain('Location (Optional)');
      expect(html).toContain('value="Rosewood Villa"');
      expect(html).toContain('value="Bengaluru, Karnataka"');
    });

    it('provides Housename and Location inputs in Create / Add Member mode', () => {
      const html = renderToString(
        <AddMemberModal
          isOpen={true}
          onClose={() => {}}
          onSubmit={async () => {}}
          isRootAncestor={false}
          editMember={null}
        />
      );

      expect(html).toContain('Housename (Optional)');
      expect(html).toContain('Location (Optional)');
      expect(html).toContain('placeholder="e.g. Vadakke Tharavadu"');
      expect(html).toContain('placeholder="e.g. Palakkad, Kerala"');
    });
  });
});
