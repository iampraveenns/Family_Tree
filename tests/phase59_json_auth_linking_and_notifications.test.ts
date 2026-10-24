import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';
import { FamilyMember } from '../server/src/models/FamilyMember.ts';
import { FamilyNotification } from '../server/src/models/FamilyNotification.ts';

const app = createApp();

describe('Phase 59: JSON Authentication, Account-to-Node Linking, and Notifications System', () => {
  let adminToken: string;
  let adminUserId: string;
  let adminEmail = 'family.admin@treetest.org';
  let familyId: string;
  let adminMemberId: string;

  let relativeEmail = 'arun.pattara@treetest.org';
  let relativeUserId: string;

  beforeAll(async () => {
    await database.connect();
  }, 15000);

  afterAll(async () => {
    await database.disconnect();
  });

  describe('1. JSON-Based Authentication & Root Account Provisioning', () => {
    it('registers a user via JSON payload and generates family vault and root node', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Admin Founder',
          email: adminEmail,
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(adminEmail);

      adminToken = res.body.data.accessToken;
      adminUserId = res.body.data.user.id;

      // Verify that a Family was provisioned and linked to admin
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user).toBeDefined();

      const famRes = await request(app)
        .get('/api/families')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(famRes.status).toBe(200);
      expect(famRes.body.data.length).toBeGreaterThan(0);
      familyId = famRes.body.data[0]._id || famRes.body.data[0].id;

      // Find root member node
      const membersRes = await request(app)
        .get(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(membersRes.status).toBe(200);
      expect(membersRes.body.data.length).toBeGreaterThan(0);
      const rootNode = membersRes.body.data[0];
      adminMemberId = rootNode._id || rootNode.id;

      // Verify root node is directly linked to admin user id
      expect(rootNode.linkedUserId?.toString()).toBe(adminUserId);
    });

    it('authenticates user login via JSON credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminEmail,
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });
  });

  describe('2. Strict Rule: Node Creation Requires Registered Account & 1:1 Linking', () => {
    it('rejects member node creation when the specified email is not a registered user account', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Unregistered',
          lastName: 'Person',
          gender: 'MALE',
          isLiving: true,
          registeredEmail: 'ghost.relative@nonexistent.org',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/registered account/i);
    });

    it('successfully registers an account for Arun Pattara via JSON authentication', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Arun Pattara',
          email: relativeEmail,
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      relativeUserId = res.body.data.user.id;
    });

    it('successfully creates member node for Arun Pattara and maps directly to their registered account', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Arun',
          lastName: 'Pattara',
          gender: 'MALE',
          isLiving: true,
          registeredEmail: relativeEmail,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.displayName).toBe('Arun Pattara');
      expect(res.body.data.linkedUserId.toString()).toBe(relativeUserId);
      expect(res.body.data.registeredEmail).toBe(relativeEmail);

      // Verify database record
      const memberInDb = await FamilyMember.findById(res.body.data._id);
      expect(memberInDb).toBeDefined();
      expect(memberInDb!.linkedUserId?.toString()).toBe(relativeUserId);
    });

    it('rejects duplicate member node creation for the same registered account in the family', async () => {
      const res = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Arun Duplicate',
          lastName: 'Pattara',
          gender: 'MALE',
          isLiving: true,
          registeredEmail: relativeEmail,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already linked/i);
    });
  });

  describe('3. Notification System Triggers & Retrieval', () => {
    it('dispatches MEMBER_ADDED notification to family members when a new relative is added', async () => {
      // Register third account
      const nieceEmail = 'priya.pattara@treetest.org';
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priya Pattara',
          email: nieceEmail,
          password: 'Password123!',
        });

      // Add Priya to tree
      const addRes = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Priya',
          lastName: 'Pattara',
          gender: 'FEMALE',
          isLiving: true,
          registeredEmail: nieceEmail,
        });

      expect(addRes.status).toBe(201);

      // Check notifications in database for this family
      const notifs = await FamilyNotification.find({
        familyId,
        type: 'MEMBER_ADDED',
      });

      expect(notifs.length).toBeGreaterThan(0);
      const memberAddedNotif = notifs.find((n) => n.message.includes('Priya Pattara was added'));
      expect(memberAddedNotif).toBeDefined();
      expect(memberAddedNotif?.title).toBe('New Relative Added');
    });

    it('dispatches MEMORY_ADDED notification to family members when a memory is posted', async () => {
      const memoryRes = await request(app)
        .post(`/api/families/${familyId}/memories`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Golden Jubilee Gathering',
          description: 'A beautiful reunion with all family generations together.',
          memoryType: 'STORY',
          visibility: 'FAMILY',
          memberIds: [adminMemberId],
        });

      expect(memoryRes.status).toBe(201);

      // Check notifications in database for this family
      const notifs = await FamilyNotification.find({
        familyId,
        type: 'MEMORY_ADDED',
      });

      expect(notifs.length).toBeGreaterThan(0);
      const memoryAddedNotif = notifs.find((n) => n.title === 'New Memory Shared');
      expect(memoryAddedNotif).toBeDefined();
      expect(memoryAddedNotif?.message).toContain('Golden Jubilee Gathering');
    });

    it('allows family members to fetch notifications via /api/families/:familyId/notifications', async () => {
      // Log in as Arun Pattara (who was recipient of notifications when Priya and Memory were added)
      const arunLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: relativeEmail,
          password: 'Password123!',
        });
      const arunToken = arunLogin.body.data.accessToken;

      const notifRes = await request(app)
        .get(`/api/families/${familyId}/notifications`)
        .set('Authorization', `Bearer ${arunToken}`);

      expect(notifRes.status).toBe(200);
      expect(notifRes.body.success).toBe(true);
      expect(Array.isArray(notifRes.body.data.notifications)).toBe(true);
      expect(notifRes.body.data.notifications.length).toBeGreaterThan(0);
      expect(notifRes.body.data.unreadCount).toBeGreaterThan(0);

      // Verify marking notification as read
      const firstNotifId = notifRes.body.data.notifications[0]._id;
      const readRes = await request(app)
        .patch(`/api/families/${familyId}/notifications/${firstNotifId}/read`)
        .set('Authorization', `Bearer ${arunToken}`);

      expect(readRes.status).toBe(200);
      expect(readRes.body.success).toBe(true);
      expect(readRes.body.data.isRead).toBe(true);
    });
  });
});
