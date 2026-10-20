import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';

const app = createApp();

describe('Phase 20 — Premium Family Onboarding & Setup API', () => {
  let userToken: string;

  beforeAll(async () => {
    await database.connect();

    const regRes = await request(app).post('/api/auth/register').send({
      email: 'onboarding.founder@familyroots.org',
      password: 'Password123!',
      name: 'Eleanor Vance',
    });
    expect(regRes.status).toBe(201);
    userToken = regRes.body.data.accessToken;
  });

  afterAll(async () => {
    await database.disconnect();
  });

  it('rejects invalid payload when family name or root ancestor is missing', async () => {
    const res = await request(app)
      .post('/api/families/onboarding')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        family: { name: '' },
        rootAncestor: { firstName: 'Eleanor', lastName: 'Vance' },
      });

    expect(res.status).toBe(400);
  });

  it('successfully initializes full family vault in single guided onboarding transaction', async () => {
    const payload = {
      family: {
        name: 'The Vance Heritage',
        originPlace: 'Edinburgh, Scotland',
        description: 'Centuries of highland resilience, seafaring, and artistry.',
        motto: 'Stand Fast, Branch Far',
      },
      rootAncestor: {
        firstName: 'Alexander',
        lastName: 'Vance',
        gender: 'MALE',
        dateOfBirth: '1892-04-12',
        birthPlace: 'Edinburgh, Scotland',
        occupation: 'Clockmaker & Shipwright',
        biography: 'Master craftsman who founded the family clockworks in the old quarter.',
      },
      immediateFamily: [
        {
          relation: 'SPOUSE',
          firstName: 'Margaret',
          lastName: 'Vance',
          gender: 'FEMALE',
          dateOfBirth: '1896-08-20',
        },
        {
          relation: 'CHILD',
          firstName: 'Robert',
          lastName: 'Vance',
          gender: 'MALE',
          dateOfBirth: '1924-03-15',
        },
        {
          relation: 'CHILD',
          firstName: 'Clara',
          lastName: 'Vance',
          gender: 'FEMALE',
          dateOfBirth: '1928-11-02',
        },
      ],
      firstMemory: {
        title: 'Opening of the Royal Mile Clockworks (1919)',
        memoryType: 'PHOTO',
        description: 'Alexander and Margaret standing proudly in front of their workshop on opening day.',
        eventDate: '1919-06-01',
        location: 'Edinburgh, Royal Mile',
        tags: ['Clockworks', 'Heritage', 'Foundational'],
      },
      invitations: [
        {
          email: 'robert.vance@familyroots.org',
          role: 'CONTRIBUTOR',
        },
        {
          email: 'archivist.vance@familyroots.org',
          role: 'ARCHIVIST',
        },
      ],
    };

    const res = await request(app)
      .post('/api/families/onboarding')
      .set('Authorization', `Bearer ${userToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const summary = res.body.data;
    expect(summary.family.name).toBe('The Vance Heritage');
    expect(summary.rootAncestor.firstName).toBe('Alexander');
    expect(summary.members.length).toBe(4); // Alexander + Margaret + Robert + Clara
    expect(summary.relationships.length).toBeGreaterThanOrEqual(3); // Alexander-Margaret (SPOUSE), Alexander-Robert (PARENT), Margaret-Robert (PARENT), etc.
    expect(summary.memories.length).toBe(1);
    expect(summary.memories[0].title).toContain('Clockworks');
    expect(summary.invitationsCount).toBe(2);
    expect(summary.generationsCount).toBe(2);
    expect(summary.completionProgress).toBe(100);
  });
});
