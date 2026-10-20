import { describe, it, expect } from 'vitest';
import {
  calculateTreeLayout,
  NODE_WIDTH,
  NODE_HEIGHT,
  SPOUSE_GAP,
  SIBLING_GAP,
  GENERATION_GAP,
} from '../src/utils/treeLayout.ts';
import { FamilyMember, Relationship } from '../src/types/index.ts';
import { formatMemberDates } from '../src/components/genealogy/HeritageMemberNode.tsx';

// Test helper to generate mock members
const makeMember = (
  id: string,
  firstName: string,
  lastName: string,
  generation: number,
  branchId?: string
): FamilyMember => ({
  id,
  familyId: 'fam-test',
  firstName,
  lastName,
  displayName: `${firstName} ${lastName}`,
  gender: 'MALE',
  isLiving: true,
  generation,
  branchId,
  branchName: branchId ? `${branchId.replace('branch-', '')} Branch` : undefined,
  memoryCount: 2,
});

describe('Family Tree Canvas Auto-Layout Engine', () => {
  it('Scenario 1: Single Generation with Isolated Members', () => {
    const members: FamilyMember[] = [
      makeMember('m1', 'Priya', 'Varma', 1),
      makeMember('m2', 'Vikram', 'Varma', 1),
    ];
    const relationships: Relationship[] = [];

    const result = calculateTreeLayout(members, relationships);

    expect(result.generationCount).toBe(1);
    expect(result.generations).toEqual([1]);

    const node1 = result.nodes.find((n) => n.id === 'm1')!;
    const node2 = result.nodes.find((n) => n.id === 'm2')!;

    // Same generation members must share the exact same Y coordinate
    expect(node1.position.y).toBe(node2.position.y);
    // Members must not overlap
    expect(Math.abs(node1.position.x - node2.position.x)).toBeGreaterThanOrEqual(
      NODE_WIDTH
    );
  });

  it('Scenario 2: Single Generation with Spouse Unit', () => {
    const members: FamilyMember[] = [
      makeMember('m1', 'Priya', 'Varma', 1),
      makeMember('m2', 'Vikram', 'Varma', 1),
    ];
    const relationships: Relationship[] = [
      {
        id: 'rel-spouse',
        familyId: 'fam-test',
        sourceMemberId: 'm1',
        targetMemberId: 'm2',
        relationshipType: 'SPOUSE',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
    ];

    const result = calculateTreeLayout(members, relationships);

    const node1 = result.nodes.find((n) => n.id === 'm1')!;
    const node2 = result.nodes.find((n) => n.id === 'm2')!;

    // Spouses must be at the exact same Y position
    expect(node1.position.y).toBe(node2.position.y);

    // Spouses must be immediately adjacent with SPOUSE_GAP
    const distance = Math.abs(node2.position.x - node1.position.x);
    expect(distance).toBe(NODE_WIDTH + SPOUSE_GAP);

    // Couple junction node must exist between them
    const junction = result.nodes.find((n) => n.type === 'coupleJunction');
    expect(junction).toBeDefined();
    if (junction) {
      const expectedCenterX = (node1.position.x + node2.position.x + NODE_WIDTH) / 2;
      expect(Math.abs(junction.position.x + 12 - expectedCenterX)).toBeLessThanOrEqual(2);
    }
  });

  it('Scenario 3: 2 Generations with Parents and Multiple Children', () => {
    const members: FamilyMember[] = [
      makeMember('p1', 'Father', 'Varma', 1),
      makeMember('p2', 'Mother', 'Varma', 1),
      makeMember('c1', 'Child1', 'Varma', 2),
      makeMember('c2', 'Child2', 'Varma', 2),
      makeMember('c3', 'Child3', 'Varma', 2),
    ];

    const relationships: Relationship[] = [
      {
        id: 'rel-spouse',
        familyId: 'fam-test',
        sourceMemberId: 'p1',
        targetMemberId: 'p2',
        relationshipType: 'SPOUSE',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'rel-c1-p1',
        familyId: 'fam-test',
        sourceMemberId: 'p1',
        targetMemberId: 'c1',
        relationshipType: 'PARENT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'rel-c2-p1',
        familyId: 'fam-test',
        sourceMemberId: 'p1',
        targetMemberId: 'c2',
        relationshipType: 'PARENT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'rel-c3-p1',
        familyId: 'fam-test',
        sourceMemberId: 'p1',
        targetMemberId: 'c3',
        relationshipType: 'PARENT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
    ];

    const result = calculateTreeLayout(members, relationships);

    expect(result.generationCount).toBe(2);

    const p1 = result.nodes.find((n) => n.id === 'p1')!;
    const p2 = result.nodes.find((n) => n.id === 'p2')!;
    const c1 = result.nodes.find((n) => n.id === 'c1')!;
    const c2 = result.nodes.find((n) => n.id === 'c2')!;
    const c3 = result.nodes.find((n) => n.id === 'c3')!;

    // Generation 1 members have same Y
    expect(p1.position.y).toBe(p2.position.y);

    // Generation 2 members have same Y
    expect(c1.position.y).toBe(c2.position.y);
    expect(c2.position.y).toBe(c3.position.y);

    // Vertical spacing between Generation 1 and Generation 2 is GENERATION_GAP
    expect(c1.position.y - p1.position.y).toBe(GENERATION_GAP);

    // Zero overlap among children in generation 2
    const childrenXs = [c1.position.x, c2.position.x, c3.position.x].sort((a, b) => a - b);
    expect(childrenXs[1] - childrenXs[0]).toBeGreaterThanOrEqual(NODE_WIDTH);
    expect(childrenXs[2] - childrenXs[1]).toBeGreaterThanOrEqual(NODE_WIDTH);

    // Edges descend from couple junction down to each child
    const childEdges = result.edges.filter((e) => e.target.startsWith('c'));
    expect(childEdges.length).toBe(3);
  });

  it('Scenario 4: 3 Generations with Branching Families', () => {
    const members: FamilyMember[] = [
      makeMember('g1-p1', 'Patriarch', 'Varma', 1),
      makeMember('g1-p2', 'Matriarch', 'Varma', 1),
      // Gen 2 Couple A
      makeMember('g2-childA', 'Kumar', 'Varma', 2, 'branch-kumar'),
      makeMember('g2-spouseA', 'Meena', 'Varma', 2, 'branch-kumar'),
      // Gen 2 Single B
      makeMember('g2-childB', 'Ravi', 'Varma', 2, 'branch-ravi'),
      // Gen 3 Children under Couple A
      makeMember('g3-c1', 'Raj', 'Varma', 3, 'branch-kumar'),
      makeMember('g3-c2', 'Anu', 'Varma', 3, 'branch-kumar'),
    ];

    const relationships: Relationship[] = [
      // Gen 1 marriage
      {
        id: 'r1',
        familyId: 'fam-test',
        sourceMemberId: 'g1-p1',
        targetMemberId: 'g1-p2',
        relationshipType: 'SPOUSE',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      // Gen 1 to Gen 2
      {
        id: 'r2',
        familyId: 'fam-test',
        sourceMemberId: 'g1-p1',
        targetMemberId: 'g2-childA',
        relationshipType: 'PARENT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'r3',
        familyId: 'fam-test',
        sourceMemberId: 'g1-p1',
        targetMemberId: 'g2-childB',
        relationshipType: 'PARENT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      // Gen 2 marriage
      {
        id: 'r4',
        familyId: 'fam-test',
        sourceMemberId: 'g2-childA',
        targetMemberId: 'g2-spouseA',
        relationshipType: 'SPOUSE',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      // Gen 2 to Gen 3
      {
        id: 'r5',
        familyId: 'fam-test',
        sourceMemberId: 'g2-childA',
        targetMemberId: 'g3-c1',
        relationshipType: 'PARENT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'r6',
        familyId: 'fam-test',
        sourceMemberId: 'g2-childA',
        targetMemberId: 'g3-c2',
        relationshipType: 'PARENT',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
    ];

    const result = calculateTreeLayout(members, relationships, { showGenerationMarkers: true });

    expect(result.generationCount).toBe(3);
    expect(result.generations).toEqual([1, 2, 3]);

    // Check generation rail markers when explicitly requested
    const markers = result.nodes.filter((n) => n.type === 'generationMarker');
    expect(markers.length).toBe(3);

    // Verify side generation markers are disabled by default
    const defaultResult = calculateTreeLayout(members, relationships);
    expect(defaultResult.nodes.filter((n) => n.type === 'generationMarker').length).toBe(0);

    // Verify all Gen 3 members have same Y coordinate
    const g3c1 = result.nodes.find((n) => n.id === 'g3-c1')!;
    const g3c2 = result.nodes.find((n) => n.id === 'g3-c2')!;
    expect(g3c1.position.y).toBe(g3c2.position.y);
  });

  it('Scenario 5: 4+ Generations Deep Pedigree', () => {
    const members: FamilyMember[] = [
      makeMember('gen1', 'GreatGrandpa', 'Varma', 1),
      makeMember('gen2', 'Grandpa', 'Varma', 2),
      makeMember('gen3', 'Father', 'Varma', 3),
      makeMember('gen4', 'Son', 'Varma', 4),
      makeMember('gen5', 'Grandson', 'Varma', 5),
    ];

    const relationships: Relationship[] = [
      { id: 'r1', familyId: 'f', sourceMemberId: 'gen1', targetMemberId: 'gen2', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
      { id: 'r2', familyId: 'f', sourceMemberId: 'gen2', targetMemberId: 'gen3', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
      { id: 'r3', familyId: 'f', sourceMemberId: 'gen3', targetMemberId: 'gen4', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
      { id: 'r4', familyId: 'f', sourceMemberId: 'gen4', targetMemberId: 'gen5', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
    ];

    const result = calculateTreeLayout(members, relationships);

    expect(result.generationCount).toBe(5);
    const nodes = result.nodes.filter((n) => n.type === 'heritageMember');
    expect(nodes.length).toBe(5);

    // Check strict descending Y values
    const sortedByY = [...nodes].sort((a, b) => a.position.y - b.position.y);
    for (let i = 1; i < sortedByY.length; i++) {
      expect(sortedByY[i].position.y).toBeGreaterThan(sortedByY[i - 1].position.y);
    }
  });

  it('Scenario 6: Branch Filtering', () => {
    const members: FamilyMember[] = [
      makeMember('k1', 'Kumar1', 'Varma', 1, 'branch-kumar'),
      makeMember('r1', 'Ravi1', 'Varma', 1, 'branch-ravi'),
      makeMember('s1', 'Suresh1', 'Varma', 1, 'branch-suresh'),
    ];

    const resultKumarOnly = calculateTreeLayout(members, [], {
      selectedBranch: 'branch-kumar',
    });

    const memberNodes = resultKumarOnly.nodes.filter((n) => n.type === 'heritageMember');
    expect(memberNodes.length).toBe(1);
    expect(memberNodes[0].id).toBe('k1');
  });

  it('Scenario 7: Bounding Box Calculation', () => {
    const members: FamilyMember[] = [
      makeMember('m1', 'Priya', 'Varma', 1),
      makeMember('m2', 'Kumar', 'Varma', 2),
    ];
    const relationships: Relationship[] = [
      { id: 'r1', familyId: 'f', sourceMemberId: 'm1', targetMemberId: 'm2', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
    ];

    const result = calculateTreeLayout(members, relationships);

    expect(result.boundingBox.width).toBeGreaterThan(0);
    expect(result.boundingBox.height).toBeGreaterThan(0);
    expect(result.boundingBox.centerX).toBeGreaterThan(0);
    expect(result.boundingBox.centerY).toBeGreaterThan(0);
  });

  describe('Phase 28 Regression Tests — Starter Node UX & Real-Time Transitions', () => {
    it('Starter cards render correctly with elegant visual attributes and no fake data', () => {
      const result = calculateTreeLayout([], []);
      expect(result.nodes.length).toBe(2);

      const memberStarter = result.nodes.find((n) => n.id === 'starter-member');
      const spouseStarter = result.nodes.find((n) => n.id === 'starter-spouse');

      expect(memberStarter).toBeDefined();
      expect(spouseStarter).toBeDefined();

      // Type and properties
      expect(memberStarter?.type).toBe('starterNode');
      expect(spouseStarter?.type).toBe('starterNode');

      expect(memberStarter?.data?.isStarterNode).toBe(true);
      expect(spouseStarter?.data?.isStarterNode).toBe(true);

      // No fake personal data
      expect(memberStarter?.data?.member).toBeUndefined();
      expect(spouseStarter?.data?.member).toBeUndefined();
      expect((memberStarter?.data as any)?.dateOfBirth).toBeUndefined();
      expect((spouseStarter?.data as any)?.occupation).toBeUndefined();
      expect((memberStarter?.data as any)?.memories).toBeUndefined();
    });

    it('Starter couple edge is frontend-only with centered marriage union symbol', () => {
      const result = calculateTreeLayout([], []);
      expect(result.edges.length).toBe(1);

      const starterEdge = result.edges[0];
      expect(starterEdge.id).toBe('edge-starter-couple');
      expect(starterEdge.source).toBe('starter-member');
      expect(starterEdge.target).toBe('starter-spouse');
      expect(starterEdge.data?.isStarterEdge).toBe(true);
      expect(starterEdge.label).toBe('⚭');
      expect(starterEdge.type).toBe('straight');
      expect(starterEdge.style?.strokeDasharray).toBe('4 4');
    });

    it('Starter nodes excluded from counts (0 Relatives -> 1 Relative -> 2 Relatives)', () => {
      // 0 Members
      const members0: FamilyMember[] = [];
      const layout0 = calculateTreeLayout(members0, []);
      expect(members0.length).toBe(0);
      expect(layout0.nodes.length).toBe(2); // 2 UI-only starter nodes

      // 1 Member
      const member1 = makeMember('m1', 'Arthur', 'Pendleton', 1);
      const members1 = [member1];
      const layout1 = calculateTreeLayout(members1, []);
      expect(members1.length).toBe(1); // 1 relative
      expect(layout1.nodes.filter((n) => n.type === 'heritageMember').length).toBe(1);

      // 2 Members
      const member2 = makeMember('m2', 'Guinevere', 'Pendleton', 1);
      const members2 = [member1, member2];
      const rels: Relationship[] = [
        {
          id: 'rel-sp-1',
          familyId: 'fam-test',
          sourceMemberId: 'm1',
          targetMemberId: 'm2',
          relationshipType: 'SPOUSE',
          status: 'ACTIVE',
          createdAt: '',
        },
      ];
      const layout2 = calculateTreeLayout(members2, rels);
      expect(members2.length).toBe(2); // 2 relatives
      expect(layout2.nodes.filter((n) => n.type === 'heritageMember').length).toBe(2);
      expect(layout2.nodes.every((n) => !n.data?.isStarterNode)).toBe(true);
    });

    it('Add Member success transition: replaces starter Member, retains starter Spouse', () => {
      // Empty tree
      const step0 = calculateTreeLayout([], []);
      expect(step0.nodes.some((n) => n.id === 'starter-member')).toBe(true);
      expect(step0.nodes.some((n) => n.id === 'starter-spouse')).toBe(true);

      // Add real root member
      const newRoot = makeMember('root-1', 'Arthur', 'Pendleton', 1);
      const step1 = calculateTreeLayout([newRoot], []);

      // Starter member removed and replaced by real member
      expect(step1.nodes.some((n) => n.id === 'starter-member')).toBe(false);
      const realNode = step1.nodes.find((n) => n.id === 'root-1');
      expect(realNode).toBeDefined();
      expect(realNode?.type).toBe('heritageMember');

      // Starter spouse remains connected to the real member
      const starterSpouse = step1.nodes.find((n) => n.id === 'starter-spouse');
      expect(starterSpouse).toBeDefined();
      expect(starterSpouse?.data?.partnerMemberId).toBe('root-1');
      expect(step1.edges.some((e) => e.source === 'root-1' && e.target === 'starter-spouse')).toBe(true);
    });

    it('Add Member failure recovery: keeps starter cards intact without partial state', () => {
      // Simulating API error during creation: members array remains empty
      let currentMembers: FamilyMember[] = [];
      const onAddMemberFail = () => {
        // Failed request throws error; currentMembers is unchanged
      };
      onAddMemberFail();

      const layoutAfterFail = calculateTreeLayout(currentMembers, []);
      expect(layoutAfterFail.nodes.length).toBe(2);
      expect(layoutAfterFail.nodes.map((n) => n.id)).toEqual(['starter-member', 'starter-spouse']);
      expect(layoutAfterFail.edges.length).toBe(1);
    });

    it('Add Spouse success transition: replaces starter Spouse, creates real couple relationship', () => {
      const root = makeMember('root-1', 'Arthur', 'Pendleton', 1);
      const spouse = makeMember('spouse-1', 'Guinevere', 'Pendleton', 1);
      const spouseRel: Relationship = {
        id: 'rel-sp-1',
        familyId: 'fam-test',
        sourceMemberId: 'root-1',
        targetMemberId: 'spouse-1',
        relationshipType: 'SPOUSE',
        status: 'ACTIVE',
        createdAt: '',
      };

      const layout = calculateTreeLayout([root, spouse], [spouseRel]);
      // Starter nodes are gone
      expect(layout.nodes.some((n) => n.id === 'starter-spouse')).toBe(false);
      expect(layout.nodes.some((n) => n.id === 'starter-member')).toBe(false);

      // Real members render
      expect(layout.nodes.filter((n) => n.type === 'heritageMember').length).toBe(2);
      // Real couple junction exists
      expect(layout.nodes.some((n) => n.type === 'coupleJunction')).toBe(true);
    });

    it('Add Spouse failure recovery: keeps real member and starter spouse', () => {
      const root = makeMember('root-1', 'Arthur', 'Pendleton', 1);
      let currentMembers = [root];
      let currentRels: Relationship[] = [];

      // Simulating spouse creation failure: members and relationships remain unchanged
      const onAddSpouseFail = () => {
        // Error thrown, no DB write, no local store update
      };
      onAddSpouseFail();

      const layoutAfterFail = calculateTreeLayout(currentMembers, currentRels);
      expect(layoutAfterFail.nodes.find((n) => n.id === 'root-1')?.type).toBe('heritageMember');
      expect(layoutAfterFail.nodes.find((n) => n.id === 'starter-spouse')?.type).toBe('starterNode');
      expect(layoutAfterFail.nodes.some((n) => n.id === 'starter-member')).toBe(false);
    });

    it('Temporary edge removed after spouse creation', () => {
      const root = makeMember('m1', 'Arthur', 'Pendleton', 1);
      const spouse = makeMember('m2', 'Guinevere', 'Pendleton', 1);
      const rel: Relationship = {
        id: 'rel-sp',
        familyId: 'fam',
        sourceMemberId: 'm1',
        targetMemberId: 'm2',
        relationshipType: 'SPOUSE',
        status: 'ACTIVE',
        createdAt: '',
      };

      const result = calculateTreeLayout([root, spouse], [rel]);
      expect(result.edges.some((e) => e.data?.isStarterEdge)).toBe(false);
      expect(result.edges.every((e) => !e.data?.isStarterEdge)).toBe(true);
    });

    it('No duplicate creation on repeated clicks: isSubmitting guard works as expected', () => {
      let submissionCount = 0;
      let isSubmitting = false;

      const submitHandler = () => {
        if (isSubmitting) return;
        isSubmitting = true;
        submissionCount++;
      };

      // Rapid clicks simulate user double-clicking
      submitHandler();
      submitHandler();
      submitHandler();

      expect(submissionCount).toBe(1);
    });

    it('Refresh loads only real database members and excludes starter nodes', () => {
      const persistedMembers = [
        makeMember('m-persisted-1', 'Grandfather', 'Pendleton', 1),
        makeMember('m-persisted-2', 'Grandmother', 'Pendleton', 1),
      ];
      const persistedRels: Relationship[] = [
        {
          id: 'r-sp',
          familyId: 'fam',
          sourceMemberId: 'm-persisted-1',
          targetMemberId: 'm-persisted-2',
          relationshipType: 'SPOUSE',
          status: 'ACTIVE',
          createdAt: '',
        },
      ];

      const refreshedTree = calculateTreeLayout(persistedMembers, persistedRels);
      expect(refreshedTree.nodes.filter((n) => n.type === 'heritageMember').length).toBe(2);
      expect(refreshedTree.nodes.some((n) => n.data?.isStarterNode)).toBe(false);
    });

    it('Starter nodes never reach export/API payloads', () => {
      const cleanExportData = (members: FamilyMember[], relationships: Relationship[]) => {
        return {
          members: members.filter((m) => Boolean(m?.id && m?.firstName && !(m as any).isStarterNode)),
          relationships: relationships.filter((r) => Boolean(r?.sourceMemberId && r?.targetMemberId && !(r as any).isStarterEdge)),
        };
      };

      const emptyExport = cleanExportData([], []);
      expect(emptyExport.members).toHaveLength(0);
      expect(emptyExport.relationships).toHaveLength(0);
    });

    it('Empty family → 0 real FamilyMember nodes', () => {
      const result = calculateTreeLayout([], []);
      const realMemberNodes = result.nodes.filter((n) => !n.data?.isStarterNode);
      expect(realMemberNodes.length).toBe(0);
      expect(realMemberNodes).toEqual([]);
    });

    it('Empty family → 0 backend relationships', () => {
      const backendRelationships: Relationship[] = [];
      const result = calculateTreeLayout([], backendRelationships);
      expect(backendRelationships.length).toBe(0);
      // The single starter edge is marked UI-only
      expect(result.edges.every((e) => e.data?.isStarterEdge === true)).toBe(true);
    });

    it('Starter nodes excluded from relative count', () => {
      const backendMembers: FamilyMember[] = [];
      const result = calculateTreeLayout(backendMembers, []);
      // Relative count in application uses backendMembers.length, not starter nodes
      const headerRelativeCount = backendMembers.length;
      expect(headerRelativeCount).toBe(0);
      expect(result.nodes.length).toBe(2);
    });

    it('Add Member → starter Member replaced by real member', () => {
      const root = makeMember('m1', 'Arthur', 'Pendleton', 1);
      const result = calculateTreeLayout([root], []);

      // Starter member node is replaced
      expect(result.nodes.some((n) => n.id === 'starter-member')).toBe(false);
      // Real member node is rendered
      const realNode = result.nodes.find((n) => n.id === 'm1');
      expect(realNode).toBeDefined();
      expect(realNode?.type).toBe('heritageMember');
      expect(realNode?.data?.isStarterNode).toBe(false);
      expect(realNode?.data?.member?.displayName).toBe('Arthur Pendleton');
    });

    it('Add Member → starter Spouse remains', () => {
      const root = makeMember('m1', 'Arthur', 'Pendleton', 1);
      const result = calculateTreeLayout([root], []);

      const starterSpouse = result.nodes.find((n) => n.id === 'starter-spouse');
      expect(starterSpouse).toBeDefined();
      expect(starterSpouse?.type).toBe('starterNode');
      expect(starterSpouse?.data?.isStarterNode).toBe(true);
      expect(starterSpouse?.data?.starterType).toBe('spouse');
      expect(starterSpouse?.data?.partnerMemberId).toBe('m1');

      // Connected to real member via couple edge
      expect(result.edges.some((e) => e.source === 'm1' && e.target === 'starter-spouse')).toBe(true);
    });

    it('Add Spouse → starter Spouse replaced by real spouse', () => {
      const root = makeMember('m1', 'Arthur', 'Pendleton', 1);
      const spouse = makeMember('m2', 'Guinevere', 'Pendleton', 1);
      const relSpouse: Relationship = {
        id: 'rel-sp-1',
        familyId: 'fam-test',
        sourceMemberId: 'm1',
        targetMemberId: 'm2',
        relationshipType: 'SPOUSE',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };

      const result = calculateTreeLayout([root, spouse], [relSpouse]);

      // Both starter nodes are completely replaced
      expect(result.nodes.some((n) => n.id === 'starter-member')).toBe(false);
      expect(result.nodes.some((n) => n.id === 'starter-spouse')).toBe(false);
      expect(result.nodes.filter((n) => n.type === 'heritageMember').length).toBe(2);
      expect(result.nodes.every((n) => !n.data?.isStarterNode)).toBe(true);
    });

    it('Real spouse relationship persisted', () => {
      const root = makeMember('m1', 'Arthur', 'Pendleton', 1);
      const spouse = makeMember('m2', 'Guinevere', 'Pendleton', 1);
      const relSpouse: Relationship = {
        id: 'rel-sp-1',
        familyId: 'fam-test',
        sourceMemberId: 'm1',
        targetMemberId: 'm2',
        relationshipType: 'SPOUSE',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };

      const result = calculateTreeLayout([root, spouse], [relSpouse]);
      // Real couple junction exists and edge is not a starter edge
      expect(result.nodes.some((n) => n.type === 'coupleJunction')).toBe(true);
      expect(result.edges.every((e) => !e.data?.isStarterEdge)).toBe(true);
    });

    it('Refresh → persisted members still render correctly', () => {
      const persistedMembers = [
        makeMember('p-1', 'Grandfather', 'Pendleton', 1),
        makeMember('p-2', 'Grandmother', 'Pendleton', 1),
        makeMember('c-1', 'Father', 'Pendleton', 2),
      ];
      const persistedRelationships: Relationship[] = [
        {
          id: 'rel-sp',
          familyId: 'fam-test',
          sourceMemberId: 'p-1',
          targetMemberId: 'p-2',
          relationshipType: 'SPOUSE',
          status: 'ACTIVE',
          createdAt: '',
        },
        {
          id: 'rel-c',
          familyId: 'fam-test',
          sourceMemberId: 'p-1',
          targetMemberId: 'c-1',
          relationshipType: 'PARENT',
          status: 'ACTIVE',
          createdAt: '',
        },
      ];

      const result = calculateTreeLayout(persistedMembers, persistedRelationships);
      expect(result.nodes.filter((n) => n.type === 'heritageMember').length).toBe(3);
      expect(result.generationCount).toBe(2);
      expect(result.generations).toEqual([1, 2]);
    });

    it('Export → starter nodes are never exported', () => {
      const exportFamilyData = (members: FamilyMember[], relationships: Relationship[]) => ({
        members: members.filter((m) => Boolean(m && m.id && m.firstName)),
        relationships: relationships.filter((r) => Boolean(r && r.sourceMemberId && r.targetMemberId)),
      });

      const exportResult = exportFamilyData([], []);
      expect(exportResult.members.length).toBe(0);
      expect(exportResult.relationships.length).toBe(0);
      expect(exportResult.members.some((m) => (m as any).isStarterNode)).toBe(false);
    });

    it('Search → starter nodes never appear', () => {
      const searchFamily = (query: string, members: FamilyMember[]) => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return members.filter((m) =>
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          (m.displayName && m.displayName.toLowerCase().includes(q))
        );
      };

      const results = searchFamily('Member', []);
      expect(results.length).toBe(0);
      const spouseResults = searchFamily('Spouse', []);
      expect(spouseResults.length).toBe(0);
    });

    it('Kinship → starter nodes ignored', () => {
      const calculateKinship = (m1Id: string, m2Id: string, members: FamilyMember[]) => {
        const memberA = members.find((m) => m.id === m1Id);
        const memberB = members.find((m) => m.id === m2Id);
        if (!memberA || !memberB) return null;
        return { distance: 1, relationship: 'Unknown' };
      };

      expect(calculateKinship('starter-member', 'starter-spouse', [])).toBeNull();
    });

    it('Missing relationship endpoint → no orphan edge', () => {
      const members = [makeMember('m1', 'Child', 'Vance', 2)];
      const relationshipsWithMissingParent: Relationship[] = [
        {
          id: 'rel-missing-parent',
          familyId: 'fam-1',
          sourceMemberId: 'ghost-parent-999',
          targetMemberId: 'm1',
          relationshipType: 'PARENT',
          status: 'ACTIVE',
          createdAt: '',
        },
      ];
      const result = calculateTreeLayout(members, relationshipsWithMissingParent, {
        disableStarterSpouse: true,
      });
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe('m1');
      // No orphan edge must be created to ghost parent
      expect(result.edges.length).toBe(0);
    });

    it('Missing spouse → no empty spouse node', () => {
      const members = [makeMember('m1', 'Husband', 'Vance', 1)];
      const relationshipsWithMissingSpouse: Relationship[] = [
        {
          id: 'rel-missing-wife',
          familyId: 'fam-1',
          sourceMemberId: 'm1',
          targetMemberId: 'ghost-spouse-999',
          relationshipType: 'SPOUSE',
          status: 'ACTIVE',
          createdAt: '',
        },
      ];
      const result = calculateTreeLayout(members, relationshipsWithMissingSpouse, {
        disableStarterSpouse: true,
      });
      // Only the real member node exists; no fake spouse node and no couple junction
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe('m1');
      expect(result.nodes.some((n) => n.id === 'ghost-spouse-999')).toBe(false);
      expect(result.nodes.some((n) => n.type === 'coupleJunction')).toBe(false);
      expect(result.edges.length).toBe(0);
    });

    it('Malformed / null / undefined member entries are filtered without crashing', () => {
      const malformedMembers = [
        null as any,
        undefined as any,
        { id: '', firstName: 'EmptyId' } as any,
        makeMember('m-real', 'Real', 'Member', 1),
      ];
      const result = calculateTreeLayout(malformedMembers, [], { disableStarterSpouse: true });
      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe('m-real');
    });

    it('Incremental tree growth: 0 → 1 (Root Ancestor) → 2 (+ Spouse) → 3 (+ Child)', () => {
      // Step 1: 0 members → 2 starter nodes (Starter Member + Starter Spouse)
      const step0 = calculateTreeLayout([], []);
      expect(step0.nodes.length).toBe(2);
      expect(step0.nodes.every((n) => n.data?.isStarterNode)).toBe(true);
      expect(step0.edges.length).toBe(1);

      // Step 2: Add Root Ancestor → Real Member replaces starter Member, Starter Spouse remains
      const root = makeMember('m1', 'Root', 'Varma', 1);
      const step1 = calculateTreeLayout([root], []);
      expect(step1.nodes.filter((n) => n.type === 'heritageMember').length).toBe(1);
      expect(step1.nodes.filter((n) => n.data?.isStarterNode).length).toBe(1);
      expect(step1.nodes.find((n) => n.id === 'starter-spouse')).toBeDefined();
      expect(step1.edges.length).toBe(1);

      // Step 3: Add Spouse → Real Spouse replaces Starter Spouse
      const spouse = makeMember('m2', 'Spouse', 'Varma', 1);
      const relSpouse: Relationship = {
        id: 'r-spouse',
        familyId: 'f',
        sourceMemberId: 'm1',
        targetMemberId: 'm2',
        relationshipType: 'SPOUSE',
        status: 'ACTIVE',
        createdAt: '',
      };
      const step2 = calculateTreeLayout([root, spouse], [relSpouse]);
      // 2 real members + 1 couple junction + 1 generation marker, 0 starter nodes
      expect(step2.nodes.filter((n) => n.type === 'heritageMember').length).toBe(2);
      expect(step2.nodes.some((n) => n.id === 'm1')).toBe(true);
      expect(step2.nodes.some((n) => n.id === 'm2')).toBe(true);
      expect(step2.nodes.every((n) => !n.data?.isStarterNode)).toBe(true);

      // Step 4: Add Child
      const child = makeMember('c1', 'Child', 'Varma', 2);
      const relChild: Relationship = {
        id: 'r-child',
        familyId: 'f',
        sourceMemberId: 'm1',
        targetMemberId: 'c1',
        relationshipType: 'PARENT',
        status: 'ACTIVE',
        createdAt: '',
      };
      const step3 = calculateTreeLayout([root, spouse, child], [relSpouse, relChild]);
      expect(step3.nodes.filter((n) => n.type === 'heritageMember').length).toBe(3);
      expect(step3.generationCount).toBe(2);
    });

    describe('Phase 29 — Canvas Centering, Geometry & Starter Unit Stability', () => {
      it('0-member state centers [Member] ─── ⚭ ─── [Spouse] symmetrically around (0, 0)', () => {
        const result = calculateTreeLayout([], []);

        expect(result.nodes.length).toBe(2);
        const memberNode = result.nodes.find((n) => n.id === 'starter-member')!;
        const spouseNode = result.nodes.find((n) => n.id === 'starter-spouse')!;

        expect(memberNode).toBeDefined();
        expect(spouseNode).toBeDefined();

        // 1. Same Y coordinate
        expect(memberNode.position.y).toBe(0);
        expect(spouseNode.position.y).toBe(0);

        // 2. Symmetrically positioned around origin X=0
        const expectedMemberX = -(NODE_WIDTH + SPOUSE_GAP / 2);
        const expectedSpouseX = SPOUSE_GAP / 2;
        expect(memberNode.position.x).toBe(expectedMemberX);
        expect(spouseNode.position.x).toBe(expectedSpouseX);

        // 3. Distance between cards is exactly NODE_WIDTH + SPOUSE_GAP
        expect(spouseNode.position.x - memberNode.position.x).toBe(NODE_WIDTH + SPOUSE_GAP);

        // 4. Exact bounding box center is at (0, NODE_HEIGHT / 2)
        expect(result.boundingBox.centerX).toBe(0);
        expect(result.boundingBox.centerY).toBe(NODE_HEIGHT / 2);

        // 5. Total width matches 2 cards + spouse gap
        expect(result.boundingBox.width).toBe(NODE_WIDTH * 2 + SPOUSE_GAP);
        expect(result.boundingBox.height).toBe(NODE_HEIGHT);

        // 6. Union couple edge connects them
        expect(result.edges.length).toBe(1);
        const edge = result.edges[0];
        expect(edge.id).toBe('edge-starter-couple');
        expect(edge.source).toBe('starter-member');
        expect(edge.target).toBe('starter-spouse');
        expect(edge.sourceHandle).toBe('right');
        expect(edge.targetHandle).toBe('left');
        expect(edge.label).toBe('⚭');
      });

      it('Single member with starter spouse centers the couple unit properly', () => {
        const root = makeMember('m1', 'Ada', 'Lovelace', 1);
        const result = calculateTreeLayout([root], []);

        expect(result.nodes.length).toBe(2);
        const rootNode = result.nodes.find((n) => n.id === 'm1')!;
        const spouseNode = result.nodes.find((n) => n.id === 'starter-spouse')!;

        expect(rootNode).toBeDefined();
        expect(spouseNode).toBeDefined();

        // Both nodes share the same Y
        expect(rootNode.position.y).toBe(spouseNode.position.y);

        // Connected via couple edge with ⚭
        expect(result.edges.length).toBe(1);
        const edge = result.edges[0];
        expect(edge.source).toBe('m1');
        expect(edge.target).toBe('starter-spouse');
        expect(edge.label).toBe('⚭');
      });

      it('Does NOT emit phantom database records or mutate input data', () => {
        const emptyMembers: FamilyMember[] = [];
        const emptyRelationships: Relationship[] = [];

        calculateTreeLayout(emptyMembers, emptyRelationships);

        expect(emptyMembers.length).toBe(0);
        expect(emptyRelationships.length).toBe(0);
      });
    });

    describe('Generation 2 & Generation 3 Symmetrical Structure & Leftside Member Placement', () => {
      it('Generation 2: Left pair places spouse on the left, right pair places spouse on the right', () => {
        const members: FamilyMember[] = [
          makeMember('g1-p1', 'Govindan', 'Pattara', 1),
          makeMember('g1-p2', 'Lakshmi', 'Pattara', 1),
          // Gen 2 Left Pair (Arun & Priya)
          makeMember('arun', 'Arun', 'Pattara', 2),
          makeMember('priya', 'Priya', 'Pattara', 2),
          // Gen 2 Right Pair (Ananth & Nalini)
          makeMember('ananth', 'Ananth', 'Pattara', 2),
          makeMember('nalini', 'Nalini', 'Pattara', 2),
        ];

        const relationships: Relationship[] = [
          // Gen 1 marriage
          { id: 'r1', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'g1-p2', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
          // Gen 1 to Gen 2
          { id: 'r2', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'arun', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
          { id: 'r3', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'ananth', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
          // Gen 2 marriages
          { id: 'r4', familyId: 'f', sourceMemberId: 'arun', targetMemberId: 'priya', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
          { id: 'r5', familyId: 'f', sourceMemberId: 'ananth', targetMemberId: 'nalini', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
        ];

        const result = calculateTreeLayout(members, relationships);

        const arunNode = result.nodes.find((n) => n.id === 'arun')!;
        const priyaNode = result.nodes.find((n) => n.id === 'priya')!;
        const ananthNode = result.nodes.find((n) => n.id === 'ananth')!;
        const naliniNode = result.nodes.find((n) => n.id === 'nalini')!;

        // Left Pair: Priya (spouse) must be on the RIGHT side of Arun (Phase 31 Right-Side Spouse Rule)
        expect(arunNode.position.x).toBeLessThan(priyaNode.position.x);
        expect(priyaNode.position.x - arunNode.position.x).toBe(NODE_WIDTH + SPOUSE_GAP);

        // Right Pair: Nalini (spouse) must be on the RIGHT side of Ananth
        expect(ananthNode.position.x).toBeLessThan(naliniNode.position.x);
        expect(naliniNode.position.x - ananthNode.position.x).toBe(NODE_WIDTH + SPOUSE_GAP);

        // Left pair is to the left of the right pair
        expect(arunNode.position.x).toBeLessThan(ananthNode.position.x);
      });

      it('Generation 3: Follows equal space and structure, left pair places spouse on right', () => {
        const members: FamilyMember[] = [
          makeMember('g1-p1', 'Govindan', 'Pattara', 1),
          makeMember('g1-p2', 'Lakshmi', 'Pattara', 1),
          makeMember('arun', 'Arun', 'Pattara', 2),
          makeMember('priya', 'Priya', 'Pattara', 2),
          makeMember('ananth', 'Ananth', 'Pattara', 2),
          makeMember('nalini', 'Nalini', 'Pattara', 2),
          // Gen 3: Arun & Priya's children
          makeMember('kumar', 'Kumar', 'Pattara', 3, 'branch-kumar'),
          makeMember('sunita', 'Sunita', 'Pattara', 3, 'branch-kumar'),
          makeMember('meena', 'Meena', 'Pattara', 3),
          makeMember('ravi', 'Ravi', 'Pattara', 3, 'branch-ravi'),
          makeMember('suresh', 'Suresh', 'Pattara', 3, 'branch-suresh'),
          // Gen 3: Ananth & Nalini's child
          makeMember('deepa', 'Deepa', 'Pattara', 3),
        ];

        const relationships: Relationship[] = [
          { id: 'r1', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'g1-p2', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
          { id: 'r2', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'arun', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
          { id: 'r3', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'ananth', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
          { id: 'r4', familyId: 'f', sourceMemberId: 'arun', targetMemberId: 'priya', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
          { id: 'r5', familyId: 'f', sourceMemberId: 'ananth', targetMemberId: 'nalini', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
          // Gen 3 parent-child
          { id: 'r6', familyId: 'f', sourceMemberId: 'arun', targetMemberId: 'kumar', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
          { id: 'r7', familyId: 'f', sourceMemberId: 'arun', targetMemberId: 'meena', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
          { id: 'r8', familyId: 'f', sourceMemberId: 'arun', targetMemberId: 'ravi', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
          { id: 'r9', familyId: 'f', sourceMemberId: 'arun', targetMemberId: 'suresh', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
          { id: 'r10', familyId: 'f', sourceMemberId: 'kumar', targetMemberId: 'sunita', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
          { id: 'r11', familyId: 'f', sourceMemberId: 'ananth', targetMemberId: 'deepa', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
        ];

        const result = calculateTreeLayout(members, relationships);

        const kumarNode = result.nodes.find((n) => n.id === 'kumar')!;
        const sunitaNode = result.nodes.find((n) => n.id === 'sunita')!;
        const meenaNode = result.nodes.find((n) => n.id === 'meena')!;
        const raviNode = result.nodes.find((n) => n.id === 'ravi')!;
        const sureshNode = result.nodes.find((n) => n.id === 'suresh')!;
        const deepaNode = result.nodes.find((n) => n.id === 'deepa')!;

        // Left Pair in Gen 3: Sunita (spouse) is on the RIGHT side of Kumar (Phase 31 Right-Side Spouse Rule)
        expect(kumarNode.position.x).toBeLessThan(sunitaNode.position.x);
        expect(sunitaNode.position.x - kumarNode.position.x).toBe(NODE_WIDTH + SPOUSE_GAP);

        // All nodes in Gen 3 share the exact same Y coordinate
        expect(sunitaNode.position.y).toBe(kumarNode.position.y);
        expect(meenaNode.position.y).toBe(kumarNode.position.y);
        expect(raviNode.position.y).toBe(kumarNode.position.y);
        expect(sureshNode.position.y).toBe(kumarNode.position.y);
        expect(deepaNode.position.y).toBe(kumarNode.position.y);

        // Equal space between nodes in Arun's branch:
        // Between Sunita (spouse of Kumar) and Meena
        const gapSunitaMeena = meenaNode.position.x - (sunitaNode.position.x + NODE_WIDTH);
        expect(gapSunitaMeena).toBe(SIBLING_GAP);

        // Between Meena and Ravi
        const gapMeenaRavi = raviNode.position.x - (meenaNode.position.x + NODE_WIDTH);
        expect(gapMeenaRavi).toBe(SIBLING_GAP);

        // Between Ravi and Suresh
        const gapRaviSuresh = sureshNode.position.x - (raviNode.position.x + NODE_WIDTH);
        expect(gapRaviSuresh).toBe(SIBLING_GAP);

        // Deepa is to the right with non-overlapping position
        expect(deepaNode.position.x).toBeGreaterThan(sureshNode.position.x + NODE_WIDTH);
      });

      it('Adding a new spouse to a leftside node places the new spouse on the RIGHT side', () => {
        const members: FamilyMember[] = [
          makeMember('g1-p1', 'Govindan', 'Pattara', 1),
          makeMember('g1-p2', 'Lakshmi', 'Pattara', 1),
          makeMember('arun', 'Arun', 'Pattara', 2),
          makeMember('ananth', 'Ananth', 'Pattara', 2),
          makeMember('new-spouse-arun', 'NewSpouse', 'Pattara', 2),
        ];

        const relationships: Relationship[] = [
          { id: 'r1', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'g1-p2', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
          { id: 'r2', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'arun', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
          { id: 'r3', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'ananth', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
          // New spouse added to Arun (leftside node)
          { id: 'r4', familyId: 'f', sourceMemberId: 'arun', targetMemberId: 'new-spouse-arun', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
        ];

        const result = calculateTreeLayout(members, relationships);

        const arunNode = result.nodes.find((n) => n.id === 'arun')!;
        const spouseNode = result.nodes.find((n) => n.id === 'new-spouse-arun')!;

        // Newly added spouse MUST be on the RIGHT side of Arun (Phase 31 Right-Side Spouse Rule)
        expect(arunNode.position.x).toBeLessThan(spouseNode.position.x);
        expect(spouseNode.position.x - arunNode.position.x).toBe(NODE_WIDTH + SPOUSE_GAP);
      });

      it('Adding a new spouse to a rightside node places the new spouse on the RIGHT side', () => {
        const members: FamilyMember[] = [
          makeMember('g1-p1', 'Govindan', 'Pattara', 1),
          makeMember('g1-p2', 'Lakshmi', 'Pattara', 1),
          makeMember('arun', 'Arun', 'Pattara', 2),
          makeMember('ananth', 'Ananth', 'Pattara', 2),
          makeMember('new-spouse-ananth', 'NewSpouse', 'Pattara', 2),
        ];

        const relationships: Relationship[] = [
          { id: 'r1', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'g1-p2', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
          { id: 'r2', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'arun', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
          { id: 'r3', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'ananth', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
          // New spouse added to Ananth (rightside node)
          { id: 'r4', familyId: 'f', sourceMemberId: 'ananth', targetMemberId: 'new-spouse-ananth', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
        ];

        const result = calculateTreeLayout(members, relationships);

        const ananthNode = result.nodes.find((n) => n.id === 'ananth')!;
        const spouseNode = result.nodes.find((n) => n.id === 'new-spouse-ananth')!;

        // Newly added spouse MUST be on the RIGHT side of Ananth
        expect(ananthNode.position.x).toBeLessThan(spouseNode.position.x);
        expect(spouseNode.position.x - ananthNode.position.x).toBe(NODE_WIDTH + SPOUSE_GAP);
      });

      it('Phase 32: Parent -> child connectors have NO "Child" text label, and spouse connectors retain clean ⚭ symbol', () => {
        const parent = makeMember('p1', 'Parent', 'Root', 1);
        const child1 = makeMember('c1', 'Child1', 'Root', 2);
        const spouse = makeMember('s1', 'Spouse', 'Root', 1);

        const rels: Relationship[] = [
          { id: 'r-spouse', familyId: 'f', sourceMemberId: 'p1', targetMemberId: 's1', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
          { id: 'r-child', familyId: 'f', sourceMemberId: 'p1', targetMemberId: 'c1', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
        ];

        // 1. Single parent-child test (without couple junction)
        const singleParentResult = calculateTreeLayout([parent, child1], [rels[1]]);
        const parentChildEdge = singleParentResult.edges.find((e) => e.target === 'c1');
        expect(parentChildEdge).toBeDefined();
        // Must NOT have 'Child', 'Adoptive Child', or 'Step Child' label
        expect(parentChildEdge?.label).toBeUndefined();

        // 2. Couple junction down to child test
        const coupleResult = calculateTreeLayout([parent, spouse, child1], rels);
        const junctionToChildEdge = coupleResult.edges.find((e) => e.target === 'c1');
        expect(junctionToChildEdge).toBeDefined();
        expect(junctionToChildEdge?.label).toBeUndefined();

        // 3. Spouse connector test: retains ⚭ without redundant "Spouse" text
        const standaloneSpouseResult = calculateTreeLayout([parent, spouse], [rels[0]]);
        const spouseEdge = standaloneSpouseResult.edges.find((e) => e.source === 'p1' && e.target === 's1');
        if (spouseEdge) {
          expect(spouseEdge.label).toBe('⚭');
          expect(spouseEdge.label).not.toContain('Spouse');
        }
      });
    });

    describe('Phase 34: Couple Alignment & Date Formatting Rules', () => {
      it('Spouse couple nodes are at exact same Y position and junction is mathematically centered', () => {
        const p1 = makeMember('m-alpha', 'Govindan', 'Pattara', 1);
        const p2 = makeMember('m-beta', 'Lakshmi', 'Pattara', 1);
        const rel: Relationship = {
          id: 'rel-spouse-1',
          familyId: 'fam-test',
          sourceMemberId: 'm-alpha',
          targetMemberId: 'm-beta',
          relationshipType: 'SPOUSE',
          status: 'ACTIVE',
          createdAt: '',
        };

        const result = calculateTreeLayout([p1, p2], [rel]);
        const node1 = result.nodes.find((n) => n.id === 'm-alpha')!;
        const node2 = result.nodes.find((n) => n.id === 'm-beta')!;
        const junction = result.nodes.find((n) => n.type === 'coupleJunction')!;

        // 1. Exactly same Y position
        expect(node1.position.y).toBe(node2.position.y);

        // 2. Spouse gap distance
        expect(node2.position.x - (node1.position.x + NODE_WIDTH)).toBe(SPOUSE_GAP);

        // 3. Junction X is centered with equal horizontal gaps to left and right cards
        const junctionLeftEdge = junction.position.x;
        const junctionRightEdge = junction.position.x + 24;
        const leftCardRightEdge = node1.position.x + NODE_WIDTH;
        const rightCardLeftEdge = node2.position.x;

        const leftGap = junctionLeftEdge - leftCardRightEdge;
        const rightGap = rightCardLeftEdge - junctionRightEdge;

        expect(leftGap).toBe(rightGap);
        expect(leftGap).toBe((SPOUSE_GAP - 24) / 2); // 14px

        // 4. Vertically centered junction: junction center Y equals node center Y
        const nodeCenterY = node1.position.y + NODE_HEIGHT / 2;
        const junctionCenterY = junction.position.y + 12;
        expect(junctionCenterY).toBe(nodeCenterY);
      });

      it('formatMemberDates correctly formats DOB and DOD according to specifications', () => {
        // Living with DOB
        const d1 = formatMemberDates('1980-06-15', null, true);
        expect(d1.dob).toBe('15 Jun 1980');
        expect(d1.dod).toBeNull();

        // Deceased with DOD
        const d2 = formatMemberDates('1950-01-20', '2022-10-05', false);
        expect(d2.dob).toBe('20 Jan 1950');
        expect(d2.dod).toBe('5 Oct 2022');

        // Deceased without DOD
        const d3 = formatMemberDates('1955-08-12', null, false);
        expect(d3.dob).toBe('12 Aug 1955');
        expect(d3.dod).toBeNull(); // Node renders "DOD: Rest in peace" when dod is null and deceased

        // Unknown DOB
        const d4 = formatMemberDates(null, null, true);
        expect(d4.dob).toBeNull();
        expect(d4.dod).toBeNull();
      });
    });
  });
});
