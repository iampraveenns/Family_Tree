# Heritage Memory Vault & Secure Media Architecture

## 1. Overview
The Heritage Memory Vault allows families to securely archive, catalog, and stream ancestral photographs, oral history recordings, letters, manuscripts, certificates, and narratives.

All stored artifacts are secured behind multi-layered authorization:
- **Family Boundary Isolation**: Users can never access media or memory documents belonging to another family.
- **Granular Scoping**: Memories and media can be marked `FAMILY` (all verified family members), `BRANCH` (restricted to lineages sharing specified branch IDs), or `PRIVATE` (restricted to the custodian creator and family owners).
- **Physical Media Separation**: Raw binary payloads are never kept inside MongoDB. Instead, metadata, checksums, and dimensions reside in MongoDB while binary content is managed by an abstracted `MediaStorageService`.

---

## 2. Data Models

### Memory (`Memory.ts`)
```typescript
interface IMemory {
  familyId: Types.ObjectId;
  title: string;
  description?: string;
  memoryType:
    | 'PHOTO'
    | 'VIDEO'
    | 'AUDIO'
    | 'DOCUMENT'
    | 'STORY'
    | 'ORAL_HISTORY'
    | 'LETTER'
    | 'CERTIFICATE'
    | 'HEIRLOOM';
  createdBy: Types.ObjectId;
  eventDate?: Date;
  eventDateApprox?: string;
  location?: string;
  visibility: 'FAMILY' | 'BRANCH' | 'PRIVATE';
  memberIds: Types.ObjectId[];
  branchIds: Types.ObjectId[];
  tags: string[];
  coverMediaId?: Types.ObjectId;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}
```

### Media Asset (`Media.ts`)
```typescript
interface IMedia {
  familyId: Types.ObjectId;
  memoryId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  originalFileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailStorageKey?: string;
  processingStatus: 'PENDING' | 'PROCESSED' | 'FAILED';
  visibility: 'FAMILY' | 'BRANCH' | 'PRIVATE';
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 3. Storage Abstraction (`MediaStorageService`)

Media storage is separated from database concerns using `MediaStorageService`:
- **Development Engine**: Stores encrypted/hashed files on the local filesystem (`uploads/families/:familyId/...`).
- **Cloud-Ready Interface**: The interface supports zero-downtime transition to S3, Cloudflare R2, or Google Cloud Storage via standard read, write, stream, and signed-URL generators.
- **Streaming & Range Requests**: Native video and oral audio streaming support HTTP 206 `Partial Content` range queries for smooth seeking.

---

## 4. Processing Pipeline

1. **Validation & Hashing**:
   - File size check (configurable per mime category).
   - Allowed MIME types sniffing (images, video, audio, PDFs, docs).
   - SHA-256 integrity digest computed on buffer intake.
2. **Sharp Image Processing**:
   - Resizes photos to generate fast thumbnails (300px width, webp/jpeg with preserved aspect ratio).
   - Operates with `failOn: 'none'` to handle legacy/historical EXIF variances gracefully.
3. **FFmpeg Handling**:
   - If FFmpeg is installed in the runtime environment, video thumbnail extraction and duration detection execute.
   - If FFmpeg is absent, the system gracefully marks video assets as processed with fallback UI placeholders.

---

## 5. Security & Access Control

1. **IDOR & Family Boundary Protection**:
   - All query endpoints reject access if the requesting user is not a verified member of `familyId`.
   - Accessing a media asset by ID requires ownership of the parent memory or valid membership in the parent family.
2. **Lineage Privacy**:
   - When a memory is set to `BRANCH`, only members belonging to the designated branches can view its contents or stream its media.
   - Private memories are restricted to the author and family owners.
3. **Audit Logging**:
   - Uploads, updates, deletions, and archival events write immutable audit trails into `AuditLog`.

---

## 6. Frontend Presentation

- **Heritage Gallery**: Unified interface supporting Grid View, List View, and Chronological Timeline View.
- **On This Day**: Highlights historic family events that occurred on today's date across the decades.
- **Memory Detail Drawer**:
  - High-resolution zoomable photo view
  - Native HTML5 streaming player for Oral Histories and Audio records
  - Video playback with range-seeking support
  - Associated relatives and lineage branch chips
  - In-drawer multi-file attachments and deletion
- **Multi-Step Memory Creation Flow**:
  - Step 1: Format selection across 9 preservation types, title, dates, and historical location.
  - Step 2: Tagging relatives and lineage branches.
  - Step 3: Drag-and-drop media upload and security classification (`FAMILY`, `BRANCH`, `PRIVATE`).
