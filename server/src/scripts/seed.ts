import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { database } from '../config/database.ts';
import { logger } from '../utils/logger.ts';
import { User } from '../models/User.ts';
import { Family } from '../models/Family.ts';
import { FamilyMember } from '../models/FamilyMember.ts';
import { Relationship } from '../models/Relationship.ts';
import { Branch } from '../models/Branch.ts';
import { FamilyMembership } from '../models/FamilyMembership.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { Memory } from '../models/Memory.ts';
import { MemoryCollection } from '../models/MemoryCollection.ts';
import { Media } from '../models/Media.ts';
import sharp from 'sharp';
import crypto from 'crypto';
import { getMediaStorageService } from '../services/storage/MediaStorageService.ts';
import {
  Role,
  RelationshipType,
  RelationshipStatus,
  UserStatus,
  BranchVisibility,
  AuditAction,
  MemoryType,
  MemoryVisibility,
  MemoryStatus,
  MediaProcessingStatus,
} from '../constants/index.ts';

export async function runSeed(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    logger.error('Seeding is strictly disabled in production. Set ALLOW_PRODUCTION_SEED=true to override.');
    throw new Error('Seeding blocked in production');
  }

  logger.info('Starting FamilyRoots database seeding...');

  const connected = await database.connect();
  if (!connected) {
    logger.error('Could not connect to database for seeding');
    process.exit(1);
  }

  try {
    // 1. Clean existing seed data if present
    const existingFamily = await Family.findOne({ name: 'Pattara Family' });
    if (existingFamily) {
      logger.info('Removing existing Pattara Family data to re-seed cleanly...');
      const famId = existingFamily._id;
      await Promise.all([
        FamilyMember.deleteMany({ familyId: famId }),
        Relationship.deleteMany({ familyId: famId }),
        Branch.deleteMany({ familyId: famId }),
        FamilyMembership.deleteMany({ familyId: famId }),
        AuditLog.deleteMany({ familyId: famId }),
        Memory.deleteMany({ familyId: famId }),
        Media.deleteMany({ familyId: famId }),
        Family.findByIdAndDelete(famId),
      ]);
    }

    // 2. Create Primary User Account
    const passwordHash = await bcrypt.hash('FamilyRoots#2026', 10);
    let devUser = await User.findOne({ email: 'dev@familyroots.heritage' });
    if (!devUser) {
      devUser = await User.create({
        email: 'dev@familyroots.heritage',
        passwordHash,
        displayName: 'Kiran Pattara',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        status: UserStatus.ACTIVE,
      });
      logger.info({ userId: devUser._id }, 'Created primary dev user');
    }

    // 3. Create "Pattara Family"
    const family = await Family.create({
      name: 'Pattara Family',
      description:
        'Centuries of heritage, botanical wisdom, architectural legacies, and cultural stories spanning Kerala and Karnataka across four generations.',
      originPlace: 'Palakkad, Kerala',
      motto: 'Roots in the Earth, Branches to the Sky',
      coverImage: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1200',
      createdBy: devUser._id,
      settings: {
        defaultMemberVisibility: 'FAMILY',
        allowMemberInvitations: true,
        allowPublicProfiles: false,
        timezone: 'Asia/Kolkata',
        dateFormat: 'YYYY-MM-DD',
      },
    });
    logger.info({ familyId: family._id }, 'Created Pattara Family');

    // 4. Create Members (14 members spanning 4 generations)
    const membersData = [
      // Generation 1 (Historical Elders / Ancestors)
      {
        key: 'govindan',
        firstName: 'Govindan',
        lastName: 'Pattara',
        displayName: 'Patriarch Govindan Pattara',
        gender: 'MALE' as const,
        dateOfBirth: '1920-04-10',
        dateOfDeath: '1994-11-22',
        isLiving: false,
        birthPlace: 'Palakkad, Kerala',
        deathPlace: 'Palakkad, Kerala',
        occupation: 'Master Botanist & Healer',
        biography:
          'Founded the Pattara botanical sanctuary in 1946. Preserved over 300 medicinal plant species and chronicled regional oral history.',
        generation: 1,
      },
      {
        key: 'lakshmi',
        firstName: 'Lakshmi',
        lastName: 'Pattara',
        displayName: 'Matriarch Lakshmi Pattara',
        gender: 'FEMALE' as const,
        dateOfBirth: '1925-08-15',
        dateOfDeath: '2005-02-18',
        isLiving: false,
        birthPlace: 'Thrissur, Kerala',
        deathPlace: 'Palakkad, Kerala',
        occupation: 'Classical Musician & Ayurvedic Practitioner',
        biography:
          'Custody holder of family heirloom ragas and herbal compendiums. Nurtured four generations through decades of social change.',
        generation: 1,
      },
      // Generation 2 (Elders - Living & Historical)
      {
        key: 'arun',
        firstName: 'Arun',
        lastName: 'Pattara',
        displayName: 'Arun Pattara',
        gender: 'MALE' as const,
        dateOfBirth: '1948-03-12',
        isLiving: true,
        birthPlace: 'Palakkad, Kerala',
        occupation: 'Senior Botanist & Archivist',
        biography:
          'Expanded the family herbarium into an international conservatory. Devoted storyteller and guardian of family manuscripts.',
        generation: 2,
      },
      {
        key: 'priya',
        firstName: 'Priya',
        lastName: 'Pattara',
        displayName: 'Priya Pattara',
        gender: 'FEMALE' as const,
        dateOfBirth: '1952-08-20',
        isLiving: true,
        birthPlace: 'Mysore, Karnataka',
        occupation: 'Classical Vocalist & Genealogist',
        biography:
          'Eminent vocalist and oral genealogist. Kept meticulous records of marriages, branch migrations, and ancestral property deeds.',
        generation: 2,
      },
      {
        key: 'ananth',
        firstName: 'Ananth',
        lastName: 'Pattara',
        displayName: 'Ananth Pattara',
        gender: 'MALE' as const,
        dateOfBirth: '1954-05-14',
        dateOfDeath: '2018-09-02',
        isLiving: false,
        birthPlace: 'Palakkad, Kerala',
        deathPlace: 'Kochi, Kerala',
        occupation: 'Maritime Historian & Harbor Engineer',
        biography:
          'Authored three seminal volumes on spice trade routes and port architecture along the Malabar coast.',
        generation: 2,
      },
      {
        key: 'nalini',
        firstName: 'Nalini',
        lastName: 'Pattara',
        displayName: 'Dr. Nalini Pattara',
        gender: 'FEMALE' as const,
        dateOfBirth: '1958-10-25',
        isLiving: true,
        birthPlace: 'Palakkad, Kerala',
        occupation: 'Community Physician',
        biography:
          'Pioneered primary community clinics across rural Palakkad. Philanthropist and traditional arts patron.',
        generation: 2,
      },
      // Generation 3 (Adults & Branch Leaders)
      {
        key: 'kumar',
        firstName: 'Kumar',
        lastName: 'Pattara',
        displayName: 'Kumar Pattara',
        gender: 'MALE' as const,
        dateOfBirth: '1975-11-04',
        isLiving: true,
        birthPlace: 'Kochi, Kerala',
        occupation: 'Heritage Architect & Restorer',
        biography:
          'Leads architectural restoration projects across Southern India. Founder of the Kumar Branch lineage.',
        generation: 3,
      },
      {
        key: 'sunita',
        firstName: 'Sunita',
        lastName: 'Pattara',
        displayName: 'Sunita Pattara',
        gender: 'FEMALE' as const,
        dateOfBirth: '1978-01-19',
        isLiving: true,
        birthPlace: 'Kozhikode, Kerala',
        occupation: 'Human Rights Attorney & Author',
        biography:
          'Advocates for traditional craft preservation and fair remuneration for indigenous artisans.',
        generation: 3,
      },
      {
        key: 'meena',
        firstName: 'Meena',
        lastName: 'Pattara',
        displayName: 'Dr. Meena Pattara',
        gender: 'FEMALE' as const,
        dateOfBirth: '1978-02-14',
        isLiving: true,
        birthPlace: 'Kochi, Kerala',
        occupation: 'Pediatrician & Medical Educator',
        biography:
          'Dedicated medical practitioner combining modern pediatrics with traditional holistic wellness practices.',
        generation: 3,
      },
      {
        key: 'ravi',
        firstName: 'Ravi',
        lastName: 'Pattara',
        displayName: 'Ravi Pattara',
        gender: 'MALE' as const,
        dateOfBirth: '1981-05-19',
        isLiving: true,
        birthPlace: 'Bengaluru, Karnataka',
        occupation: 'Architectural Photographer',
        biography:
          'Documentary photographer focusing on heritage temple woodwork and vernacular architecture. Founder of Ravi Branch.',
        generation: 3,
      },
      {
        key: 'suresh',
        firstName: 'Suresh',
        lastName: 'Pattara',
        displayName: 'Suresh Pattara',
        gender: 'MALE' as const,
        dateOfBirth: '1984-09-30',
        isLiving: true,
        birthPlace: 'Bengaluru, Karnataka',
        occupation: 'Agronomist & Seed Conservator',
        biography:
          'Continuing grandfather Govindan’s work through open-source heirloom seed banking across the Western Ghats.',
        generation: 3,
      },
      {
        key: 'deepa',
        firstName: 'Deepa',
        lastName: 'Pattara',
        displayName: 'Deepa Pattara',
        gender: 'FEMALE' as const,
        dateOfBirth: '1986-06-12',
        isLiving: true,
        birthPlace: 'Thrissur, Kerala',
        occupation: 'Documentary Filmmaker',
        biography:
          'Chronicles disappearing folk traditions, performing arts, and indigenous maritime lore across India.',
        generation: 3,
      },
      // Generation 4 (Youth / Digital Custodians)
      {
        key: 'raj',
        firstName: 'Raj',
        lastName: 'Pattara',
        displayName: 'Raj Pattara',
        gender: 'MALE' as const,
        dateOfBirth: '2003-04-18',
        isLiving: true,
        birthPlace: 'Chennai, Tamil Nadu',
        occupation: 'Software Engineer & Digital Archivist',
        biography:
          'Developer building family memory networks, digital genealogies, and interactive preservation portals.',
        generation: 4,
      },
      {
        key: 'anu',
        firstName: 'Anu',
        lastName: 'Pattara',
        displayName: 'Anu Pattara',
        gender: 'FEMALE' as const,
        dateOfBirth: '2006-10-09',
        isLiving: true,
        birthPlace: 'Chennai, Tamil Nadu',
        occupation: 'Bio-Heritage Scholar & Student',
        biography:
          'Student archivist digitizing grandmother Priya’s handwritten manuscripts and heirloom recipes.',
        generation: 4,
      },
    ];

    const createdMembers: Record<string, InstanceType<typeof FamilyMember>> = {};

    for (const m of membersData) {
      const member = await FamilyMember.create({
        familyId: family._id,
        firstName: m.firstName,
        lastName: m.lastName,
        displayName: m.displayName,
        gender: m.gender,
        dateOfBirth: m.dateOfBirth,
        dateOfDeath: m.dateOfDeath,
        isLiving: m.isLiving,
        birthPlace: m.birthPlace,
        deathPlace: m.deathPlace,
        occupation: m.occupation,
        biography: m.biography,
        generation: m.generation,
        createdBy: devUser._id,
      });
      createdMembers[m.key] = member;
    }

    logger.info({ count: Object.keys(createdMembers).length }, 'Created family members');

    // 5. Create Branches
    const kumarBranch = await Branch.create({
      familyId: family._id,
      name: 'Kumar Branch',
      description: 'Lineage descending through Kumar Pattara, encompassing Raj and Anu in Chennai and Kochi.',
      rootMemberId: createdMembers.kumar._id,
      accentColor: '#059669', // Emerald
      visibility: BranchVisibility.FAMILY,
      createdBy: devUser._id,
    });

    const raviBranch = await Branch.create({
      familyId: family._id,
      name: 'Ravi Branch',
      description: 'Creative and visual arts lineage centered around architectural research and Bengaluru heritage.',
      rootMemberId: createdMembers.ravi._id,
      accentColor: '#0284c7', // Sky
      visibility: BranchVisibility.FAMILY,
      createdBy: devUser._id,
    });

    const sureshBranch = await Branch.create({
      familyId: family._id,
      name: 'Suresh Branch',
      description: 'Agricultural research and heirloom seed preservation heritage in Mysore and Bengaluru.',
      rootMemberId: createdMembers.suresh._id,
      accentColor: '#d97706', // Amber
      visibility: BranchVisibility.FAMILY,
      createdBy: devUser._id,
    });

    // Update member branchIds
    await FamilyMember.findByIdAndUpdate(createdMembers.kumar._id, { $addToSet: { branchIds: kumarBranch._id } });
    await FamilyMember.findByIdAndUpdate(createdMembers.sunita._id, { $addToSet: { branchIds: kumarBranch._id } });
    await FamilyMember.findByIdAndUpdate(createdMembers.raj._id, { $addToSet: { branchIds: kumarBranch._id } });
    await FamilyMember.findByIdAndUpdate(createdMembers.anu._id, { $addToSet: { branchIds: kumarBranch._id } });

    await FamilyMember.findByIdAndUpdate(createdMembers.ravi._id, { $addToSet: { branchIds: raviBranch._id } });
    await FamilyMember.findByIdAndUpdate(createdMembers.suresh._id, { $addToSet: { branchIds: sureshBranch._id } });

    logger.info('Created 3 family branches with branch member associations');

    // 6. Create Relationships
    const relationshipsToCreate = [
      // Gen 1 Spouses
      { src: 'govindan', tgt: 'lakshmi', type: RelationshipType.SPOUSE },

      // Gen 1 -> Gen 2 Parent-Child
      { src: 'govindan', tgt: 'arun', type: RelationshipType.PARENT },
      { src: 'lakshmi', tgt: 'arun', type: RelationshipType.PARENT },
      { src: 'govindan', tgt: 'ananth', type: RelationshipType.PARENT },
      { src: 'lakshmi', tgt: 'ananth', type: RelationshipType.PARENT },

      // Gen 2 Spouses & Siblings
      { src: 'arun', tgt: 'priya', type: RelationshipType.SPOUSE },
      { src: 'ananth', tgt: 'nalini', type: RelationshipType.SPOUSE },
      { src: 'arun', tgt: 'ananth', type: RelationshipType.SIBLING },

      // Gen 2 -> Gen 3 Parent-Child (Arun & Priya's children)
      { src: 'arun', tgt: 'kumar', type: RelationshipType.PARENT },
      { src: 'priya', tgt: 'kumar', type: RelationshipType.PARENT },
      { src: 'arun', tgt: 'meena', type: RelationshipType.PARENT },
      { src: 'priya', tgt: 'meena', type: RelationshipType.PARENT },
      { src: 'arun', tgt: 'ravi', type: RelationshipType.PARENT },
      { src: 'priya', tgt: 'ravi', type: RelationshipType.PARENT },
      { src: 'arun', tgt: 'suresh', type: RelationshipType.PARENT },
      { src: 'priya', tgt: 'suresh', type: RelationshipType.PARENT },

      // Gen 2 -> Gen 3 (Ananth & Nalini's child Deepa)
      { src: 'ananth', tgt: 'deepa', type: RelationshipType.PARENT },
      { src: 'nalini', tgt: 'deepa', type: RelationshipType.PARENT },

      // Gen 3 Siblings & Spouses
      { src: 'kumar', tgt: 'sunita', type: RelationshipType.SPOUSE },
      { src: 'kumar', tgt: 'meena', type: RelationshipType.SIBLING },
      { src: 'kumar', tgt: 'ravi', type: RelationshipType.SIBLING },
      { src: 'kumar', tgt: 'suresh', type: RelationshipType.SIBLING },

      // Gen 3 -> Gen 4 Parent-Child (Kumar & Sunita's children)
      { src: 'kumar', tgt: 'raj', type: RelationshipType.PARENT },
      { src: 'sunita', tgt: 'raj', type: RelationshipType.PARENT },
      { src: 'kumar', tgt: 'anu', type: RelationshipType.PARENT },
      { src: 'sunita', tgt: 'anu', type: RelationshipType.PARENT },

      // Gen 4 Siblings
      { src: 'raj', tgt: 'anu', type: RelationshipType.SIBLING },
    ];

    for (const rel of relationshipsToCreate) {
      await Relationship.create({
        familyId: family._id,
        sourceMemberId: createdMembers[rel.src]._id,
        targetMemberId: createdMembers[rel.tgt]._id,
        relationshipType: rel.type,
        status: RelationshipStatus.ACTIVE,
        createdBy: devUser._id,
      });
    }

    logger.info({ count: relationshipsToCreate.length }, 'Created family relationships');

    // 7. Create Membership
    await FamilyMembership.create({
      userId: devUser._id,
      familyId: family._id,
      memberId: createdMembers.raj._id,
      role: Role.FAMILY_OWNER,
      status: 'ACTIVE',
      permissions: Object.values(Role),
    });

    // 8. Create Initial Audit Logs
    await AuditLog.create({
      familyId: family._id,
      actorUserId: devUser._id.toString(),
      action: AuditAction.BRANCH_CREATED,
      entityType: 'Family',
      entityId: family._id.toString(),
      metadata: { seed: true, familyName: family.name },
    });

    // 9. Seed Heritage Memory Vault
    logger.info('Seeding Heritage Memory Vault for Pattara Family...');
    const storageService = getMediaStorageService();
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDay = String(today.getDate()).padStart(2, '0');

    const sampleMemoriesData = [
      {
        fileName: 'ancestral_courtyard_1968.png',
        color: { r: 68, g: 84, b: 68 },
        title: 'Palakkad Courtyard Gathering of 1968',
        desc: 'Annual monsoon gathering at the ancestral homestead with Patriarch Govindan and Matriarch Lakshmi celebrating the seasonal cardamom harvest.',
        type: MemoryType.PHOTO,
        date: new Date('1968-07-15'),
        approx: 'Monsoon 1968',
        location: 'Palakkad Heritage Courtyard, Kerala',
        members: [createdMembers.govindan._id, createdMembers.lakshmi._id, createdMembers.kumar._id, createdMembers.ravi._id],
        branches: [kumarBranch._id, raviBranch._id],
        tags: ['monsoon', 'harvest', 'ancestral-homestead', 'courtyard'],
        visibility: MemoryVisibility.FAMILY,
      },
      {
        fileName: 'spice_route_manuscript.png',
        color: { r: 120, g: 82, b: 54 },
        title: 'The Legend of the Spice Route Trade',
        desc: 'Historical chronicle documenting the 19th-century trade journeys across the Western Ghats between Palakkad and Mangalore port, as recounted by family elders.',
        type: MemoryType.STORY,
        date: new Date('1982-10-04'),
        approx: 'Autumn 1982',
        location: 'Western Ghats, Wayanad',
        members: [createdMembers.ravi._id, createdMembers.suresh._id],
        branches: [raviBranch._id, sureshBranch._id],
        tags: ['oral-history', 'trade', 'western-ghats', 'legend'],
        visibility: MemoryVisibility.FAMILY,
      },
      {
        fileName: 'ayurvedic_accreditation_1954.png',
        color: { r: 42, g: 76, b: 88 },
        title: "Govindan Pattara's Master Ayurvedic Accreditation",
        desc: 'Official botanical certification granted by the Royal Board of Indigenous Medicine honoring over 300 preserved medicinal plant species.',
        type: MemoryType.DOCUMENT,
        date: new Date('1954-05-18'),
        approx: 'May 1954',
        location: 'Trivandrum, Kerala',
        members: [createdMembers.govindan._id],
        branches: [kumarBranch._id],
        tags: ['ayurveda', 'botanical', 'historical-document', 'royal-board'],
        visibility: MemoryVisibility.FAMILY,
      },
      {
        fileName: 'nilgiri_tea_recording_1975.png',
        color: { r: 80, g: 60, b: 90 },
        title: 'Memories of the Nilgiri Tea Plantations',
        desc: 'Spoken family recollection and audio recording of Priya and Nalini reflecting on childhood summers spent near the tea estate bungalows of Ooty.',
        type: MemoryType.AUDIO,
        date: new Date('1975-08-20'),
        approx: 'Summer 1975',
        location: 'Nilgiris, Tamil Nadu',
        members: [createdMembers.priya._id, createdMembers.nalini._id, createdMembers.kumar._id],
        branches: [kumarBranch._id],
        tags: ['audio', 'nilgiris', 'childhood', 'plantations'],
        visibility: MemoryVisibility.FAMILY,
      },
      {
        fileName: 'letter_from_bangalore_1991.png',
        color: { r: 96, g: 82, b: 70 },
        title: 'Letter from Bangalore: Founding the Design Studio',
        desc: 'Personal correspondence from Ravi to his brother Kumar expressing excitement and ambition about establishing the architectural practice in Bangalore.',
        type: MemoryType.DOCUMENT,
        date: new Date(`1991-${currentMonth}-${currentDay}`),
        approx: 'September 1991',
        location: 'Bangalore, Karnataka',
        members: [createdMembers.ravi._id, createdMembers.kumar._id],
        branches: [raviBranch._id, kumarBranch._id],
        tags: ['document', 'architecture', 'bangalore', 'new-beginnings'],
        visibility: MemoryVisibility.FAMILY,
      },
      {
        fileName: 'first_silent_valley_trek_2012.png',
        color: { r: 40, g: 90, b: 70 },
        title: "Kiran & Vikram's First Heritage Trek",
        desc: 'Youth camping and indigenous flora identification trek led by Raj Pattara across the Silent Valley buffer zone with the fourth generation.',
        type: MemoryType.PHOTO,
        date: new Date('2012-12-28'),
        approx: 'Winter 2012',
        location: 'Silent Valley National Park, Kerala',
        members: [createdMembers.raj._id, createdMembers.anu._id],
        branches: [kumarBranch._id],
        tags: ['nature', 'trekking', 'next-generation', 'botany'],
        visibility: MemoryVisibility.FAMILY,
      },
      {
        fileName: 'ancestral_palakkad_sambar_recipe.png',
        color: { r: 180, g: 90, b: 40 },
        title: "Lakshmi Amma's Ancestral Palakkad Sambar",
        desc: 'Traditional family recipe passed down from matriarch Lakshmi Pattara. Prepared with roasted coconut paste, hand-pounded coriander, and fresh drumsticks from the courtyard trees.',
        type: MemoryType.RECIPE,
        date: new Date('1972-11-12'),
        approx: 'Winter 1972',
        location: 'Palakkad, Kerala',
        members: [createdMembers.lakshmi._id, createdMembers.priya._id],
        branches: [kumarBranch._id],
        tags: ['recipe', 'culinary', 'traditional', 'ancestral'],
        visibility: MemoryVisibility.FAMILY,
      },
    ];

    let seededMemoriesCount = 0;
    for (const item of sampleMemoriesData) {
      // 1. Create Memory
      const memory = await Memory.create({
        familyId: family._id,
        title: item.title,
        description: item.desc,
        memoryType: item.type,
        createdBy: devUser._id,
        eventDate: item.date,
        eventDateApprox: item.approx,
        location: item.location,
        visibility: item.visibility,
        memberIds: item.members,
        branchIds: item.branches,
        tags: item.tags,
        status: MemoryStatus.ACTIVE,
      });

      // 2. Synthesize Real Image & Thumbnail on disk for seamless preview
      const fullBuffer = await sharp({
        create: {
          width: 900,
          height: 600,
          channels: 3,
          background: item.color,
        },
      })
        .png()
        .toBuffer();

      const thumbBuffer = await sharp(fullBuffer)
        .resize(400, 300, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();

      const sha256Checksum = crypto.createHash('sha256').update(fullBuffer).digest('hex');
      const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const storageKey = `families/${family._id}/memories/${memory._id}/original/${uniqueSuffix}_${item.fileName}`;
      const thumbStorageKey = `families/${family._id}/memories/${memory._id}/thumbnails/${uniqueSuffix}.webp`;

      await storageService.saveFile(storageKey, fullBuffer, 'image/png');
      await storageService.saveFile(thumbStorageKey, thumbBuffer, 'image/webp');

      // 3. Persist Media record
      const media = await Media.create({
        familyId: family._id,
        memoryId: memory._id,
        uploadedBy: devUser._id,
        originalFileName: item.fileName,
        storageKey,
        mimeType: 'image/png',
        fileSize: fullBuffer.length,
        sha256Checksum,
        width: 900,
        height: 600,
        thumbnailStorageKey: thumbStorageKey,
        processingStatus: MediaProcessingStatus.READY,
        visibility: item.visibility,
      });

      // 4. Link cover media
      await Memory.findByIdAndUpdate(memory._id, { coverMediaId: media._id });

      // 5. Audit log
      await AuditLog.create({
        familyId: family._id,
        actorUserId: devUser._id.toString(),
        action: AuditAction.MEMORY_CREATED,
        entityType: 'Memory',
        entityId: memory._id.toString(),
        metadata: { title: memory.title, memoryType: memory.memoryType },
      });

      seededMemoriesCount++;
    }

    logger.info({ count: seededMemoriesCount }, 'Seeded heritage memories and media');

    // 6. Seed Advanced Heritage Archive Collections
    const allFamilyMemories = await Memory.find({ familyId: family._id, status: MemoryStatus.ACTIVE }).populate('coverMediaId').lean();

    const collectionsToSeed = [
      {
        title: 'Grandparents',
        description: 'Cherished memories, wisdom, and ancestral portraits of family matriarchs and patriarchs.',
        filterKeywords: ['govindan', 'lakshmi', 'grand', 'homestead', 'ancestral'],
      },
      {
        title: 'Childhood Memories',
        description: 'Growing up across generations, childhood summers, garden games, and school days.',
        filterKeywords: ['childhood', 'summer', 'plantation', 'tea', 'youth', 'trek'],
      },
      {
        title: 'Family Weddings',
        description: 'Traditional ceremonies, wedding celebrations, joyous reunions, and vows.',
        filterKeywords: ['wedding', 'marriage', 'celebration', 'gathering', 'ceremony'],
      },
      {
        title: 'Our Village',
        description: 'Roots in Palakkad, Kerala courtyards, Western Ghats travels, and local community memories.',
        filterKeywords: ['palakkad', 'courtyard', 'kerala', 'spice', 'village', 'homestead'],
      },
      {
        title: 'Old Family Documents',
        description: 'Historical records, royal accreditation certificates, hand-written letters, and land documents.',
        filterKeywords: ['accreditation', 'certificate', 'letter', 'document', 'manuscript'],
      },
    ];

    for (const cDef of collectionsToSeed) {
      const matchingMemories = allFamilyMemories.filter((m: any) => {
        const text = `${m.title} ${m.description || ''} ${(m.tags || []).join(' ')}`.toLowerCase();
        return cDef.filterKeywords.some((kw) => text.includes(kw));
      });

      const memoryOids = matchingMemories.map((m: any) => m._id);
      const firstMemory = matchingMemories[0];

      const col = await MemoryCollection.create({
        familyId: family._id,
        title: cDef.title,
        description: cDef.description,
        coverMediaId: firstMemory?.coverMediaId?._id || undefined,
        coverImageUrl: undefined,
        memoryIds: memoryOids,
        createdBy: devUser._id,
        status: MemoryStatus.ACTIVE,
      });

      if (memoryOids.length > 0) {
        await Memory.updateMany(
          { _id: { $in: memoryOids } },
          { $addToSet: { collectionIds: col._id } }
        );
      }
    }
    logger.info({ count: collectionsToSeed.length }, 'Seeded Heritage Collections');

    logger.info('=====================================================');
    logger.info('SEED COMPLETED SUCCESSFULLY!');
    logger.info(`Family ID: ${family._id}`);
    logger.info(`Family Name: ${family.name}`);
    logger.info(`Total Members: ${membersData.length}`);
    logger.info(`Total Relationships: ${relationshipsToCreate.length}`);
    logger.info(`Branches: Kumar Branch, Ravi Branch, Suresh Branch`);
    logger.info('=====================================================');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown seed error';
    logger.error({ error: msg }, 'Failed to seed database');
    throw err;
  }
}

// Allow direct execution: tsx server/src/scripts/seed.ts
if (process.argv[1]?.includes('seed')) {
  runSeed()
    .then(async () => {
      await database.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await database.disconnect();
      process.exit(1);
    });
}
