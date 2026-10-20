import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HeritageMemberNode, HeritageMemberNodeData, getNodeDateRows } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { calculateTreeLayout } from '../src/utils/treeLayout.ts';
import { FamilyMember, Relationship } from '../src/types/index.ts';

// Mock reactflow Handle & Position
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

describe('DOM (Date of Marriage) inside Primary Member Node instead of Spouse Node', () => {
  const primaryMember: FamilyMember = {
    id: 'primary-john',
    familyId: 'fam-test',
    firstName: 'John',
    lastName: 'Doe',
    gender: 'MALE',
    isLiving: true,
    generation: 1,
    dateOfBirth: '1980-05-15',
    dateOfMarriage: '2010-06-20',
    marriageDate: '2010-06-20',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const spouseMember: FamilyMember = {
    id: 'spouse-jane',
    familyId: 'fam-test',
    firstName: 'Jane',
    lastName: 'Doe',
    gender: 'FEMALE',
    isLiving: true,
    generation: 1,
    dateOfBirth: '1982-08-25',
    dateOfMarriage: '2010-06-20',
    marriageDate: '2010-06-20',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('1. getNodeDateRows outputs DOM for primary member and omits DOM for spouse node', () => {
    // Primary member
    const primaryRows = getNodeDateRows(primaryMember, '2010-06-20', false);
    const primaryDom = primaryRows.find((r) => r.label === 'DOM');
    expect(primaryDom).toBeDefined();
    expect(primaryDom?.text).toContain('DOM: 20 Jun 2010');

    // Spouse node
    const spouseRows = getNodeDateRows(spouseMember, '2010-06-20', true);
    const spouseDom = spouseRows.find((r) => r.label === 'DOM');
    expect(spouseDom).toBeUndefined();
  });

  it('2. HeritageMemberNode displays DOM on primary member node', () => {
    const nodeData: HeritageMemberNodeData = {
      member: primaryMember,
      isSelected: false,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: true,
      isPrimaryPartner: true,
      isSecondarySpouse: false,
      marriageDate: '2010-06-20',
    };

    const html = renderToString(<HeritageMemberNode data={nodeData} />);

    expect(html).toContain('DOM: 20 Jun 2010');
    expect(html).toContain('data-testid="node-dom-primary-john"');
  });

  it('3. HeritageMemberNode does NOT display DOM on spouse node', () => {
    const nodeData: HeritageMemberNodeData = {
      member: spouseMember,
      isSelected: false,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: true,
      isPrimaryPartner: false,
      isSecondarySpouse: true,
      marriageDate: null,
    };

    const html = renderToString(<HeritageMemberNode data={nodeData} />);

    expect(html).not.toContain('DOM:');
    expect(html).not.toContain('data-testid="node-dom-spouse-jane"');
  });

  it('4. calculateTreeLayout sets marriageDate on primary node and null on spouse node', () => {
    const relationships: Relationship[] = [
      {
        id: 'rel-spouse-1',
        familyId: 'fam-test',
        sourceMemberId: 'primary-john',
        targetMemberId: 'spouse-jane',
        relationshipType: 'SPOUSE',
        marriageDate: '2010-06-20',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const result = calculateTreeLayout([primaryMember, spouseMember], relationships, {});

    const primaryNode = result.nodes.find((n) => n.id === 'primary-john');
    const spouseNode = result.nodes.find((n) => n.id === 'spouse-jane');

    expect(primaryNode).toBeDefined();
    expect(spouseNode).toBeDefined();

    // Primary partner has marriageDate
    expect(primaryNode?.data.isSecondarySpouse).toBe(false);
    expect(primaryNode?.data.marriageDate).toBe('2010-06-20');

    // Spouse partner has no marriageDate
    expect(spouseNode?.data.isSecondarySpouse).toBe(true);
    expect(spouseNode?.data.marriageDate).toBeNull();
    expect(spouseNode?.data.member.dateOfMarriage).toBeNull();
  });
});
