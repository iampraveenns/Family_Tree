import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.ts';
import { database } from '../server/src/config/database.ts';
import { resolveDynamicBranches } from '../src/utils/branchUtils.ts';
import { FamilyMember } from '../src/types/index.ts';

const app = createApp();

describe('Phase 60: Family Tree Structure, Profile Editing, Branch Management, and Automatic Branch Generation', () => {
  let adminToken: string;
  let adminUserId: string;
  let adminEmail = 'phase60.admin@chronicle.org';
  let familyId: string;
  let rootMemberId: string;

  let memberSpouseEmail = 'spouse.member@chronicle.org';
  let memberSpouseUserId: string;
  let spouseToken: string;
  let spouseMemberId: string;

  let childMemberEmail = 'child.member@chronicle.org';
  let childMemberUserId: string;
  let childMemberId: string;

  beforeAll(async () => {
    await database.connect();
  }, 15000);

  afterAll(async () => {
    await database.disconnect();
  });

  describe('1. Family Tree Name & Root Ancestor Separation', () => {
    it('provisions a family tree with a dedicated Family Tree Name distinct from root ancestor', async () => {
      // Register initial admin user
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Grandfather Pattara',
          email: adminEmail,
          password: 'Password123!',
        });

      expect(regRes.status).toBe(201);
      adminToken = regRes.body.data.accessToken;
      adminUserId = regRes.body.data.user.id;

      // Create new dedicated family tree with Family Tree Name
      const treeRes = await request(app)
        .post('/api/families')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'The Pattara Heritage Family Tree',
          description: 'A multi-generational lineage chronicle',
          originPlace: 'Kerala, India',
          motto: 'Roots run deep, branches reach far',
        });

      expect(treeRes.status).toBe(201);
      expect(treeRes.body.data.name).toBe('The Pattara Heritage Family Tree');
      familyId = treeRes.body.data._id || treeRes.body.data.id;

      // Create root ancestor as a distinct member node inside the tree structure
      const memberRes = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Govindan',
          lastName: 'Pattara',
          displayName: 'Govindan Pattara',
          gender: 'MALE',
          generation: 1,
          isLiving: true,
          registeredEmail: adminEmail,
        });

      expect(memberRes.status).toBe(201);
      expect(memberRes.body.data.firstName).toBe('Govindan');
      expect(memberRes.body.data.displayName).toBe('Govindan Pattara');
      rootMemberId = memberRes.body.data._id || memberRes.body.data.id;

      // Rename the Family Tree Name and verify root ancestor remains unchanged
      const renameRes = await request(app)
        .patch(`/api/families/${familyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pattara Ancestral Chronicle & Tree',
        });

      expect(renameRes.status).toBe(200);
      expect(renameRes.body.data.name).toBe('Pattara Ancestral Chronicle & Tree');

      // Check root ancestor node inside the tree
      const rootCheck = await request(app)
        .get(`/api/families/${familyId}/members/${rootMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(rootCheck.status).toBe(200);
      expect(rootCheck.body.data.firstName).toBe('Govindan');
      expect(rootCheck.body.data.displayName).toBe('Govindan Pattara');
    });
  });

  describe('2. Secure Self-Profile Editing (JWT / Account-to-Node Matching)', () => {
    it('creates spouse relative and verifies only the matched authenticated account can edit self profile', async () => {
      // Register spouse user account via JSON auth
      const spouseReg = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Meenakshi Pattara',
          email: memberSpouseEmail,
          password: 'Password123!',
        });

      expect(spouseReg.status).toBe(201);
      spouseToken = spouseReg.body.data.accessToken;
      memberSpouseUserId = spouseReg.body.data.user.id;

      // Admin adds Meenakshi as a member node linked to her account
      const addSpouseMember = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Meenakshi',
          lastName: 'Pattara',
          gender: 'FEMALE',
          generation: 1,
          isLiving: true,
          registeredEmail: memberSpouseEmail,
        });

      expect(addSpouseMember.status).toBe(201);
      spouseMemberId = addSpouseMember.body.data._id || addSpouseMember.body.data.id;

      // Establish SPOUSE relationship between Govindan and Meenakshi
      const spouseRelRes = await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sourceMemberId: rootMemberId,
          targetMemberId: spouseMemberId,
          relationshipType: 'SPOUSE',
          marriageDate: '1975-05-18',
        });

      expect(spouseRelRes.status).toBe(201);

      // Verify Meenakshi (non-admin) CAN edit her own profile node via JWT session
      const selfEditRes = await request(app)
        .patch(`/api/families/${familyId}/members/${spouseMemberId}`)
        .set('Authorization', `Bearer ${spouseToken}`)
        .send({
          firstName: 'Meenakshi',
          lastName: 'Pattara',
          occupation: 'Genealogist & Botanist',
          biography: 'Keeper of family traditions and garden remedies.',
          birthPlace: 'Palakkad, Kerala',
        });

      expect(selfEditRes.status).toBe(200);
      expect(selfEditRes.body.data.occupation).toBe('Genealogist & Botanist');
      expect(selfEditRes.body.data.biography).toBe('Keeper of family traditions and garden remedies.');

      // Verify Meenakshi (non-admin) is PREVENTED from editing Govindan's profile node (IDOR / unauthorized check)
      const unauthorizedEditRes = await request(app)
        .patch(`/api/families/${familyId}/members/${rootMemberId}`)
        .set('Authorization', `Bearer ${spouseToken}`)
        .send({
          firstName: 'HackedName',
          occupation: 'Malicious Edit',
        });

      expect(unauthorizedEditRes.status).toBe(403);
      expect(unauthorizedEditRes.body.message).toContain('only authorized to edit your own profile node');

      // Verify Admin CAN edit any profile node
      const adminEditRes = await request(app)
        .patch(`/api/families/${familyId}/members/${spouseMemberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          occupation: 'Master Botanist & Genealogist',
        });

      expect(adminEditRes.status).toBe(200);
      expect(adminEditRes.body.data.occupation).toBe('Master Botanist & Genealogist');
    });
  });

  describe('3. Automatic Branch Creation when Person has both Spouse and Child', () => {
    it('automatically generates a dedicated [Member Name]\'s Family Branch when a member has both a spouse and a child', async () => {
      // Register child user account
      const childReg = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Arun Pattara',
          email: childMemberEmail,
          password: 'Password123!',
        });

      expect(childReg.status).toBe(201);
      childMemberUserId = childReg.body.data.user.id;

      // Add child member node
      const addChildRes = await request(app)
        .post(`/api/families/${familyId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Arun',
          lastName: 'Pattara',
          gender: 'MALE',
          generation: 2,
          isLiving: true,
          registeredEmail: childMemberEmail,
        });

      expect(addChildRes.status).toBe(201);
      childMemberId = addChildRes.body.data._id || addChildRes.body.data.id;

      // Add CHILD relationship: Govindan is parent to Arun
      // At this point, Govindan has a spouse (Meenakshi) AND a child (Arun)!
      const addRelRes = await request(app)
        .post(`/api/families/${familyId}/relationships`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sourceMemberId: rootMemberId,
          targetMemberId: childMemberId,
          relationshipType: 'PARENT',
        });

      expect(addRelRes.status).toBe(201);

      // Fetch family tree to verify automatic branch generation
      const treeRes = await request(app)
        .get(`/api/families/${familyId}/tree`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(treeRes.status).toBe(200);
      expect(treeRes.body.success).toBe(true);

      const treeBranches = treeRes.body.data.branches;
      expect(treeBranches).toBeDefined();

      // Check that a branch named "Govindan Pattara's Family Branch" exists
      const govindanBranch = treeBranches.find(
        (b: any) =>
          b.name.includes('Govindan Pattara\'s Family Branch') ||
          b.name.includes('Govindan\'s Family Branch')
      );

      expect(govindanBranch).toBeDefined();
      expect(govindanBranch.rootMemberId).toBe(rootMemberId);

      // Verify that members have the branch in their branchIds
      const treeMembers = treeRes.body.data.members;
      const govindan = treeMembers.find((m: any) => m.id === rootMemberId);
      const meenakshi = treeMembers.find((m: any) => m.id === spouseMemberId);
      const arun = treeMembers.find((m: any) => m.id === childMemberId);

      expect(govindan.branchIds).toContain(govindanBranch.id);
      expect(meenakshi.branchIds).toContain(govindanBranch.id);
      expect(arun.branchIds).toContain(govindanBranch.id);
    });
  });

  describe('4. Dynamic Branch Resolution & List Utilities', () => {
    it('dynamically resolves [Member Name]\'s Family Branch for married parents and children', () => {
      const mockMembers: FamilyMember[] = [
        {
          id: 'mem-1',
          familyId: 'fam-1',
          firstName: 'Govindan',
          lastName: 'Pattara',
          displayName: 'Govindan Pattara',
          gender: 'MALE',
          generation: 1,
          isLiving: true,
        },
        {
          id: 'mem-2',
          familyId: 'fam-1',
          firstName: 'Meenakshi',
          lastName: 'Pattara',
          displayName: 'Meenakshi Pattara',
          gender: 'FEMALE',
          generation: 1,
          isLiving: true,
        },
        {
          id: 'mem-3',
          familyId: 'fam-1',
          firstName: 'Arun',
          lastName: 'Pattara',
          displayName: 'Arun Pattara',
          gender: 'MALE',
          generation: 2,
          isLiving: true,
        },
      ];

      const mockRelationships = [
        {
          id: 'rel-1',
          familyId: 'fam-1',
          sourceMemberId: 'mem-1',
          targetMemberId: 'mem-2',
          relationshipType: 'SPOUSE',
          status: 'ACTIVE',
        },
        {
          id: 'rel-2',
          familyId: 'fam-1',
          sourceMemberId: 'mem-1',
          targetMemberId: 'mem-3',
          relationshipType: 'PARENT',
          status: 'ACTIVE',
        },
      ];

      const resolved = resolveDynamicBranches(mockMembers, mockRelationships as any);
      expect(resolved.length).toBe(3);

      const mem1Branch = resolved.find((m) => m.id === 'mem-1')?.branchName;
      const mem2Branch = resolved.find((m) => m.id === 'mem-2')?.branchName;
      const mem3Branch = resolved.find((m) => m.id === 'mem-3')?.branchName;

      expect(mem1Branch).toBe("Govindan Pattara's Family Branch");
      expect(mem2Branch).toBe("Govindan Pattara's Family Branch");
      expect(mem3Branch).toBe("Govindan Pattara's Family Branch");
    });
  });
});
