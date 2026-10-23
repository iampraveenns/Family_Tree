import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CoupleJunctionNode, CoupleJunctionData } from '../src/components/genealogy/CoupleJunctionNode.tsx';
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

describe('Phase: Node UI - Minimal Marriage Connector & Butter #FEF3C7 Background', () => {
  const memberLivingMarried: FamilyMember = {
    id: 'mem-living-married',
    familyId: 'fam-yellow',
    firstName: 'Ravi',
    lastName: 'Pattara',
    gender: 'MALE',
    isLiving: true,
    generation: 1,
    branchName: 'Ravi Branch',
    dateOfBirth: '1980-05-15',
    dateOfMarriage: '2010-06-20',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const memberDeceasedSingle: FamilyMember = {
    id: 'mem-deceased-single',
    familyId: 'fam-yellow',
    firstName: 'Dev',
    lastName: 'Sharma',
    gender: 'MALE',
    isLiving: false,
    dateOfDeath: '2018-03-10',
    dateOfBirth: '1940-02-12',
    generation: 1,
    branchName: 'Kumar Branch',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('1. CoupleJunctionNode removes the marriage-date label and tooltip, keeping minimal heart', () => {
    const data: CoupleJunctionData = {
      parentAId: 'p-1',
      parentBId: 'p-2',
      childrenIds: ['c-1'],
      marriageDate: '2015-05-20',
    };

    const html = renderToString(<CoupleJunctionNode data={data} />);

    // Must NOT display "Married: 20 May 2015" or any "Married:" text
    expect(html).not.toContain('Married:');
    expect(html).not.toContain('2015');

    // Must NOT have a title attribute containing "Married:"
    expect(html).not.toContain('title="Married:');

    // Must have the Heart icon (clean & minimal connector: [Node] ── ♡ ── [Node])
    expect(html).toContain('svg');
    expect(html).toContain('lucide-heart');
  });

  it('2. HeritageMemberNode has #FFF9D6 background for living married member', () => {
    const nodeData: HeritageMemberNodeData = {
      member: memberLivingMarried,
      isSelected: false,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: true,
      marriageDate: '2010-06-20',
    };

    const html = renderToString(<HeritageMemberNode data={nodeData} />);

    // Background color (#fef08a) and enlarged dimensions
    expect(html).toMatch(/background-color:\s*(#fef08a|rgb\(255,\s*255,\s*30\)|#FFF9D6)/i);
    expect(html).toContain('width:280px');
    expect(html).toContain('height:160px');
  });

  it('3. HeritageMemberNode has background for deceased single member', () => {
    const nodeData: HeritageMemberNodeData = {
      member: memberDeceasedSingle,
      isSelected: false,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: false,
    };

    const html = renderToString(<HeritageMemberNode data={nodeData} />);

    expect(html).toMatch(/background-color:\s*(#fef08a|rgb\(255,\s*255,\s*30\)|#FFF9D6)/i);
    expect(html).toContain('width:280px');
    expect(html).toContain('height:160px');
  });

  it('4. Selected and hovered states maintain background while applying focus borders', () => {
    const nodeData: HeritageMemberNodeData = {
      member: memberLivingMarried,
      isSelected: true,
      isFocused: true,
      isDimmed: false,
      isHovered: true,
      hasSpouse: true,
    };

    const html = renderToString(<HeritageMemberNode data={nodeData} />);

    expect(html).toMatch(/background-color:\s*(#fef08a|rgb\(255,\s*255,\s*30\)|#FFF9D6)/i);
    expect(html).toContain('border-[#2563EB]');
  });
});

