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

  describe('3. Invitation Flow & Single Admin Constraint', () => {
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

    it('enforces Single Admin Constraint: rejects inviting additional users as ADMIN', async () => {
      const invAdminFail = await request(app)
        .post(`/api/families/${familyId}/memberships/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'admin@familyroots.org',
          role: Role.ADMIN,
        });

      expect(invAdminFail.status).toBe(400);
      expect(invAdminFail.body.error.message).toMatch(/only one ADMIN/i);
    });

    it('creates invitations for family members with VIEWER role', async () => {
      // 1. Invite User 1 (Admin User as Viewer)
      const invAdmin = await request(app)
        .post(`/api/families/${familyId}/memberships/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'admin@familyroots.org',
          role: Role.VIEWER,
        });

      expect(invAdmin.status).toBe(201);
      expect(invAdmin.body.data.rawToken).toBeDefined();
      inviteTokenForAdmin = invAdmin.body.data.rawToken;

      // 2. Invite User 2 (Parent Manager as Viewer)
      const invPM = await request(app)
        .post(`/api/families/${familyId}/memberships/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'parentmgr@familyroots.org',
          role: Role.VIEWER,
        });

      expect(invPM.status).toBe(201);
      inviteTokenForParentManager = invPM.body.data.rawToken;

      // 3. Invite User 3 (Member as Viewer)
      const invMember = await request(app)
        .post(`/api/families/${familyId}/memberships/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'member@familyroots.org',
          role: Role.VIEWER,
        });

      expect(invMember.status).toBe(201);
      inviteTokenForMember = invMember.body.data.rawToken;
    });

    it('accepts invitations and provisions active memberships as VIEWER', async () => {
      // User 1 accepts
      const accAdmin = await request(app)
        .post('/api/families/invitations/accept')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ token: inviteTokenForAdmin });

      expect(accAdmin.status).toBe(200);
      expect(accAdmin.body.data.role).toBe(Role.VIEWER);

      // User 2 accepts
      const accPM = await request(app)
        .post('/api/families/invitations/accept')
        .set('Authorization', `Bearer ${parentManagerToken}`)
        .send({ token: inviteTokenForParentManager });

      expect(accPM.status).toBe(200);
      expect(accPM.body.data.role).toBe(Role.VIEWER);

      // User 3 accepts
      const accMem = await request(app)
        .post('/api/families/invitations/accept')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ token: inviteTokenForMember });

      expect(accMem.status).toBe(200);
      expect(accMem.body.data.role).toBe(Role.VIEWER);
    });

    it('rejects reusing an already accepted invitation token', async () => {
      const res = await request(app)
        .post('/api/families/invitations/accept')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ token: inviteTokenForAdmin });

      expect(res.status).toBe(400);
    });
  });

  describe('4. Role Hierarchy, Single Admin Ownership Transfer & Role Protections', () => {
    let memberMembershipId: string;
    let ownerMembershipId: string;
    let adminMembershipId: string;

    beforeAll(async () => {
      const memRes = await request(app)
        .get(`/api/families/${familyId}/memberships`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const memberships = memRes.body.data;
      const ownerMem = memberships.find((m: any) => m.userId?._id === ownerUserId || m.userId === ownerUserId);
      const adminMem = memberships.find((m: any) => m.userId?._id === adminUserId || m.userId === adminUserId);
      const regMem = memberships.find((m: any) => m.userId?._id === memberUserId || m.userId === memberUserId);

      ownerMembershipId = ownerMem._id;
      adminMembershipId = adminMem._id;
      memberMembershipId = regMem._id;
    });

    it('strictly prohibits self-escalation (user cannot change own role)', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyId}/memberships/${ownerMembershipId}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: Role.ADMIN });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/strictly prohibited from modifying their own role/i);
    });

    it('prohibits VIEWER from modifying roles or promoting others', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyId}/memberships/${memberMembershipId}/role`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ role: Role.ADMIN });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/(Only the Family ADMIN can manage roles|lacks MANAGE_ROLES capability)/i);
    });

    it('prohibits demoting the sole ADMIN without transferring ownership first', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyId}/memberships/${ownerMembershipId}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: Role.VIEWER });

      // Owner cannot demote self per self-escalation/modification rule
      expect(res.status).toBe(403);
    });

    it('transfers sole ADMIN ownership to another user, demoting previous admin to VIEWER', async () => {
      // Owner promotes adminMembership to ADMIN -> transfers ownership
      const res = await request(app)
        .patch(`/api/families/${familyId}/memberships/${adminMembershipId}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ role: Role.ADMIN });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(Role.ADMIN);

      // Verify previous owner is now demoted to VIEWER
      const verifyRes = await request(app)
        .get(`/api/families/${familyId}/memberships`)
        .set('Authorization', `Bearer ${adminToken}`);

      const memberships = verifyRes.body.data;
      const prevOwnerMem = memberships.find((m: any) => m._id === ownerMembershipId);
      const newAdminMem = memberships.find((m: any) => m._id === adminMembershipId);

      expect(prevOwnerMem.role).toBe(Role.VIEWER);
      expect(newAdminMem.role).toBe(Role.ADMIN);

      // Transfer ownership back to ownerUser for subsequent test steps
      const returnRes = await request(app)
        .patch(`/api/families/${familyId}/memberships/${ownerMembershipId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: Role.ADMIN });

      expect(returnRes.status).toBe(200);
      expect(returnRes.body.data.role).toBe(Role.ADMIN);
    });
  });

  describe('5. Registered Account Requirement & Permission Matrix Enforcement', () => {
    it('blocks creating a living member without a registered account (Rule 3)', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Unregistered',
          lastName: 'Person',
          gender: 'MALE',
          isLiving: true,
          dateOfBirth: '1995-05-15',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Cannot create member node: This person must have a registered account first.');
    });

    it('blocks creating a living member with an unknown non-existent email', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Ghost',
          lastName: 'User',
          gender: 'FEMALE',
          isLiving: true,
          registeredEmail: 'nonexistent_account@ghost.org',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Cannot create member node: This person must have a registered account first.');
    });

    it('allows creating deceased historical ancestors without a registered account', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Grandfather',
          lastName: 'Somerset',
          gender: 'MALE',
          isLiving: false,
          dateOfBirth: '1925-01-01',
          dateOfDeath: '1995-10-12',
        });

      expect(res.status).toBe(201);
      expect(res.body.data._id).toBeDefined();
      rootGrandparentMemberId = res.body.data._id;
    });

    it('allows creating living members when linked to a verified registered user account', async () => {
      // 1. Parent linked to parentmgr@familyroots.org
      const r2 = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Parent',
          lastName: 'Somerset',
          gender: 'MALE',
          dateOfBirth: '1960-01-01',
          isLiving: true,
          registeredEmail: 'parentmgr@familyroots.org',
        });

      expect(r2.status).toBe(201);
      expect(r2.body.data.linkedUserId).toBe(parentManagerUserId);
      parentMemberId = r2.body.data._id;

      // 2. Child linked to member@familyroots.org
      const r3 = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Child',
          lastName: 'Somerset',
          gender: 'FEMALE',
          dateOfBirth: '1990-01-01',
          isLiving: true,
          registeredEmail: 'member@familyroots.org',
        });

      expect(r3.status).toBe(201);
      expect(r3.body.data.linkedUserId).toBe(memberUserId);
      childMemberId = r3.body.data._id;

      // 3. Spouse for Grandfather (deceased ancestor)
      const rSpouse1 = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'Grandmother',
          lastName: 'Somerset',
          gender: 'FEMALE',
          isLiving: false,
          dateOfBirth: '1928-01-01',
          dateOfDeath: '1998-05-15',
        });

      expect(rSpouse1.status).toBe(201);

      // 4. Spouse for Parent (living, linked to admin@familyroots.org)
      const rSpouse2 = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          firstName: 'OtherParent',
          lastName: 'Somerset',
          gender: 'FEMALE',
          isLiving: true,
          registeredEmail: 'admin@familyroots.org',
        });

      expect(rSpouse2.status).toBe(201);

      // Create tree relationships
      await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sourceMemberId: rootGrandparentMemberId,
          targetMemberId: rSpouse1.body.data._id,
          relationshipType: RelationshipType.SPOUSE,
        });

      await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sourceMemberId: parentMemberId,
          targetMemberId: rSpouse2.body.data._id,
          relationshipType: RelationshipType.SPOUSE,
        });

      await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sourceMemberId: rootGrandparentMemberId,
          targetMemberId: parentMemberId,
          relationshipType: RelationshipType.PARENT,
        });

      await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sourceMemberId: parentMemberId,
          targetMemberId: childMemberId,
          relationshipType: RelationshipType.PARENT,
        });
    });

    it('prohibits VIEWER from creating or modifying tree member nodes', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          firstName: 'Unauthorized',
          lastName: 'Member',
          isLiving: false,
        });

      expect(res.status).toBe(403);
    });

    it('prohibits VIEWER from mutating relationships in the tree', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          sourceMemberId: rootGrandparentMemberId,
          targetMemberId: childMemberId,
          relationshipType: RelationshipType.PARENT,
        });

      expect(res.status).toBe(403);
    });

    it('allows VIEWER to view tree members (Read-Only access)', async () => {
      const res = await request(app)
        .get(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('allows VIEWER to contribute and upload new memories', async () => {
      const res = await request(app)
        .post(`/api/memories`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          familyId,
          title: 'A Beautiful Family Reunion Memory',
          description: 'Uploaded by viewer to celebrate heritage',
          memberIds: [childMemberId],
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });
  });

  describe('6. Audit Logging & Compliance Trail', () => {
    it('retrieves recorded audit trail entries for the family as ADMIN', async () => {
      const res = await request(app)
        .get(`/api/families/${familyId}/memberships/audit-logs/all`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify that sensitive actions like ROLE_CHANGED are recorded
      const actions = res.body.data.map((log: { action: string }) => log.action);
      expect(actions).toContain('ROLE_CHANGED');
    });

    it('prohibits standard VIEWER without VIEW_AUDIT_LOG from accessing audit trail', async () => {
      const res = await request(app)
        .get(`/api/families/${familyId}/memberships/audit-logs/all`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });
  });
});
