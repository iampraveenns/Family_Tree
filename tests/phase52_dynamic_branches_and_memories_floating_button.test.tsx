import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TreeFloatingControls } from '../src/components/genealogy/TreeFloatingControls.tsx';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { resolveDynamicBranches } from '../src/utils/branchUtils.ts';
import { calculateTreeLayout } from '../src/utils/treeLayout.ts';
import { FamilyMember, Relationship } from '../src/types/index.ts';

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

describe('Phase 52: Memories Floating Button Redesign & Dynamic Branches for Members and Spouse Groups', () => {
  describe('1. Memories floating button redesign', () => {
    it('removes the symbol/icon and reduces the width of the button', () => {
      const html = renderToString(
        <TreeFloatingControls
          onZoomIn={vi.fn()}
          onZoomOut={vi.fn()}
          onFitFamily={vi.fn()}
          isFocusMode={false}
          onToggleFocusMode={vi.fn()}
          isFullscreen={false}
          onToggleFullscreen={vi.fn()}
          showMiniMap={false}
          onToggleMiniMap={vi.fn()}
          showHint={false}
          onDismissHint={vi.fn()}
          onToggleMemoriesSidebar={vi.fn()}
          isMemoriesSidebarOpen={false}
          memoriesCount={5}
        />
      );

      // Button exists with data-testid
      expect(html).toContain('data-testid="toggle-memories-sidebar-button"');

      // The FolderHeart icon symbol is removed
      expect(html).not.toContain('lucide-folder-heart');
      expect(html).not.toContain('FolderHeart');

      // Width is reduced with compact px-2 py-1 styling specifically on memories button
      const memoriesBtnMatch = html.match(/data-testid="toggle-memories-sidebar-button"[^>]*class="([^"]+)"/);
      expect(memoriesBtnMatch).toBeTruthy();
      expect(memoriesBtnMatch![1]).toContain('px-2 py-1');
      expect(memoriesBtnMatch![1]).not.toContain('px-2.5 py-1.5');

      // Text label and count badge are displayed
      expect(html).toContain('Memories</span>');
      expect(html).toContain('5</span>');
    });
  });

  describe('2. Dynamic branch resolution for every member and child-spouse groups', () => {
    const members: FamilyMember[] = [
      // Gen 1: Root couple
      {
        id: 'mem-govindan',
        familyId: 'fam-1',
        firstName: 'Govindan',
        lastName: 'Pattara',
        displayName: 'Govindan Pattara',
        gender: 'MALE',
        isLiving: false,
        generation: 1,
      },
      {
        id: 'mem-lakshmi',
        familyId: 'fam-1',
        firstName: 'Lakshmi',
        lastName: 'Pattara',
        displayName: 'Lakshmi Pattara',
        gender: 'FEMALE',
        isLiving: false,
        generation: 1,
      },
      // Gen 2: Child Arun and his spouse Priya
      {
        id: 'mem-arun',
        familyId: 'fam-1',
        firstName: 'Arun',
        lastName: 'Pattara',
        displayName: 'Arun Pattara',
        gender: 'MALE',
        isLiving: true,
        generation: 2,
      },
      {
        id: 'mem-priya',
        familyId: 'fam-1',
        firstName: 'Priya',
        lastName: 'Pattara',
        displayName: 'Priya Pattara',
        gender: 'FEMALE',
        isLiving: true,
        generation: 2,
      },
      // Gen 2: Child Ananth and his spouse Nalini
      {
        id: 'mem-ananth',
        familyId: 'fam-1',
        firstName: 'Ananth',
        lastName: 'Pattara',
        displayName: 'Ananth Pattara',
        gender: 'MALE',
        isLiving: true,
        generation: 2,
      },
      {
        id: 'mem-nalini',
        familyId: 'fam-1',
        firstName: 'Nalini',
        lastName: 'Pattara',
        displayName: 'Nalini Pattara',
        gender: 'FEMALE',
        isLiving: true,
        generation: 2,
      },
      // Gen 3: Child Kumar (of Arun) and spouse Sunita
      {
        id: 'mem-kumar',
        familyId: 'fam-1',
        firstName: 'Kumar',
        lastName: 'Pattara',
        displayName: 'Kumar Pattara',
        gender: 'MALE',
        isLiving: true,
        generation: 3,
      },
      {
        id: 'mem-sunita',
        familyId: 'fam-1',
        firstName: 'Sunita',
        lastName: 'Pattara',
        displayName: 'Sunita Pattara',
        gender: 'FEMALE',
        isLiving: true,
        generation: 3,
      },
      // Gen 3: Single child Ravi (of Arun)
      {
        id: 'mem-ravi',
        familyId: 'fam-1',
        firstName: 'Ravi',
        lastName: 'Pattara',
        displayName: 'Ravi Pattara',
        gender: 'MALE',
        isLiving: true,
        generation: 3,
      },
      // Gen 4: Child Raj (of Kumar & Sunita)
      {
        id: 'mem-raj',
        familyId: 'fam-1',
        firstName: 'Raj',
        lastName: 'Pattara',
        displayName: 'Raj Pattara',
        gender: 'MALE',
        isLiving: true,
        generation: 4,
      },
    ];

    const relationships: Relationship[] = [
      // Govindan & Lakshmi are spouses
      {
        id: 'rel-1',
        familyId: 'fam-1',
        sourceMemberId: 'mem-govindan',
        targetMemberId: 'mem-lakshmi',
        relationshipType: 'SPOUSE',
        status: 'ACTIVE',
        createdAt: '2024-01-01',
      },
      // Govindan & Lakshmi -> Arun
      {
        id: 'rel-2',
        familyId: 'fam-1',
        sourceMemberId: 'mem-govindan',
        targetMemberId: 'mem-arun',
        relationshipType: 'PARENT',
        status: 'ACTIVE',
        createdAt: '2024-01-01',
      },
      // Govindan & Lakshmi -> Ananth
      {
        id: 'rel-3',
        familyId: 'fam-1',
        sourceMemberId: 'mem-govindan',
        targetMemberId: 'mem-ananth',
        relationshipType: 'PARENT',
        status: 'ACTIVE',
        createdAt: '2024-01-01',
      },
      // Arun & Priya are spouses
      {
        id: 'rel-4',
        familyId: 'fam-1',
        sourceMemberId: 'mem-arun',
        targetMemberId: 'mem-priya',
        relationshipType: 'SPOUSE',
        status: 'ACTIVE',
        createdAt: '2024-01-01',
      },
      // Ananth & Nalini are spouses
      {
        id: 'rel-5',
        familyId: 'fam-1',
        sourceMemberId: 'mem-ananth',
        targetMemberId: 'mem-nalini',
        relationshipType: 'SPOUSE',
        status: 'ACTIVE',
        createdAt: '2024-01-01',
      },
      // Arun -> Kumar
      {
        id: 'rel-6',
        familyId: 'fam-1',
        sourceMemberId: 'mem-arun',
        targetMemberId: 'mem-kumar',
        relationshipType: 'PARENT',
        status: 'ACTIVE',
        createdAt: '2024-01-01',
      },
      // Arun -> Ravi
      {
        id: 'rel-7',
        familyId: 'fam-1',
        sourceMemberId: 'mem-arun',
        targetMemberId: 'mem-ravi',
        relationshipType: 'PARENT',
        status: 'ACTIVE',
        createdAt: '2024-01-01',
      },
      // Kumar & Sunita are spouses
      {
        id: 'rel-8',
        familyId: 'fam-1',
        sourceMemberId: 'mem-kumar',
        targetMemberId: 'mem-sunita',
        relationshipType: 'SPOUSE',
        status: 'ACTIVE',
        createdAt: '2024-01-01',
      },
      // Kumar -> Raj
      {
        id: 'rel-9',
        familyId: 'fam-1',
        sourceMemberId: 'mem-kumar',
        targetMemberId: 'mem-raj',
        relationshipType: 'PARENT',
        status: 'ACTIVE',
        createdAt: '2024-01-01',
      },
    ];

    it('assigns branches dynamically for every member and groups couples together', () => {
      const resolved = resolveDynamicBranches(members, relationships);

      const byId = new Map(resolved.map((m) => [m.id, m]));

      // 1. Every single member has a branchName
      resolved.forEach((m) => {
        expect(m.branchName).toBeDefined();
        expect(m.branchName!.trim().length).toBeGreaterThan(0);
        expect(m.branchId).toBeDefined();
      });

      // 2. Child Arun has spouse Priya: both Arun and Priya have "Arun Branch"
      expect(byId.get('mem-arun')?.branchName).toBe('Arun Branch');
      expect(byId.get('mem-priya')?.branchName).toBe('Arun Branch');

      // 3. Child Ananth has spouse Nalini: both Ananth and Nalini have "Ananth Branch"
      expect(byId.get('mem-ananth')?.branchName).toBe('Ananth Branch');
      expect(byId.get('mem-nalini')?.branchName).toBe('Ananth Branch');

      // 4. Child Kumar has spouse Sunita: both Kumar and Sunita have "Kumar Branch"
      expect(byId.get('mem-kumar')?.branchName).toBe('Kumar Branch');
      expect(byId.get('mem-sunita')?.branchName).toBe('Kumar Branch');

      // 5. Raj (child of Kumar & Sunita) inherits "Kumar Branch"
      expect(byId.get('mem-raj')?.branchName).toBe('Kumar Branch');

      // 6. Root ancestors Govindan and Lakshmi have "Govindan Branch"
      expect(byId.get('mem-govindan')?.branchName).toBe('Govindan Branch');
      expect(byId.get('mem-lakshmi')?.branchName).toBe('Govindan Branch');
    });

    it('renders branch badge dynamically on both primary member node and spouse node in HeritageMemberNode', () => {
      const resolved = resolveDynamicBranches(members, relationships);
      const arun = resolved.find((m) => m.id === 'mem-arun')!;
      const priya = resolved.find((m) => m.id === 'mem-priya')!;

      // Render Arun (Primary Member)
      const arunData: HeritageMemberNodeData = {
        member: arun,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
        hasSpouse: true,
        isSecondarySpouse: false,
      };
      const arunHtml = renderToString(<HeritageMemberNode data={arunData} id="node-arun" {...({} as any)} />);

      // Arun displays Gen 2 and Arun Branch badge
      expect(arunHtml).toContain('data-testid="node-gen-badge-mem-arun"');
      expect(arunHtml).toContain('Gen 2');
      expect(arunHtml).toContain('data-testid="node-branch-badge-mem-arun"');
      expect(arunHtml).toContain('Arun Branch');

      // Render Priya (Secondary Spouse)
      const priyaData: HeritageMemberNodeData = {
        member: priya,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
        hasSpouse: true,
        isSecondarySpouse: true,
      };
      const priyaHtml = renderToString(<HeritageMemberNode data={priyaData} id="node-priya" {...({} as any)} />);

      // Priya (spouse) does NOT have Gen badge, BUT DOES display Arun Branch badge!
      expect(priyaHtml).not.toContain('data-testid="node-gen-badge-mem-priya"');
      expect(priyaHtml).toContain('data-testid="node-branch-badge-mem-priya"');
      expect(priyaHtml).toContain('Arun Branch');
    });

    it('calculateTreeLayout embeds dynamically resolved branches in nodes', () => {
      const layout = calculateTreeLayout(members, relationships);
      const priyaNode = layout.nodes.find((n) => n.id === 'mem-priya');
      const arunNode = layout.nodes.find((n) => n.id === 'mem-arun');

      expect(arunNode?.data.member.branchName).toBe('Arun Branch');
      expect(priyaNode?.data.member.branchName).toBe('Arun Branch');
    });
  });
});
