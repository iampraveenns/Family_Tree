import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';
import {
  calculateTreeLayout,
  NODE_WIDTH,
  NODE_HEIGHT,
  SPOUSE_GAP,
  SIBLING_GAP,
  FAMILY_GAP,
  GENERATION_GAP,
} from '../src/utils/treeLayout.ts';
import { FamilyMember, Relationship } from '../src/types/index.ts';

const app = createApp();

function makeMember(
  id: string,
  firstName: string,
  lastName: string,
  generation = 1,
  branchId?: string,
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN' = 'MALE'
): FamilyMember {
  return {
    id,
    familyId: 'fam-p33',
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    generation,
    branchId,
    gender,
    isLiving: true,
    memoryCount: 0,
  };
}

describe('PHASE 33 — Auto-Layout & Relationship-Aware Member Creation Suite', () => {
  let familyId: string;
  let isolatedFamilyId: string;
  let unmarriedFatherId: string;
  let marriedFatherId: string;
  let motherSpouseId: string;
  let childId: string;

  beforeAll(async () => {
    await database.connect();

    // Primary Family
    const fRes = await request(app).post('/api/families').send({
      name: 'Phase 33 Lineage Clan',
      description: 'Testing couple-centered layout and marriage-required child creation',
    });
    expect(fRes.status).toBe(201);
    familyId = fRes.body.data._id || fRes.body.data.id;

    // Isolated Family for cross-boundary tests
    const isoRes = await request(app).post('/api/families').send({
      name: 'Isolated Clan',
      description: 'Isolation checking',
    });
    isolatedFamilyId = isoRes.body.data._id || isoRes.body.data.id;
  }, 15000);

  afterAll(async () => {
    await database.disconnect();
  });

  describe('Part 1: Tree Layout Engine — Family Units, Subtrees & Multi-Generation Alignment', () => {
    it('1.1: Single couple layout unit (same Y, consistent SPOUSE_GAP, centered junction)', () => {
      const p1 = makeMember('p1', 'Father', 'Pattara', 1, undefined, 'MALE');
      const p2 = makeMember('p2', 'Mother', 'Pattara', 1, undefined, 'FEMALE');
      const rels: Relationship[] = [
        {
          id: 'r-spouse-1',
          familyId: 'fam-p33',
          sourceMemberId: 'p1',
          targetMemberId: 'p2',
          relationshipType: 'SPOUSE',
          status: 'ACTIVE',
          createdAt: '',
        },
      ];

      const result = calculateTreeLayout([p1, p2], rels);
      expect(result.generationCount).toBe(1);

      const n1 = result.nodes.find((n) => n.id === 'p1')!;
      const n2 = result.nodes.find((n) => n.id === 'p2')!;
      const junction = result.nodes.find((n) => n.type === 'coupleJunction')!;

      // Same generation Y
      expect(n1.position.y).toBe(n2.position.y);

      // Consistent horizontal gap
      expect(n2.position.x - n1.position.x).toBe(NODE_WIDTH + SPOUSE_GAP);

      // Couple width calculated as a single family unit
      const coupleUnitWidth = 2 * NODE_WIDTH + SPOUSE_GAP;
      expect(n2.position.x + NODE_WIDTH - n1.position.x).toBe(coupleUnitWidth);

      // Centered union connector junction directly between spouses
      const coupleCenter = (n1.position.x + n2.position.x + NODE_WIDTH) / 2;
      expect(junction.position.x + 12).toBe(coupleCenter);
    });

    it('1.2: One child centered directly below the couple', () => {
      const p1 = makeMember('p1', 'Father', 'Pattara', 1, undefined, 'MALE');
      const p2 = makeMember('p2', 'Mother', 'Pattara', 1, undefined, 'FEMALE');
      const c1 = makeMember('c1', 'OnlyChild', 'Pattara', 2, undefined, 'MALE');

      const rels: Relationship[] = [
        { id: 'r1', familyId: 'f', sourceMemberId: 'p1', targetMemberId: 'p2', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
        { id: 'r2', familyId: 'f', sourceMemberId: 'p1', targetMemberId: 'c1', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
      ];

      const result = calculateTreeLayout([p1, p2, c1], rels);
      expect(result.generationCount).toBe(2);

      const n1 = result.nodes.find((n) => n.id === 'p1')!;
      const n2 = result.nodes.find((n) => n.id === 'p2')!;
      const childNode = result.nodes.find((n) => n.id === 'c1')!;
      const junction = result.nodes.find((n) => n.type === 'coupleJunction')!;

      const coupleCenter = (n1.position.x + n2.position.x + NODE_WIDTH) / 2;
      const childCenter = childNode.position.x + NODE_WIDTH / 2;

      // Single child center matches couple junction center
      expect(Math.abs(childCenter - coupleCenter)).toBeLessThanOrEqual(2);
      expect(Math.abs(childCenter - (junction.position.x + 12))).toBeLessThanOrEqual(2);

      // Child Y is strictly at generation 2
      expect(childNode.position.y - n1.position.y).toBe(GENERATION_GAP);
    });

    it('1.3: Multiple children evenly distributed around couple center', () => {
      const p1 = makeMember('p1', 'Father', 'Pattara', 1);
      const p2 = makeMember('p2', 'Mother', 'Pattara', 1);
      const c1 = makeMember('c1', 'Child1', 'Pattara', 2);
      const c2 = makeMember('c2', 'Child2', 'Pattara', 2);
      const c3 = makeMember('c3', 'Child3', 'Pattara', 2);

      const rels: Relationship[] = [
        { id: 'r0', familyId: 'f', sourceMemberId: 'p1', targetMemberId: 'p2', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
        { id: 'r1', familyId: 'f', sourceMemberId: 'p1', targetMemberId: 'c1', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
        { id: 'r2', familyId: 'f', sourceMemberId: 'p1', targetMemberId: 'c2', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
        { id: 'r3', familyId: 'f', sourceMemberId: 'p1', targetMemberId: 'c3', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
      ];

      const result = calculateTreeLayout([p1, p2, c1, c2, c3], rels);

      const n1 = result.nodes.find((n) => n.id === 'p1')!;
      const n2 = result.nodes.find((n) => n.id === 'p2')!;
      const nc1 = result.nodes.find((n) => n.id === 'c1')!;
      const nc2 = result.nodes.find((n) => n.id === 'c2')!;
      const nc3 = result.nodes.find((n) => n.id === 'c3')!;

      // Children have uniform SIBLING_GAP between them
      expect(nc2.position.x - (nc1.position.x + NODE_WIDTH)).toBe(SIBLING_GAP);
      expect(nc3.position.x - (nc2.position.x + NODE_WIDTH)).toBe(SIBLING_GAP);

      // Children group center is aligned with parent couple center
      const coupleCenter = (n1.position.x + n2.position.x + NODE_WIDTH) / 2;
      const childrenGroupCenter = (nc1.position.x + nc3.position.x + NODE_WIDTH) / 2;
      expect(Math.abs(childrenGroupCenter - coupleCenter)).toBeLessThanOrEqual(2);

      // Middle child nc2 is directly centered below the couple
      expect(Math.abs(nc2.position.x + NODE_WIDTH / 2 - coupleCenter)).toBeLessThanOrEqual(2);
    });

    it('1.4: Multi-generation alignment maintains strict generation rows', () => {
      const g1p1 = makeMember('g1-p1', 'A', 'Pattara', 1);
      const g1p2 = makeMember('g1-p2', 'B', 'Pattara', 1);
      const g2p1 = makeMember('g2-p1', 'C', 'Pattara', 2);
      const g2p2 = makeMember('g2-p2', 'D', 'Pattara', 2);
      const g2single = makeMember('g2-single', 'E', 'Pattara', 2);
      const g3c1 = makeMember('g3-c1', 'F', 'Pattara', 3);
      const g3c2 = makeMember('g3-c2', 'G', 'Pattara', 3);
      const g3c3 = makeMember('g3-c3', 'H', 'Pattara', 3);

      const rels: Relationship[] = [
        { id: 'r1', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'g1-p2', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
        { id: 'r2', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'g2-p1', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
        { id: 'r3', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'g2-single', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
        { id: 'r4', familyId: 'f', sourceMemberId: 'g2-p1', targetMemberId: 'g2-p2', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
        { id: 'r5', familyId: 'f', sourceMemberId: 'g2-p1', targetMemberId: 'g3-c1', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
        { id: 'r6', familyId: 'f', sourceMemberId: 'g2-p1', targetMemberId: 'g3-c2', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
        { id: 'r7', familyId: 'f', sourceMemberId: 'g2-single', targetMemberId: 'g3-c3', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
      ];

      const result = calculateTreeLayout(
        [g1p1, g1p2, g2p1, g2p2, g2single, g3c1, g3c2, g3c3],
        rels
      );

      // Verify all Gen 1 nodes have exact same Y
      const gen1Nodes = result.nodes.filter((n) => n.id === 'g1-p1' || n.id === 'g1-p2');
      expect(gen1Nodes[0].position.y).toBe(gen1Nodes[1].position.y);

      // Verify all Gen 2 nodes have exact same Y
      const gen2Nodes = result.nodes.filter((n) => n.id.startsWith('g2-'));
      expect(gen2Nodes.every((n) => n.position.y === gen2Nodes[0].position.y)).toBe(true);

      // Verify all Gen 3 nodes have exact same Y
      const gen3Nodes = result.nodes.filter((n) => n.id.startsWith('g3-'));
      expect(gen3Nodes.every((n) => n.position.y === gen3Nodes[0].position.y)).toBe(true);

      // Gen 2 is at GENERATION_GAP below Gen 1
      expect(gen2Nodes[0].position.y - gen1Nodes[0].position.y).toBe(GENERATION_GAP);
      // Gen 3 is at GENERATION_GAP below Gen 2
      expect(gen3Nodes[0].position.y - gen2Nodes[0].position.y).toBe(GENERATION_GAP);
    });

    it('1.5: Subtree width calculation prevents excessive width and avoids overlap', () => {
      const g1p1 = makeMember('g1-p1', 'Root1', 'Pattara', 1);
      const g1p2 = makeMember('g1-p2', 'Root2', 'Pattara', 1);

      // Branch A couple with 2 children
      const b1 = makeMember('b1', 'ChildA', 'Pattara', 2, 'branch-a');
      const b1Spouse = makeMember('b1-spouse', 'SpouseA', 'Pattara', 2, 'branch-a');
      const b1c1 = makeMember('b1-c1', 'GrandChildA1', 'Pattara', 3, 'branch-a');
      const b1c2 = makeMember('b1-c2', 'GrandChildA2', 'Pattara', 3, 'branch-a');

      // Branch B couple with 2 children
      const b2 = makeMember('b2', 'ChildB', 'Pattara', 2, 'branch-b');
      const b2Spouse = makeMember('b2-spouse', 'SpouseB', 'Pattara', 2, 'branch-b');
      const b2c1 = makeMember('b2-c1', 'GrandChildB1', 'Pattara', 3, 'branch-b');
      const b2c2 = makeMember('b2-c2', 'GrandChildB2', 'Pattara', 3, 'branch-b');

      const rels: Relationship[] = [
        { id: 'r0', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'g1-p2', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
        { id: 'r1', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'b1', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
        { id: 'r2', familyId: 'f', sourceMemberId: 'g1-p1', targetMemberId: 'b2', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
        { id: 'r3', familyId: 'f', sourceMemberId: 'b1', targetMemberId: 'b1-spouse', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
        { id: 'r4', familyId: 'f', sourceMemberId: 'b2', targetMemberId: 'b2-spouse', relationshipType: 'SPOUSE', status: 'ACTIVE', createdAt: '' },
        { id: 'r5', familyId: 'f', sourceMemberId: 'b1', targetMemberId: 'b1c1', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
        { id: 'r6', familyId: 'f', sourceMemberId: 'b1', targetMemberId: 'b1c2', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
        { id: 'r7', familyId: 'f', sourceMemberId: 'b2', targetMemberId: 'b2c1', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
        { id: 'r8', familyId: 'f', sourceMemberId: 'b2', targetMemberId: 'b2c2', relationshipType: 'PARENT', status: 'ACTIVE', createdAt: '' },
      ];

      const result = calculateTreeLayout(
        [g1p1, g1p2, b1, b1Spouse, b1c1, b1c2, b2, b2Spouse, b2c1, b2c2],
        rels
      );

      // Verify no member nodes overlap in any generation
      const memberNodes = result.nodes.filter((n) => n.type === 'heritageMember');
      for (let i = 0; i < memberNodes.length; i++) {
        for (let j = i + 1; j < memberNodes.length; j++) {
          const a = memberNodes[i];
          const b = memberNodes[j];
          if (a.position.y === b.position.y) {
            const minX = Math.min(a.position.x, b.position.x);
            const maxX = Math.max(a.position.x, b.position.x);
            expect(maxX - minX).toBeGreaterThanOrEqual(NODE_WIDTH);
          }
        }
      }

      // Check hasSpouse prop on nodes
      const b1Node = result.nodes.find((n) => n.id === 'b1')!;
      expect(b1Node.data.hasSpouse).toBe(true);

      const b1c1Node = result.nodes.find((n) => n.id === 'b1-c1')!;
      expect(b1c1Node.data.hasSpouse).toBe(false);
    });
  });

  describe('Part 2: Business Rule — Child Requires Spouse (API & Graph Validation)', () => {
    it('2.1: Sets up an unmarried member and rejects creating child directly without a spouse', async () => {
      // Create unmarried father
      const resM = await request(app)
        .post(`/api/families/${familyId}/members`)
        .send({
          firstName: 'UnmarriedFather',
          lastName: 'Pattara',
          gender: 'MALE',
          generation: 1,
        });
      expect(resM.status).toBe(201);
      unmarriedFatherId = resM.body.data._id || resM.body.data.id;

      // Create prospective child
      const resC = await request(app)
        .post(`/api/families/${familyId}/members`)
        .send({
          firstName: 'ProspectiveChild',
          lastName: 'Pattara',
          gender: 'MALE',
          generation: 2,
        });
      expect(resC.status).toBe(201);
      childId = resC.body.data._id || resC.body.data.id;

      // Try adding child to unmarried member -> MUST FAIL with 400 validation error
      const failRelRes = await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .send({
          sourceMemberId: unmarriedFatherId,
          targetMemberId: childId,
          relationshipType: 'PARENT',
        });

      expect(failRelRes.status).toBe(400);
      expect(failRelRes.body.success).toBe(false);
      expect(failRelRes.body.message).toMatch(/spouse/i);
    });

    it('2.2: Rejects inverse CHILD relationship if target parent has no spouse', async () => {
      const failInverse = await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .send({
          sourceMemberId: childId,
          targetMemberId: unmarriedFatherId,
          relationshipType: 'CHILD',
        });

      expect(failInverse.status).toBe(400);
      expect(failInverse.body.success).toBe(false);
      expect(failInverse.body.message).toMatch(/spouse/i);
    });

    it('2.3: Allows adding child once the parent has a valid registered spouse', async () => {
      // 1. Create married father
      const fRes = await request(app)
        .post(`/api/families/${familyId}/members`)
        .send({
          firstName: 'MarriedFather',
          lastName: 'Pattara',
          gender: 'MALE',
          generation: 1,
        });
      expect(fRes.status).toBe(201);
      marriedFatherId = fRes.body.data._id || fRes.body.data.id;

      // 2. Create spouse (Mother)
      const mRes = await request(app)
        .post(`/api/families/${familyId}/members`)
        .send({
          firstName: 'MotherSpouse',
          lastName: 'Pattara',
          gender: 'FEMALE',
          generation: 1,
        });
      expect(mRes.status).toBe(201);
      motherSpouseId = mRes.body.data._id || mRes.body.data.id;

      // 3. Connect as SPOUSE
      const spouseRel = await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .send({
          sourceMemberId: marriedFatherId,
          targetMemberId: motherSpouseId,
          relationshipType: 'SPOUSE',
        });
      expect(spouseRel.status).toBe(201);
      expect(spouseRel.body.success).toBe(true);

      // 4. Now connect child -> MUST SUCCEED (201)
      const childRel = await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .send({
          sourceMemberId: marriedFatherId,
          targetMemberId: childId,
          relationshipType: 'PARENT',
        });

      expect(childRel.status).toBe(201);
      expect(childRel.body.success).toBe(true);
    });

    it('2.4: Prevents cross-family relationship creation', async () => {
      const crossRel = await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .send({
          sourceMemberId: marriedFatherId,
          targetMemberId: isolatedFamilyId, // Invalid ID in this family
          relationshipType: 'PARENT',
        });

      expect(crossRel.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Part 3: Spouse Gender Auto-Detection & Form Rules', () => {
    it('3.1: Auto-detection logic: Male -> Female, Female -> Male, Unknown -> Neutral', () => {
      // Helper function that mirrors the form default logic
      const getInitialSpouseGender = (refMember?: FamilyMember | null) => {
        if (!refMember) return 'MALE';
        if (refMember.gender === 'MALE') return 'FEMALE';
        if (refMember.gender === 'FEMALE') return 'MALE';
        return 'UNKNOWN';
      };

      const maleMember = makeMember('m1', 'Kumar', 'Pattara', 1, undefined, 'MALE');
      expect(getInitialSpouseGender(maleMember)).toBe('FEMALE');

      const femaleMember = makeMember('f1', 'Lakshmi', 'Pattara', 1, undefined, 'FEMALE');
      expect(getInitialSpouseGender(femaleMember)).toBe('MALE');

      const neutralMember = makeMember('o1', 'Alex', 'Pattara', 1, undefined, 'OTHER');
      expect(getInitialSpouseGender(neutralMember)).toBe('UNKNOWN');

      const unknownMember = makeMember('u1', 'Sam', 'Pattara', 1, undefined, 'UNKNOWN');
      expect(getInitialSpouseGender(unknownMember)).toBe('UNKNOWN');
    });
  });

  describe('Part 4: Starter Nodes & Regression Guard', () => {
    it('4.1: Empty family (0 members) renders starter nodes with ⚭ connector', () => {
      const result = calculateTreeLayout([], []);
      expect(result.nodes.length).toBe(2);

      const starterMember = result.nodes.find((n) => n.id === 'starter-member')!;
      const starterSpouse = result.nodes.find((n) => n.id === 'starter-spouse')!;
      expect(starterMember).toBeDefined();
      expect(starterSpouse).toBeDefined();

      const starterEdge = result.edges.find((e) => e.id === 'edge-starter-couple')!;
      expect(starterEdge).toBeDefined();
      expect(starterEdge.label).toBe('⚭');
    });

    it('4.2: Single member with no spouse renders real member + starter spouse', () => {
      const m1 = makeMember('real-root', 'Anand', 'Pattara', 1);
      const result = calculateTreeLayout([m1], []);

      const realNode = result.nodes.find((n) => n.id === 'real-root')!;
      const starterSpouse = result.nodes.find((n) => n.id === 'starter-spouse')!;
      expect(realNode).toBeDefined();
      expect(starterSpouse).toBeDefined();

      const edge = result.edges[0];
      expect(edge.source).toBe('real-root');
      expect(edge.target).toBe('starter-spouse');
      expect(edge.label).toBe('⚭');
    });
  });
});
