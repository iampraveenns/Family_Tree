import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { StarterMemberNode } from '../src/components/genealogy/StarterMemberNode.tsx';
import { FamilyMember } from '../src/types/index.ts';

// Mock reactflow Handle & Position & MiniMap
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
  MiniMap: () => <div data-testid="mock-minimap" />,
}));

describe('Phase 54: Node Background Color rgb(255, 255, 30) for Existing and Newly Created Nodes', () => {
  const sampleLivingMember: FamilyMember = {
    id: 'mem-node-existing-1',
    familyId: 'fam-test-1',
    firstName: 'Ramesh',
    lastName: 'Pattara',
    gender: 'MALE',
    generation: 2,
    isLiving: true,
    dateOfBirth: '1970-05-15',
    dateOfMarriage: '1996-08-20',
  };

  const sampleNewlyCreatedMember: FamilyMember = {
    id: 'mem-node-newly-created-2',
    familyId: 'fam-test-1',
    firstName: 'Ananya',
    lastName: 'Pattara',
    gender: 'FEMALE',
    generation: 3,
    isLiving: true,
    dateOfBirth: '2005-11-12',
  };

  it('1. verifies existing member node renders with rgb(255, 255, 30) background color and bg-[rgb(255,255,30)]', () => {
    const data: HeritageMemberNodeData = {
      member: sampleLivingMember,
      isSelected: false,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: true,
    };

    const html = renderToString(<HeritageMemberNode data={data} id="node-existing-1" {...({} as any)} />);

    // Direct inline style and Tailwind utility class verification
    expect(html).toContain('background-color:rgb(255, 255, 30)');
    expect(html).toContain('bg-[rgb(255,255,30)]');
  });

  it('2. verifies newly created member node renders with rgb(255, 255, 30) background color and bg-[rgb(255,255,30)]', () => {
    const data: HeritageMemberNodeData = {
      member: sampleNewlyCreatedMember,
      isSelected: false,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: false,
    };

    const html = renderToString(<HeritageMemberNode data={data} id="node-newly-created-2" {...({} as any)} />);

    expect(html).toContain('background-color:rgb(255, 255, 30)');
    expect(html).toContain('bg-[rgb(255,255,30)]');
  });

  it('3. verifies popup action editbar on selected node uses rgb(255, 255, 30) background color', () => {
    const data: HeritageMemberNodeData = {
      member: sampleLivingMember,
      isSelected: true,
      isFocused: true,
      isDimmed: false,
      isHovered: false,
      hasSpouse: true,
    };

    const html = renderToString(<HeritageMemberNode data={data} id="node-existing-1" {...({} as any)} />);

    expect(html).toContain('data-testid="node-popup-editbar-mem-node-existing-1"');
    expect(html).toContain('background-color:rgb(255, 255, 30)');
    expect(html).toContain('bg-[rgb(255,255,30)]');
  });

  it('4. verifies StarterMemberNode (add placeholder node) renders with rgb(255, 255, 30) background color', () => {
    const html = renderToString(
      <StarterMemberNode
        id="starter-node-1"
        data={{
          isStarterNode: true,
          starterType: 'member',
        }}
        {...({} as any)}
      />
    );

    expect(html).toContain('background-color:rgb(255, 255, 30)');
    expect(html).toContain('bg-[rgb(255,255,30)]');
  });
});
