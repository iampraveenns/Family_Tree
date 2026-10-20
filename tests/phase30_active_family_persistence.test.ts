import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';
import { STORAGE_ACTIVE_FAMILY_KEY } from '../src/stores/useFamilyStore.ts';

const app = createApp();

describe('Phase 30 — Active Family Vault & Member Persistence', () => {
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let familyAId: string;
  let familyBId: string;
  let rootMemberId: string;
  let spouseMemberId: string;
  let childMemberId: string;

  beforeAll(async () => {
    await database.connect();

    // 1. Register User A
    const regResA = await request(app).post('/api/auth/register').send({
      displayName: 'Kumar Varma',
      email: `kumar.varma.${Date.now()}@example.com`,
      password: 'Password123!',
    });
    expect(regResA.status).toBe(201);
    userAToken = regResA.body.data.accessToken;
    userAId = regResA.body.data.user.id;

    // 2. Register User B
    const regResB = await request(app).post('/api/auth/register').send({
      displayName: 'Anita Roy',
      email: `anita.roy.${Date.now()}@example.com`,
      password: 'Password123!',
    });
    expect(regResB.status).toBe(201);
    userBToken = regResB.body.data.accessToken;
    userBId = regResB.body.data.user.id;
  }, 20000);

  afterAll(async () => {
    await database.disconnect();
  });

  describe('1. Family Vault Creation & Immediate Activation', () => {
    it('creates a new family vault for authenticated User A and attaches real id and _id', async () => {
      const res = await request(app)
        .post('/api/families')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          name: 'The Kumar Family',
          description: 'Ancestral heritage archive of the Kumar lineage',
          originPlace: 'Varanasi, India',
          motto: 'Connected by Roots, Thriving in Branches',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('The Kumar Family');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data._id).toBeDefined();
      expect(res.body.data.id).toBe(res.body.data._id);
      familyAId = res.body.data.id;
    });

    it('creates Family B for User B to test family isolation', async () => {
      const res = await request(app)
        .post('/api/families')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          name: 'The Roy Family',
          description: 'Private records of the Roy lineage',
        });

      expect(res.status).toBe(201);
      familyBId = res.body.data.id;
      expect(familyBId).toBeDefined();
      expect(familyBId).not.toBe(familyAId);
    });

    it('User A can retrieve their available families including The Kumar Family', async () => {
      const res = await request(app)
        .get('/api/families')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((f: any) => f.id === familyAId || f._id === familyAId);
      expect(found).toBeDefined();
      expect(found.name).toBe('The Kumar Family');
      expect(found.id).toBe(familyAId);
    });
  });

  describe('2. Member Creation in Active Family (Root Ancestor, Spouse, Child)', () => {
    it('creates root ancestor in The Kumar Family without errors', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/members`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          firstName: 'Ramesh',
          lastName: 'Kumar',
          gender: 'MALE',
          dateOfBirth: '1945-03-15',
          isLiving: false,
          deathDate: '2015-08-20',
          birthPlace: 'Varanasi, India',
          occupation: 'Professor of History',
          generation: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.firstName).toBe('Ramesh');
      expect(res.body.data.lastName).toBe('Kumar');
      expect(res.body.data.displayName).toBe('Ramesh Kumar');
      rootMemberId = res.body.data.id || res.body.data._id;
      expect(rootMemberId).toBeDefined();
    });

    it('creates spouse for Root Ancestor in The Kumar Family', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/members`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          firstName: 'Saraswati',
          lastName: 'Kumar',
          gender: 'FEMALE',
          dateOfBirth: '1948-06-10',
          isLiving: true,
          birthPlace: 'Lucknow, India',
          occupation: 'Author',
          generation: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      spouseMemberId = res.body.data.id || res.body.data._id;
      expect(spouseMemberId).toBeDefined();

      // Establish SPOUSE relationship
      const relRes = await request(app)
        .post(`/api/families/${familyAId}/relationships`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          sourceMemberId: rootMemberId,
          targetMemberId: spouseMemberId,
          relationshipType: 'SPOUSE',
        });

      expect(relRes.status).toBe(201);
      expect(relRes.body.success).toBe(true);
    });

    it('creates child in generation 2 linked to Root Ancestor', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/members`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          firstName: 'Vikram',
          lastName: 'Kumar',
          gender: 'MALE',
          dateOfBirth: '1975-09-22',
          isLiving: true,
          birthPlace: 'Varanasi, India',
          occupation: 'Architect',
          generation: 2,
        });

      expect(res.status).toBe(201);
      childMemberId = res.body.data.id || res.body.data._id;
      expect(childMemberId).toBeDefined();

      // Establish PARENT relationship
      const relRes = await request(app)
        .post(`/api/families/${familyAId}/relationships`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          sourceMemberId: rootMemberId,
          targetMemberId: childMemberId,
          relationshipType: 'PARENT',
        });

      expect(relRes.status).toBe(201);
      expect(relRes.body.success).toBe(true);
    });

    it('retrieves updated family tree with all nodes and connections', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/tree`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.family.id).toBe(familyAId);
      expect(res.body.data.members.length).toBe(3);
      expect(res.body.data.relationships.length).toBe(2);
    });
  });

  describe('3. Family Isolation & Cross-Family Protection', () => {
    it('User B cannot create a member inside User A family (Family A)', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/members`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          firstName: 'Intruder',
          lastName: 'Sneak',
          gender: 'MALE',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('User A cannot create a member inside User B family (Family B)', async () => {
      const res = await request(app)
        .post(`/api/families/${familyBId}/members`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          firstName: 'Intruder',
          lastName: 'Sneak',
          gender: 'MALE',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid non-existent family ID safely', async () => {
      const res = await request(app)
        .post('/api/families/000000000000000000000000/members')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          firstName: 'Ghost',
          lastName: 'Member',
          gender: 'MALE',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Active Family Resolution & Persistence Invariants', () => {
    it('verifies STORAGE_ACTIVE_FAMILY_KEY is the standard key', () => {
      expect(STORAGE_ACTIVE_FAMILY_KEY).toBe('familyroots_active_family_id');
    });

    it('verifies family switching: User B members only appear in Family B', async () => {
      const res = await request(app)
        .post(`/api/families/${familyBId}/members`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          firstName: 'Sunil',
          lastName: 'Roy',
          gender: 'MALE',
        });

      expect(res.status).toBe(201);

      // Verify Family A tree does not contain Sunil Roy
      const treeA = await request(app)
        .get(`/api/families/${familyAId}/tree`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(treeA.body.data.members.some((m: any) => m.lastName === 'Roy')).toBe(false);

      // Verify Family B tree does not contain Ramesh Kumar
      const treeB = await request(app)
        .get(`/api/families/${familyBId}/tree`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(treeB.body.data.members.some((m: any) => m.lastName === 'Kumar')).toBe(false);
    });
  });
});
