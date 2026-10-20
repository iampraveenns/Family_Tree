import { describe, it, expect } from 'vitest';
import { calculateTreeLayout, isSecondarySpouse } from '../src/utils/treeLayout.ts';
import { FamilyMember, Relationship } from '../src/types/index.ts';

describe('Phase: Fix Spouse Node Action Buttons', () => {
  const raviPattara: FamilyMember = {
    id: 'ravi-pattara',
    familyId: 'fam-spouse-action',
    firstName: 'Ravi',
    lastName: 'Pattara',
    gender: 'MALE',
    isLiving: true,
    generation: 1,
    memoryCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const raniM: FamilyMember = {
    id: 'rani-m',
    familyId: 'fam-spouse-action',
    firstName: 'Rani',
    lastName: 'M',
    gender: 'FEMALE',
    isLiving: true,
    generation: 1,
    memoryCount: 1,
    createdAt: '2026-01-01T00:05:00.000Z',
  };

  const spouseRel: Relationship = {
    id: 'rel-ravi-rani',
    familyId: 'fam-spouse-action',
    sourceMemberId: 'ravi-pattara',
    targetMemberId: 'rani-m',
    relationshipType: 'SPOUSE',
    marriageDate: '2015-05-20',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:10:00.000Z',
  };

  it('1. Existing couple: left partner (Ravi) is primary partner, right partner (Rani) is secondary spouse', () => {
    const layout = calculateTreeLayout([raviPattara, raniM], [spouseRel], {});

    const raviNode = layout.nodes.find((n) => n.id === 'ravi-pattara')!;
    const raniNode = layout.nodes.find((n) => n.id === 'rani-m')!;

    expect(raviNode).toBeDefined();
    expect(raniNode).toBeDefined();

    // Ravi is on the LEFT, Rani is on the RIGHT
    expect(raviNode.position.x).toBeLessThan(raniNode.position.x);

    // Ravi (left/primary) has actions enabled
    expect(raviNode.data.isPrimaryPartner).toBe(true);
    expect(raviNode.data.isSecondarySpouse).toBe(false);
    expect(raviNode.data.hideRelationshipActions).toBe(false);

    // Rani (right/secondary) has relationship actions hidden
    expect(raniNode.data.isPrimaryPartner).toBe(false);
    expect(raniNode.data.isSecondarySpouse).toBe(true);
    expect(raniNode.data.hideRelationshipActions).toBe(true);
  });

  it('2. Helper function isSecondarySpouse correctly identifies secondary spouse', () => {
    expect(isSecondarySpouse('ravi-pattara', [raviPattara, raniM], [spouseRel])).toBe(false);
    expect(isSecondarySpouse('rani-m', [raviPattara, raniM], [spouseRel])).toBe(true);
  });

  it('3. Single / unmarried person displays relationship actions', () => {
    const singleMember: FamilyMember = {
      id: 'single-person',
      familyId: 'fam-spouse-action',
      firstName: 'Solo',
      lastName: 'User',
      gender: 'MALE',
      isLiving: true,
      generation: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const layout = calculateTreeLayout([singleMember], [], { disableStarterSpouse: true });
    const singleNode = layout.nodes.find((n) => n.id === 'single-person')!;

    expect(singleNode).toBeDefined();
    expect(singleNode.data.hasSpouse).toBe(false);
    expect(singleNode.data.isPrimaryPartner).toBe(true);
    expect(singleNode.data.isSecondarySpouse).toBe(false);
    expect(singleNode.data.hideRelationshipActions).toBe(false);
  });

  it('4. Gender neutrality: bloodline female partner is primary (left), added male spouse is secondary (right)', () => {
    const patriarch: FamilyMember = {
      id: 'patriarch-father',
      familyId: 'fam-spouse-action',
      firstName: 'Grandfather',
      lastName: 'Sharma',
      gender: 'MALE',
      isLiving: true,
      generation: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const daughter: FamilyMember = {
      id: 'daughter-maya',
      familyId: 'fam-spouse-action',
      firstName: 'Maya',
      lastName: 'Sharma',
      gender: 'FEMALE',
      isLiving: true,
      generation: 2,
      createdAt: '2026-01-02T00:00:00.000Z',
    };
    const husband: FamilyMember = {
      id: 'husband-john',
      familyId: 'fam-spouse-action',
      firstName: 'John',
      lastName: 'Smith',
      gender: 'MALE',
      isLiving: true,
      generation: 2,
      createdAt: '2026-01-02T05:00:00.000Z',
    };

    const parentChildRel: Relationship = {
      id: 'rel-pc',
      familyId: 'fam-spouse-action',
      sourceMemberId: 'patriarch-father',
      targetMemberId: 'daughter-maya',
      relationshipType: 'PARENT',
      createdAt: '2026-01-02T01:00:00.000Z',
    };

    const marriageRel: Relationship = {
      id: 'rel-maya-john',
      familyId: 'fam-spouse-action',
      sourceMemberId: 'daughter-maya',
      targetMemberId: 'husband-john',
      relationshipType: 'SPOUSE',
      status: 'ACTIVE',
      createdAt: '2026-01-02T06:00:00.000Z',
    };

    const layout = calculateTreeLayout([patriarch, daughter, husband], [parentChildRel, marriageRel], {});

    const mayaNode = layout.nodes.find((n) => n.id === 'daughter-maya')!;
    const johnNode = layout.nodes.find((n) => n.id === 'husband-john')!;

    // Maya (daughter in bloodline) is left, John (husband) is right
    expect(mayaNode.position.x).toBeLessThan(johnNode.position.x);

    // Maya is primary partner, John is secondary spouse
    expect(mayaNode.data.isPrimaryPartner).toBe(true);
    expect(mayaNode.data.isSecondarySpouse).toBe(false);
    expect(mayaNode.data.hideRelationshipActions).toBe(false);

    expect(johnNode.data.isPrimaryPartner).toBe(false);
    expect(johnNode.data.isSecondarySpouse).toBe(true);
    expect(johnNode.data.hideRelationshipActions).toBe(true);
  });

  it('5. Deceased person retains deterministic primary/secondary action flags', () => {
    const deceasedRavi: FamilyMember = {
      ...raviPattara,
      isLiving: false,
      dateOfDeath: '2020-01-01',
    };

    const layout = calculateTreeLayout([deceasedRavi, raniM], [spouseRel], {});
    const raviNode = layout.nodes.find((n) => n.id === 'ravi-pattara')!;
    const raniNode = layout.nodes.find((n) => n.id === 'rani-m')!;

    expect(raviNode.data.isPrimaryPartner).toBe(true);
    expect(raviNode.data.hideRelationshipActions).toBe(false);

    expect(raniNode.data.isPrimaryPartner).toBe(false);
    expect(raniNode.data.isSecondarySpouse).toBe(true);
    expect(raniNode.data.hideRelationshipActions).toBe(true);
  });

  it('6. Adding children maintains strict left-to-right sibling ordering with centered couple junction', () => {
    const child1: FamilyMember = {
      id: 'child-1',
      familyId: 'fam-spouse-action',
      firstName: 'Raja',
      lastName: 'A',
      gender: 'MALE',
      isLiving: true,
      generation: 2,
      siblingOrder: 1,
      displayOrder: 1,
      createdAt: '2026-01-03T01:00:00.000Z',
    };
    const child2: FamilyMember = {
      id: 'child-2',
      familyId: 'fam-spouse-action',
      firstName: 'Raja',
      lastName: 'B',
      gender: 'FEMALE',
      isLiving: true,
      generation: 2,
      siblingOrder: 2,
      displayOrder: 2,
      createdAt: '2026-01-03T02:00:00.000Z',
    };

    const relC1: Relationship = {
      id: 'rel-c1',
      familyId: 'fam-spouse-action',
      sourceMemberId: 'ravi-pattara',
      targetMemberId: 'child-1',
      relationshipType: 'PARENT',
      siblingOrder: 1,
      displayOrder: 1,
      createdAt: '2026-01-03T01:00:00.000Z',
    };
    const relC2: Relationship = {
      id: 'rel-c2',
      familyId: 'fam-spouse-action',
      sourceMemberId: 'ravi-pattara',
      targetMemberId: 'child-2',
      relationshipType: 'PARENT',
      siblingOrder: 2,
      displayOrder: 2,
      createdAt: '2026-01-03T02:00:00.000Z',
    };

    const layout = calculateTreeLayout(
      [raviPattara, raniM, child1, child2],
      [spouseRel, relC1, relC2],
      {}
    );

    const raviNode = layout.nodes.find((n) => n.id === 'ravi-pattara')!;
    const raniNode = layout.nodes.find((n) => n.id === 'rani-m')!;
    const c1Node = layout.nodes.find((n) => n.id === 'child-1')!;
    const c2Node = layout.nodes.find((n) => n.id === 'child-2')!;

    // Couple actions check
    expect(raviNode.data.hideRelationshipActions).toBe(false);
    expect(raniNode.data.hideRelationshipActions).toBe(true);

    // Sibling left-to-right ordering
    expect(c1Node.position.x).toBeLessThan(c2Node.position.x);
  });
});
