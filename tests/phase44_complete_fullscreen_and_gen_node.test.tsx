import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { TreeFloatingControls } from '../src/components/genealogy/TreeFloatingControls.tsx';
import { calculateTreeLayout } from '../src/utils/treeLayout.ts';
import { FamilyMember, Relationship } from '../src/types/index.ts';

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

describe('Phase 44: FamilyRoots — Complete Tree Fullscreen & Generation Node Badges', () => {
  const memberGen1: FamilyMember = {
    id: 'mem-gen-1',
    familyId: 'fam-1',
    firstName: 'Pattara',
    lastName: 'Senior',
    displayName: 'Pattara Senior',
    gender: 'MALE',
    isLiving: false,
    generation: 1,
    branchName: 'Root Lineage',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const memberGen2: FamilyMember = {
    id: 'mem-gen-2',
    familyId: 'fam-1',
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

  const memberGen3: FamilyMember = {
    id: 'mem-gen-3',
    familyId: 'fam-1',
    firstName: 'Aarav',
    lastName: 'Pattara',
    displayName: 'Aarav Pattara',
    gender: 'MALE',
    isLiving: true,
    generation: 3,
    branchName: 'Suresh Branch',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  describe('1. Person Node Generation Indicator on Left Top Corner', () => {
    it('renders "Gen 1" on top-left corner of Generation 1 member node', () => {
      const data: HeritageMemberNodeData = {
        member: memberGen1,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
      };

      const html = renderToString(<HeritageMemberNode data={data} id="node-1" {...({} as any)} />);

      expect(html).toContain('Gen 1');
      expect(html).toContain('data-testid="node-gen-badge-mem-gen-1"');
      expect(html).toContain('Pattara Senior');
    });

    it('renders "Gen 2" on top-left corner alongside branch name', () => {
      const data: HeritageMemberNodeData = {
        member: memberGen2,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
      };

      const html = renderToString(<HeritageMemberNode data={data} id="node-2" {...({} as any)} />);

      expect(html).toContain('Gen 2');
      expect(html).toContain('data-testid="node-gen-badge-mem-gen-2"');
      expect(html).toContain('Suresh Branch');
      expect(html).toContain('Suresh Pattara');
    });

    it('renders "Gen 3" on top-left corner for Generation 3 member node', () => {
      const data: HeritageMemberNodeData = {
        member: memberGen3,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
      };

      const html = renderToString(<HeritageMemberNode data={data} id="node-3" {...({} as any)} />);

      expect(html).toContain('Gen 3');
      expect(html).toContain('data-testid="node-gen-badge-mem-gen-3"');
      expect(html).toContain('Aarav Pattara');
    });
  });

  describe('2. Removal of Generation Markers from Tree Side Rail', () => {
    it('calculateTreeLayout does not output side generationMarker nodes by default', () => {
      const members = [memberGen1, memberGen2, memberGen3];
      const relationships: Relationship[] = [
        {
          id: 'rel-1',
          familyId: 'fam-1',
          sourceMemberId: memberGen1.id,
          targetMemberId: memberGen2.id,
          relationshipType: 'PARENT',
          status: 'ACTIVE',
          createdAt: '',
        },
        {
          id: 'rel-2',
          familyId: 'fam-1',
          sourceMemberId: memberGen2.id,
          targetMemberId: memberGen3.id,
          relationshipType: 'PARENT',
          status: 'ACTIVE',
          createdAt: '',
        },
      ];

      const result = calculateTreeLayout(members, relationships);

      // Verify no generation markers are attached on the side rail
      const sideMarkers = result.nodes.filter((n) => n.type === 'generationMarker');
      expect(sideMarkers.length).toBe(0);

      // Member nodes remain properly generated with correct generations
      const memberNodes = result.nodes.filter((n) => n.type === 'heritageMember');
      expect(memberNodes.length).toBe(3);
      expect(result.generationCount).toBe(3);
    });
  });

  describe('3. Tree Floating Controls Positioning & Hierarchy', () => {
    it('renders controls at top-5 right-5 with z-35 above canvas', () => {
      const html = renderToString(
        <TreeFloatingControls
          onZoomIn={() => {}}
          onZoomOut={() => {}}
          onFitFamily={() => {}}
          isFocusMode={false}
          onToggleFocusMode={() => {}}
          isFullscreen={false}
          onToggleFullscreen={() => {}}
          showMiniMap={false}
          onToggleMiniMap={() => {}}
          showHint={false}
          onDismissHint={() => {}}
          isDrawerOpen={false}
        />
      );

      expect(html).toContain('top-5 right-5');
      expect(html).toContain('z-35');
      expect(html).toContain('Zoom In');
      expect(html).toContain('Zoom Out');
      expect(html).toContain('Fit Family');
      expect(html).toContain('Focus');
      expect(html).toContain('Fullscreen');
    });

    it('adapts position with sm:right-[436px] when detail drawer is open to prevent occlusion', () => {
      const html = renderToString(
        <TreeFloatingControls
          onZoomIn={() => {}}
          onZoomOut={() => {}}
          onFitFamily={() => {}}
          isFocusMode={false}
          onToggleFocusMode={() => {}}
          isFullscreen={false}
          onToggleFullscreen={() => {}}
          showMiniMap={false}
          onToggleMiniMap={() => {}}
          showHint={false}
          onDismissHint={() => {}}
          isDrawerOpen={true}
        />
      );

      expect(html).toContain('sm:right-[436px]');
    });

    it('shows "Exit Fullscreen" label and active state when isFullscreen is true', () => {
      const html = renderToString(
        <TreeFloatingControls
          onZoomIn={() => {}}
          onZoomOut={() => {}}
          onFitFamily={() => {}}
          isFocusMode={false}
          onToggleFocusMode={() => {}}
          isFullscreen={true}
          onToggleFullscreen={() => {}}
          showMiniMap={false}
          onToggleMiniMap={() => {}}
          showHint={false}
          onDismissHint={() => {}}
        />
      );

      expect(html).toContain('Exit Fullscreen');
      expect(html).toContain('aria-label="Exit Fullscreen"');
    });
  });
});
