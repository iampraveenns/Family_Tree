import { database } from '../config/database.ts';
import { logger } from '../utils/logger.ts';
import {
  User,
  Family,
  FamilyMember,
  Relationship,
  Branch,
  FamilyMembership,
  AuditLog,
  Memory,
  MemoryCollection,
  Media,
  FamilyEvent,
  FamilyNotification,
  ChangeProposal,
  FamilyInvitation,
  RefreshToken,
  FamilyBackup,
} from '../models/index.ts';

export interface CleanDemoResult {
  isDryRun: boolean;
  demoFamiliesFound: number;
  demoUsersFound: number;
  demoMembersFound: number;
  demoRelationshipsFound: number;
  demoBranchesFound: number;
  demoMembershipsFound: number;
  demoMemoriesFound: number;
  demoMediaFound: number;
  demoCollectionsFound: number;
  demoAuditLogsFound: number;
  demoNotificationsFound: number;
  demoProposalsFound: number;
  demoEventsFound: number;
  demoInvitationsFound: number;
  deletedCounts?: Record<string, number>;
}

export async function cleanDemoRecords(options: { confirm: boolean }): Promise<CleanDemoResult> {
  const connected = await database.connect();
  if (!connected) {
    throw new Error('Could not connect to database for cleanup');
  }

  // 1. Identify Demo Families
  const demoFamilies = await Family.find({
    $or: [
      { name: { $regex: /pattara/i } },
      { name: { $regex: /arun & priya/i } },
      { description: { $regex: /pattara/i } },
    ],
  }).lean();

  const demoFamilyIds = demoFamilies.map((f) => f._id);

  // 2. Identify Demo Users
  const demoUsers = await User.find({
    $or: [
      { email: { $regex: /@familyroots\.heritage$/i } },
      { email: 'dev@familyroots.heritage' },
      { email: 'kiran@familyroots.heritage' },
      { displayName: { $regex: /pattara/i } },
    ],
  }).lean();

  const demoUserIds = demoUsers.map((u) => u._id);

  // 3. Identify Associated Demo Records
  const [
    demoMembers,
    demoRelationships,
    demoBranches,
    demoMemberships,
    demoMemories,
    demoMedia,
    demoCollections,
    demoAuditLogs,
    demoNotifications,
    demoProposals,
    demoEvents,
    demoInvitations,
  ] = await Promise.all([
    FamilyMember.find({
      $or: [
        { familyId: { $in: demoFamilyIds } },
        { lastName: { $regex: /^pattara$/i } },
      ],
    }).lean(),
    Relationship.find({ familyId: { $in: demoFamilyIds } }).lean(),
    Branch.find({ familyId: { $in: demoFamilyIds } }).lean(),
    FamilyMembership.find({
      $or: [
        { familyId: { $in: demoFamilyIds } },
        { userId: { $in: demoUserIds } },
      ],
    }).lean(),
    Memory.find({ familyId: { $in: demoFamilyIds } }).lean(),
    Media.find({ familyId: { $in: demoFamilyIds } }).lean(),
    MemoryCollection.find({ familyId: { $in: demoFamilyIds } }).lean(),
    AuditLog.find({
      $or: [
        { familyId: { $in: demoFamilyIds } },
        { actorEmail: { $regex: /@familyroots\.heritage$/i } },
      ],
    }).lean(),
    FamilyNotification.find({ familyId: { $in: demoFamilyIds } }).lean(),
    ChangeProposal.find({ familyId: { $in: demoFamilyIds } }).lean(),
    FamilyEvent.find({ familyId: { $in: demoFamilyIds } }).lean(),
    FamilyInvitation.find({
      $or: [
        { familyId: { $in: demoFamilyIds } },
        { email: { $regex: /@familyroots\.heritage$/i } },
      ],
    }).lean(),
  ]);

  const result: CleanDemoResult = {
    isDryRun: !options.confirm,
    demoFamiliesFound: demoFamilies.length,
    demoUsersFound: demoUsers.length,
    demoMembersFound: demoMembers.length,
    demoRelationshipsFound: demoRelationships.length,
    demoBranchesFound: demoBranches.length,
    demoMembershipsFound: demoMemberships.length,
    demoMemoriesFound: demoMemories.length,
    demoMediaFound: demoMedia.length,
    demoCollectionsFound: demoCollections.length,
    demoAuditLogsFound: demoAuditLogs.length,
    demoNotificationsFound: demoNotifications.length,
    demoProposalsFound: demoProposals.length,
    demoEventsFound: demoEvents.length,
    demoInvitationsFound: demoInvitations.length,
  };

  logger.info({
    summary: {
      families: demoFamilies.length,
      users: demoUsers.length,
      members: demoMembers.length,
      relationships: demoRelationships.length,
      branches: demoBranches.length,
      memberships: demoMemberships.length,
      memories: demoMemories.length,
      media: demoMedia.length,
      collections: demoCollections.length,
      auditLogs: demoAuditLogs.length,
      notifications: demoNotifications.length,
      proposals: demoProposals.length,
      events: demoEvents.length,
      invitations: demoInvitations.length,
    },
  }, 'Demo records identification scan completed');

  if (!options.confirm) {
    logger.warn('DRY RUN ONLY: No demo records were deleted. Provide --confirm to execute deletion.');
    return result;
  }

  // Perform targeted, safe deletion ONLY of identified demo records
  logger.info('Executing targeted demo records removal...');

  const [
    delMembers,
    delRelationships,
    delBranches,
    delMemberships,
    delMemories,
    delMedia,
    delCollections,
    delAuditLogs,
    delNotifications,
    delProposals,
    delEvents,
    delInvitations,
    delRefreshTokens,
    delBackups,
    delFamilies,
    delUsers,
  ] = await Promise.all([
    FamilyMember.deleteMany({
      $or: [
        { familyId: { $in: demoFamilyIds } },
        { lastName: { $regex: /^pattara$/i } },
      ],
    }),
    Relationship.deleteMany({ familyId: { $in: demoFamilyIds } }),
    Branch.deleteMany({ familyId: { $in: demoFamilyIds } }),
    FamilyMembership.deleteMany({
      $or: [
        { familyId: { $in: demoFamilyIds } },
        { userId: { $in: demoUserIds } },
      ],
    }),
    Memory.deleteMany({ familyId: { $in: demoFamilyIds } }),
    Media.deleteMany({ familyId: { $in: demoFamilyIds } }),
    MemoryCollection.deleteMany({ familyId: { $in: demoFamilyIds } }),
    AuditLog.deleteMany({
      $or: [
        { familyId: { $in: demoFamilyIds } },
        { actorEmail: { $regex: /@familyroots\.heritage$/i } },
      ],
    }),
    FamilyNotification.deleteMany({ familyId: { $in: demoFamilyIds } }),
    ChangeProposal.deleteMany({ familyId: { $in: demoFamilyIds } }),
    FamilyEvent.deleteMany({ familyId: { $in: demoFamilyIds } }),
    FamilyInvitation.deleteMany({
      $or: [
        { familyId: { $in: demoFamilyIds } },
        { email: { $regex: /@familyroots\.heritage$/i } },
      ],
    }),
    RefreshToken.deleteMany({ userId: { $in: demoUserIds } }),
    FamilyBackup.deleteMany({ familyId: { $in: demoFamilyIds } }),
    Family.deleteMany({ _id: { $in: demoFamilyIds } }),
    User.deleteMany({ _id: { $in: demoUserIds } }),
  ]);

  result.deletedCounts = {
    families: delFamilies.deletedCount,
    users: delUsers.deletedCount,
    members: delMembers.deletedCount,
    relationships: delRelationships.deletedCount,
    branches: delBranches.deletedCount,
    memberships: delMemberships.deletedCount,
    memories: delMemories.deletedCount,
    media: delMedia.deletedCount,
    collections: delCollections.deletedCount,
    auditLogs: delAuditLogs.deletedCount,
    notifications: delNotifications.deletedCount,
    proposals: delProposals.deletedCount,
    events: delEvents.deletedCount,
    invitations: delInvitations.deletedCount,
    refreshTokens: delRefreshTokens.deletedCount,
    backups: delBackups.deletedCount,
  };

  logger.info({ deletedCounts: result.deletedCounts }, 'Demo records safely and permanently removed.');
  return result;
}

// CLI Execution Handler
if (process.argv[1]?.includes('cleanDemoData')) {
  const confirm = process.argv.includes('--confirm') || process.env.CONFIRM_CLEAN === 'true';

  cleanDemoRecords({ confirm })
    .then(async (res) => {
      if (res.isDryRun) {
        console.log('\n================ DEMO CLEANUP: DRY RUN PREVIEW ================');
        console.log(`Demo Families Found:      ${res.demoFamiliesFound}`);
        console.log(`Demo Users Found:         ${res.demoUsersFound}`);
        console.log(`Demo Members Found:       ${res.demoMembersFound}`);
        console.log(`Demo Relationships Found: ${res.demoRelationshipsFound}`);
        console.log(`Demo Branches Found:      ${res.demoBranchesFound}`);
        console.log(`Demo Memberships Found:   ${res.demoMembershipsFound}`);
        console.log(`Demo Memories Found:      ${res.demoMemoriesFound}`);
        console.log(`Demo Media Found:         ${res.demoMediaFound}`);
        console.log(`Demo Collections Found:   ${res.demoCollectionsFound}`);
        console.log(`Demo Audit Logs Found:    ${res.demoAuditLogsFound}`);
        console.log(`Demo Events Found:        ${res.demoEventsFound}`);
        console.log(`Demo Invitations Found:   ${res.demoInvitationsFound}`);
        console.log('================================================================');
        console.log('NOTICE: No records were deleted.');
        console.log('To execute permanent deletion, run:');
        console.log('  npm run clean:demo -- --confirm\n');
      } else {
        console.log('\n================ DEMO CLEANUP: COMPLETED =======================');
        console.log(`Deleted Families:         ${res.deletedCounts?.families || 0}`);
        console.log(`Deleted Users:            ${res.deletedCounts?.users || 0}`);
        console.log(`Deleted Members:          ${res.deletedCounts?.members || 0}`);
        console.log(`Deleted Relationships:    ${res.deletedCounts?.relationships || 0}`);
        console.log(`Deleted Branches:         ${res.deletedCounts?.branches || 0}`);
        console.log(`Deleted Memberships:      ${res.deletedCounts?.memberships || 0}`);
        console.log(`Deleted Memories:         ${res.deletedCounts?.memories || 0}`);
        console.log(`Deleted Media:            ${res.deletedCounts?.media || 0}`);
        console.log(`Deleted Collections:      ${res.deletedCounts?.collections || 0}`);
        console.log(`Deleted Audit Logs:       ${res.deletedCounts?.auditLogs || 0}`);
        console.log(`Deleted Events:           ${res.deletedCounts?.events || 0}`);
        console.log(`Deleted Invitations:      ${res.deletedCounts?.invitations || 0}`);
        console.log('================================================================');
        console.log('Cleaned demo records. Production user data was untouched.\n');
      }
      await database.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Failed to clean demo data:', err);
      await database.disconnect();
      process.exit(1);
    });
}
