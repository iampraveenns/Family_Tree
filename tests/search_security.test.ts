import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';
import { MemoryType, MemoryVisibility, Role, RelationshipType } from '../server/src/constants/index.ts';

const app = createApp();

describe('Phase 8: Search Security, Privacy & Genealogy Exploration Tests', () => {
  let user1Token: string;
  let user1Id: string;

  let user2Token: string;
  let user2Id: string;

  let outsiderToken: string;
  let outsiderId: string;

  let familyAId: string;
  let familyBId: string;

  let branchA1Id: string;
  let branchA2Id: string;

  let memberA1Id: string; // Grandparent
  let memberA2Id: string; // Parent
  let memberA3Id: string; // Child
  let memberB1Id: string; // Member in Family B

  let publicMemoryId: string;
  let privateMemoryUser1Id: string;
  let branchMemoryId: string;

  beforeAll(async () => {
    await database.connect();

    // 1. Create User 1 (Owner of Family A)
    const reg1 = await request(app).post('/api/auth/register').send({
      email: 'search_owner@familyroots.test',
      password: 'SecurePassword123!',
      name: 'Search Owner',
    });
    user1Token = reg1.body.data.accessToken;
    user1Id = reg1.body.data.user.id || reg1.body.data.user._id;

    // 2. Create User 2 (Regular Member in Family A)
    const reg2 = await request(app).post('/api/auth/register').send({
      email: 'search_member@familyroots.test',
      password: 'SecurePassword123!',
      name: 'Search Member',
    });
    user2Token = reg2.body.data.accessToken;
    user2Id = reg2.body.data.user.id || reg2.body.data.user._id;

    // 3. Create Outsider User (Family B)
    const regOutsider = await request(app).post('/api/auth/register').send({
      email: 'search_outsider@familyroots.test',
      password: 'SecurePassword123!',
      name: 'Search Outsider',
    });
    outsiderToken = regOutsider.body.data.accessToken;
    outsiderId = regOutsider.body.data.user.id || regOutsider.body.data.user._id;

    // 4. Create Family A
    const famARes = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'The Hawthorne Family',
        description: 'Pioneering lineage of the northern territory',
      });
    familyAId = famARes.body.data._id || famARes.body.data.id;

    // Add User 2 as a MEMBER in Family A via real invitation flow
    const invMember = await request(app)
      .post(`/api/families/${familyAId}/memberships/invitations`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        email: 'search_member@familyroots.test',
        role: Role.MEMBER,
      });
    const inviteToken = invMember.body.data.rawToken;
    await request(app)
      .post('/api/families/invitations/accept')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ token: inviteToken });

    // 5. Create Family B (Outsider family)
    const famBRes = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        name: 'The Sterling Dynasty',
        description: 'Southern estates and archives',
      });
    familyBId = famBRes.body.data._id || famBRes.body.data.id;

    // 6. Populate Members in Family A first so we can assign rootMemberId to branches
    const m1Res = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        firstName: 'Arthur',
        lastName: 'Hawthorne',
        displayName: 'Arthur Hawthorne Sr.',
        gender: 'MALE',
        generation: 1,
        birthPlace: 'Portland, Maine',
        occupation: 'Master Shipbuilder',
        dateOfBirth: '1920-04-12',
        isLiving: false,
      });
    memberA1Id = m1Res.body.data._id || m1Res.body.data.id;

    const m2Res = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        firstName: 'Eleanor',
        lastName: 'Hawthorne',
        displayName: 'Eleanor Hawthorne',
        gender: 'FEMALE',
        generation: 2,
        birthPlace: 'Boston, Massachusetts',
        occupation: 'Architectural Historian',
        dateOfBirth: '1955-08-23',
        isLiving: true,
      });
    memberA2Id = m2Res.body.data._id || m2Res.body.data.id;

    const m3Res = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        firstName: 'Julian',
        lastName: 'Hawthorne',
        displayName: 'Julian Hawthorne',
        gender: 'MALE',
        generation: 3,
        birthPlace: 'San Francisco, California',
        occupation: 'Software Engineer',
        dateOfBirth: '1988-11-05',
        isLiving: true,
      });
    memberA3Id = m3Res.body.data._id || m3Res.body.data.id;

    // 7. Create Branches in Family A
    const branch1Res = await request(app)
      .post(`/api/families/${familyAId}/branches`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'Hawthorne Timber Branch',
        description: 'Forestry and craftsmanship',
        rootMemberId: memberA1Id,
        accentColor: '#10b981',
      });
    branchA1Id = branch1Res.body.data._id || branch1Res.body.data.id;

    const branch2Res = await request(app)
      .post(`/api/families/${familyAId}/branches`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'Hawthorne Coastal Branch',
        description: 'Maritime and seafaring',
        rootMemberId: memberA2Id,
        accentColor: '#3b82f6',
      });
    branchA2Id = branch2Res.body.data._id || branch2Res.body.data.id;

    // Update members with their branchIds
    await request(app)
      .patch(`/api/families/${familyAId}/members/${memberA1Id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ branchIds: [branchA1Id] });

    await request(app)
      .patch(`/api/families/${familyAId}/members/${memberA2Id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ branchIds: [branchA1Id] });

    await request(app)
      .patch(`/api/families/${familyAId}/members/${memberA3Id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ branchIds: [branchA1Id] });

    // Create spouse for Arthur (Margaret)
    const margaretRes = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        firstName: 'Margaret',
        lastName: 'Hawthorne',
        gender: 'FEMALE',
        generation: 1,
      });
    const margaretId = margaretRes.body.data._id || margaretRes.body.data.id;
    await request(app)
      .post(`/api/families/${familyAId}/relationships`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        sourceMemberId: memberA1Id,
        targetMemberId: margaretId,
        relationshipType: 'SPOUSE',
      });

    // Create spouse for Eleanor (Thomas)
    const thomasRes = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        firstName: 'Thomas',
        lastName: 'Hawthorne',
        gender: 'MALE',
        generation: 2,
      });
    const thomasId = thomasRes.body.data._id || thomasRes.body.data.id;
    await request(app)
      .post(`/api/families/${familyAId}/relationships`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        sourceMemberId: memberA2Id,
        targetMemberId: thomasId,
        relationshipType: 'SPOUSE',
      });

    // Connect members via relationships: Arthur -> Eleanor (PARENT), Eleanor -> Julian (PARENT)
    await request(app)
      .post(`/api/families/${familyAId}/relationships`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        sourceMemberId: memberA1Id,
        targetMemberId: memberA2Id,
        relationshipType: 'PARENT',
      });

    await request(app)
      .post(`/api/families/${familyAId}/relationships`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        sourceMemberId: memberA2Id,
        targetMemberId: memberA3Id,
        relationshipType: 'PARENT',
      });

    // 8. Populate Member in Family B
    const mbRes = await request(app)
      .post(`/api/families/${familyBId}/members`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        firstName: 'Alexander',
        lastName: 'Sterling',
        displayName: 'Alexander Sterling',
        gender: 'MALE',
        generation: 1,
        birthPlace: 'Richmond, Virginia',
        occupation: 'Secret Master Architect',
        dateOfBirth: '1935-02-18',
        isLiving: true,
      });
    memberB1Id = mbRes.body.data._id || mbRes.body.data.id;

    // 9. Create Memories in Family A with various visibility levels
    // Public Memory
    const pubMemRes = await request(app)
      .post(`/api/families/${familyAId}/memories`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'The Great Shipyard Launch of 1948',
        description: 'Documenting Arthur building the magnificent wooden vessel.',
        memoryType: MemoryType.STORY,
        visibility: MemoryVisibility.PUBLIC,
        memberIds: [memberA1Id],
        branchIds: [branchA1Id],
        tags: ['shipyard', 'heritage', 'craftsmanship'],
      });
    publicMemoryId = pubMemRes.body.data._id || pubMemRes.body.data.id;

    // Private Memory created by User 1
    const privMemRes = await request(app)
      .post(`/api/families/${familyAId}/memories`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Confidential Journal of Arthur Secret Fortune',
        description: 'Only for direct heirs: hidden safe combinations and antique coins.',
        memoryType: MemoryType.DOCUMENT,
        visibility: MemoryVisibility.PRIVATE,
        memberIds: [memberA1Id],
        tags: ['secret', 'treasure', 'confidential'],
      });
    privateMemoryUser1Id = privMemRes.body.data._id || privMemRes.body.data.id;

    // Branch-restricted memory for Coastal Branch (branchA2Id)
    const branchMemRes = await request(app)
      .post(`/api/families/${familyAId}/memories`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Coastal Navigation Logbooks',
        description: 'Restricted logs exclusively for members of the Coastal Branch.',
        memoryType: MemoryType.DOCUMENT,
        visibility: MemoryVisibility.BRANCH,
        branchIds: [branchA2Id],
        tags: ['coastal', 'navigation', 'maritime'],
      });
    branchMemoryId = branchMemRes.body.data._id || branchMemRes.body.data.id;
  }, 25000);

  afterAll(async () => {
    await database.disconnect();
  });

  describe('1. Cross-Family Isolation & Boundary Enforcement', () => {
    it('does not leak Family B members when searching within Family A', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/search?q=Sterling`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results.people.length).toBe(0);
      expect(res.body.data.counts.people).toBe(0);
    });

    it('does not leak Family A members when searching within Family B', async () => {
      const res = await request(app)
        .get(`/api/families/${familyBId}/search?q=Hawthorne`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results.people.length).toBe(0);
      expect(res.body.data.counts.people).toBe(0);
    });
  });

  describe('2. Memory Privacy & RBAC Visibility Security', () => {
    it('allows the creator (User 1) to find their own private memory in search', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/search?q=Secret+Fortune`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.data.results.memories.find(
        (m: any) => m.id === privateMemoryUser1Id
      );
      expect(found).toBeDefined();
      expect(found.title).toContain('Confidential Journal');
    });

    it('PREVENTS other members (User 2) from discovering private memories in search results', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/search?q=Secret+Fortune`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // User 2 must NEVER receive the private memory in results
      const found = res.body.data.results.memories.find(
        (m: any) => m.id === privateMemoryUser1Id
      );
      expect(found).toBeUndefined();
      expect(res.body.data.results.memories.length).toBe(0);
    });

    it('allows all family members to search and discover public memories', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/search?q=Shipyard`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.data.results.memories.find(
        (m: any) => m.id === publicMemoryId
      );
      expect(found).toBeDefined();
      expect(found.title).toContain('The Great Shipyard Launch');
    });
  });

  describe('3. Advanced Combinable Filters Verification', () => {
    it('filters family members accurately by generation and gender', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/search?category=PEOPLE&generation=2&gender=FEMALE`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results.people.length).toBe(1);
      expect(res.body.data.results.people[0].firstName).toBe('Eleanor');
      expect(res.body.data.results.people[0].generation).toBe(2);
    });

    it('filters family members by occupation and living status', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/search?category=PEOPLE&occupation=Shipbuilder&isLiving=false`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results.people.length).toBe(1);
      expect(res.body.data.results.people[0].firstName).toBe('Arthur');
      expect(res.body.data.results.people[0].isLiving).toBe(false);
    });

    it('returns search suggestions categorized accurately without leaking sensitive data', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/search/suggestions?q=Haw`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const personSuggestion = res.body.data.find((s: any) => s.category === 'PERSON');
      expect(personSuggestion).toBeDefined();
    });
  });

  describe('4. Genealogy Kinship & Common Ancestor Discovery', () => {
    it('computes kinship path between Arthur (Grandparent) and Julian (Grandchild)', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/kinship/${memberA1Id}/${memberA3Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.distance).toBe(2);
      expect(res.body.data.path.length).toBe(2);
      const pathMemberIds = res.body.data.path
        .map((p: any) => p.fromId)
        .concat([res.body.data.target.id]);
      expect(pathMemberIds).toContain(memberA1Id);
      expect(pathMemberIds).toContain(memberA2Id);
      expect(pathMemberIds).toContain(memberA3Id);
    });

    it('identifies common ancestor accurately between relatives', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/kinship/common-ancestors/${memberA2Id}/${memberA3Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.allCommonAncestors.length).toBeGreaterThanOrEqual(1);
      const ancestorIds = res.body.data.allCommonAncestors.map((a: any) => a.ancestor.id);
      expect(ancestorIds).toContain(memberA1Id);
    });
  });
});
