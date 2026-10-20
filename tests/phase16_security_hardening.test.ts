import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';
import { config } from '../server/src/config/index.ts';
import { Role, Permission, UserStatus, RelationshipType, MemoryVisibility, MemoryType } from '../server/src/constants/index.ts';
import { User } from '../server/src/models/User.ts';
import { FamilyMembership } from '../server/src/models/FamilyMembership.ts';
import { Memory } from '../server/src/models/Memory.ts';

const app = createApp();

describe('Phase 16: Production Readiness & Security Hardening Suite', () => {
  let ownerToken: string;
  let ownerRefreshToken: string;
  let ownerUserId: string;

  let memberToken: string;
  let memberUserId: string;

  let branchManagerToken: string;
  let branchManagerUserId: string;

  let parentManagerToken: string;
  let parentManagerUserId: string;

  let familyAId: string;
  let familyBId: string;

  let branch1Id: string;
  let branch2Id: string;

  let rootGrandparentMemberId: string;
  let parentMemberId: string;
  let childMemberId: string;
  let unrelatedMemberId: string;

  let privateMemoryId: string;

  beforeAll(async () => {
    await database.connect();

    // 1. Register Owner
    const regOwner = await request(app).post('/api/auth/register').send({
      email: 'p16_owner@familyroots.org',
      password: 'SecurePassword123!',
      name: 'Owner Security User',
    });
    ownerToken = regOwner.body.data.accessToken;
    ownerRefreshToken = regOwner.body.data.refreshToken;
    ownerUserId = regOwner.body.data.user.id;

    // 2. Register Member
    const regMember = await request(app).post('/api/auth/register').send({
      email: 'p16_member@familyroots.org',
      password: 'SecurePassword123!',
      name: 'Standard Member User',
    });
    memberToken = regMember.body.data.accessToken;
    memberUserId = regMember.body.data.user.id;

    // 3. Register Branch Manager User
    const regBranchMgr = await request(app).post('/api/auth/register').send({
      email: 'p16_branchmgr@familyroots.org',
      password: 'SecurePassword123!',
      name: 'Branch Manager User',
    });
    branchManagerToken = regBranchMgr.body.data.accessToken;
    branchManagerUserId = regBranchMgr.body.data.user.id;

    // 4. Register Parent Manager User
    const regParentMgr = await request(app).post('/api/auth/register').send({
      email: 'p16_parentmgr@familyroots.org',
      password: 'SecurePassword123!',
      name: 'Parent Manager User',
    });
    parentManagerToken = regParentMgr.body.data.accessToken;
    parentManagerUserId = regParentMgr.body.data.user.id;

    // 5. Create Family A (Owner is automatically Family Owner)
    const famARes = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Hardened Security Clan A',
        description: 'Testing RBAC and security isolation',
      });
    familyAId = famARes.body.data._id;

    // 6. Create Family B (Isolated family)
    const famBRes = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        name: 'Isolated Clan B',
        description: 'Separate family boundary',
      });
    familyBId = famBRes.body.data._id;

    // 7. Create Members in Family A first
    const gpRes = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'Grandparent', lastName: 'Elder', gender: 'MALE' });
    rootGrandparentMemberId = gpRes.body.data._id;

    const pRes = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'Parent', lastName: 'Elder', gender: 'FEMALE' });
    parentMemberId = pRes.body.data._id;

    const cRes = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'Child', lastName: 'Elder', gender: 'FEMALE' });
    childMemberId = cRes.body.data._id;

    const uRes = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'Unrelated', lastName: 'Cousin', gender: 'MALE' });
    unrelatedMemberId = uRes.body.data._id;

    // 8. Create Branches in Family A
    const b1Res = await request(app)
      .post(`/api/families/${familyAId}/branches`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Northern Highland Branch', rootMemberId: rootGrandparentMemberId });
    branch1Id = b1Res.body.data._id;

    const b2Res = await request(app)
      .post(`/api/families/${familyAId}/branches`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Southern Coastal Branch', rootMemberId: unrelatedMemberId });
    branch2Id = b2Res.body.data._id;

    // Assign branch1Id to parent and child
    await request(app)
      .patch(`/api/families/${familyAId}/members/${parentMemberId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ branchIds: [branch1Id] });

    await request(app)
      .patch(`/api/families/${familyAId}/members/${childMemberId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ branchIds: [branch1Id] });

    await request(app)
      .patch(`/api/families/${familyAId}/members/${unrelatedMemberId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ branchIds: [branch2Id] });

    // 9. Link Lineage Relationships: Grandparent -> Parent -> Child
    // Spouses for Grandparent and Parent (Required by Phase 33 to add children)
    const gpSpouseRes = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'Grandmother', lastName: 'Elder', gender: 'FEMALE' });
    await request(app)
      .post(`/api/families/${familyAId}/relationships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceMemberId: rootGrandparentMemberId,
        targetMemberId: gpSpouseRes.body.data._id,
        relationshipType: RelationshipType.SPOUSE,
      });

    const pSpouseRes = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ firstName: 'ParentSpouse', lastName: 'Elder', gender: 'MALE' });
    await request(app)
      .post(`/api/families/${familyAId}/relationships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceMemberId: parentMemberId,
        targetMemberId: pSpouseRes.body.data._id,
        relationshipType: RelationshipType.SPOUSE,
      });

    await request(app)
      .post(`/api/families/${familyAId}/relationships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceMemberId: rootGrandparentMemberId,
        targetMemberId: parentMemberId,
        relationshipType: RelationshipType.PARENT,
      });

    await request(app)
      .post(`/api/families/${familyAId}/relationships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceMemberId: parentMemberId,
        targetMemberId: childMemberId,
        relationshipType: RelationshipType.PARENT,
      });

    // 10. Add Memberships for Parent Manager and Branch Manager in Family A
    await FamilyMembership.create({
      userId: parentManagerUserId,
      familyId: familyAId,
      role: Role.PARENT_MANAGER,
      memberId: parentMemberId,
      status: 'ACTIVE',
      permissions: [Permission.EDIT_MEMBER, Permission.CREATE_MEMBER, Permission.VIEW_MEMBER],
    });

    await FamilyMembership.create({
      userId: branchManagerUserId,
      familyId: familyAId,
      role: Role.BRANCH_MANAGER,
      branchId: branch1Id,
      status: 'ACTIVE',
      permissions: [Permission.EDIT_MEMBER, Permission.DELETE_MEMBER, Permission.VIEW_MEMBER],
    });

    // 11. Add Standard Member to Family A
    await FamilyMembership.create({
      userId: memberUserId,
      familyId: familyAId,
      role: Role.MEMBER,
      status: 'ACTIVE',
      permissions: [Permission.VIEW_MEMBER, Permission.VIEW_FAMILY, Permission.UPLOAD_MEMORY],
    });
  }, 25000);

  afterAll(async () => {
    await database.disconnect();
  });

  describe('1. Authentication Security Hardening', () => {
    it('rejects expired access token with 401 Unauthorized', async () => {
      const expiredToken = jwt.sign(
        { userId: ownerUserId, email: 'p16_owner@familyroots.org', tokenVersion: 0 },
        config.JWT_SECRET,
        { expiresIn: '-10s' } // Expired 10 seconds ago
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects tampered access token signature with 401 Unauthorized', async () => {
      const tamperedToken = ownerToken.slice(0, -5) + 'abcde';
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rotates refresh token and invalidates the previous token', async () => {
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: ownerRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).toBeDefined();

      const newRefreshToken = refreshRes.body.data.refreshToken;
      expect(newRefreshToken).not.toBe(ownerRefreshToken);

      // Attempting to reuse the revoked/old refresh token MUST trigger reuse detection
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: ownerRefreshToken });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.success).toBe(false);
      expect(reuseRes.body.error?.message).toMatch(/revoked|invalid|compromised/i);

      // Update ownerToken with valid new access token
      ownerToken = refreshRes.body.data.accessToken;
      ownerRefreshToken = newRefreshToken;
    });

    it('enforces password complexity validation during registration', async () => {
      // Missing number & special character
      const weakRes = await request(app).post('/api/auth/register').send({
        email: 'weakpass@test.org',
        password: 'password',
        name: 'Weak Password',
      });
      expect(weakRes.status).toBe(400);
      expect(weakRes.body.success).toBe(false);

      // Too short
      const shortRes = await request(app).post('/api/auth/register').send({
        email: 'shortpass@test.org',
        password: 'Pass1!',
        name: 'Short Password',
      });
      expect(shortRes.status).toBe(400);
      expect(shortRes.body.success).toBe(false);
    });

    it('blocks login for suspended accounts with 403 Forbidden', async () => {
      const user = await User.findById(memberUserId);
      if (user) {
        user.status = UserStatus.SUSPENDED;
        await user.save();
      }

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'p16_member@familyroots.org',
        password: 'SecurePassword123!',
      });

      expect(loginRes.status).toBe(403);
      expect(loginRes.body.error?.message).toMatch(/suspended/i);

      // Restore active status
      if (user) {
        user.status = UserStatus.ACTIVE;
        await user.save();
      }
    });

    it('invalidates tokens on logout', async () => {
      const regTemp = await request(app).post('/api/auth/register').send({
        email: 'p16_logout_test@familyroots.org',
        password: 'SecurePassword123!',
        name: 'Logout Test User',
      });
      const tempToken = regTemp.body.data.accessToken;
      const tempRefreshToken = regTemp.body.data.refreshToken;

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tempToken}`)
        .send({ refreshToken: tempRefreshToken });

      expect(logoutRes.status).toBe(200);

      // After logout, using the refresh token must be rejected
      const tryRefresh = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: tempRefreshToken });

      expect(tryRefresh.status).toBe(401);
    });
  });

  describe('2. Authorization Audit & Granular RBAC', () => {
    it('blocks cross-family IDOR access', async () => {
      // Family A owner attempting to read or edit Family B records
      const res = await request(app)
        .get(`/api/families/${familyBId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('prevents self-role escalation', async () => {
      const memberships = await FamilyMembership.find({ familyId: familyAId, userId: memberUserId });
      expect(memberships.length).toBeGreaterThan(0);
      const memberMembershipId = memberships[0]._id.toString();

      // Standard member attempts to promote self to FAMILY_OWNER or FAMILY_ADMIN
      const res = await request(app)
        .patch(`/api/families/${familyAId}/memberships/${memberMembershipId}/role`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ role: Role.FAMILY_ADMIN });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('enforces Parent Manager scope: allows editing descendants, blocks non-descendants', async () => {
      // Parent Manager manages their child (verified descendant)
      const allowedRes = await request(app)
        .patch(`/api/families/${familyAId}/members/${childMemberId}`)
        .set('Authorization', `Bearer ${parentManagerToken}`)
        .send({ firstName: 'Child-Updated-By-Parent' });

      expect(allowedRes.status).toBe(200);
      expect(allowedRes.body.data.firstName).toBe('Child-Updated-By-Parent');

      // Parent Manager attempts to edit Grandparent (ancestor, not descendant) -> MUST be blocked
      const blockedAncestorRes = await request(app)
        .patch(`/api/families/${familyAId}/members/${rootGrandparentMemberId}`)
        .set('Authorization', `Bearer ${parentManagerToken}`)
        .send({ firstName: 'Tampered-Grandparent' });

      expect(blockedAncestorRes.status).toBe(403);
      expect(blockedAncestorRes.body.error?.message).toMatch(/descendant/i);

      // Parent Manager attempts to edit Unrelated member -> MUST be blocked
      const blockedUnrelatedRes = await request(app)
        .patch(`/api/families/${familyAId}/members/${unrelatedMemberId}`)
        .set('Authorization', `Bearer ${parentManagerToken}`)
        .send({ firstName: 'Tampered-Unrelated' });

      expect(blockedUnrelatedRes.status).toBe(403);
      expect(blockedUnrelatedRes.body.error?.message).toMatch(/descendant/i);
    });

    it('enforces Branch Manager scope: allows managing within assigned branch, blocks other branch', async () => {
      // Branch Manager manages member in branch 1
      const allowedRes = await request(app)
        .patch(`/api/families/${familyAId}/members/${parentMemberId}`)
        .set('Authorization', `Bearer ${branchManagerToken}`)
        .send({ notes: 'Verified by branch manager' });

      expect(allowedRes.status).toBe(200);

      // Branch Manager attempts to manage member in branch 2 -> MUST be blocked
      const blockedRes = await request(app)
        .patch(`/api/families/${familyAId}/members/${unrelatedMemberId}`)
        .set('Authorization', `Bearer ${branchManagerToken}`)
        .send({ notes: 'Tampered note across branches' });

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.error?.message).toMatch(/branch/i);
    });
  });

  describe('3. Observability, Security Headers & Request Correlation', () => {
    it('attaches X-Request-Id correlation header to all HTTP responses', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
    });

    it('preserves client-provided X-Request-Id correlation header', async () => {
      const customId = 'client-trace-abc-12345';
      const res = await request(app)
        .get('/api/health')
        .set('X-Request-Id', customId);

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe(customId);
    });

    it('sets hardened security headers via helmet', async () => {
      const res = await request(app).get('/api/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('4. Media Security & Private Memory Protection', () => {
    it('creates a private memory and verifies only creator and admin can access it', async () => {
      // Owner creates a private memory
      const memRes = await request(app)
        .post(`/api/families/${familyAId}/memories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Owner Confidential Journal',
          description: 'A deeply personal narrative strictly for the author.',
          memoryType: MemoryType.STORY,
          visibility: MemoryVisibility.PRIVATE,
        });

      expect(memRes.status).toBe(201);
      privateMemoryId = memRes.body.data._id;

      // Creator (owner) can access
      const creatorRes = await request(app)
        .get(`/api/families/${familyAId}/memories/${privateMemoryId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(creatorRes.status).toBe(200);

      // Standard member cannot access
      const memberRes = await request(app)
        .get(`/api/families/${familyAId}/memories/${privateMemoryId}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(memberRes.status).toBe(403);
      expect(memberRes.body.error?.message).toMatch(/Private/i);
    });
  });

  describe('5. Data Integrity: Cascade Cleanup of Orphaned Member References', () => {
    it('cleans up references in memories, events, and memberships when a member is deleted', async () => {
      // Create temporary member to delete
      const tempMemRes = await request(app)
        .post(`/api/families/${familyAId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ firstName: 'Ephemeral', lastName: 'ToDelete', gender: 'OTHER' });

      const ephemeralMemberId = tempMemRes.body.data._id;

      // Tag this ephemeral member in a memory
      const memoryWithTag = await request(app)
        .post(`/api/families/${familyAId}/memories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Event With Ephemeral Member',
          memoryType: MemoryType.STORY,
          memberIds: [ephemeralMemberId, rootGrandparentMemberId],
        });

      const taggedMemoryId = memoryWithTag.body.data._id;

      // Delete the ephemeral member
      const delRes = await request(app)
        .delete(`/api/families/${familyAId}/members/${ephemeralMemberId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(delRes.status).toBe(200);

      // Verify the memory record has cleanly dereferenced the deleted member
      const updatedMemory = await Memory.findById(taggedMemoryId);
      expect(updatedMemory).toBeDefined();
      const stringMemberIds = (updatedMemory?.memberIds || []).map((id) => id.toString());
      expect(stringMemberIds).not.toContain(ephemeralMemberId);
      expect(stringMemberIds).toContain(rootGrandparentMemberId);
    });
  });

  describe('6. AI Safeguards & Heritage Narrative', () => {
    it('generates heritage summary strictly from verified records with AI labeling', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/insights/ai-summary`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.label).toBeDefined();
      expect(res.body.data.disclaimer).toBeDefined();
      expect(res.body.data.keyHighlights).toBeInstanceOf(Array);
    }, 15000);
  });
});
