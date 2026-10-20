import { Memory, MediaAsset } from '../types/index.ts';

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
