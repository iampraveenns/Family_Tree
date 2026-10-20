# FamilyRoots — Digital Family Heritage & Genealogy Platform

FamilyRoots is a digital family heritage vault and genealogy platform built with modern full-stack web technologies. It provides a graph validation engine with cycle prevention, kinship pathfinding, an interactive generational family tree canvas, a multimedia heritage vault with deduplication, a multi-generational timeline, granular role-based collaboration, and cryptographic archive export/restoration.

---

## 🏛️ System Architecture

FamilyRoots adopts a strict domain-driven, layered full-stack architecture:

```
[ Client: React 18 SPA / React Flow / Tailwind / Zustand ]
                           │
                 HTTPS / REST JSON API
                           │
                           ▼
               [ Reverse Proxy / Nginx ]
                           │ (Port 3000)
                           ▼
          [ Express 4 Application Server ]
  ├── Security & Middlewares (Helmet, CORS, Rate Limiters, Request Logger)
  ├── Authentication & RBAC Interceptors (JWT, Token Version Invalidation)
  ├── Validation Layer (Zod Schemas)
  ├── Domain Controllers (Family, Member, Relationship, Memory, Media, Admin, Backup)
  ├── Domain Services (Kinship BFS, Cycle Detection, Deduplication, Archive Engine)
  └── Data Access Repositories (Mongoose Models, Compound Indexes, Soft Deletes)
                           │
                           ▼
               [ MongoDB 6+ Database ]
    (Embedded In-Memory Fallback for Testing / Isolated Dev)
```

---

## 💻 Technology Stack

- **Frontend Application**:
  - React 19 / 18 (Vite 6 SPA)
  - TypeScript (Strict Mode)
  - React Flow (Interactive genealogical canvas with generational tiering)
  - Tailwind CSS (Natural Tones Design System: Parchment, Heritage Evergreen, Warm Gold)
  - Zustand (High-performance client state management)
  - Lucide React (Standard vector iconography)
  - Motion / Framer Motion (Route and state transitions)

- **Backend Platform**:
  - Node.js 20+ / 22+ with Express 4
  - TypeScript (Transpiled via esbuild into a standalone `dist/server.cjs` bundle)
  - Mongoose 9 (Schema validation, compound indexing, transaction rollback)
  - Zod (Runtime payload and query string validation)
  - Pino (Structured JSON logging with request correlation IDs)
  - JSZip (Streaming cryptographic archive packaging and validation)
  - Sharp (Image processing, thumbnail generation, and metadata extraction)

- **Database & Storage**:
  - MongoDB 6+ (Production-ready with replica set support)
  - Embedded MongoDB Memory Server (Zero-configuration local testing and self-contained evaluation)
  - Storage Drivers: Local Disk, S3-compatible object storage (AWS S3, Cloudflare R2, MinIO), or Cloudinary

---

## 📂 Repository & Project Structure

```
├── .env.example                     # Environment template with safe default placeholders
├── package.json                     # Root dependencies, scripts, and build targets
├── server.ts                        # Unified application entry point (Express + Vite/Static)
├── vite.config.ts                   # Vite client bundling and Tailwind plugin configuration
├── dist/                            # Production build artifact (compiled client & server.cjs)
├── server/
│   └── src/
│       ├── app.ts                   # Express application setup, security middleware, and routes
│       ├── config/                  # Environment schemas (Zod) and MongoDB connection manager
│       ├── constants/               # Enums (Roles, Permissions, MemoryTypes, RelationshipTypes)
│       ├── controllers/             # REST endpoint handlers
│       ├── middleware/              # Auth, RBAC, Rate limiting, Uploads, Error handling
│       ├── models/                  # Mongoose models and compound indexes
│       ├── repositories/            # Data access abstractions with strict family isolation
│       ├── routes/                  # Modular route definitions with Zod validators
│       ├── scripts/                 # Database seed script and migration utilities
│       ├── services/                # Business logic, Graph algorithms, Kinship BFS, Archives
│       └── utils/                   # Structured logger, Custom errors, Cryptographic helpers
├── src/
│   ├── App.tsx                      # Root React router, theme provider, and toast container
│   ├── main.tsx                     # React client bootstrap
│   ├── components/
│   │   ├── family/                  # Tree canvas, kinship calculators, member detail cards
│   │   ├── memories/                # Memory grid, detail drawer, media viewers
│   │   ├── navigation/              # Topbar, Global search modal, Notification center
│   │   ├── onboarding/              # Step-by-step family initialization modals
│   │   ├── timeline/                # Milestone markers and historical era groups
│   │   └── ui/                      # Buttons, inputs, modals, tabs, avatars, theme switchers
│   ├── layouts/                     # PublicLayout, AppLayout with responsive navigation
│   ├── pages/                       # Dashboard, Tree, Members, Memories, Timeline, Admin, Settings
│   ├── stores/                      # Zustand state stores (Family, Memory, Auth, Theme, Collab)
│   ├── types/                       # Shared TypeScript interface definitions
│   └── utils/                       # API clients, date formatters, export utilities
└── tests/                           # Vitest end-to-end and integration test suites
```

---

## 🌳 Key Functional Modules

1. **Family Multi-Tenancy & Isolation**:
   - Every entity (`FamilyMember`, `Relationship`, `Memory`, `Media`, `Branch`, `AuditLog`) is strictly scoped by `familyId`.
   - Cross-family resource access is blocked at the repository layer.

2. **Graph Integrity & Kinship Pathfinding**:
   - Relationship graphs prevent generational circularity (e.g. child cannot be their own ancestor).
   - Breadth-First Search (BFS) pathfinding derives kinship terms (`FATHER`, `MOTHER`, `PATERNAL_GRANDFATHER`, `MATERNAL_COUSIN`, `UNCLE`, etc.) along with degrees of separation.

3. **Interactive Generational Canvas**:
   - React Flow tree visualization with automatic generation clustering, branch filtering, live edge creation, and search highlighting.

4. **Heritage Vault (Memories & Media)**:
   - Validated categories: `PHOTO`, `STORY`, `AUDIO`, `DOCUMENT`, `RECIPE`.
   - Media upload pipeline with SHA-256 checksum deduplication, MIME type allowlists, and signed asset delivery.

5. **Timeline & Milestone Chronicle**:
   - Multi-generational timeline view grouping major family moments, births, marriages, and historic events by chronological eras.

6. **Role-Based Collaboration & Governance**:
   - Token-based email invitation system with configurable roles (`FAMILY_ADMIN`, `CONTRIBUTOR`, `VIEWER`).
   - Administrative governance panel for member approval, role elevation, and audit review.

7. **Cryptographic Archive & Disaster Recovery**:
   - Complete family exports packaged into ZIP archives with checksummed JSON manifests and media binaries.
   - Safe dry-run pre-flight validation inspects archive structure and conflicts before committing.

---

## 🔒 Security Architecture & Hardening

- **Authentication & Token Lifecycle**:
  - Passwords hashed using bcrypt (salt rounds: 10).
  - JWT tokens with configurable expiration (`JWT_EXPIRES_IN=7d`).
  - Account `tokenVersion` increments instantly invalidate existing sessions upon password change or revocation.
- **Authorization & RBAC Enforcement**:
  - Middlewares verify family tenant boundaries on every request (`requireFamilyMembership`).
  - Strict hierarchical permission checks guard sensitive actions (only `FAMILY_OWNER` and `FAMILY_ADMIN` can export archives, manage memberships, or delete lineages).
- **Injection & Path Traversal Protections**:
  - Mongoose query builders and Zod schemas prevent NoSQL injection.
  - Media filenames and archive extract paths are sanitized to prevent directory traversal (`../`).
- **Media Upload Validation**:
  - 50MB file size ceiling (`MAX_FILE_SIZE_BYTES`).
  - MIME type verification and magic-byte checks prevent malicious file execution.
- **Rate Limiting & Threat Mitigation**:
  - Global API rate limiter (300 requests / 15 mins).
  - Auth route limiter (20 attempts / hr).
  - Helmet headers configure Content Security Policy (CSP), prevent MIME sniffing (`X-Content-Type-Options: nosniff`), and frame injection.
- **Data Privacy & Redaction**:
  - Sensitive parameters (`password`, `token`, credentials) are automatically stripped from request logs and API error responses.

---

## 👥 Role-Based Access Control (RBAC) Matrix

| Capability | FAMILY_OWNER | FAMILY_ADMIN | CONTRIBUTOR | VIEWER |
| :--- | :---: | :---: | :---: | :---: |
| **Manage Family Vault Settings** | ✅ | ✅ | ❌ | ❌ |
| **Invite & Manage Members** | ✅ | ✅ | ❌ | ❌ |
| **Export & Restore Archives** | ✅ | ✅ | ❌ | ❌ |
| **Delete Members & Branches** | ✅ | ✅ | ❌ | ❌ |
| **Add / Edit Members & Relationships** | ✅ | ✅ | ✅ | ❌ |
| **Contribute Memories & Media** | ✅ | ✅ | ✅ | ❌ |
| **Create Timeline Milestones** | ✅ | ✅ | ✅ | ❌ |
| **Browse Family Tree & Vault** | ✅ | ✅ | ✅ | ✅ |
| **View Memories & Milestones** | ✅ | ✅ | ✅ | ✅ |

---

## 🖼️ Media & Object Storage System

FamilyRoots supports three storage configurations via `STORAGE_PROVIDER`:

1. **Local Disk Storage (`STORAGE_PROVIDER=local`)**:
   - Files stored under `uploads/` directory on the server filesystem.
   - Ideal for local development, self-contained VPS deployments, and testing.
2. **S3-Compatible Object Storage (`STORAGE_PROVIDER=s3`)**:
   - Compatible with AWS S3, Cloudflare R2, MinIO, or Google Cloud Storage (S3 API).
   - Requires `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, and `STORAGE_SECRET_KEY`.
3. **Cloudinary (`STORAGE_PROVIDER=cloudinary`)**:
   - Requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.

All media assets generate short-lived signed authorization tokens for streaming and viewing (`STORAGE_SIGNED_URL_EXPIRES_SECONDS=3600`).

---

## 📦 Archival Backup, Export & Dry-Run Restoration Engine

### Archive Structure
```
familyroots-archive-[familyId].zip
├── manifest.json              # Version metadata, timestamp, checksums, and record counts
├── data/
│   ├── family.json            # Family vault metadata
│   ├── members.json           # All family members with biographical details
│   ├── relationships.json     # Lineage edges and relationship definitions
│   ├── branches.json          # Lineage branches
│   ├── memories.json          # Stories, recipes, documents, photos
│   └── milestones.json        # Timeline milestone chronicle
└── media/
    └── [mediaId].[ext]        # Preserved binary media assets
```

### Pre-Flight Validation & Restoration Workflow
1. **Export Archive**:
   `GET /api/families/:familyId/export` generates the signed `.zip`.
2. **Dry-Run Validation**:
   `POST /api/families/:familyId/restore/validate` unpacks the archive in memory, validates the JSON manifest, verifies file checksums, counts records, and returns a non-destructive conflict preview.
3. **Execution**:
   `POST /api/families/:familyId/restore/execute` performs idempotent document insertion with reference mapping.

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env` to configure your environment:

```bash
# Server & Network
NODE_ENV=production
PORT=3000
CLIENT_URL=https://your-domain.example.com
LOG_LEVEL=info

# Database Connection (MongoDB 6+ or MongoDB Atlas)
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/familyroots?retryWrites=true&w=majority

# Security
JWT_SECRET=replace_with_a_secure_random_64_character_hex_secret_in_production
JWT_EXPIRES_IN=7d

# Media Storage
STORAGE_PROVIDER=local
STORAGE_DIR=uploads
MAX_FILE_SIZE_BYTES=52428800
STORAGE_SIGNED_URL_EXPIRES_SECONDS=3600

# Optional S3 Provider Settings (Required if STORAGE_PROVIDER=s3)
STORAGE_ENDPOINT=
STORAGE_BUCKET=
STORAGE_REGION=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

# Optional Production Seed Guard
ALLOW_PRODUCTION_SEED=false
```

---

## 🚀 Local Development Setup & Execution

### Prerequisites
- Node.js 20.x or 22.x
- npm 9+
- Optional: Local MongoDB (if omitted, the embedded in-memory MongoDB automatically provisions for zero-friction evaluation)

### Quick Start
```bash
# 1. Install all dependencies
npm install

# 2. Seed development demonstration dataset (The Pattara Family)
npm run seed

# 3. Start unified full-stack development server (Express API + Vite SPA on port 3000)
npm run dev
```

Visit `http://localhost:3000` in your web browser.

---

## 🚢 Production Deployment Guide

### Option 1: Standalone Node.js Service (Recommended for standard Linux / VPS / Cloud VMs)

1. **Build the Client and Server Bundles:**
   ```bash
   npm ci
   npm run build
   ```
   This compiles the Vite frontend into `dist/` and bundles `server.ts` into a CommonJS production file `dist/server.cjs`.

2. **Run with Process Manager (e.g. PM2):**
   ```bash
   NODE_ENV=production pm2 start dist/server.cjs --name "familyroots" -i max
   ```

3. **Verify Deployment Health:**
   ```bash
   curl http://localhost:3000/api/health
   # Returns: {"success":true,"message":"FamilyRoots API is running","database":{"connected":true}}
   ```

### Option 2: Containerized Deployment (Google Cloud Run / AWS ECS / Docker)

1. **Build Container:**
   ```bash
   docker build -t familyroots:latest .
   ```

2. **Run Container:**
   ```bash
   docker run -d -p 3000:3000 \
     -e NODE_ENV=production \
     -e MONGODB_URI="mongodb+srv://user:password@cluster.mongodb.net/familyroots" \
     -e JWT_SECRET="your-64-character-hex-secret-here" \
     -e CLIENT_URL="https://familyroots.example.com" \
     familyroots:latest
   ```

---

## 🧪 Automated Testing & Verification Suite

FamilyRoots features 12 comprehensive automated test suites covering graph validation, RBAC, archive export/restore, security hardening, and complete end-to-end user journeys:

```bash
# Run complete test suite (all 181 tests)
npm test

# Run individual test suites
npx vitest run tests/phase22_e2e_journey.test.ts
npx vitest run tests/phase17_security_production.test.ts
npx vitest run tests/phase16_security_hardening.test.ts
npx vitest run tests/domain.test.ts
```

### Static Analysis & Build Verification
```bash
# Type check and linting
npm run lint

# Production compilation
npm run build
```

---

## 🎬 Interactive Demo Flow (Step-by-Step Walkthrough)

To explore or demonstrate FamilyRoots as a complete resume project:

1. **Landing & Authentication**:
   - Navigate to `/` to view the heritage landing page.
   - Click **Get Started** or **Sign In** (`/login`).
   - Default seeded administrator: `founder@pattara.example.com` / `Password123!`.
2. **Dashboard Overview (`/dashboard`)**:
   - Inspect generation statistics, branch distributions, featured memories, and recent audit activity.
3. **Interactive Family Tree (`/family/tree`)**:
   - Pan and zoom through 3 generations of the Pattara family tree.
   - Click any member card to view biological facts, relationships, and direct lineage.
   - Click **Add Person** or click connection handles to create new relationships in real time.
4. **Kinship Calculator**:
   - Select any two family members to calculate their exact kinship title (e.g., Grandfather, First Cousin, Great Uncle) and degree distance.
5. **Memory Vault (`/family/memories`)**:
   - Filter memories by type (`PHOTO`, `STORY`, `AUDIO`, `DOCUMENT`, `RECIPE`).
   - Open a memory to inspect rich text, tags, linked family members, and audio/image media.
   - Click **Create Memory** to add a story or upload a family photo.
6. **Chronological Timeline (`/family/timeline`)**:
   - Scroll through family milestones and historical events grouped by chronological eras.
7. **People Directory (`/family/members`)**:
   - Search members with real-time filtering, branch badges, and generation indicators.
8. **Collaboration & Governance (`/family/admin`)**:
   - Invite a collaborator with `CONTRIBUTOR` or `VIEWER` permissions.
   - Inspect the immutable tamper-evident audit log.
9. **Archival Backup & Disaster Recovery (`/family/admin?tab=backups`)**:
   - Click **Export Family Archive** to download a cryptographically signed `.zip` backup.
   - Run a non-destructive pre-flight dry run to validate archive integrity before restoring.

---

## ⚠️ Known Non-Blocking Limitations & Scope Boundaries

- **Real-Time Collaboration**: Updates use optimistic client store refreshes and polling rather than WebSockets.
- **Audio & Video Streaming**: Long media files stream via direct HTTP range requests without HLS/DASH chunking.
- **Third-Party GEDCOM Import**: Focuses on modern structured JSON archives rather than legacy 1980s GEDCOM 5.5 files.
- **Third-Party Identity Providers**: Local bcrypt authentication with JWT session management is the primary identity provider.
