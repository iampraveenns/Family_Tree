import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';
import { config } from '../server/src/config/index.ts';
import { Role, Permission, UserStatus, MemoryVisibility, MemoryType } from '../server/src/constants/index.ts';
import { User } from '../server/src/models/User.ts';
import { FamilyMembership } from '../server/src/models/FamilyMembership.ts';
import { Memory } from '../server/src/models/Memory.ts';
import { FamilyEvent } from '../server/src/models/FamilyEvent.ts';
import { MemoryCollection } from '../server/src/models/MemoryCollection.ts';
import { getMediaStorageService } from '../server/src/services/storage/MediaStorageService.ts';

const app = createApp();

describe('Phase 17: Production Security & Data Protection Test Suite', () => {
  let userA1Token: string;
  let userA1Id: string;

  let viewerAToken: string;
  let viewerAId: string;

  let userBToken: string;
  let userBId: string;

  let familyAId: string;
  let familyBId: string;

  let memberAId: string;
  let memberBId: string;

  let memoryAId: string;
  let privateMemoryAId: string;
  let memoryBId: string;

  let eventAId: string;
  let eventBId: string;

  let collectionAId: string;
  let collectionBId: string;

  let relAId: string;
  let relBId: string;

  let mediaAId: string;

  beforeAll(async () => {
    await database.connect();

    // 1. Register User A1 (Owner of Family A)
    const regA1 = await request(app).post('/api/auth/register').send({
      email: 'sec_owner_a@familyroots.org',
      password: 'StrongP@ssw0rd2026!',
      name: 'Owner Family A',
    });
    expect(regA1.status).toBe(201);
    userA1Token = regA1.body.data.accessToken;
    userA1Id = regA1.body.data.user.id;

    // 2. Register Viewer in Family A
    const regViewer = await request(app).post('/api/auth/register').send({
      email: 'sec_viewer_a@familyroots.org',
      password: 'StrongP@ssw0rd2026!',
      name: 'Viewer Family A',
    });
    viewerAToken = regViewer.body.data.accessToken;
    viewerAId = regViewer.body.data.user.id;

    // 3. Register User B (Owner of Family B)
    const regB = await request(app).post('/api/auth/register').send({
      email: 'sec_owner_b@familyroots.org',
      password: 'StrongP@ssw0rd2026!',
      name: 'Owner Family B',
    });
    userBToken = regB.body.data.accessToken;
    userBId = regB.body.data.user.id;

    // 4. Create Family A
    const famA = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${userA1Token}`)
      .send({ name: 'Alpha Clan', description: 'Family A Protected Domain' });
    familyAId = famA.body.data._id;

    // 5. Create Family B
    const famB = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ name: 'Beta Clan', description: 'Family B Isolated Domain' });
    familyBId = famB.body.data._id;

    // 6. Assign Viewer to Family A
    await FamilyMembership.create({
      userId: viewerAId,
      familyId: familyAId,
      role: Role.VIEWER,
      status: 'ACTIVE',
      permissions: [Permission.VIEW_FAMILY, Permission.VIEW_MEMBER, Permission.VIEW_MEMORY],
    });

    // 7. Create Members in Family A
    const memARes = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${userA1Token}`)
      .send({ firstName: 'Arthur', lastName: 'Pendleton', gender: 'MALE' });
    memberAId = memARes.body.data._id;

    const memA2Res = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${userA1Token}`)
      .send({ firstName: 'Guinevere', lastName: 'Pendleton', gender: 'FEMALE' });
    const memberA2Id = memA2Res.body.data._id;

    // 8. Create Member in Family B
    const memBRes = await request(app)
      .post(`/api/families/${familyBId}/members`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ firstName: 'Boris', lastName: 'Bavaria', gender: 'MALE' });
    memberBId = memBRes.body.data._id;

    const memB2Res = await request(app)
      .post(`/api/families/${familyBId}/members`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ firstName: 'Bella', lastName: 'Bavaria', gender: 'FEMALE' });
    const memberB2Id = memB2Res.body.data._id;

    // 9. Create Relationships in A and B
    const relARes = await request(app)
      .post(`/api/families/${familyAId}/relationships`)
      .set('Authorization', `Bearer ${userA1Token}`)
      .send({
        sourceMemberId: memberAId,
        targetMemberId: memberA2Id,
        relationshipType: 'SPOUSE',
      });
    relAId = relARes.body.data._id;

    const relBRes = await request(app)
      .post(`/api/families/${familyBId}/relationships`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        sourceMemberId: memberBId,
        targetMemberId: memberB2Id,
        relationshipType: 'SPOUSE',
      });
    relBId = relBRes.body.data._id;

    // 10. Create Memories in Family A (Public family vs Private)
    const mem1Res = await request(app)
      .post(`/api/families/${familyAId}/memories`)
      .set('Authorization', `Bearer ${userA1Token}`)
      .send({
        title: 'Alpha Family Reunion',
        memoryType: MemoryType.STORY,
        visibility: MemoryVisibility.FAMILY,
      });
    memoryAId = mem1Res.body.data._id;

    const privRes = await request(app)
      .post(`/api/families/${familyAId}/memories`)
      .set('Authorization', `Bearer ${userA1Token}`)
      .send({
        title: 'Secret Diary Entry',
        memoryType: MemoryType.STORY,
        visibility: MemoryVisibility.PRIVATE,
      });
    privateMemoryAId = privRes.body.data._id;

    // Memory in Family B
    const memBMemRes = await request(app)
      .post(`/api/families/${familyBId}/memories`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        title: 'Beta Secret Records',
        memoryType: MemoryType.STORY,
        visibility: MemoryVisibility.FAMILY,
      });
    memoryBId = memBMemRes.body.data._id;

    // 11. Create Events in A and B
    const evtARes = await request(app)
      .post(`/api/families/${familyAId}/events`)
      .set('Authorization', `Bearer ${userA1Token}`)
      .send({
        title: 'Alpha Clan Founding',
        eventType: 'CUSTOM',
        importance: 'HIGH',
      });
    eventAId = evtARes.body.data._id;

    const evtBRes = await request(app)
      .post(`/api/families/${familyBId}/events`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        title: 'Beta Clan Founding',
        eventType: 'CUSTOM',
        importance: 'HIGH',
      });
    eventBId = evtBRes.body.data._id;

    // 12. Create Collections in A and B
    const colARes = await request(app)
      .post(`/api/families/${familyAId}/collections`)
      .set('Authorization', `Bearer ${userA1Token}`)
      .send({
        title: 'Alpha Heirlooms',
        description: 'Vintage artifacts of Family A',
      });
    collectionAId = colARes.body.data._id;

    const colBRes = await request(app)
      .post(`/api/families/${familyBId}/collections`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        title: 'Beta Vault',
        description: 'Classified artifacts of Family B',
      });
    collectionBId = colBRes.body.data._id;

    // 13. Create an actual Media file for media tests
    const validPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const uploadRes = await request(app)
      .post(`/api/memories/${memoryAId}/media`)
      .set('Authorization', `Bearer ${userA1Token}`)
      .attach('file', validPngBuffer, { filename: 'alpha_crest.png', contentType: 'image/png' });
    mediaAId = uploadRes.body.data._id;
  }, 20000);

  afterAll(async () => {
    await database.disconnect();
  });

  // =========================================================================
  // 1. AUTHENTICATION SECURITY & TOKEN VERIFICATION
  // =========================================================================
  describe('1. Authentication Security', () => {
    it('rejects protected endpoints when no authentication token is provided', async () => {
      const res = await request(app).get(`/api/members/${memberAId}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects forged JWT tokens with invalid signatures', async () => {
      const fakeToken = jwt.sign(
        { sub: userA1Id, email: 'fake@hacker.io' },
        'wrong-secret-key-attacker-guess',
        { expiresIn: '1h' }
      );
      const res = await request(app)
        .get(`/api/members/${memberAId}`)
        .set('Authorization', `Bearer ${fakeToken}`);
      expect(res.status).toBe(401);
    });

    it('rejects expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { sub: userA1Id, email: 'sec_owner_a@familyroots.org' },
        config.JWT_SECRET,
        { expiresIn: '-10s' }
      );
      const res = await request(app)
        .get(`/api/members/${memberAId}`)
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it('blocks suspended users from accessing APIs', async () => {
      await User.findByIdAndUpdate(userBId, { status: UserStatus.SUSPENDED });
      const res = await request(app)
        .get(`/api/families/${familyBId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/suspended/i);

      // Restore user B status
      await User.findByIdAndUpdate(userBId, { status: UserStatus.ACTIVE });
    });
  });

  // =========================================================================
  // 2. CROSS-FAMILY ISOLATION (IDOR DEFENSE)
  // =========================================================================
  describe('2. Cross-Family Isolation (IDOR Defense)', () => {
    it('prevents User A from accessing Family B details via /families/:familyId', async () => {
      const res = await request(app)
        .get(`/api/families/${familyBId}`)
        .set('Authorization', `Bearer ${userA1Token}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('prevents User A from viewing Family B members via /members/:memberId', async () => {
      const res = await request(app)
        .get(`/api/members/${memberBId}`)
        .set('Authorization', `Bearer ${userA1Token}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('prevents User A from modifying Family B members via /members/:memberId', async () => {
      const res = await request(app)
        .patch(`/api/members/${memberBId}`)
        .set('Authorization', `Bearer ${userA1Token}`)
        .send({ firstName: 'Hacked' });
      expect(res.status).toBe(403);
    });

    it('prevents User A from deleting Family B members via /members/:memberId', async () => {
      const res = await request(app)
        .delete(`/api/members/${memberBId}`)
        .set('Authorization', `Bearer ${userA1Token}`);
      expect(res.status).toBe(403);
    });

    it('prevents User A from accessing Family B memories via /memories/:memoryId', async () => {
      const res = await request(app)
        .get(`/api/memories/${memoryBId}`)
        .set('Authorization', `Bearer ${userA1Token}`);
      expect(res.status).toBe(403);
    });

    it('prevents User A from viewing Family B timeline events via /timeline/:eventId', async () => {
      const res = await request(app)
        .get(`/api/timeline/${eventBId}`)
        .set('Authorization', `Bearer ${userA1Token}`);
      expect(res.status).toBe(403);
    });

    it('prevents User A from deleting Family B timeline events via /timeline/:eventId', async () => {
      const res = await request(app)
        .delete(`/api/timeline/${eventBId}`)
        .set('Authorization', `Bearer ${userA1Token}`);
      expect(res.status).toBe(403);
    });

    it('prevents User A from accessing Family B collections via /collections/:collectionId', async () => {
      const res = await request(app)
        .get(`/api/collections/${collectionBId}`)
        .set('Authorization', `Bearer ${userA1Token}`);
      expect(res.status).toBe(403);
    });

    it('prevents User A from viewing Family B relationships via /relationships/:relationshipId', async () => {
      const res = await request(app)
        .get(`/api/relationships/${relBId}`)
        .set('Authorization', `Bearer ${userA1Token}`);
      expect(res.status).toBe(403);
    });

    it('rejects cross-family member access when spoofed in nested route /families/:familyAId/members/:memberBId', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/members/${memberBId}`)
        .set('Authorization', `Bearer ${userA1Token}`);
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 3. RBAC BOUNDARY ENFORCEMENT
  // =========================================================================
  describe('3. Role Privilege Boundary Enforcement', () => {
    it('prevents VIEWER from creating family members', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/members`)
        .set('Authorization', `Bearer ${viewerAToken}`)
        .send({ firstName: 'Illegal', lastName: 'Addition', gender: 'MALE' });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/permission denied|lacks/i);
    });

    it('prevents VIEWER from deleting family members', async () => {
      const res = await request(app)
        .delete(`/api/members/${memberAId}`)
        .set('Authorization', `Bearer ${viewerAToken}`);
      expect(res.status).toBe(403);
    });

    it('allows VIEWER to read permitted family members', async () => {
      const res = await request(app)
        .get(`/api/members/${memberAId}`)
        .set('Authorization', `Bearer ${viewerAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('Arthur');
    });
  });

  // =========================================================================
  // 4. MEMORY & MEDIA PRIVACY CONTROLS
  // =========================================================================
  describe('4. Memory & Media Privacy', () => {
    it('prevents other members from viewing PRIVATE memories authored by another user', async () => {
      const res = await request(app)
        .get(`/api/memories/${privateMemoryAId}`)
        .set('Authorization', `Bearer ${viewerAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/private/i);
    });

    it('allows the author to access their own private memory', async () => {
      const res = await request(app)
        .get(`/api/memories/${privateMemoryAId}`)
        .set('Authorization', `Bearer ${userA1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Secret Diary Entry');
    });

    it('rejects direct media access when user does not belong to authorized family', async () => {
      const res = await request(app)
        .get(`/api/media/${mediaAId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(403);
    });

    it('rejects signed media URL with tampered signature', async () => {
      const storageService = getMediaStorageService();
      const signedUrl = storageService.generateSignedUrl(mediaAId, { expiresInSeconds: 300 });
      const tamperedUrl = signedUrl.replace(/token=[a-f0-9]{10}/, 'token=0000000000');

      const pathOnly = tamperedUrl.replace(/^https?:\/\/[^/]+/, '');
      const res = await request(app).get(pathOnly);
      expect([401, 403]).toContain(res.status);
      expect(res.body.message).toMatch(/signature|invalid|unauthorized/i);
    });

    it('rejects signed media URL that has expired', async () => {
      const storageService = getMediaStorageService();
      // Generate URL expired 10 seconds in the past
      const expiredUrl = storageService.generateSignedUrl(mediaAId, { expiresInSeconds: -10 });

      const pathOnly = expiredUrl.replace(/^https?:\/\/[^/]+/, '');
      const res = await request(app).get(pathOnly);
      expect([401, 403]).toContain(res.status);
      expect(res.body.message).toMatch(/expired|invalid|unauthorized/i);
    });
  });

  // =========================================================================
  // 5. FILE UPLOAD SECURITY
  // =========================================================================
  describe('5. File Upload Security', () => {
    it('rejects disallowed executable file extensions (.exe)', async () => {
      const fakeExeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
      const res = await request(app)
        .post(`/api/memories/${memoryAId}/media`)
        .set('Authorization', `Bearer ${userA1Token}`)
        .attach('file', fakeExeBuffer, 'virus.exe');
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/unsupported or dangerous/i);
    });

    it('rejects binary header magic byte mismatch (executable disguised as .jpg)', async () => {
      const fakeJpgBuffer = Buffer.from('MZ\x90\x00Executable binary content');
      const res = await request(app)
        .post(`/api/memories/${memoryAId}/media`)
        .set('Authorization', `Bearer ${userA1Token}`)
        .attach('file', fakeJpgBuffer, 'photo.jpg');
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/magic bytes|header/i);
    });

    it('accepts valid images with authentic magic bytes', async () => {
      const validPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );
      const res = await request(app)
        .post(`/api/memories/${memoryAId}/media`)
        .set('Authorization', `Bearer ${userA1Token}`)
        .attach('file', validPng, 'portrait.png');
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mimeType).toBe('image/png');
    });
  });
});
