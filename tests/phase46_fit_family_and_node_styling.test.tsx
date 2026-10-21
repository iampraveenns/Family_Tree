import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { StarterMemberNode } from '../src/components/genealogy/StarterMemberNode.tsx';
import { calculateTreeLayout, NODE_WIDTH, NODE_HEIGHT } from '../src/utils/treeLayout.ts';
import { FamilyMember, Relationship } from '../src/types/index.ts';

// Mock reactflow Handle
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

describe('Phase 46: FamilyRoots — #FFF9D6 Background, Enlarged Nodes & Complete Tree Fit', () => {
  const sampleMember: FamilyMember = {
    id: 'mem-amber-1',
    familyId: 'fam-1',
    firstName: 'Pattara',
    lastName: 'Senior',
    displayName: 'Pattara Senior',
    gender: 'MALE',
    dateOfBirth: '1950-01-15',
    isLiving: true,
    generation: 1,
    branchName: 'Root Lineage',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  describe('1. Member Node Background Color #FFF9D6 & Dimensions', () => {
    it('renders member node with #FFF9D6 background color and 280x160 dimensions', () => {
      const data: HeritageMemberNodeData = {
        member: sampleMember,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
      };

      const html = renderToString(<HeritageMemberNode data={data} id="node-1" {...({} as any)} />);

      // Background color (updated to rgb(255, 255, 30) per Phase 54)
      expect(html).toMatch(/background-color:\s*(rgb\(255,\s*255,\s*30\)|#FFF9D6)/i);
      expect(html).toMatch(/(bg-\[rgb\(255,255,30\)\]|bg-\[#FFF9D6\])/);

      // Enlarged dimensions (280x160)
      expect(html).toContain('width:280px');
      expect(html).toContain('height:160px');
      expect(html).toContain('w-[280px]');
      expect(html).toContain('h-[160px]');

      // Slightly enlarged text for better readability
      expect(html).toContain('text-[13.5px]'); // Member name
      expect(html).toContain('text-[10px]');   // Generation / date rows
    });

    it('renders StarterMemberNode with #FFF9D6 background color and 280x160 dimensions', () => {
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

      expect(html).toMatch(/background-color:\s*(rgb\(255,\s*255,\s*30\)|#FFF9D6)/i);
      expect(html).toMatch(/(bg-\[rgb\(255,255,30\)\]|bg-\[#FFF9D6\])/);
      expect(html).toContain('width:280px');
      expect(html).toContain('height:160px');
    });
  });

  describe('2. Tree Layout Node Dimensions & Bounds', () => {
    it('exports NODE_WIDTH as 280 and NODE_HEIGHT as 160', () => {
      expect(NODE_WIDTH).toBe(280);
      expect(NODE_HEIGHT).toBe(160);
    });

    it('positions member nodes respecting the enlarged 280x160 dimensions', () => {
      const memberA: FamilyMember = {
        ...sampleMember,
        id: 'mem-a',
      };
      const memberB: FamilyMember = {
        ...sampleMember,
        id: 'mem-b',
        firstName: 'Lakshmi',
        gender: 'FEMALE',
      };
      const spouseRel: Relationship = {
        id: 'rel-1',
        familyId: 'fam-1',
        sourceMemberId: 'mem-a',
        targetMemberId: 'mem-b',
        relationshipType: 'SPOUSE',
        createdAt: '2026-01-01',
      };

      const result = calculateTreeLayout([memberA, memberB], [spouseRel], {});

      const nodeA = result.nodes.find((n) => n.id === 'mem-a')!;
      const nodeB = result.nodes.find((n) => n.id === 'mem-b')!;

      // Distance between couple is NODE_WIDTH + SPOUSE_GAP
      expect(nodeB.position.x - nodeA.position.x).toBe(280 + 52);
    });
  });
});
