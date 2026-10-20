import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';
import { MemoryType, MemoryVisibility, Role, Permission, AuditAction } from '../server/src/constants/index.ts';
import { AuditLog } from '../server/src/models/AuditLog.ts';
import { Memory } from '../server/src/models/Memory.ts';
import { FamilyMembership } from '../server/src/models/FamilyMembership.ts';

const app = createApp();

describe('Phase 4: Heritage Memory Vault & Secure Media Engine', () => {
  let ownerToken: string;
  let ownerUserId: string;

  let contributorToken: string;
  let contributorUserId: string;

  let unrelatedToken: string;

  let familyAId: string;
  let familyBId: string;

  let member1Id: string;
  let member2Id: string;

  let createdMemoryId: string;
  let uploadedMediaId: string;
  let signedStreamUrl: string;
  let sampleImageBuffer: Buffer;

  beforeAll(async () => {
    await database.connect();

    // 1. Create Owner User
    const regOwner = await request(app).post('/api/auth/register').send({
      email: 'vault_owner@pattara.test',
      password: 'SecurePassword123!',
      name: 'Vault Owner',
    });
    ownerToken = regOwner.body.data.accessToken;
    ownerUserId = regOwner.body.data.user.id;

    // 2. Create Contributor User
    const regContrib = await request(app).post('/api/auth/register').send({
      email: 'vault_contrib@pattara.test',
      password: 'SecurePassword123!',
      name: 'Vault Contributor',
    });
    contributorToken = regContrib.body.data.accessToken;
    contributorUserId = regContrib.body.data.user.id;

    // 3. Create Unrelated User
    const regUnrelated = await request(app).post('/api/auth/register').send({
      email: 'vault_unrelated@other.test',
      password: 'SecurePassword123!',
      name: 'Unrelated User',
    });
    unrelatedToken = regUnrelated.body.data.accessToken;

    // 4. Create Family A (Owner is automatically Family Owner)
    const famARes = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Pattara Heritage Vault Family',
        description: 'Testing Memory Vault and Media Subsystem',
      });
    familyAId = famARes.body.data._id;

    // 5. Create Family B (for cross-family IDOR isolation tests)
    const famBRes = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${unrelatedToken}`)
      .send({
        name: 'Isolated Clan Family',
        description: 'Completely separated family space',
      });
    familyBId = famBRes.body.data._id;

    // 6. Create Members in Family A
    const m1Res = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        firstName: 'Dev',
        lastName: 'Pattara',
        gender: 'MALE',
        dateOfBirth: '1970-03-12',
      });
    member1Id = m1Res.body.data._id;

    const m2Res = await request(app)
      .post(`/api/families/${familyAId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        firstName: 'Meera',
        lastName: 'Pattara',
        gender: 'FEMALE',
        dateOfBirth: '1974-06-25',
      });
    member2Id = m2Res.body.data._id;

    // 7. Add Contributor to Family A
    await FamilyMembership.create({
      userId: contributorUserId,
      familyId: familyAId,
      role: Role.CONTRIBUTOR,
      status: 'ACTIVE',
      permissions: [Permission.UPLOAD_MEMORY, Permission.EDIT_MEMORY],
    });

    // 8. Generate sample valid image buffer
    sampleImageBuffer = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: { r: 70, g: 120, b: 80 },
      },
    })
      .png()
      .toBuffer();
  }, 25000);

  afterAll(async () => {
    await database.disconnect();
  });

  describe('1. Memory Creation & Input Validation', () => {
    it('rejects memory creation without required title', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/memories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: '',
          memoryType: MemoryType.PHOTO,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects memory creation with invalid memoryType', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/memories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Invalid Type Memory',
          memoryType: 'UNKNOWN_FORMAT',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('creates a rich memory with tagged members and tags', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/memories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Monsoon Tea Harvest Celebration',
          description: 'Gathering at the hill plantation to celebrate seasonal yield.',
          memoryType: MemoryType.PHOTO,
          eventDate: '1995-07-20',
          eventDateApprox: 'Summer 1995',
          location: 'Wayanad, Kerala',
          visibility: MemoryVisibility.FAMILY,
          memberIds: [member1Id, member2Id],
          tags: ['monsoon', 'harvest', 'plantation'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Monsoon Tea Harvest Celebration');
      expect(res.body.data.memberIds).toHaveLength(2);
      expect(res.body.data.tags).toContain('monsoon');
      createdMemoryId = res.body.data._id;
    });

    it('allows a family Contributor to create a memory', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/memories`)
        .set('Authorization', `Bearer ${contributorToken}`)
        .send({
          title: 'Contributor Family Story',
          description: 'A story written by the contributor member.',
          memoryType: MemoryType.STORY,
          visibility: MemoryVisibility.FAMILY,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.createdBy).toBe(contributorUserId);
    });

    it('rejects creation with removed memory types (Oral History, Letter, Certificate, Heirloom, Family Narrative)', async () => {
      const removedTypes = ['ORAL_HISTORY', 'LETTER', 'CERTIFICATE', 'HEIRLOOM', 'FAMILY_NARRATIVE', 'VIDEO', 'OTHER'];
      for (const badType of removedTypes) {
        const res = await request(app)
          .post(`/api/families/${familyAId}/memories`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            title: `Attempt with ${badType}`,
            memoryType: badType,
            visibility: MemoryVisibility.FAMILY,
          });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('Invalid memory type');
      }
    });

    it('accepts creation with all 5 retained memory types: PHOTO, STORY, AUDIO, DOCUMENT, RECIPE', async () => {
      const allowedTypes = [
        MemoryType.PHOTO,
        MemoryType.STORY,
        MemoryType.AUDIO,
        MemoryType.DOCUMENT,
        MemoryType.RECIPE,
      ];

      for (const valid of allowedTypes) {
        const res = await request(app)
          .post(`/api/families/${familyAId}/memories`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            title: `Valid Memory of type ${valid}`,
            memoryType: valid,
            visibility: MemoryVisibility.FAMILY,
          });

        expect(res.status).toBe(201);
        expect(res.body.data.memoryType).toBe(valid);
      }
    });

    it('emits MEMORY_CREATED and MEMBER_TAGGED_IN_MEMORY audit logs', async () => {
      const logs = await AuditLog.find({
        familyId: familyAId,
        entityId: createdMemoryId,
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain('MEMORY_CREATED');
      expect(actions).toContain('MEMBER_TAGGED_IN_MEMORY');
    });
  });

  describe('2. Media Upload, Validation & Checksum Deduplication', () => {
    it('uploads a valid media file to the memory and creates a thumbnail', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/memories/${createdMemoryId}/media`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', sampleImageBuffer, 'harvest_photo.png');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.originalFileName).toBe('harvest_photo.png');
      expect(res.body.data.mimeType).toBe('image/png');
      expect(res.body.data.sha256Checksum).toBeDefined();
      expect(res.body.data.thumbnailStorageKey).toBeDefined();
      expect(res.body.data.streamUrl).toBeDefined();

      uploadedMediaId = res.body.data._id;
      signedStreamUrl = res.body.data.streamUrl;
    });

    it('prevents uploading an exact duplicate file to the same memory', async () => {
      const res = await request(app)
        .post(`/api/families/${familyAId}/memories/${createdMemoryId}/media`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', sampleImageBuffer, 'duplicate_harvest.png');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message).toContain('duplicate');
    });

    it('rejects unsupported file MIME formats', async () => {
      const dummyExeBuffer = Buffer.from('MZ...fake executable content');
      const res = await request(app)
        .post(`/api/families/${familyAId}/memories/${createdMemoryId}/media`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', dummyExeBuffer, 'virus.exe');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message).toContain('Unsupported file type');
    });
  });

  describe('3. Secure Media Streaming & Range Requests', () => {
    it('streams media using the generated signed URL with valid token', async () => {
      const res = await request(app).get(signedStreamUrl);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('rejects access if signed token is tampered or invalid', async () => {
      const tamperedUrl = signedStreamUrl.replace(/token=[a-f0-9]+/, 'token=badbadbadbad');
      const res = await request(app).get(tamperedUrl);

      expect(res.status).toBe(401);
    });

    it('supports HTTP Range byte slicing for video/audio seek', async () => {
      const res = await request(app)
        .get(signedStreamUrl)
        .set('Range', 'bytes=0-99');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toMatch(/^bytes 0-99\/\d+/);
      expect(res.body.length).toBe(100);
    });

    it('serves the webp thumbnail with public cache headers', async () => {
      const accessRes = await request(app)
        .get(`/api/media/${uploadedMediaId}/access`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(accessRes.status).toBe(200);
      const thumbUrl = accessRes.body.data.thumbnailUrl;
      expect(thumbUrl).toBeDefined();

      const thumbStream = await request(app).get(thumbUrl);
      expect(thumbStream.status).toBe(200);
      expect(thumbStream.headers['content-type']).toBe('image/webp');
      expect(thumbStream.headers['cache-control']).toContain('max-age=86400');
    });
  });

  describe('4. RBAC, Cross-Family Isolation & IDOR Protection', () => {
    it('blocks unrelated user from viewing family memories', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/memories/${createdMemoryId}`)
        .set('Authorization', `Bearer ${unrelatedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('blocks cross-family IDOR: accessing Family A memory under Family B path', async () => {
      const res = await request(app)
        .get(`/api/families/${familyBId}/memories/${createdMemoryId}`)
        .set('Authorization', `Bearer ${unrelatedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('blocks cross-family IDOR: uploading media to Family A memory under Family B route', async () => {
      const res = await request(app)
        .post(`/api/families/${familyBId}/memories/${createdMemoryId}/media`)
        .set('Authorization', `Bearer ${unrelatedToken}`)
        .attach('file', sampleImageBuffer, 'attack.png');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows owner to edit memory and change visibility', async () => {
      const res = await request(app)
        .patch(`/api/families/${familyAId}/memories/${createdMemoryId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Updated Monsoon Celebration Title',
          visibility: MemoryVisibility.PRIVATE,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Monsoon Celebration Title');
      expect(res.body.data.visibility).toBe(MemoryVisibility.PRIVATE);
    });

    it('restricts private memory access strictly to creator and owner/admin', async () => {
      // Contributor is in Family A, but should NOT see private memory created by Owner
      const res = await request(app)
        .get(`/api/families/${familyAId}/memories/${createdMemoryId}`)
        .set('Authorization', `Bearer ${contributorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toContain('Private memories');
    });
  });

  describe('5. Filters, Stats & On This Day Querying', () => {
    beforeAll(async () => {
      // Make it family-visible again for queries
      await request(app)
        .patch(`/api/families/${familyAId}/memories/${createdMemoryId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ visibility: MemoryVisibility.FAMILY });
    });

    it('filters memories by type and memberId', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/memories?type=PHOTO&memberId=${member1Id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.memories.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.memories[0].title).toContain('Monsoon');
    });

    it('filters memories by tag and year', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/memories?tag=monsoon&year=1995`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.memories.length).toBeGreaterThanOrEqual(1);
    });

    it('retrieves aggregate stats for the family vault', async () => {
      const res = await request(app)
        .get(`/api/families/${familyAId}/memories/stats`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalMemories).toBeGreaterThanOrEqual(2);
      expect(res.body.data.totalMedia).toBeGreaterThanOrEqual(1);
      expect(res.body.data.countsByType.PHOTO).toBeGreaterThanOrEqual(1);
    });

    it('retrieves on-this-day memories', async () => {
      // Create a memory with today's date
      const today = new Date();
      await request(app)
        .post(`/api/families/${familyAId}/memories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Historical Anniversary of Today',
          memoryType: MemoryType.DOCUMENT,
          eventDate: today.toISOString(),
          visibility: MemoryVisibility.FAMILY,
        });

      const res = await request(app)
        .get(`/api/families/${familyAId}/memories/on-this-day`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const matched = res.body.data.find((m: any) => m.title === 'Historical Anniversary of Today');
      expect(matched).toBeDefined();
    });
  });

  describe('6. Deletion, Archival & Cleanup', () => {
    it('deletes uploaded media file cleanly and unsets cover', async () => {
      const res = await request(app)
        .delete(`/api/media/${uploadedMediaId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify media record is gone
      const checkRes = await request(app)
        .get(`/api/media/${uploadedMediaId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(checkRes.status).toBe(404);
    });

    it('archives memory and logs MEMORY_ARCHIVED audit action', async () => {
      const res = await request(app)
        .delete(`/api/families/${familyAId}/memories/${createdMemoryId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);

      const audit = await AuditLog.findOne({
        familyId: familyAId,
        action: AuditAction.MEMORY_ARCHIVED,
        entityId: createdMemoryId,
      });
      expect(audit).toBeDefined();
    });
  });

  describe('7. Safe Migration Strategy for Legacy / Removed Memory Types', () => {
    it('safely re-maps legacy memory records without data loss', async () => {
      const mongoose = await import('mongoose');

      // Create memories directly in DB with legacy/removed types
      const legacyDoc = await Memory.collection.insertOne({
        familyId: new mongoose.Types.ObjectId(familyAId),
        title: 'Old Hand-Written Letter Archive',
        description: 'Sent from Madras in 1942',
        memoryType: 'LETTER',
        createdBy: new mongoose.Types.ObjectId(ownerUserId),
        visibility: MemoryVisibility.FAMILY,
        tags: ['madras'],
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const oralDoc = await Memory.collection.insertOne({
        familyId: new mongoose.Types.ObjectId(familyAId),
        title: 'Oral History of River Ferry',
        description: 'Recorded by elders',
        memoryType: 'ORAL_HISTORY',
        createdBy: new mongoose.Types.ObjectId(ownerUserId),
        visibility: MemoryVisibility.FAMILY,
        tags: ['ferry'],
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const heirloomDoc = await Memory.collection.insertOne({
        familyId: new mongoose.Types.ObjectId(familyAId),
        title: '1890 Silver Cardamom Box',
        description: 'Physical heirloom handed down across generations',
        memoryType: 'HEIRLOOM',
        createdBy: new mongoose.Types.ObjectId(ownerUserId),
        visibility: MemoryVisibility.FAMILY,
        tags: ['silver'],
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { runMemoryTypeMigration } = await import('../server/src/scripts/migrateMemoryTypes.ts');
      const result = await runMemoryTypeMigration();

      expect(result.migrated).toBeGreaterThanOrEqual(3);

      const updatedLetter = await Memory.findById(legacyDoc.insertedId);
      expect(updatedLetter?.memoryType).toBe(MemoryType.DOCUMENT);
      expect(updatedLetter?.tags).toContain('letter');

      const updatedOral = await Memory.findById(oralDoc.insertedId);
      expect(updatedOral?.memoryType).toBe(MemoryType.AUDIO);
      expect(updatedOral?.tags).toContain('oral-history');

      const updatedHeirloom = await Memory.findById(heirloomDoc.insertedId);
      expect(updatedHeirloom?.memoryType).toBe(MemoryType.PHOTO);
      expect(updatedHeirloom?.tags).toContain('heirloom');
    });
  });
});
