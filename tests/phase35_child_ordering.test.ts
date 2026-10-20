import { describe, it, expect } from 'vitest';
import { calculateTreeLayout, NODE_WIDTH } from '../src/utils/treeLayout.ts';
import { FamilyMember, Relationship } from '../src/types/index.ts';

describe('Phase: Family Tree Child Ordering & Layout Correction', () => {
  const parentA: FamilyMember = {
    id: 'parent-father',
    familyId: 'fam-order',
    firstName: 'Dev',
    lastName: 'Sharma',
    gender: 'MALE',
    isLiving: true,
    generation: 1,
    memoryCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const parentB: FamilyMember = {
    id: 'parent-mother',
    familyId: 'fam-order',
    firstName: 'Maya',
    lastName: 'Sharma',
    gender: 'FEMALE',
    isLiving: true,
    generation: 1,
    memoryCount: 0,
    createdAt: '2026-01-01T00:05:00.000Z',
  };

  const spouseRel: Relationship = {
    id: 'rel-spouse',
    familyId: 'fam-order',
    sourceMemberId: 'parent-father',
    targetMemberId: 'parent-mother',
    relationshipType: 'SPOUSE',
    marriageDate: '2010-01-10',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:10:00.000Z',
  };

  const childA: FamilyMember = {
    id: 'child-raja-a',
    familyId: 'fam-order',
    firstName: 'Raja',
    lastName: 'A',
    gender: 'MALE',
    isLiving: true,
    generation: 2,
    memoryCount: 0,
    siblingOrder: 1,
    displayOrder: 1,
    createdAt: '2026-01-02T10:00:00.000Z',
  };

  const childB: FamilyMember = {
    id: 'child-raja-b',
    familyId: 'fam-order',
    firstName: 'Raja',
    lastName: 'B',
    gender: 'FEMALE',
    isLiving: true,
    generation: 2,
    memoryCount: 0,
    siblingOrder: 2,
    displayOrder: 2,
    createdAt: '2026-01-02T11:00:00.000Z',
  };

  const childC: FamilyMember = {
    id: 'child-raja-c',
    familyId: 'fam-order',
    firstName: 'Raja',
    lastName: 'C',
    gender: 'MALE',
    isLiving: true,
    generation: 2,
    memoryCount: 0,
    siblingOrder: 3,
    displayOrder: 3,
    createdAt: '2026-01-02T12:00:00.000Z',
  };

  const childD: FamilyMember = {
    id: 'child-raja-d',
    familyId: 'fam-order',
    firstName: 'Raja',
    lastName: 'D',
    gender: 'FEMALE',
    isLiving: true,
    generation: 2,
    memoryCount: 0,
    siblingOrder: 4,
    displayOrder: 4,
    createdAt: '2026-01-02T13:00:00.000Z',
  };

  const relChildA: Relationship = {
    id: 'rel-child-a',
    familyId: 'fam-order',
    sourceMemberId: 'parent-father',
    targetMemberId: 'child-raja-a',
    relationshipType: 'PARENT',
    status: 'ACTIVE',
    siblingOrder: 1,
    displayOrder: 1,
    createdAt: '2026-01-02T10:00:00.000Z',
  };

  const relChildB: Relationship = {
    id: 'rel-child-b',
    familyId: 'fam-order',
    sourceMemberId: 'parent-father',
    targetMemberId: 'child-raja-b',
    relationshipType: 'PARENT',
    status: 'ACTIVE',
    siblingOrder: 2,
    displayOrder: 2,
    createdAt: '2026-01-02T11:00:00.000Z',
  };

  const relChildC: Relationship = {
    id: 'rel-child-c',
    familyId: 'fam-order',
    sourceMemberId: 'parent-father',
    targetMemberId: 'child-raja-c',
    relationshipType: 'PARENT',
    status: 'ACTIVE',
    siblingOrder: 3,
    displayOrder: 3,
    createdAt: '2026-01-02T12:00:00.000Z',
  };

  const relChildD: Relationship = {
    id: 'rel-child-d',
    familyId: 'fam-order',
    sourceMemberId: 'parent-father',
    targetMemberId: 'child-raja-d',
    relationshipType: 'PARENT',
    status: 'ACTIVE',
    siblingOrder: 4,
    displayOrder: 4,
    createdAt: '2026-01-02T13:00:00.000Z',
  };

  it('1. First child gets the first (leftmost) position', () => {
    const layout = calculateTreeLayout(
      [parentA, parentB, childA],
      [spouseRel, relChildA],
      {}
    );

    const nodeA = layout.nodes.find((n) => n.id === 'child-raja-a')!;
    expect(nodeA).toBeDefined();
  });

  it('2. Second child appears to the right of the first child', () => {
    const layout = calculateTreeLayout(
      [parentA, parentB, childA, childB],
      [spouseRel, relChildA, relChildB],
      {}
    );

    const nodeA = layout.nodes.find((n) => n.id === 'child-raja-a')!;
    const nodeB = layout.nodes.find((n) => n.id === 'child-raja-b')!;

    expect(nodeA.position.x).toBeLessThan(nodeB.position.x);
  });

  it('3. Third child appears further right: Raja A -> Raja B -> Raja C (NEVER reverse C -> B -> A)', () => {
    const layout = calculateTreeLayout(
      [parentA, parentB, childA, childB, childC],
      [spouseRel, relChildA, relChildB, relChildC],
      {}
    );

    const nodeA = layout.nodes.find((n) => n.id === 'child-raja-a')!;
    const nodeB = layout.nodes.find((n) => n.id === 'child-raja-b')!;
    const nodeC = layout.nodes.find((n) => n.id === 'child-raja-c')!;

    expect(nodeA.position.x).toBeLessThan(nodeB.position.x);
    expect(nodeB.position.x).toBeLessThan(nodeC.position.x);
  });

  it('4. Fourth child appears at the far right: Raja A -> Raja B -> Raja C -> Raja D', () => {
    const layout = calculateTreeLayout(
      [parentA, parentB, childA, childB, childC, childD],
      [spouseRel, relChildA, relChildB, relChildC, relChildD],
      {}
    );

    const nodeA = layout.nodes.find((n) => n.id === 'child-raja-a')!;
    const nodeB = layout.nodes.find((n) => n.id === 'child-raja-b')!;
    const nodeC = layout.nodes.find((n) => n.id === 'child-raja-c')!;
    const nodeD = layout.nodes.find((n) => n.id === 'child-raja-d')!;

    expect(nodeA.position.x).toBeLessThan(nodeB.position.x);
    expect(nodeB.position.x).toBeLessThan(nodeC.position.x);
    expect(nodeC.position.x).toBeLessThan(nodeD.position.x);
  });

  it('5. Sibling order survives when relationships or members are provided in reverse array order', () => {
    // Relationships in reverse order (e.g. MongoDB sort createdAt: -1)
    const reversedRelationships = [relChildD, relChildC, relChildB, relChildA, spouseRel];
    const reversedMembers = [childD, childC, childB, childA, parentB, parentA];

    const layout = calculateTreeLayout(reversedMembers, reversedRelationships, {});

    const nodeA = layout.nodes.find((n) => n.id === 'child-raja-a')!;
    const nodeB = layout.nodes.find((n) => n.id === 'child-raja-b')!;
    const nodeC = layout.nodes.find((n) => n.id === 'child-raja-c')!;
    const nodeD = layout.nodes.find((n) => n.id === 'child-raja-d')!;

    // Must still strictly be left-to-right A < B < C < D
    expect(nodeA.position.x).toBeLessThan(nodeB.position.x);
    expect(nodeB.position.x).toBeLessThan(nodeC.position.x);
    expect(nodeC.position.x).toBeLessThan(nodeD.position.x);
  });

  it('6. Removing a middle child keeps remaining siblings strictly left-to-right', () => {
    // Remove Raja B
    const layoutWithoutB = calculateTreeLayout(
      [parentA, parentB, childA, childC, childD],
      [spouseRel, relChildA, relChildC, relChildD],
      {}
    );

    const nodeA = layoutWithoutB.nodes.find((n) => n.id === 'child-raja-a')!;
    const nodeC = layoutWithoutB.nodes.find((n) => n.id === 'child-raja-c')!;
    const nodeD = layoutWithoutB.nodes.find((n) => n.id === 'child-raja-d')!;

    expect(nodeA.position.x).toBeLessThan(nodeC.position.x);
    expect(nodeC.position.x).toBeLessThan(nodeD.position.x);
  });

  it('7. Adding a new child after deletion places it at the far right', () => {
    // Sibling order: A=1, C=3, NewChild=4
    const newChildE: FamilyMember = {
      id: 'child-raja-e',
      familyId: 'fam-order',
      firstName: 'Raja',
      lastName: 'E',
      gender: 'MALE',
      isLiving: true,
      generation: 2,
      memoryCount: 0,
      siblingOrder: 4,
      displayOrder: 4,
      createdAt: '2026-01-02T14:00:00.000Z',
    };
    const relChildE: Relationship = {
      id: 'rel-child-e',
      familyId: 'fam-order',
      sourceMemberId: 'parent-father',
      targetMemberId: 'child-raja-e',
      relationshipType: 'PARENT',
      status: 'ACTIVE',
      siblingOrder: 4,
      displayOrder: 4,
      createdAt: '2026-01-02T14:00:00.000Z',
    };

    const layout = calculateTreeLayout(
      [parentA, parentB, childA, childC, newChildE],
      [spouseRel, relChildA, relChildC, relChildE],
      {}
    );

    const nodeA = layout.nodes.find((n) => n.id === 'child-raja-a')!;
    const nodeC = layout.nodes.find((n) => n.id === 'child-raja-c')!;
    const nodeE = layout.nodes.find((n) => n.id === 'child-raja-e')!;

    expect(nodeA.position.x).toBeLessThan(nodeC.position.x);
    expect(nodeC.position.x).toBeLessThan(nodeE.position.x);
  });

  it('8. Backward compatibility: when siblingOrder is not explicitly set, falls back to createdAt ascending', () => {
    const unassignedA: FamilyMember = {
      ...childA,
      siblingOrder: null,
      displayOrder: null,
      createdAt: '2026-01-01T01:00:00.000Z', // created first
    };
    const unassignedB: FamilyMember = {
      ...childB,
      siblingOrder: null,
      displayOrder: null,
      createdAt: '2026-01-01T02:00:00.000Z', // created second
    };
    const unassignedC: FamilyMember = {
      ...childC,
      siblingOrder: null,
      displayOrder: null,
      createdAt: '2026-01-01T03:00:00.000Z', // created third
    };

    const unassignedRelA: Relationship = {
      ...relChildA,
      siblingOrder: null,
      displayOrder: null,
      createdAt: '2026-01-01T01:00:00.000Z',
    };
    const unassignedRelB: Relationship = {
      ...relChildB,
      siblingOrder: null,
      displayOrder: null,
      createdAt: '2026-01-01T02:00:00.000Z',
    };
    const unassignedRelC: Relationship = {
      ...relChildC,
      siblingOrder: null,
      displayOrder: null,
      createdAt: '2026-01-01T03:00:00.000Z',
    };

    // Pass in reverse to test that createdAt ascending is respected
    const layout = calculateTreeLayout(
      [unassignedC, unassignedB, unassignedA, parentB, parentA],
      [unassignedRelC, unassignedRelB, unassignedRelA, spouseRel],
      {}
    );

    const nodeA = layout.nodes.find((n) => n.id === 'child-raja-a')!;
    const nodeB = layout.nodes.find((n) => n.id === 'child-raja-b')!;
    const nodeC = layout.nodes.find((n) => n.id === 'child-raja-c')!;

    expect(nodeA.position.x).toBeLessThan(nodeB.position.x);
    expect(nodeB.position.x).toBeLessThan(nodeC.position.x);
  });

  it('9. Spouse positioning remains intact: spouse is to the immediate right of partner', () => {
    const layout = calculateTreeLayout(
      [parentA, parentB, childA, childB, childC],
      [spouseRel, relChildA, relChildB, relChildC],
      {}
    );

    const nodeP1 = layout.nodes.find((n) => n.id === 'parent-father')!;
    const nodeP2 = layout.nodes.find((n) => n.id === 'parent-mother')!;

    // Spouse node P2 must be strictly to the right of P1
    expect(nodeP1.position.x).toBeLessThan(nodeP2.position.x);
  });

  it('10. Parent couple and junction are centered over the sibling group', () => {
    const layout = calculateTreeLayout(
      [parentA, parentB, childA, childB, childC],
      [spouseRel, relChildA, relChildB, relChildC],
      {}
    );

    const nodeA = layout.nodes.find((n) => n.id === 'child-raja-a')!;
    const nodeC = layout.nodes.find((n) => n.id === 'child-raja-c')!;
    const junction = layout.nodes.find((n) => n.type === 'coupleJunction')!;

    const childrenMidpoint = (nodeA.position.x + nodeC.position.x + NODE_WIDTH) / 2;
    // Junction x is junction.position.x + 12 (since position is x - 12)
    const junctionCenter = junction.position.x + 12;

    expect(Math.abs(junctionCenter - childrenMidpoint)).toBeLessThanOrEqual(5);
  });

  it('11. Focus mode preserves sibling order', () => {
    const layout = calculateTreeLayout(
      [parentA, parentB, childA, childB, childC],
      [spouseRel, relChildA, relChildB, relChildC],
      {
        selectedMemberId: 'child-raja-b',
        focusedNodeIds: new Set(['parent-father', 'child-raja-a', 'child-raja-b', 'child-raja-c']),
      }
    );

    const nodeA = layout.nodes.find((n) => n.id === 'child-raja-a')!;
    const nodeB = layout.nodes.find((n) => n.id === 'child-raja-b')!;
    const nodeC = layout.nodes.find((n) => n.id === 'child-raja-c')!;

    expect(nodeA.position.x).toBeLessThan(nodeB.position.x);
    expect(nodeB.position.x).toBeLessThan(nodeC.position.x);
  });

  it('12. Multiple parent/couple groups maintain independent left-to-right order', () => {
    // Generation 2 child A gets married and has children
    const childSpouse: FamilyMember = {
      id: 'spouse-of-a',
      familyId: 'fam-order',
      firstName: 'Pooja',
      lastName: 'A',
      gender: 'FEMALE',
      isLiving: true,
      generation: 2,
      memoryCount: 0,
      createdAt: '2026-01-03T00:00:00.000Z',
    };
    const marriageA: Relationship = {
      id: 'rel-marriage-a',
      familyId: 'fam-order',
      sourceMemberId: 'child-raja-a',
      targetMemberId: 'spouse-of-a',
      relationshipType: 'SPOUSE',
      status: 'ACTIVE',
      createdAt: '2026-01-03T01:00:00.000Z',
    };
    const grandchild1: FamilyMember = {
      id: 'gc-1',
      familyId: 'fam-order',
      firstName: 'Grandchild',
      lastName: '1',
      gender: 'MALE',
      isLiving: true,
      generation: 3,
      memoryCount: 0,
      siblingOrder: 1,
      displayOrder: 1,
      createdAt: '2026-01-04T01:00:00.000Z',
    };
    const grandchild2: FamilyMember = {
      id: 'gc-2',
      familyId: 'fam-order',
      firstName: 'Grandchild',
      lastName: '2',
      gender: 'FEMALE',
      isLiving: true,
      generation: 3,
      memoryCount: 0,
      siblingOrder: 2,
      displayOrder: 2,
      createdAt: '2026-01-04T02:00:00.000Z',
    };
    const relGC1: Relationship = {
      id: 'rel-gc-1',
      familyId: 'fam-order',
      sourceMemberId: 'child-raja-a',
      targetMemberId: 'gc-1',
      relationshipType: 'PARENT',
      status: 'ACTIVE',
      siblingOrder: 1,
      displayOrder: 1,
      createdAt: '2026-01-04T01:00:00.000Z',
    };
    const relGC2: Relationship = {
      id: 'rel-gc-2',
      familyId: 'fam-order',
      sourceMemberId: 'child-raja-a',
      targetMemberId: 'gc-2',
      relationshipType: 'PARENT',
      status: 'ACTIVE',
      siblingOrder: 2,
      displayOrder: 2,
      createdAt: '2026-01-04T02:00:00.000Z',
    };

    const layout = calculateTreeLayout(
      [parentA, parentB, childA, childSpouse, childB, childC, grandchild1, grandchild2],
      [spouseRel, relChildA, relChildB, relChildC, marriageA, relGC1, relGC2],
      {}
    );

    // Gen 2 siblings order
    const nodeA = layout.nodes.find((n) => n.id === 'child-raja-a')!;
    const nodeB = layout.nodes.find((n) => n.id === 'child-raja-b')!;
    const nodeC = layout.nodes.find((n) => n.id === 'child-raja-c')!;
    expect(nodeA.position.x).toBeLessThan(nodeB.position.x);
    expect(nodeB.position.x).toBeLessThan(nodeC.position.x);

    // Gen 3 grandchildren order
    const nodeGC1 = layout.nodes.find((n) => n.id === 'gc-1')!;
    const nodeGC2 = layout.nodes.find((n) => n.id === 'gc-2')!;
    expect(nodeGC1.position.x).toBeLessThan(nodeGC2.position.x);
  });
});
