import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HeritageMemberNode, HeritageMemberNodeData, getNodeDateRows } from '../src/components/genealogy/HeritageMemberNode.tsx';
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

describe('Phase 39: FamilyRoots — Family Tree Node Date Display Priority & Order', () => {
  const baseMember: FamilyMember = {
    id: 'm-date-test',
    familyId: 'fam-test',
    firstName: 'Ravi',
    lastName: 'Pattara',
    gender: 'MALE',
    generation: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    isLiving: true,
  };

  describe('1. getNodeDateRows logic', () => {
    it('Case 1: DOB only exists -> displays DOB only', () => {
      const member = {
        ...baseMember,
        dateOfBirth: '1981-05-19',
        dateOfMarriage: null,
        dateOfDeath: null,
        isLiving: true,
      };

      const rows = getNodeDateRows(member);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ label: 'DOB', text: 'DOB: 19 May 1981' });
      expect(rows.some((r) => r.label === 'DOM')).toBe(false);
      expect(rows.some((r) => r.label === 'DOD')).toBe(false);
    });

    it('Case 2: DOB + DOM exist -> displays DOB then DOM', () => {
      const member = {
        ...baseMember,
        dateOfBirth: '1978-02-14',
        dateOfMarriage: '2026-10-02',
        dateOfDeath: null,
        isLiving: true,
      };

      const rows = getNodeDateRows(member);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ label: 'DOB', text: 'DOB: 14 Feb 1978' });
      expect(rows[1]).toEqual({ label: 'DOM', text: 'DOM: 2 Oct 2026' });
      expect(rows.some((r) => r.label === 'DOD')).toBe(false);
    });

    it('Case 3: DOB + DOD exist (no DOM) -> displays DOB then DOD', () => {
      const member = {
        ...baseMember,
        dateOfBirth: '1981-05-19',
        dateOfMarriage: null,
        dateOfDeath: '2026-10-03',
        isLiving: false,
      };

      const rows = getNodeDateRows(member);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ label: 'DOB', text: 'DOB: 19 May 1981' });
      expect(rows[1]).toEqual({ label: 'DOD', text: 'DOD: 3 Oct 2026' });
      expect(rows.some((r) => r.label === 'DOM')).toBe(false);
    });

    it('Case 4: DOB + DOM + DOD all exist -> displays all 3 in exact order DOB, DOM, DOD', () => {
      const member = {
        ...baseMember,
        dateOfBirth: '1981-05-19',
        dateOfMarriage: '2026-10-02',
        dateOfDeath: '2026-10-03',
        isLiving: false,
      };

      const rows = getNodeDateRows(member);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual({ label: 'DOB', text: 'DOB: 19 May 1981' });
      expect(rows[1]).toEqual({ label: 'DOM', text: 'DOM: 2 Oct 2026' });
      expect(rows[2]).toEqual({ label: 'DOD', text: 'DOD: 3 Oct 2026' });
    });

    it('Case 5: DOM only exists -> displays DOM only', () => {
      const member = {
        ...baseMember,
        dateOfBirth: null,
        dateOfMarriage: '2026-10-02',
        dateOfDeath: null,
        isLiving: true,
      };

      const rows = getNodeDateRows(member);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ label: 'DOM', text: 'DOM: 2 Oct 2026' });
      expect(rows.some((r) => r.label === 'DOB')).toBe(false);
      expect(rows.some((r) => r.label === 'DOD')).toBe(false);
    });

    it('Case 6: DOD only exists -> displays DOD only', () => {
      const member = {
        ...baseMember,
        dateOfBirth: null,
        dateOfMarriage: null,
        dateOfDeath: '2026-10-03',
        isLiving: false,
      };

      const rows = getNodeDateRows(member);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ label: 'DOD', text: 'DOD: 3 Oct 2026' });
      expect(rows.some((r) => r.label === 'DOB')).toBe(false);
      expect(rows.some((r) => r.label === 'DOM')).toBe(false);
    });

    it('Case 7: No dates exist -> returns empty array, never invents placeholders', () => {
      const member = {
        ...baseMember,
        dateOfBirth: null,
        dateOfMarriage: null,
        dateOfDeath: null,
        isLiving: true,
      };

      const rows = getNodeDateRows(member);
      expect(rows).toEqual([]);
      expect(rows).toHaveLength(0);
    });
  });

  describe('2. HeritageMemberNode DOM Rendering & Vertical Layout', () => {
    it('renders all three dates on separate lines in order DOB, DOM, DOD for deceased member', () => {
      const allThreeDatesMember: FamilyMember = {
        ...baseMember,
        firstName: 'Suresh',
        lastName: 'Pattara',
        dateOfBirth: '1984-09-30',
        dateOfMarriage: '2010-06-20',
        dateOfDeath: '2026-10-03',
        isLiving: false,
        memoryCount: 0,
      };

      const html = renderToString(
        <HeritageMemberNode
          data={{
            member: allThreeDatesMember,
            isSelected: false,
            isFocused: false,
            isDimmed: false,
            isHovered: false,
            hasSpouse: true,
            marriageDate: '2010-06-20',
          }}
        />
      );

      // Verify Rest in Peace badge
      expect(html).toContain('Rest in Peace');

      // Verify each date exists on its own separate line
      expect(html).toContain('DOB: 30 Sep 1984');
      expect(html).toContain('DOM: 20 Jun 2010');
      expect(html).toContain('DOD: 3 Oct 2026');

      // Verify order: DOB precedes DOM, and DOM precedes DOD
      const dobIndex = html.indexOf('DOB: 30 Sep 1984');
      const domIndex = html.indexOf('DOM: 20 Jun 2010');
      const dodIndex = html.indexOf('DOD: 3 Oct 2026');

      expect(dobIndex).toBeGreaterThan(-1);
      expect(domIndex).toBeGreaterThan(dobIndex);
      expect(dodIndex).toBeGreaterThan(domIndex);

      // 0 memories count indicator must be completely hidden
      expect(html).not.toContain('0 Memories');
      expect(html).not.toContain('0 Memory');
    });

    it('renders DOB and DOM for living married member without DOD', () => {
      const livingMember: FamilyMember = {
        ...baseMember,
        firstName: 'Rani',
        lastName: 'Pattara',
        dateOfBirth: '1978-02-14',
        dateOfMarriage: '2026-10-02',
        dateOfDeath: null,
        isLiving: true,
        memoryCount: 2,
      };

      const html = renderToString(
        <HeritageMemberNode
          data={{
            member: livingMember,
            isSelected: false,
            isFocused: false,
            isDimmed: false,
            isHovered: false,
            hasSpouse: true,
            marriageDate: '2026-10-02',
          }}
        />
      );

      // Status is Living
      expect(html).toContain('Living');

      // Dates
      expect(html).toContain('DOB: 14 Feb 1978');
      expect(html).toContain('DOM: 2 Oct 2026');
      expect(html).not.toContain('DOD:');

      // Memories row appears when count > 0 below dates
      expect(html).toContain('2 Memories');

      const domIndex = html.indexOf('DOM: 2 Oct 2026');
      const memIndex = html.indexOf('2 Memories');
      expect(memIndex).toBeGreaterThan(domIndex);
    });

    it('renders no date placeholders when member has no dates', () => {
      const noDatesMember: FamilyMember = {
        ...baseMember,
        firstName: 'New',
        lastName: 'Member',
        dateOfBirth: null,
        dateOfMarriage: null,
        dateOfDeath: null,
        isLiving: true,
        memoryCount: 0,
      };

      const html = renderToString(
        <HeritageMemberNode
          data={{
            member: noDatesMember,
            isSelected: false,
            isFocused: false,
            isDimmed: false,
            isHovered: false,
          }}
        />
      );

      // No date placeholders
      expect(html).not.toContain('DOB:');
      expect(html).not.toContain('DOM:');
      expect(html).not.toContain('DOD:');
      expect(html).not.toContain('0 Memories');
    });
  });
});
