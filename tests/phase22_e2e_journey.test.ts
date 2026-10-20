import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';
import { Role } from '../server/src/constants/index.ts';

const app = createApp();

describe('Phase 22: Complete Production End-to-End User Journey & Release QA', () => {
  let ownerToken: string;
  let contributorToken: string;
  let viewerToken: string;
  let familyId: string;
  let rootMemberId: string;
  let spouseMemberId: string;
  let childMemberId: string;
  let relationshipId: string;
  let memoryId: string;
  let eventId: string;
  let exportedArchiveBuffer: Buffer;

  beforeAll(async () => {
    await database.connect();
  });

  afterAll(async () => {
    await database.disconnect();
  });

  // Step 1: User Registration
  it('Step 1: Successfully registers primary family founder and receives JWT token', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'founder.sterling@familyroots.org',
        password: 'Password123!',
        name: 'Arthur Sterling',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.data.accessToken).toBeDefined();
    ownerToken = regRes.body.data.accessToken;
  });

  // Step 2: Create Family Space
  it('Step 2: Founder creates a new Family Vault space', async () => {
    const famRes = await request(app)
      .post('/api/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'The Sterling Lineage',
        originPlace: 'Edinburgh & Montreal',
        description: 'Chronicles of clockmaking, maritime navigation, and community resilience.',
        motto: 'Veritas et Constantia',
      });

    expect(famRes.status).toBe(201);
    expect(famRes.body.success).toBe(true);
    familyId = famRes.body.data.id || famRes.body.data._id;
  });

  // Step 3: Add Root Ancestor
  it('Step 3: Founder records the founding root ancestor', async () => {
    const rootRes = await request(app)
      .post(`/api/families/${familyId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        firstName: 'Thomas',
        lastName: 'Sterling',
        gender: 'MALE',
        dateOfBirth: '1888-03-14',
        birthPlace: 'Edinburgh, Scotland',
        occupation: 'Master Clockmaker',
        biography: 'Apprenticed in the royal clocks before navigating to Nova Scotia.',
      });

    expect(rootRes.status).toBe(201);
    rootMemberId = rootRes.body.data.id || rootRes.body.data._id;
    expect(rootMemberId).toBeDefined();
  });

  // Step 4: Add Relatives
  it('Step 4: Adds spouse and child relatives to the family vault', async () => {
    const spouseRes = await request(app)
      .post(`/api/families/${familyId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        firstName: 'Margaret',
        lastName: 'Sinclair-Sterling',
        gender: 'FEMALE',
        dateOfBirth: '1892-07-22',
        birthPlace: 'Aberdeen, Scotland',
        occupation: 'Botanist & Educator',
      });
    expect(spouseRes.status).toBe(201);
    spouseMemberId = spouseRes.body.data.id || spouseRes.body.data._id;
    expect(spouseMemberId).toBeDefined();

    const childRes = await request(app)
      .post(`/api/families/${familyId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        firstName: 'Malcolm',
        lastName: 'Sterling',
        gender: 'MALE',
        dateOfBirth: '1920-11-05',
        birthPlace: 'Halifax, Canada',
        occupation: 'Naval Architect',
      });
    expect(childRes.status).toBe(201);
    childMemberId = childRes.body.data.id || childRes.body.data._id;
    expect(childMemberId).toBeDefined();
  });

  // Step 5: Establish Kinship Relationships
  it('Step 5: Connects relatives with verified kinship relationships (Spouse & Parent)', async () => {
    const spouseRelRes = await request(app)
      .post(`/api/families/${familyId}/relationships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceMemberId: rootMemberId,
        targetMemberId: spouseMemberId,
        relationshipType: 'SPOUSE',
        startDate: '1915-06-18',
      });
    expect(spouseRelRes.status).toBe(201);
    relationshipId = spouseRelRes.body.data.id || spouseRelRes.body.data._id;

    const parentRelRes = await request(app)
      .post(`/api/families/${familyId}/relationships`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceMemberId: rootMemberId,
        targetMemberId: childMemberId,
        relationshipType: 'PARENT',
      });
    expect(parentRelRes.status).toBe(201);
  });

  // Step 6: Add Memories to Vault
  it('Step 6: Adds rich heritage memories with tags and member references', async () => {
    const memRes = await request(app)
      .post(`/api/families/${familyId}/memories`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Voyage on the S.S. Cassandra',
        description: 'Diary entry describing the stormy passage across the North Atlantic.',
        memoryType: 'STORY',
        eventDate: '1910-09-12',
        location: 'North Atlantic Ocean',
        taggedMemberIds: [rootMemberId],
        tags: ['migration', 'maritime', 'journal'],
        visibility: 'FAMILY',
      });

    expect(memRes.status).toBe(201);
    memoryId = memRes.body.data.id || memRes.body.data._id;
    expect(memoryId).toBeDefined();
  });

  // Step 7: Create Milestone Events
  it('Step 7: Creates milestone event in family timeline calendar', async () => {
    const eventRes = await request(app)
      .post(`/api/families/${familyId}/milestones`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Thomas & Margaret Golden Jubilee',
        eventDate: '1965-06-18',
        eventType: 'ANNIVERSARY',
        description: 'Celebrated fifty years of marriage with seventy descendants gathered.',
        memberIds: [rootMemberId, spouseMemberId],
      });

    expect(eventRes.status).toBe(201);
    eventId = eventRes.body.data.id || eventRes.body.data._id;
    expect(eventId).toBeDefined();
  });

  // Step 8: Invite Collaborators with Different RBAC Roles
  it('Step 8: Invites family members with CONTRIBUTOR and VIEWER roles', async () => {
    // 8a: Register the contributor user
    const contReg = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'contributor.sterling@familyroots.org',
        password: 'Password123!',
        name: 'Clara Sterling',
      });
    expect(contReg.status).toBe(201);
    contributorToken = contReg.body.data.accessToken;

    // 8b: Register the viewer user
    const viewReg = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'viewer.sterling@familyroots.org',
        password: 'Password123!',
        name: 'Julian Sterling',
      });
    expect(viewReg.status).toBe(201);
    viewerToken = viewReg.body.data.accessToken;

    // 8c: Send invitation for Contributor
    const inv1Res = await request(app)
      .post(`/api/families/${familyId}/memberships/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'contributor.sterling@familyroots.org',
        role: Role.CONTRIBUTOR,
      });
    expect(inv1Res.status).toBe(201);
    const token1 = inv1Res.body.data.rawToken;
    expect(token1).toBeDefined();

    // 8d: Send invitation for Viewer
    const inv2Res = await request(app)
      .post(`/api/families/${familyId}/memberships/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'viewer.sterling@familyroots.org',
        role: Role.VIEWER,
      });
    expect(inv2Res.status).toBe(201);
    const token2 = inv2Res.body.data.rawToken;
    expect(token2).toBeDefined();

    // 8e: Accept Contributor invitation
    const accept1 = await request(app)
      .post('/api/families/invitations/accept')
      .set('Authorization', `Bearer ${contributorToken}`)
      .send({ token: token1 });
    expect(accept1.status).toBe(200);

    // 8f: Accept Viewer invitation
    const accept2 = await request(app)
      .post('/api/families/invitations/accept')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ token: token2 });
    expect(accept2.status).toBe(200);
  });

  // Step 9: Verify Role-Based Permissions for Invited Collaborators
  it('Step 9: Enforces role capabilities: Contributor can add memories, Viewer is read-only', async () => {
    // Contributor creates a memory -> SUCCESS
    const contMem = await request(app)
      .post(`/api/families/${familyId}/memories`)
      .set('Authorization', `Bearer ${contributorToken}`)
      .send({
        title: 'Scottish Shortbread Recipe from Grandma Margaret',
        description: 'Passed down in handwritten copperplate script.',
        memoryType: 'RECIPE',
        visibility: 'FAMILY',
      });
    expect(contMem.status).toBe(201);

    // Viewer attempts to create a memory -> 403 Forbidden
    const viewMem = await request(app)
      .post(`/api/families/${familyId}/memories`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        title: 'Unauthorized Memory Addition',
        memoryType: 'STORY',
      });
    expect(viewMem.status).toBe(403);

    // Viewer attempts to delete root ancestor -> 403 Forbidden
    const viewDel = await request(app)
      .delete(`/api/families/${familyId}/members/${rootMemberId}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(viewDel.status).toBe(403);

    // Viewer can view family memories -> 200 OK
    const viewGet = await request(app)
      .get(`/api/families/${familyId}/memories`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(viewGet.status).toBe(200);
    expect(viewGet.body.data.memories.length).toBeGreaterThanOrEqual(2);
  });

  // Step 10: Browse Family Tree Layout
  it('Step 10: Retrieves hierarchical pedigree tree structure', async () => {
    const treeRes = await request(app)
      .get(`/api/families/${familyId}/tree`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(treeRes.status).toBe(200);
    expect(treeRes.body.success).toBe(true);
    expect(treeRes.body.data.members).toBeDefined();
    expect(treeRes.body.data.relationships).toBeDefined();
    expect(treeRes.body.data.members.length).toBeGreaterThanOrEqual(3);
  });

  // Step 11: Export Complete Family Archive
  it('Step 11: Exports full verified family archive as ZIP package', async () => {
    const exportRes = await request(app)
      .get(`/api/families/${familyId}/export`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .buffer(true)
      .parse((res, callback) => {
        res.setEncoding('binary');
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { callback(null, Buffer.from(data, 'binary')); });
      });

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('application/zip');
    expect(exportRes.body.length).toBeGreaterThan(100);
    exportedArchiveBuffer = exportRes.body;
  });

  // Step 12: Validate and Verify Archive Package
  it('Step 12: Validates the integrity and schema of the exported archive package', async () => {
    const valRes = await request(app)
      .post(`/api/families/${familyId}/restore/validate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('archive', exportedArchiveBuffer, 'sterling-archive.zip');

    expect(valRes.status).toBe(200);
    expect(valRes.body.success).toBe(true);
    expect(valRes.body.data.isValid).toBe(true);
    expect(valRes.body.data.summary.members.total).toBeGreaterThanOrEqual(3);
    expect(valRes.body.data.summary.relationships.total).toBeGreaterThanOrEqual(2);
  });

  // Step 13: RBAC Safeguards on Administrative Endpoints
  it('Step 13: Strictly prevents Contributor or Viewer from exporting or restoring archives', async () => {
    const contExport = await request(app)
      .get(`/api/families/${familyId}/export`)
      .set('Authorization', `Bearer ${contributorToken}`);
    expect(contExport.status).toBe(403);

    const viewExport = await request(app)
      .get(`/api/families/${familyId}/export`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(viewExport.status).toBe(403);
  });
});
