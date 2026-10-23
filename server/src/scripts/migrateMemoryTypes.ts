import { Memory } from '../models/Memory.ts';
import { MemoryType } from '../constants/index.ts';
import { logger } from '../utils/logger.ts';
import { database } from '../config/database.ts';

const VALID_MEMORY_TYPES = Object.values(MemoryType) as string[];

/**
 * Maps obsolete or removed memory types to the 5 supported formats:
 * PHOTO, STORY, AUDIO, DOCUMENT, RECIPE.
 * Preserves user context by appending the legacy category name to tags.
 */
export function remapLegacyMemoryType(oldType: string): { newType: MemoryType; legacyTag: string } {
  const normalized = (oldType || '').trim().toUpperCase();

  switch (normalized) {
    case 'ORAL_HISTORY':
      return { newType: MemoryType.AUDIO, legacyTag: 'oral-history' };

    case 'LETTER':
      return { newType: MemoryType.DOCUMENT, legacyTag: 'letter' };

    case 'CERTIFICATE':
      return { newType: MemoryType.DOCUMENT, legacyTag: 'certificate' };

    case 'HEIRLOOM':
      return { newType: MemoryType.PHOTO, legacyTag: 'heirloom' };

    case 'VIDEO':
      return { newType: MemoryType.VIDEO, legacyTag: 'video' };

    case 'FAMILY_NARRATIVE':
      return { newType: MemoryType.STORY, legacyTag: 'family-narrative' };

    case 'OTHER':
    default:
      return { newType: MemoryType.STORY, legacyTag: 'legacy-archive' };
  }
}

/**
 * Migration runner for database records.
 * Gracefully re-maps any removed memory types to the 5 valid types without data loss.
 */
export async function runMemoryTypeMigration(): Promise<{
  scanned: number;
  migrated: number;
  details: Array<{ id: string; oldType: string; newType: MemoryType; title: string }>;
}> {
  // Find all memory records where memoryType is not in the 5 supported types
  const legacyMemories = await Memory.find({
    memoryType: { $nin: Object.values(MemoryType) as MemoryType[] },
  } as any);

  const details: Array<{ id: string; oldType: string; newType: MemoryType; title: string }> = [];

  for (const record of legacyMemories) {
    const oldType = record.memoryType as unknown as string;
    const { newType, legacyTag } = remapLegacyMemoryType(oldType);

    const existingTags = Array.isArray(record.tags) ? record.tags : [];
    const updatedTags = existingTags.includes(legacyTag)
      ? existingTags
      : [...existingTags, legacyTag];

    record.memoryType = newType;
    record.tags = updatedTags;
    await record.save();

    details.push({
      id: record._id.toString(),
      oldType,
      newType,
      title: record.title,
    });
  }

  if (details.length > 0) {
    logger.info(
      { migratedCount: details.length, details },
      'Memory type migration completed successfully: legacy categories re-mapped to supported formats.'
    );
  } else {
    logger.debug('Memory type migration check: all records conform to supported memory types.');
  }

  return {
    scanned: legacyMemories.length,
    migrated: details.length,
    details,
  };
}

// Standalone execution script
const isDirectRun = typeof require !== 'undefined'
  ? require.main === module
  : Boolean(typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('migrateMemoryTypes.ts'));

if (isDirectRun) {
  (async () => {
    try {
      await database.connect();
      const res = await runMemoryTypeMigration();
      console.log(`Migration complete. Migrated ${res.migrated} memory records.`);
      await database.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('Migration failed:', err);
      process.exit(1);
    }
  })();
}
