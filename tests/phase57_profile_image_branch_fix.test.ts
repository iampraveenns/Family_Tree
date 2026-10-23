import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { database } from '../server/src/config/database.ts';
import { memberService } from '../server/src/services/memberService.ts';
import { branchRepository } from '../server/src/repositories/branchRepository.ts';
import { User } from '../server/src/models/User.ts';
import { Family } from '../server/src/models/Family.ts';
import { FamilyMember } from '../server/src/models/FamilyMember.ts';
import { Branch } from '../server/src/models/Branch.ts';
import { Types } from 'mongoose';

describe('Phase 57: Profile Image Upload & Branch Slug Resolution Fix', () => {
  let testFamilyId: string;
  let testUserId: string;
  let testMemberId: string;

  beforeAll(async () => {
    await database.connect();

    // 1. Create a test user
    const user = (await User.create({
      email: 'branch_fix_tester@pattara.test',
      passwordHash: 'hashed_password_sample_123',
      displayName: 'Branch Fix Tester',
    })) as any;
    testUserId = user._id.toString();

    // 2. Create a test family
    const family = (await Family.create({
      name: 'Pattara Heritage',
      description: 'Family space for branch testing',
      createdBy: user._id,
    })) as any;
    testFamilyId = family._id.toString();

    // 3. Create an existing family member (e.g. Arun Pattara)
    const member = (await FamilyMember.create({
      familyId: family._id,
      firstName: 'Arun',
      lastName: 'Pattara',
      displayName: 'Arun Pattara',
      gender: 'MALE',
      isLiving: true,
      generation: 2,
      linkedUserId: user._id,
      createdBy: user._id,
      branchIds: [],
    })) as any;
    testMemberId = member._id.toString();
  });

  afterAll(async () => {
    await database.disconnect();
  });

  describe('1. Updating profile photo with dynamic branch slug', () => {
    it('successfully updates profilePhoto when branchIds contains dynamic slug "branch-arun-branch"', async () => {
      const samplePhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

      // This is the exact payload sent by the frontend when a user edits Arun's profile to add an image:
      const updatePayload = {
        firstName: 'Arun',
        lastName: 'Pattara',
        displayName: 'Arun Pattara',
        profilePhoto: samplePhoto,
        branchIds: ['branch-arun-branch'],
      };

      const updated = await memberService.updateMember(testFamilyId, testMemberId, updatePayload as any, {
        userId: testUserId,
      });

      expect(updated).toBeDefined();
      expect(updated.profilePhoto).toBe(samplePhoto);
      expect(updated.branchIds).toBeDefined();
      expect(updated.branchIds.length).toBeGreaterThan(0);
      // Ensure the branchId stored in MongoDB is a valid ObjectId, not the raw pseudo-string
      expect(Types.ObjectId.isValid(updated.branchIds[0].toString())).toBe(true);

      // Verify in DB
      const freshMember = await FamilyMember.findById(testMemberId);
      expect(freshMember?.profilePhoto).toBe(samplePhoto);
    });

    it('successfully resolves existing branch if a Branch with matching name exists', async () => {
      // Create a branch named "Deepa Branch"
      const deepaBranch = await branchRepository.create({
        familyId: new Types.ObjectId(testFamilyId),
        name: 'Deepa Branch',
        description: 'Branch for Deepa lineage',
        rootMemberId: new Types.ObjectId(testMemberId),
        createdBy: testUserId,
      });

      // Look up using slug "branch-deepa-branch"
      const foundBySlug = await branchRepository.findByFamilyAndId(testFamilyId, 'branch-deepa-branch');
      expect(foundBySlug).toBeDefined();
      expect(foundBySlug?._id.toString()).toBe(deepaBranch._id.toString());

      // Update member using slug
      const updated = await memberService.updateMember(
        testFamilyId,
        testMemberId,
        {
          branchIds: ['branch-deepa-branch'],
          profilePhoto: 'https://images.unsplash.com/photo-deepa.jpg',
        } as any,
        { userId: testUserId }
      );

      expect(updated.profilePhoto).toBe('https://images.unsplash.com/photo-deepa.jpg');
      expect(updated.branchIds[0].toString()).toBe(deepaBranch._id.toString());
    });

    it('still rejects branchIds from completely different families', async () => {
      // Create a foreign family and branch
      const foreignFamily = await Family.create({
        name: 'Foreign Family',
        createdBy: new Types.ObjectId(),
      });
      const foreignBranch = await Branch.create({
        familyId: foreignFamily._id,
        name: 'Foreign Branch',
        rootMemberId: new Types.ObjectId(),
      });

      await expect(
        memberService.updateMember(
          testFamilyId,
          testMemberId,
          {
            branchIds: [foreignBranch._id.toString()],
          } as any,
          { userId: testUserId }
        )
      ).rejects.toThrow(/does not belong to family/);
    });
  });
});
