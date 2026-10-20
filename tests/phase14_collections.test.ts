import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';
import { MemoryType, MemoryVisibility, Role } from '../server/src/constants/index.ts';
import crypto from 'crypto';

const app = createApp();

describe('Phase 14: Advanced Heritage Archive (Collections & Duplicate Protection)', () => {
  let ownerToken: string;
  let ownerUserId: string;
  let familyId: string;
  let memory1Id: string;
  let memory2Id: string;
  let collectionId: string;
  const sampleChecksum = crypto.createHash('sha256').update('heritage-test-media-buffer').digest('hex');

  beforeAll(async () => {
    await database.connect();

    // 1. Register Owner
    const regRes = await request(app).post('/api/auth/register').send({
      email: `archive_owner_${Date.now()}@pattara.test`,
      password: 'SecurePassword123!',
      name: 'Archive Curator',
    });
    ownerToken = regRes.body.data.accessToken;
    ownerUserId = regRes.body.data.user.id;

    // 2. Create Family
    const famRes = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Heritage Archive Test Family',
        originPlace: 'Palakkad, Kerala',
      });
    familyId = famRes.body.data._id || famRes.body.data.id;

    // 3. Create two sample memories
    const mem1 = await request(app)
      .post(`/api/families/${familyId}/memories`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Ancestral Village Homestead',
        description: 'The ancient stone courtyard in Palakkad.',
        memoryType: MemoryType.STORY,
        visibility: MemoryVisibility.FAMILY,
        eventDate: '1965-05-12',
      });
    memory1Id = mem1.body.data._id || mem1.body.data.id;

    const mem2 = await request(app)
      .post(`/api/families/${familyId}/memories`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Govindan & Lakshmi Wedding Portrait',
        description: 'Traditional wedding ceremony and golden garlands.',
        memoryType: MemoryType.PHOTO,
        visibility: MemoryVisibility.FAMILY,
        eventDate: '1970-11-20',
      });
    memory2Id = mem2.body.data._id || mem2.body.data.id;
  });

  afterAll(async () => {
    await database.disconnect();
  });

  it('automatically bootstraps default heritage collections on first query', async () => {
    const res = await request(app)
      .get(`/api/families/${familyId}/collections`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);

    const titles = res.body.data.map((c: any) => c.title);
    expect(titles).toContain('Grandparents');
    expect(titles).toContain('Childhood Memories');
    expect(titles).toContain('Family Weddings');
    expect(titles).toContain('Our Village');
    expect(titles).toContain('Old Family Documents');
  });

  it('allows creating a new custom heritage collection', async () => {
    const res = await request(app)
      .post(`/api/families/${familyId}/collections`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Rare Culinary Traditions',
        description: 'Authentic heirloom recipes passed down through matriarchs.',
        memoryIds: [memory1Id],
        coverImageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Rare Culinary Traditions');
    expect(res.body.data.memoryCount).toBe(1);
    collectionId = res.body.data.id;
  });

  it('retrieves collection details with enriched metadata and date ranges', async () => {
    const res = await request(app)
      .get(`/api/families/${familyId}/collections/${collectionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(collectionId);
    expect(res.body.data.title).toBe('Rare Culinary Traditions');
    expect(res.body.data.dateRange).toBe('1965');
  });

  it('adds and removes memories from a collection', async () => {
    // Add memory2
    const addRes = await request(app)
      .post(`/api/families/${familyId}/collections/${collectionId}/memories`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ memoryId: memory2Id });

    expect(addRes.status).toBe(200);
    expect(addRes.body.data.memoryCount).toBe(2);
    expect(addRes.body.data.dateRange).toBe('1965 – 1970');

    // Remove memory1
    const removeRes = await request(app)
      .delete(`/api/families/${familyId}/collections/${collectionId}/memories/${memory1Id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.data.memoryCount).toBe(1);
    expect(removeRes.body.data.dateRange).toBe('1970');
  });

  it('checks duplicate media checksum via API', async () => {
    const res = await request(app)
      .get(`/api/families/${familyId}/memories/check-duplicate?checksum=${sampleChecksum}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isDuplicate).toBe(false);
  });

  it('updates and deletes a collection cleanly', async () => {
    // Update
    const updateRes = await request(app)
      .patch(`/api/families/${familyId}/collections/${collectionId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        description: 'Updated heirloom recipes and feast memories.',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.description).toBe('Updated heirloom recipes and feast memories.');

    // Delete
    const deleteRes = await request(app)
      .delete(`/api/families/${familyId}/collections/${collectionId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.success).toBe(true);

    // Verify it is no longer returned in active list
    const listRes = await request(app)
      .get(`/api/families/${familyId}/collections`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const found = listRes.body.data.find((c: any) => c.id === collectionId);
    expect(found).toBeUndefined();
  });
});
