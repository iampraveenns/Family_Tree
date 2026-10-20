import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';

const app = createApp();

describe('FamilyRoots Domain & Relationship Engine', () => {
  let familyAId: string;
  let familyBId: string;
  let memberA1Id: string;
  let memberA2Id: string;
  let memberA3Id: string;
  let memberB1Id: string;
  let branchId: string;

  beforeAll(async () => {
    await database.connect();

    // Create Family A
    const resA = await request(app).post('/api/families').send({
      name: 'Test Family A',
      description: 'Primary testing family',
    });
    expect(resA.status).toBe(201);
    familyAId = resA.body.data._id;

    // Create Family B (to test cross-family protection)
    const resB = await request(app).post('/api/families').send({
      name: 'Test Family B',
      description: 'Isolated testing family',
    });
    expect(resB.status).toBe(201);
    familyBId = resB.body.data._id;
  }, 15000);

  afterAll(async () => {
    await database.disconnect();
  });

  describe('1. Member Lifecycle & Family Scoping', () => {
    it('creates family members in Family A', async () => {
      const res1 = await request(app)
        .post(`/api/families/${familyAId}/members`)
        .send({
          firstName: 'Anand',
          lastName: 'Pattara',
          gender: 'MALE',
          dateOfBirth: '1950-01-01',
          occupation: 'Historian',
        });
      expect(res1.status).toBe(201);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.displayName).toBe('Anand Pattara');
      memberA1Id = res1.body.data._id;

      const res2 = await request(app)
        .post(`/api/families/${familyAId}/members`)
        .send({
          firstName: 'Sita',
          lastName: 'Pattara',
          gender: 'FEMALE',
          dateOfBirth: '1955-05-15',
        });
      expect(res2.status).toBe(201);
      memberA2Id = res2.body.data._id;

      const res3 = await request(app)
        .post(`/api/families/${familyAId}/members`)
        .send({
          firstName: 'Dev',
          lastName: 'Pattara',
          gender: 'MALE',
          dateOfBirth: '1980-09-20',
        });
      expect(res3.status).toBe(201);
      memberA3Id = res3.body.data._id;
    });

    it('creates a member in Family B', async () => {
      const res = await request(app)
        .post(`/api/families/${familyBId}/members`)
        .send({
          firstName: 'Rohan',
          lastName: 'External',
          gender: 'MALE',
        });
      expect(res.status).toBe(201);
      memberB1Id = res.body.data._id;
    });

    it('retrieves members with pagination', async () => {
      const res = await request(app).get(`/api/families/${familyAId}/members?page=1&limit=2`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(3);
    });

    it('retrieves member details by ID', async () => {
      const res = await request(app).get(`/api/families/${familyAId}/members/${memberA1Id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('Anand');
    });

    it('rejects accessing a member of Family B under Family A URL', async () => {
      const res = await request(app).get(`/api/families/${familyAId}/members/${memberB1Id}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MEMBER_NOT_FOUND');
    });

    it('updates member details', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyAId}/members/${memberA1Id}`)
        .send({
          occupation: 'Emeritus Professor of Botany',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.occupation).toBe('Emeritus Professor of Botany');
    });
  });

  describe('2. Relationship Graph & Integrity Engine', () => {
    it('creates a SPOUSE relationship between Anand and Sita', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/relationships`)
        .send({
          sourceMemberId: memberA1Id,
          targetMemberId: memberA2Id,
          relationshipType: 'SPOUSE',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.relationshipType).toBe('SPOUSE');
    });

    it('creates a PARENT relationship: Anand -> Dev', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/relationships`)
        .send({
          sourceMemberId: memberA1Id,
          targetMemberId: memberA3Id,
          relationshipType: 'PARENT',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.relationshipType).toBe('PARENT');
    });

    it('creates a PARENT relationship: Sita -> Dev', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/relationships`)
        .send({
          sourceMemberId: memberA2Id,
          targetMemberId: memberA3Id,
          relationshipType: 'PARENT',
        });
      expect(res.status).toBe(201);
    });

    it('REJECTS self-relationship (source === target)', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/relationships`)
        .send({
          sourceMemberId: memberA1Id,
          targetMemberId: memberA1Id,
          relationshipType: 'PARENT',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('REJECTS cross-family relationships', async () => {
      // memberA1Id belongs to family A, memberB1Id belongs to family B
      const res = await request(app)
        .post(`/api/families/${familyAId}/relationships`)
        .send({
          sourceMemberId: memberA1Id,
          targetMemberId: memberB1Id,
          relationshipType: 'PARENT',
        });
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MEMBER_NOT_FOUND');
    });

    it('REJECTS duplicate symmetric SPOUSE relationship (Sita -> Anand)', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/relationships`)
        .send({
          sourceMemberId: memberA2Id,
          targetMemberId: memberA1Id,
          relationshipType: 'SPOUSE',
        });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DUPLICATE_ENTITY');
    });

    it('REJECTS duplicate directional PARENT relationship (Anand -> Dev)', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/relationships`)
        .send({
          sourceMemberId: memberA1Id,
          targetMemberId: memberA3Id,
          relationshipType: 'PARENT',
        });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DUPLICATE_ENTITY');
    });

    it('REJECTS circular parent-child relationship (Dev -> Anand as PARENT)', async () => {
      // Anand is already parent of Dev. Dev cannot become parent of Anand!
      const res = await request(app)
        .post(`/api/families/${familyAId}/relationships`)
        .send({
          sourceMemberId: memberA3Id,
          targetMemberId: memberA1Id,
          relationshipType: 'PARENT',
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/parent|circular|invalid/i);
    });

    it('retrieves member relationships', async () => {
      const res = await request(app).get(`/api/families/${familyAId}/members/${memberA1Id}/relationships`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2); // Spouse Sita, Child Dev
    });
  });

  describe('3. Branches API', () => {
    it('creates a family branch linked to a root member', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/branches`)
        .send({
          name: 'Dev Heritage Branch',
          description: 'Lineage descending through Dev Pattara',
          rootMemberId: memberA3Id,
          accentColor: '#059669',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Dev Heritage Branch');
      branchId = res.body.data._id;
    });

    it('retrieves branches for the family', async () => {
      const res = await request(app).get(`/api/families/${familyAId}/branches`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    it('updates branch details', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyAId}/branches/${branchId}`)
        .send({
          description: 'Updated branch description for testing',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Updated branch description for testing');
    });
  });

  describe('4. Normalized Tree API', () => {
    it('returns normalized tree data suitable for React Flow', async () => {
      const res = await request(app).get(`/api/families/${familyAId}/tree`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.family.id).toBe(familyAId);
      expect(res.body.data.members.length).toBe(3);
      expect(res.body.data.relationships.length).toBe(3);
      expect(res.body.data.branches.length).toBe(1);
    });
  });

  describe('5. Kinship API', () => {
    it('calculates kinship path for parent-child (Anand -> Dev)', async () => {
      const res = await request(app).get(`/api/families/${familyAId}/kinship/${memberA1Id}/${memberA3Id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.relationship).toBe('SON');
      expect(res.body.data.distance).toBe(1);
    });

    it('calculates kinship path for child-parent (Dev -> Anand)', async () => {
      const res = await request(app).get(`/api/families/${familyAId}/kinship/${memberA3Id}/${memberA1Id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.relationship).toBe('FATHER');
      expect(res.body.data.distance).toBe(1);
    });

    it('calculates kinship path for spouses (Anand <-> Sita)', async () => {
      const res = await request(app).get(`/api/families/${familyAId}/kinship/${memberA1Id}/${memberA2Id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.relationship).toBe('WIFE');
      expect(res.body.data.distance).toBe(1);
    });

    it('returns SELF when source equals target', async () => {
      const res = await request(app).get(`/api/families/${familyAId}/kinship/${memberA1Id}/${memberA1Id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.relationship).toBe('SELF');
      expect(res.body.data.distance).toBe(0);
    });
  });

  describe('6. Entity Deletions & Cascade Cleanup', () => {
    it('deletes branch without deleting root member', async () => {
      const res = await request(app).delete(`/api/families/${familyAId}/branches/${branchId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);

      // Verify root member still exists
      const memberRes = await request(app).get(`/api/families/${familyAId}/members/${memberA3Id}`);
      expect(memberRes.status).toBe(200);
      expect(memberRes.body.data.firstName).toBe('Dev');
    });

    it('deletes member and cascades removal of associated relationships', async () => {
      // Delete Dev (memberA3)
      const res = await request(app).delete(`/api/families/${familyAId}/members/${memberA3Id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);

      // Verify member is not found
      const getRes = await request(app).get(`/api/families/${familyAId}/members/${memberA3Id}`);
      expect(getRes.status).toBe(404);

      // Verify Anand's relationships no longer include Dev
      const relRes = await request(app).get(`/api/families/${familyAId}/members/${memberA1Id}/relationships`);
      expect(relRes.status).toBe(200);
      const remainingTargetIds = relRes.body.data.map((r: { sourceMemberId: string; targetMemberId: string }) =>
        r.sourceMemberId === memberA1Id ? r.targetMemberId : r.sourceMemberId
      );
      expect(remainingTargetIds).not.toContain(memberA3Id);
    });
  });
});
