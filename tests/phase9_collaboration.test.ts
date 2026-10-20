import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';
import { Role } from '../server/src/constants/index.ts';

const app = createApp();

describe('Phase 9: Family Collaboration, Administration, RBAC & Protection Suite', () => {
  let ownerToken: string;
  let ownerUserId: string;

  let adminToken: string;
  let adminUserId: string;
  let adminMembershipId: string;

  let memberToken: string;
  let memberUserId: string;
  let memberMembershipId: string;

  let familyId: string;
  let branchId1: string;
  let branchId2: string;
  let treeMemberId: string;

  let testInviteToken: string;
  let testInviteId: string;

  beforeAll(async () => {
    await database.connect();

    // 1. Create Owner User
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'collab_owner@heritage.org',
        password: 'Password123!',
        name: 'Heritage Family Owner',
      });
    expect(ownerRes.status).toBe(201);
    ownerToken = ownerRes.body.data.accessToken;
    ownerUserId = ownerRes.body.data.user.id;

    // 2. Create Family
    const familyRes = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'The Collaboration Dynasty',
        description: 'A multi-branch lineage with strict administration and collaboration',
        motto: 'Honor and Integrity',
      });
    expect(familyRes.status).toBe(201);
    familyId = familyRes.body.data._id || familyRes.body.data.id;

    // 3. Create Admin User
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'collab_admin@heritage.org',
        password: 'Password123!',
        name: 'Dynasty Admin',
      });
    expect(adminRes.status).toBe(201);
    adminToken = adminRes.body.data.accessToken;
    adminUserId = adminRes.body.data.user.id || adminRes.body.data.user._id;

    // 4. Create Regular Member User
    const memberRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'collab_member@heritage.org',
        password: 'Password123!',
        name: 'Dynasty Relative',
      });
    expect(memberRes.status).toBe(201);
    memberToken = memberRes.body.data.accessToken;
    memberUserId = memberRes.body.data.user.id || memberRes.body.data.user._id;

    // 5. Create a Family Member node in the tree
    const treeNodeRes = await request(app)
      .post(`/api/families/${familyId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        firstName: 'Eleanor',
        lastName: 'Dynasty',
        gender: 'FEMALE',
        isLiving: true,
      });
    expect(treeNodeRes.status).toBe(201);
    treeMemberId = treeNodeRes.body.data._id || treeNodeRes.body.data.id;

    // 6. Invite and add Admin to family
    const inviteAdminRes = await request(app)
      .post(`/api/families/${familyId}/memberships/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'collab_admin@heritage.org',
        role: Role.FAMILY_ADMIN,
      });
    expect(inviteAdminRes.status).toBe(201);
    const adminInviteRawToken = inviteAdminRes.body.data.rawToken;

    // Admin accepts invite
    const acceptAdminRes = await request(app)
      .post('/api/auth/invitations/accept')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ token: adminInviteRawToken });
    expect(acceptAdminRes.status).toBe(200);

    // 7. Invite and add Member to family
    const inviteMemberRes = await request(app)
      .post(`/api/families/${familyId}/memberships/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'collab_member@heritage.org',
        role: Role.MEMBER,
        targetMemberId: treeMemberId,
      });
    expect(inviteMemberRes.status).toBe(201);
    const memberInviteRawToken = inviteMemberRes.body.data.rawToken;

    // Member accepts invite
    const acceptMemberRes = await request(app)
      .post('/api/auth/invitations/accept')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ token: memberInviteRawToken });
    expect(acceptMemberRes.status).toBe(200);

    // Retrieve memberships to store IDs
    const memsRes = await request(app)
      .get(`/api/families/${familyId}/memberships`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(memsRes.status).toBe(200);

    for (const m of memsRes.body.data) {
      if (m.userId === adminUserId || m.userId?._id === adminUserId) {
        adminMembershipId = m._id || m.id;
      }
      if (m.userId === memberUserId || m.userId?._id === memberUserId) {
        memberMembershipId = m._id || m.id;
      }
    }
  }, 25000);

  afterAll(async () => {
    await database.disconnect();
  });

  describe('1. Member Status Management & Owner Protection', () => {
    it('prevents an owner from suspending themselves', async () => {
      // Find owner membership ID
      const memsRes = await request(app)
        .get(`/api/families/${familyId}/memberships`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const ownerMem = memsRes.body.data.find(
        (m: any) => (m.userId === ownerUserId || m.userId?._id === ownerUserId)
      );

      const res = await request(app)
        .patch(`/api/families/${familyId}/memberships/${ownerMem._id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(403);
      const msg1 = res.body.error?.message || res.body.message;
      expect(msg1).toContain('Cannot suspend or reactivate your own membership');
    });

    it('prevents an admin from suspending a Family Owner', async () => {
      const memsRes = await request(app)
        .get(`/api/families/${familyId}/memberships`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const ownerMem = memsRes.body.data.find(
        (m: any) => (m.userId === ownerUserId || m.userId?._id === ownerUserId)
      );

      const res = await request(app)
        .patch(`/api/families/${familyId}/memberships/${ownerMem._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(403);
      const msg2 = res.body.error?.message || res.body.message;
      expect(msg2).toContain('Cannot suspend a Family Owner');
    });

    it('allows an owner to suspend a regular member', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyId}/memberships/${memberMembershipId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUSPENDED');
    });

    it('allows an owner to reactivate a suspended member', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyId}/memberships/${memberMembershipId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('prevents regular members from modifying roles or status', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyId}/memberships/${adminMembershipId}/status`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(403);
    });
  });

  describe('2. Invitation Experience & Security Protections', () => {
    it('creates an invitation and generates a secure raw token', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/memberships/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'future_relative@heritage.org',
          role: Role.CONTRIBUTOR,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.rawToken).toBeDefined();
      expect(res.body.data.invitation.id).toBeDefined();
      expect(res.body.data.invitation.status).toBe('PENDING');

      testInviteToken = res.body.data.rawToken;
      testInviteId = res.body.data.invitation.id;
    });

    it('prevents duplicate pending invitations to the same email address', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/memberships/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'future_relative@heritage.org',
          role: Role.MEMBER,
        });

      expect(res.status).toBe(409);
      const msg = res.body.error?.message || res.body.message;
      expect(msg).toContain('pending invitation for this email address already exists');
    });

    it('prevents inviting an email that already holds active membership in the family', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/memberships/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'collab_member@heritage.org',
          role: Role.MEMBER,
        });

      expect(res.status).toBe(409);
      const msg = res.body.error?.message || res.body.message;
      expect(msg).toContain('already an active member of this family');
    });

    it('previews invitation details without requiring authentication', async () => {
      const res = await request(app)
        .get(`/api/auth/invitations/preview?token=${testInviteToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.familyName).toBe('The Collaboration Dynasty');
      expect(res.body.data.invitedEmail).toBe('future_relative@heritage.org');
      expect(res.body.data.role).toBe(Role.CONTRIBUTOR);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.isExpired).toBe(false);
    });

    it('resends an existing invitation, updating expiry and generating a new raw token', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/memberships/invitations/${testInviteId}/resend`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.rawToken).toBeDefined();
      expect(res.body.data.invitation.status).toBe('PENDING');

      // Update the test invite token to the new one
      testInviteToken = res.body.data.rawToken;
    });

    it('declines an invitation securely', async () => {
      const res = await request(app)
        .post('/api/auth/invitations/decline')
        .send({ token: testInviteToken });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });
  });

  describe('3. Branch Management, Archiving & Member Transfer', () => {
    it('creates branches within the family', async () => {
      const res1 = await request(app)
        .post(`/api/families/${familyId}/branches`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Northern Dynasty Branch',
          description: 'Descendants from the northern territory',
          rootMemberId: treeMemberId,
          accentColor: '#3B82F6',
        });
      expect(res1.status).toBe(201);
      branchId1 = res1.body.data._id || res1.body.data.id;

      const res2 = await request(app)
        .post(`/api/families/${familyId}/branches`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Southern Dynasty Branch',
          description: 'Descendants from the southern territory',
          rootMemberId: treeMemberId,
          accentColor: '#10B981',
        });
      expect(res2.status).toBe(201);
      branchId2 = res2.body.data._id || res2.body.data.id;
    });

    it('assigns managers to a branch', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyId}/branches/${branchId1}/managers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          managerIds: [adminUserId],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.managerIds).toBeDefined();
    });

    it('transfers a member to a destination branch', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/branches/${branchId1}/transfer-member`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          memberId: treeMemberId,
          targetBranchId: branchId2,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.branchIds).toContain(branchId2);
    });

    it('archives a branch without deleting member records', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyId}/branches/${branchId1}/archive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ isArchived: true });

      expect(res.status).toBe(200);
      expect(res.body.data.isArchived).toBe(true);

      // Verify member record is intact
      const memberRes = await request(app)
        .get(`/api/families/${familyId}/members/${treeMemberId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(memberRes.status).toBe(200);
      expect(memberRes.body.data.firstName).toBe('Eleanor');
    });
  });

  describe('4. Permission Transparency & Audit Trail', () => {
    it('returns a comprehensive permission breakdown via my-permissions', async () => {
      const res = await request(app)
        .get(`/api/families/${familyId}/memberships/my-permissions`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(Role.FAMILY_OWNER);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.allowedActions.length).toBeGreaterThan(0);
      expect(res.body.data.prohibitedActions).toBeDefined();
    });

    it('retrieves enriched audit logs with filter support', async () => {
      const res = await request(app)
        .get(`/api/families/${familyId}/memberships/audit-logs/all?limit=20`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.logs).toBeDefined();
      expect(res.body.data.total).toBeGreaterThan(0);
      expect(Array.isArray(res.body.data.logs)).toBe(true);

      // Verify enriched actor name
      const firstLog = res.body.data.logs[0];
      expect(firstLog.actorName).toBeDefined();
      expect(firstLog.action).toBeDefined();
    });
  });
});
