import { Memory, MediaAsset, FamilyMember } from '../types/index.ts';

/**
 * Resolves a streamable or viewable image URL from any media asset or media ID.
 */
export function resolveMediaStreamUrl(media?: any, fallbackMediaId?: any): string | null {
  if (!media && !fallbackMediaId) return null;

  // 1. If media is direct string URL
  if (typeof media === 'string') {
    if (media.includes('unsplash.com')) {
      return null; // Ignore hardcoded stock images
    }
    if (media.startsWith('http') || media.startsWith('data:') || media.startsWith('blob:') || media.startsWith('/api/')) {
      return media;
    }
    if (media.length > 8) {
      return `/api/media/${media}/stream`;
    }
  }

  // 2. Direct properties on media object
  if (media && typeof media === 'object') {
    if (media.streamUrl && typeof media.streamUrl === 'string' && !media.streamUrl.includes('unsplash.com')) {
      return media.streamUrl;
    }
    if (media.thumbnailUrl && typeof media.thumbnailUrl === 'string' && !media.thumbnailUrl.includes('unsplash.com')) {
      return media.thumbnailUrl;
    }
    if (media.url && typeof media.url === 'string' && !media.url.includes('unsplash.com')) {
      return media.url;
    }
    if (media.coverMediaUrl && typeof media.coverMediaUrl === 'string' && !media.coverMediaUrl.includes('unsplash.com')) {
      return media.coverMediaUrl;
    }

    const id = media._id || media.id;
    if (id) {
      const idStr = id.toString();
      if (idStr.length > 8) {
        return `/api/media/${idStr}/stream`;
      }
    }
  }

  // 3. Fallback media ID
  if (fallbackMediaId) {
    if (typeof fallbackMediaId === 'string') {
      if (fallbackMediaId.includes('unsplash.com')) return null;
      if (
        fallbackMediaId.startsWith('http') ||
        fallbackMediaId.startsWith('data:') ||
        fallbackMediaId.startsWith('blob:') ||
        fallbackMediaId.startsWith('/api/')
      ) {
        return fallbackMediaId;
      }
      if (fallbackMediaId.length > 8) {
        return `/api/media/${fallbackMediaId}/stream`;
      }
    }
    if (typeof fallbackMediaId === 'object') {
      const fbId = fallbackMediaId._id || fallbackMediaId.id;
      if (fbId) {
        return `/api/media/${fbId.toString()}/stream`;
      }
      if (fallbackMediaId.streamUrl && !fallbackMediaId.streamUrl.includes('unsplash.com')) {
        return fallbackMediaId.streamUrl;
      }
      if (fallbackMediaId.thumbnailUrl && !fallbackMediaId.thumbnailUrl.includes('unsplash.com')) {
        return fallbackMediaId.thumbnailUrl;
      }
    }
  }

  return null;
}

/**
 * Returns the best image cover URL for a memory item.
 */
export function getMemoryCoverUrl(memory: Memory | any): string | null {
  if (!memory) return null;

  // Direct coverMediaUrl
  if (memory.coverMediaUrl && !memory.coverMediaUrl.includes('unsplash.com')) {
    return memory.coverMediaUrl;
  }

  // From coverMedia object
  if (memory.coverMedia) {
    const url = resolveMediaStreamUrl(memory.coverMedia);
    if (url) return url;
  }

  // From coverMediaId
  if (memory.coverMediaId) {
    const url = resolveMediaStreamUrl(memory.coverMediaId, memory.coverMediaId);
    if (url) return url;
  }

  // From media array
  if (Array.isArray(memory.media) && memory.media.length > 0) {
    for (const item of memory.media) {
      const url = resolveMediaStreamUrl(item);
      if (url) return url;
    }
  }

  return null;
}

/**
 * Resolves the video streaming/playback URL for a memory item.
 * Checks media array, videoAsset, mediaUrl, coverMedia, and coverMediaUrl.
 */
export function getMemoryVideoUrl(memory: Memory | any): string | null {
  if (!memory) return null;

  // 1. Direct videoUrl or mediaUrl
  if (memory.videoUrl && typeof memory.videoUrl === 'string') return memory.videoUrl;
  if (memory.mediaUrl && typeof memory.mediaUrl === 'string') return memory.mediaUrl;

  // 2. Search media array for video asset
  if (Array.isArray(memory.media) && memory.media.length > 0) {
    const videoAsset = memory.media.find((item: any) => {
      if (!item) return false;
      if (item.mimeType?.startsWith('video/')) return true;
      const fn = (item.originalFileName || item.storageKey || item.url || '').toLowerCase();
      return fn.endsWith('.mp4') || fn.endsWith('.webm') || fn.endsWith('.mov') || fn.endsWith('.mkv');
    });
    if (videoAsset) {
      const url = resolveMediaStreamUrl(videoAsset);
      if (url) return url;
    }
  }

  // 3. From coverMedia if video
  if (memory.coverMedia) {
    const cm = memory.coverMedia;
    const isVid =
      cm.mimeType?.startsWith('video/') ||
      (cm.storageKey && /\.(mp4|webm|mov|mkv)$/i.test(cm.storageKey)) ||
      (cm.originalFileName && /\.(mp4|webm|mov|mkv)$/i.test(cm.originalFileName));
    if (isVid) {
      const url = resolveMediaStreamUrl(cm);
      if (url) return url;
    }
  }

  // 4. If memoryType is VIDEO, fallback to coverMedia / coverMediaUrl / first media
  const type = (memory.memoryType || memory.type || '').toUpperCase();
  if (type === 'VIDEO') {
    if (memory.coverMediaUrl && !memory.coverMediaUrl.includes('unsplash.com')) {
      return memory.coverMediaUrl;
    }
    if (memory.coverMedia) {
      const url = resolveMediaStreamUrl(memory.coverMedia);
      if (url) return url;
    }
    if (memory.coverMediaId) {
      const url = resolveMediaStreamUrl(memory.coverMediaId, memory.coverMediaId);
      if (url) return url;
    }
    if (Array.isArray(memory.media) && memory.media.length > 0) {
      const url = resolveMediaStreamUrl(memory.media[0]);
      if (url) return url;
    }
  }

  return null;
}

/**
 * Resolves the audio streaming/playback URL for an audio memory item.
 * Checks media array, audioAsset, mediaUrl, audioUrl, coverMedia, and coverMediaUrl.
 */
export function getMemoryAudioUrl(memory: Memory | any): string | null {
  if (!memory) return null;

  // 1. Direct audioUrl or mediaUrl
  if (memory.audioUrl && typeof memory.audioUrl === 'string') return memory.audioUrl;
  if (
    memory.mediaUrl &&
    typeof memory.mediaUrl === 'string' &&
    (/\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(memory.mediaUrl) || (memory.memoryType || memory.type) === 'AUDIO')
  ) {
    return memory.mediaUrl;
  }

  // 2. Search media array for audio asset
  if (Array.isArray(memory.media) && memory.media.length > 0) {
    const audioAsset = memory.media.find((item: any) => {
      if (!item) return false;
      if (item.mimeType?.startsWith('audio/')) return true;
      const fn = (item.originalFileName || item.storageKey || item.url || item.streamUrl || '').toLowerCase();
      return (
        fn.endsWith('.mp3') ||
        fn.endsWith('.wav') ||
        fn.endsWith('.ogg') ||
        fn.endsWith('.m4a') ||
        fn.endsWith('.aac') ||
        (fn.endsWith('.webm') && (memory.memoryType || memory.type) === 'AUDIO')
      );
    });
    if (audioAsset) {
      const url = resolveMediaStreamUrl(audioAsset);
      if (url) return url;
    }
  }

  // 3. From coverMedia if audio
  if (memory.coverMedia) {
    const cm = memory.coverMedia;
    const isAud =
      cm.mimeType?.startsWith('audio/') ||
      (cm.storageKey && /\.(mp3|wav|ogg|m4a|aac)$/i.test(cm.storageKey)) ||
      (cm.originalFileName && /\.(mp3|wav|ogg|m4a|aac)$/i.test(cm.originalFileName));
    if (isAud) {
      const url = resolveMediaStreamUrl(cm);
      if (url) return url;
    }
  }

  // 4. If memoryType is AUDIO, fallback to coverMedia / coverMediaUrl / first media
  const type = (memory.memoryType || memory.type || '').toUpperCase();
  if (type === 'AUDIO') {
    if (memory.coverMediaUrl && !memory.coverMediaUrl.includes('unsplash.com')) {
      return memory.coverMediaUrl;
    }
    if (memory.coverMedia) {
      const url = resolveMediaStreamUrl(memory.coverMedia);
      if (url) return url;
    }
    if (memory.coverMediaId) {
      const url = resolveMediaStreamUrl(memory.coverMediaId, memory.coverMediaId);
      if (url) return url;
    }
    if (Array.isArray(memory.media) && memory.media.length > 0) {
      const url = resolveMediaStreamUrl(memory.media[0]);
      if (url) return url;
    }
  }

  return null;
}

/**
 * Formats a family name to the canonical format (e.g. "Pattara Family", "Sikawath Family").
 */
export function formatFamilyDisplayName(rawName?: string | null): string {
  if (!rawName || !rawName.trim()) return 'Pattara family';
  const clean = rawName.trim();
  if (clean.toLowerCase() === 'family vault') return 'Family Vault';
  if (/family$/i.test(clean)) {
    const base = clean.replace(/family$/i, '').trim();
    if (!base) return 'Family';
    return `${base.charAt(0).toUpperCase() + base.slice(1)} family`;
  }
  return `${clean.charAt(0).toUpperCase() + clean.slice(1)} family`;
}

/**
 * Resolves the author member record, author display name, and latest profile photo
 * for any memory post. Ensures author profile photos updated in the family tree
 * (such as Arun Pattara's updated profile) are immediately visible on their memory cards.
 */
export function resolveMemoryAuthor(
  mem: Memory,
  members: FamilyMember[] = [],
  membersById?: Map<string, FamilyMember>
): {
  authorMember: FamilyMember | null;
  authorName: string;
  authorPhoto: string | null;
} {
  // 1. Resolve author name
  let authorName =
    mem.addedByMemberName ||
    (typeof (mem as any).addedByMemberId === 'object'
      ? (mem as any).addedByMemberId?.displayName ||
        `${(mem as any).addedByMemberId?.firstName || ''} ${(mem as any).addedByMemberId?.lastName || ''}`.trim()
      : null) ||
    'Family Member';

  let authorMember: FamilyMember | null = null;

  // 2. Resolve by addedByMemberId if present
  const rawAddedById = mem.addedByMemberId as any;
  if (rawAddedById) {
    if (typeof rawAddedById === 'string' && rawAddedById.trim().length > 0) {
      authorMember =
        membersById?.get(rawAddedById) ||
        members.find((m) => m.id === rawAddedById || (m as any)._id === rawAddedById) ||
        null;
    } else if (typeof rawAddedById === 'object') {
      const objId = rawAddedById.id || rawAddedById._id?.toString?.();
      if (objId) {
        authorMember =
          membersById?.get(objId) ||
          members.find((m) => m.id === objId || (m as any)._id === objId) ||
          null;
      }
      if (!authorMember) {
        authorMember = rawAddedById as FamilyMember;
      }
    }
  }

  // 3. Fallback: match by authorName across members list
  if (!authorMember && authorName && authorName !== 'Family Member' && members.length > 0) {
    const cleanName = authorName.toLowerCase().trim();
    authorMember =
      members.find((m) => {
        const dName = (m.displayName || '').toLowerCase().trim();
        const fName = `${m.firstName} ${m.lastName || ''}`.toLowerCase().trim();
        const firstOnly = (m.firstName || '').toLowerCase().trim();
        return dName === cleanName || fName === cleanName || firstOnly === cleanName;
      }) ||
      members.find((m) => {
        const dName = (m.displayName || '').toLowerCase().trim();
        const fName = `${m.firstName} ${m.lastName || ''}`.toLowerCase().trim();
        return (cleanName && dName.includes(cleanName)) || (cleanName && fName.includes(cleanName));
      }) ||
      null;
  }

  // 4. Fallback to tagged members if any
  if (!authorMember && mem.memberIds && mem.memberIds.length > 0) {
    for (const rawId of mem.memberIds) {
      const idStr = typeof rawId === 'object' ? (rawId as any)._id?.toString() || (rawId as any).id : rawId?.toString();
      if (idStr) {
        const found = membersById?.get(idStr) || members.find((m) => m.id === idStr || (m as any)._id === idStr);
        if (found) {
          authorMember = found;
          break;
        }
      }
    }
  }

  // 5. Update authorName if authorMember was found
  if (authorMember && (!mem.addedByMemberName || authorName === 'Family Member')) {
    authorName = authorMember.displayName || `${authorMember.firstName} ${authorMember.lastName}`.trim();
  }

  // 6. Extract profile photo from authorMember or memory payload
  const rawPhoto =
    authorMember?.profilePhoto ||
    (authorMember as any)?.avatarUrl ||
    (authorMember as any)?.avatar ||
    (authorMember as any)?.profileImageUrl ||
    (authorMember as any)?.photoUrl ||
    (typeof rawAddedById === 'object' ? (rawAddedById as any)?.profilePhoto || (rawAddedById as any)?.avatar : null) ||
    (mem as any).authorPhoto ||
    (mem as any).addedByMemberPhoto;

  const authorPhoto = typeof rawPhoto === 'string' && rawPhoto.trim().length > 0 ? rawPhoto.trim() : null;

  return { authorMember, authorName, authorPhoto };
}
