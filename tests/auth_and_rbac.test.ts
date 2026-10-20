import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';
import { Role, RelationshipType } from '../server/src/constants/index.ts';

const app = createApp();

describe('Authentication, RBAC & Membership Management Engine', () => {
  let ownerToken: string;
  let ownerRefreshToken: string;
  let ownerUserId: string;

  let adminToken: string;
  let adminUserId: string;

  let parentManagerToken: string;
  let parentManagerUserId: string;

  let memberToken: string;
  let memberUserId: string;

  let familyId: string;
  let rootGrandparentMemberId: string;
  let parentMemberId: string;
  let childMemberId: string;
  let unrelatedMemberId: string;

  beforeAll(async () => {
    await database.connect();
  }, 15000);

  afterAll(async () => {
    await database.disconnect();
  });

  describe('1. Authentication System (Registration, Login, Refresh, Session Invalidation)', () => {
    it('registers a new user with hashed password and returns access & refresh tokens', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'owner@familyroots.org',
          password: 'Password123!',
          name: 'Owner User',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('owner@familyroots.org');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      ownerToken = res.body.data.accessToken;
      ownerRefreshToken = res.body.data.refreshToken;
      ownerUserId = res.body.data.user.id;
    });

    it('rejects registration with duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'owner@familyroots.org',
          password: 'Password123!',
          name: 'Duplicate Owner',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('authenticates user login and verifies password hash', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'owner@familyroots.org',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      ownerToken = res.body.data.accessToken;
      ownerRefreshToken = res.body.data.refreshToken;
    });

    it('rejects login with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'owner@familyroots.org',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns authenticated user profile from /api/auth/me', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('owner@familyroots.org');
      expect(Array.isArray(res.body.data.memberships)).toBe(true);
    });

    it('rejects /api/auth/me without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('rotates refresh tokens successfully', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: ownerRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      ownerToken = res.body.data.accessToken;
      const newRefreshToken = res.body.data.refreshToken;

      // Old refresh token is revoked/rotated and cannot be reused
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: ownerRefreshToken });

      expect(reuseRes.status).toBe(401);
      ownerRefreshToken = newRefreshToken;
    });
  });

  describe('2. Family Creation & Owner Bootstrap', () => {
    it('creates a new family as authenticated owner and auto-provisions FAMILY_OWNER membership', async () => {
      const res = await request(app)
        .post('/api/families')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Somerset Heritage Family',
          description: 'Multigenerational testing lineage',
        });

      expect(res.status).toBe(201);
      familyId = res.body.data._id;

      // Verify that owner membership was created
      const memRes = await request(app)
        .get(`/api/families/${familyId}/memberships`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(memRes.status).toBe(200);
      expect(memRes.body.success).toBe(true);
      expect(memRes.body.data.length).toBe(1);
      expect(memRes.body.data[0].role).toBe(Role.FAMILY_OWNER);
      expect(memRes.body.data[0].userId._id).toBe(ownerUserId);
    });
  });

  describe('3. Invitation Flow & Multirole Provisioning', () => {
    let inviteTokenForAdmin: string;
    let inviteTokenForParentManager: string;
    let inviteTokenForMember: string;

    beforeAll(async () => {
      // Register other test users
      const rAdmin = await request(app).post('/api/auth/register').send({
        email: 'admin@familyroots.org',
        password: 'Password123!',
        name: 'Admin User',
      });
      adminToken = rAdmin.body.data.accessToken;
      adminUserId = rAdmin.body.data.user.id;

      const rPM = await request(app).post('/api/auth/register').send({
        email: 'parentmgr@familyroots.org',
        password: 'Password123!',
        name: 'Parent Manager User',
      });
      parentManagerToken = rPM.body.data.accessToken;
      parentManagerUserId = rPM.body.data.user.id;

      const rMember = await request(app).post('/api/auth/register').send({
        email: 'member@familyroots.org',
        password: 'Password123!',
        name: 'Standard Member',
      });
      memberToken = rMember.body.data.accessToken;
      memberUserId = rMember.body.data.user.id;
    });

    it('creates invitations for family members with specific roles', async () => {
      // 1. Invite Admin
      const invAdmin = await request(app)
        .post(`/api/families/${familyId}/memberships/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'admin@familyroots.org',
          role: Role.FAMILY_ADMIN,
        });

      expect(invAdmin.status).toBe(201);
      expect(invAdmin.body.data.rawToken).toBeDefined();
      inviteTokenForAdmin = invAdmin.body.data.rawToken;

      // 2. Invite Parent Manager
      const invPM = await request(app)
        .post(`/api/families/${familyId}/memberships/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'parentmgr@familyroots.org',
          role: Role.PARENT_MANAGER,
        });

      expect(invPM.status).toBe(201);
      inviteTokenForParentManager = invPM.body.data.rawToken;

      // 3. Invite Member
      const invMember = await request(app)
        .post(`/api/families/${familyId}/memberships/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'member@familyroots.org',
          role: Role.MEMBER,
        });

      expect(invMember.status).toBe(201);
      inviteTokenForMember = invMember.body.data.rawToken;
    });

    it('accepts invitations and provisions active memberships with corresponding roles', async () => {
      // Admin accepts
      const accAdmin = await request(app)
        .post('/api/families/invitations/accept')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ token: inviteTokenForAdmin });

      expect(accAdmin.status).toBe(200);
      expect(accAdmin.body.data.role).toBe(Role.FAMILY_ADMIN);

      // Parent Manager accepts
      const accPM = await request(app)
        .post('/api/families/invitations/accept')
        .set('Authorization', `Bearer ${parentManagerToken}`)
        .send({ token: inviteTokenForParentManager });

      expect(accPM.status).toBe(200);
      expect(accPM.body.data.role).toBe(Role.PARENT_MANAGER);

      // Member accepts
      const accMem = await request(app)
        .post('/api/families/invitations/accept')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ token: inviteTokenForMember });

      expect(accMem.status).toBe(200);
      expect(accMem.body.data.role).toBe(Role.MEMBER);
    });

    it('rejects reusing an already accepted invitation token', async () => {
      const res = await request(app)
        .post('/api/families/invitations/accept')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ token: inviteTokenForAdmin });

      expect(res.status).toBe(400);
    });
  });

  describe('4. Role Hierarchy & Role Mutation Protections', () => {
    let memberMembershipId: string;
    let ownerMembershipId: string;
    let adminMembershipId: string;

    beforeAll(async () => {
      const memRes = await request(app)
        .get(`/api/families/${familyId}/memberships`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const memberships = memRes.body.data;
      const ownerMem = memberships.find((m: { role: string }) => m.role === Role.FAMILY_OWNER);
      const adminMem = memberships.find((m: { role: string }) => m.role === Role.FAMILY_ADMIN);
      const regMem = memberships.find((m: { role: string }) => m.role === Role.MEMBER);

      ownerMembershipId = ownerMem._id;
      adminMembershipId = adminMem._id;
      memberMembershipId = regMem._id;
    });

    it('strictly prohibits self-escalation (user cannot change own role)', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyId}/memberships/${adminMembershipId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: Role.FAMILY_OWNER });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/strictly prohibited from modifying their own role/i);
    });

    it('prohibits demoting or removing the final FAMILY_OWNER', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyId}/memberships/${ownerMembershipId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: Role.MEMBER });

      expect(res.status).toBe(403);
    });

    it('prohibits admin from promoting someone to FAMILY_OWNER (only owner can appoint owner)', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyId}/memberships/${memberMembershipId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: Role.FAMILY_OWNER });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Cannot grant a role \(FAMILY_OWNER\) equal to or higher than actor's role/i);
    });

    it('allows FAMILY_OWNER to promote member to CONTRIBUTOR', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyId}/memberships/${memberMembershipId}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: Role.CONTRIBUTOR });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(Role.CONTRIBUTOR);
    });
  });

  describe('5. Scoped Authorization & BFS Descendant Traversal for PARENT_MANAGER', () => {
    let parentManagerMembershipId: string;

    beforeAll(async () => {
      // 1. Create family tree hierarchy: Root Grandparent -> Parent -> Child
      const r1 = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Grandfather',
          lastName: 'Somerset',
          gender: 'MALE',
          dateOfBirth: '1930-01-01',
        });
      rootGrandparentMemberId = r1.body.data._id;

      const r2 = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Parent',
          lastName: 'Somerset',
          gender: 'MALE',
          dateOfBirth: '1960-01-01',
        });
      parentMemberId = r2.body.data._id;

      const r3 = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Child',
          lastName: 'Somerset',
          gender: 'FEMALE',
          dateOfBirth: '1990-01-01',
        });
      childMemberId = r3.body.data._id;

      const r4 = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Unrelated',
          lastName: 'Stranger',
          gender: 'OTHER',
          dateOfBirth: '1970-01-01',
        });
      unrelatedMemberId = r4.body.data._id;

      // Spouses for Grandparent and Parent (Required by Phase 33 to have children)
      const rSpouse1 = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ firstName: 'Grandmother', lastName: 'Somerset', gender: 'FEMALE', dateOfBirth: '1942-01-01' });
      await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sourceMemberId: rootGrandparentMemberId,
          targetMemberId: rSpouse1.body.data._id,
          relationshipType: RelationshipType.SPOUSE,
        });

      const rSpouse2 = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ firstName: 'OtherParent', lastName: 'Somerset', gender: 'MALE', dateOfBirth: '1966-01-01' });
      await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sourceMemberId: parentMemberId,
          targetMemberId: rSpouse2.body.data._id,
          relationshipType: RelationshipType.SPOUSE,
        });

      // Relationships:
      // Grandfather PARENT of Parent
      await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sourceMemberId: rootGrandparentMemberId,
          targetMemberId: parentMemberId,
          relationshipType: RelationshipType.PARENT,
        });

      // Parent PARENT of Child
      await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sourceMemberId: parentMemberId,
          targetMemberId: childMemberId,
          relationshipType: RelationshipType.PARENT,
        });

      // Link Parent Manager's membership to the "Parent" member node
      const memRes = await request(app)
        .get(`/api/families/${familyId}/memberships`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const pmMem = memRes.body.data.find((m: { role: string }) => m.role === Role.PARENT_MANAGER);
      parentManagerMembershipId = pmMem._id;

      // Update membership with memberId link
      const { FamilyMembership } = await import('../server/src/models/FamilyMembership.ts');
      await FamilyMembership.findByIdAndUpdate(parentManagerMembershipId, {
        memberId: parentMemberId,
      });
    });

    it('verifies that PARENT_MANAGER can manage their verified descendant (Child)', async () => {
      const { authorizationService } = await import('../server/src/services/authorizationService.ts');
      const { Permission } = await import('../server/src/constants/index.ts');

      const check = await authorizationService.canManageMember(
        parentManagerUserId,
        familyId,
        childMemberId,
        Permission.EDIT_MEMBER
      );

      expect(check.allowed).toBe(true);
    });

    it('verifies that PARENT_MANAGER CANNOT manage their ancestor (Grandfather)', async () => {
      const { authorizationService } = await import('../server/src/services/authorizationService.ts');
      const { Permission } = await import('../server/src/constants/index.ts');

      const check = await authorizationService.canManageMember(
        parentManagerUserId,
        familyId,
        rootGrandparentMemberId,
        Permission.EDIT_MEMBER
      );

      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/verified descendants/i);
    });

    it('verifies that PARENT_MANAGER CANNOT manage an unrelated member', async () => {
      const { authorizationService } = await import('../server/src/services/authorizationService.ts');
      const { Permission } = await import('../server/src/constants/index.ts');

      const check = await authorizationService.canManageMember(
        parentManagerUserId,
        familyId,
        unrelatedMemberId,
        Permission.EDIT_MEMBER
      );

      expect(check.allowed).toBe(false);
    });
  });

  describe('6. Audit Logging & Compliance Trail', () => {
    it('retrieves recorded audit trail entries for the family', async () => {
      const res = await request(app)
        .get(`/api/families/${familyId}/memberships/audit-logs/all`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify that sensitive actions like ROLE_CHANGED or MEMBER_CREATED are recorded
      const actions = res.body.data.map((log: { action: string }) => log.action);
      expect(actions).toContain('ROLE_CHANGED');
    });

    it('prohibits standard members without VIEW_AUDIT_LOG from accessing audit trail', async () => {
      const res = await request(app)
        .get(`/api/families/${familyId}/memberships/audit-logs/all`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });
  });
});
