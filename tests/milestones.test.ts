import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';
import { Role, AuditAction } from '../server/src/constants/index.ts';
import { AuditLog } from '../server/src/models/AuditLog.ts';

const app = createApp();

describe('Phase 6 — Milestones, Anniversaries, Recurrence & Reminders', () => {
  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;

  let familyAId: string;
  let familyBId: string;

  let memberA1Id: string;
  let memberA2Id: string;
  let branchA1Id: string;

  let birthdayMilestoneId: string;
  let weddingMilestoneId: string;
  let memorialMilestoneId: string;

  beforeAll(async () => {
    await database.connect();

    // 1. Register Owner
    const ownerRes = await request(app).post('/api/auth/register').send({
      email: 'milestone.owner@familyroots.org',
      password: 'Password123!',
      name: 'Milestone Vault Keeper',
    });
    expect(ownerRes.status).toBe(201);
    ownerToken = ownerRes.body.data.accessToken;

    // 2. Register Member in Family A
    const memberRes = await request(app).post('/api/auth/register').send({
      email: 'milestone.member@familyroots.org',
      password: 'Password123!',
      name: 'Milestone Family Member',
    });
    expect(memberRes.status).toBe(201);
    memberToken = memberRes.body.data.accessToken;

    // 3. Register Outsider in Family B
    const outsiderRes = await request(app).post('/api/auth/register').send({
      email: 'milestone.outsider@familyroots.org',
      password: 'Password123!',
      name: 'Unrelated Outsider',
    });
    expect(outsiderRes.status).toBe(201);
    outsiderToken = outsiderRes.body.data.accessToken;

    // 4. Create Family A (as Owner)
    const famARes = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'The Arun Heritage Vault',
        description: 'Multi-generational family archive',
      });
    expect(famARes.status).toBe(201);
    familyAId = famARes.body.data._id;

    // 5. Create Family B (as Outsider)
    const famBRes = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        name: 'The Isolated Smith Family',
        description: 'Isolated testing lineage',
      });
    expect(famBRes.status).toBe(201);
    familyBId = famBRes.body.data._id;

    // 6. Add members to Family A
    const m1Res = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        firstName: 'Arun',
        lastName: 'Varma',
        gender: 'MALE',
        dateOfBirth: '1948-03-12',
        occupation: 'Master Botanist',
      });
    expect(m1Res.status).toBe(201);
    memberA1Id = m1Res.body.data._id;

    const m2Res = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        firstName: 'Priya',
        lastName: 'Varma',
        gender: 'FEMALE',
        dateOfBirth: '1952-08-24',
        occupation: 'Classical Music Maestro',
      });
    expect(m2Res.status).toBe(201);
    memberA2Id = m2Res.body.data._id;

    // 7. Add branch in Family A
    const bRes = await request(app)
      .post(`/api/families/${familyAId}/branches`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Kumar Lineage Branch',
        description: 'Descendants of Kumar',
        rootMemberId: memberA1Id,
        accentColor: '#059669',
      });
    expect(bRes.status).toBe(201);
    branchA1Id = bRes.body.data._id;
  }, 20000);

  afterAll(async () => {
    await database.disconnect();
  });

  describe('1. Milestone CRUD Operations & Reminders', () => {
    it('creates a yearly recurring Birthday milestone with reminders & importance', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/milestones`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: "Patriarch Arun's Birthday Celebration",
          description: 'Gathering to celebrate Arun Varma with traditional feast.',
          eventType: 'BIRTHDAY',
          eventDate: '1948-03-12',
          location: 'Palakkad Ancestral House',
          importance: 'HIGH',
          recurrence: 'YEARLY',
          memberIds: [memberA1Id],
          branchIds: [branchA1Id],
          visibility: 'FAMILY',
          reminderSettings: {
            enabled: true,
            daysBefore: [1, 7],
            notifyChannels: ['EMAIL', 'IN_APP'],
            customMessage: 'Send festive blessings to grandfather Arun',
          },
          notes: 'Heirloom botanical records to be gifted.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isMilestone).toBe(true);
      expect(res.body.data.eventType).toBe('BIRTHDAY');
      expect(res.body.data.importance).toBe('HIGH');
      expect(res.body.data.recurrence).toBe('YEARLY');
      expect(res.body.data.reminderSettings.enabled).toBe(true);
      expect(res.body.data.reminderSettings.daysBefore).toEqual([1, 7]);
      birthdayMilestoneId = res.body.data._id;
    });

    it('creates a Wedding Anniversary milestone with recurrence', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/milestones`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Golden Wedding Anniversary of Arun & Priya',
          description: 'Fifty cherished years of union, music, and love.',
          eventType: 'ANNIVERSARY',
          eventDate: '1974-11-20',
          location: 'Mysore Heritage Hall',
          importance: 'CRITICAL',
          recurrence: 'YEARLY',
          memberIds: [memberA1Id, memberA2Id],
          branchIds: [branchA1Id],
          visibility: 'FAMILY',
          reminderSettings: {
            enabled: true,
            daysBefore: [7, 14],
            notifyChannels: ['EMAIL', 'IN_APP'],
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.eventType).toBe('ANNIVERSARY');
      weddingMilestoneId = res.body.data._id;
    });

    it('creates a Memorial Date milestone', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/milestones`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Remembrance of Great-Grandmother Shanta',
          description: 'Quiet reflection and lighting of brass oil lamps.',
          eventType: 'MEMORIAL',
          eventDate: '1988-05-10',
          importance: 'HIGH',
          recurrence: 'YEARLY',
          visibility: 'FAMILY',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.eventType).toBe('MEMORIAL');
      memorialMilestoneId = res.body.data._id;
    });

    it('retrieves all milestones with calculated fields (daysAway, anniversaryLabel, nextOccurrenceDate)', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/milestones`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);

      const birthday = res.body.data.find((m: any) => m._id === birthdayMilestoneId);
      expect(birthday).toBeDefined();
      expect(birthday.daysAway).not.toBeNull();
      expect(birthday.nextOccurrenceDate).toBeDefined();
      expect(birthday.anniversaryLabel).toBeDefined(); // e.g. "78th Birthday"

      const wedding = res.body.data.find((m: any) => m._id === weddingMilestoneId);
      expect(wedding).toBeDefined();
      expect(wedding.anniversaryLabel).toContain('Anniversary');

      // Verify grouped structure
      expect(res.body.grouped).toBeDefined();
      expect(res.body.grouped.upcoming).toBeDefined();
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.total).toBeGreaterThanOrEqual(3);
    });

    it('retrieves a single milestone by id', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/milestones/${birthdayMilestoneId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(birthdayMilestoneId);
      expect(res.body.data.title).toContain('Birthday');
      expect(res.body.data.anniversaryLabel).toBeDefined();
    });

    it('updates milestone reminder and notes via PATCH', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyAId}/milestones/${birthdayMilestoneId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: "Patriarch Arun's Grand Birthday Jubilee",
          importance: 'CRITICAL',
          reminderSettings: {
            enabled: true,
            daysBefore: [1, 3, 7],
            notifyChannels: ['EMAIL', 'IN_APP'],
            customMessage: 'Bring hand-pressed floral garlands',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toContain('Grand Birthday Jubilee');
      expect(res.body.data.importance).toBe('CRITICAL');
      expect(res.body.data.reminderSettings.daysBefore).toEqual([1, 3, 7]);
    });

    it('filters milestones by eventType and importance', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/milestones?eventType=BIRTHDAY`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((m: any) => m.eventType === 'BIRTHDAY')).toBe(true);
    });
  });

  describe('2. Recurrence Math & Timeframe Filtering', () => {
    it('creates a milestone happening today to verify isToday flag', async () => {
      const today = new Date();
      const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
        today.getDate()
      ).padStart(2, '0')}`;

      const res = await request(app)
        .post(`/api/families/${familyAId}/milestones`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: "Annual Family Reunion Celebration",
          eventType: 'REUNION',
          eventDate: todayDateStr,
          importance: 'HIGH',
          recurrence: 'YEARLY',
        });

      expect(res.status).toBe(201);
      const todayMilestoneId = res.body.data._id;

      // Query today's milestones
      const queryRes = await request(app)
        .get(`/api/families/${familyAId}/milestones?timeframe=today`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(queryRes.status).toBe(200);
      const todayMatch = queryRes.body.data.find((m: any) => m._id === todayMilestoneId);
      expect(todayMatch).toBeDefined();
      expect(todayMatch.isToday).toBe(true);
      expect(todayMatch.daysAway).toBe(0);
    });

    it('queries this month milestones', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/milestones?timeframe=month`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('3. Family Isolation & Security Boundary', () => {
    it('prevents an outsider user from viewing Family A milestones', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/milestones`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });

    it('prevents an outsider user from creating a milestone in Family A', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/milestones`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          title: 'Illicit Milestone Infiltration',
          eventType: 'CUSTOM',
          eventDate: '2026-10-10',
        });

      expect(res.status).toBe(403);
    });

    it('prevents an outsider user from deleting Family A milestone', async () => {
      const res = await request(app)
        .delete(`/api/families/${familyAId}/milestones/${birthdayMilestoneId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('4. Audit Logging for Milestones', () => {
    it('verifies that MILESTONE_CREATED and MILESTONE_UPDATED are recorded in AuditLog', async () => {
      const logs = await AuditLog.find({
        familyId: familyAId,
        action: { $in: [AuditAction.MILESTONE_CREATED, AuditAction.MILESTONE_UPDATED] },
      }).sort({ createdAt: -1 });

      expect(logs.length).toBeGreaterThanOrEqual(2);
      const createLog = logs.find((l) => l.action === AuditAction.MILESTONE_CREATED);
      expect(createLog).toBeDefined();
      expect(createLog?.entityType).toBe('FamilyEvent');
    });

    it('deletes a milestone and confirms MILESTONE_DELETED audit log is produced', async () => {
      const delRes = await request(app)
        .delete(`/api/families/${familyAId}/milestones/${memorialMilestoneId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const deleteLog = await AuditLog.findOne({
        familyId: familyAId,
        action: AuditAction.MILESTONE_DELETED,
        entityId: memorialMilestoneId,
      });

      expect(deleteLog).toBeDefined();
    });
  });
});
