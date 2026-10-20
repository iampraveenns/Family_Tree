# FamilyRoots Domain Model & Database Architecture

## 1. Architectural Overview

FamilyRoots implements a strict, enterprise-grade layered domain architecture:

```
HTTP Request
     │
     ▼
[ Express Router ] ──> [ Request Validation (Zod) ]
     │
     ▼
[ Controller Layer ] (Request unpacking, HTTP status mapping, error passing)
     │
     ▼
[ Service Layer ] (Business logic, Graph integrity, BFS cycle detection, Kinship engine, Audit dispatch)
     │
     ▼
[ Repository Layer ] (Data access, Mongo query optimization, pagination abstraction)
     │
     ▼
[ Mongoose Models ] (Schema definition, Compound indexing, Validation constraints)
     │
     ▼
[ MongoDB Database ]
```

---

## 2. Core Domain Entities

### 2.1 Family (`Family`)
Represents the top-level tenant and boundary for all heritage records. Every member, relationship, branch, and audit entry is strictly family-scoped.

- **Collection**: `families`
- **Key Fields**:
  - `_id`: ObjectId
  - `name`: String (Required, max 120 chars)
  - `description`: String (max 2000 chars)
  - `coverImage`: String (Storage URI)
  - `originPlace`: String (max 200 chars)
  - `motto`: String (max 200 chars)
  - `createdBy`: String / ObjectId
  - `rootMemberIds`: Array<ObjectId>
  - `settings`: Object (visibility, invitations, timezone, date format)
- **Indexes**:
  - `{ createdBy: 1 }`

---

### 2.2 FamilyMember (`FamilyMember`)
Represents an individual ancestor or living relative. Members belong to exactly one family and can be associated with multiple branches.

- **Collection**: `familymembers`
- **Key Fields**:
  - `_id`: ObjectId
  - `familyId`: ObjectId (ref: `Family`, Indexed)
  - `firstName`, `lastName`: String (Required)
  - `middleName`, `nickname`: String
  - `displayName`: String (Computed or overridden)
  - `gender`: `'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN'`
  - `profilePhoto`: String (Storage URI)
  - `dateOfBirth`, `dateOfDeath`: String (ISO date string or partial year)
  - `isLiving`: Boolean (default `true`)
  - `birthPlace`, `deathPlace`: String
  - `occupation`, `education`: String
  - `biography`: String
  - `generation`: Number (Positive integer)
  - `branchIds`: Array<ObjectId> (ref: `FamilyBranch`)
  - `linkedUserId`: String / ObjectId (optional linkage to authenticated account)
  - `privacySettings`: Object (`visibility`, `hideLivingDates`)
- **Indexes**:
  - `{ familyId: 1, lastName: 1, firstName: 1 }`
  - `{ familyId: 1, generation: 1 }`
  - `{ familyId: 1, branchIds: 1 }`
  - `{ familyId: 1, isLiving: 1 }`

---

### 2.3 Relationship (`Relationship`)
First-class graph edge model. Represents directional or symmetrical connections between two family members within the same family boundary.

- **Collection**: `relationships`
- **Key Fields**:
  - `_id`: ObjectId
  - `familyId`: ObjectId (ref: `Family`, Indexed)
  - `sourceMemberId`: ObjectId (ref: `FamilyMember`, Indexed)
  - `targetMemberId`: ObjectId (ref: `FamilyMember`, Indexed)
  - `relationshipType`: Enum (`PARENT`, `CHILD`, `SPOUSE`, `SIBLING`, `HALF_SIBLING`, `ADOPTIVE_PARENT`, `ADOPTED_CHILD`, `STEP_PARENT`, `STEP_CHILD`, `GUARDIAN`)
  - `status`: `'ACTIVE' | 'PENDING' | 'HISTORICAL'`
  - `metadata`: Object (marriage dates, location, ceremony notes)
- **Indexes**:
  - `{ familyId: 1, sourceMemberId: 1, targetMemberId: 1 }`
  - `{ familyId: 1, targetMemberId: 1 }`
  - `{ familyId: 1, relationshipType: 1 }`

---

### 2.4 FamilyBranch (`FamilyBranch`)
Represents lineage clusters anchored by a root ancestor (e.g., branches created when siblings form their own lineages).

- **Collection**: `familybranches`
- **Key Fields**:
  - `_id`: ObjectId
  - `familyId`: ObjectId (ref: `Family`, Indexed)
  - `name`: String (Required, max 100 chars)
  - `description`: String (max 1000 chars)
  - `rootMemberId`: ObjectId (ref: `FamilyMember`, Indexed)
  - `coverImage`: String (Storage URI)
  - `accentColor`: String (HEX color code, e.g. `#059669`)
  - `visibility`: `'FAMILY' | 'PUBLIC' | 'PRIVATE'`
- **Indexes**:
  - `{ familyId: 1, rootMemberId: 1 }`
  - `{ familyId: 1, name: 1 }`

---

### 2.5 AuditLog (`AuditLog`)
Immutable history of domain actions performed on family data.

- **Collection**: `auditlogs`
- **Key Fields**:
  - `familyId`: ObjectId
  - `action`: String (e.g., `MEMBER_CREATED`, `RELATIONSHIP_CREATED`)
  - `entityType`: String (`Family`, `FamilyMember`, `Relationship`, `FamilyBranch`)
  - `entityId`: String
  - `userId`: String
  - `details`: Record<string, unknown>
  - `createdAt`: Date

---

## 3. Graph Integrity & Validation Rules

The `RelationshipService` enforces strict graph invariants prior to inserting or updating relationships:

1. **Family Isolation**: Both `sourceMemberId` and `targetMemberId` must belong to the specified `familyId`.
2. **Self-Reference Prevention**: A member cannot form a relationship with themselves (`sourceMemberId !== targetMemberId`).
3. **Duplicate Prevention**:
   - **Directional duplicate**: If `A -> B` exists as `PARENT`, creating another `A -> B` as `PARENT` is rejected.
   - **Symmetric duplicate**: If `A <-> B` exists as `SPOUSE`, attempting `B -> A` as `SPOUSE` is rejected as duplicate.
4. **Mutual Parenting Rejection**: If `A` is already recorded as a parent of `B`, an assertion that `B` is a parent of `A` is rejected immediately.
5. **Cycle Detection Engine (BFS)**:
   - When adding a `PARENT` edge `source -> target`, the service runs a Breadth-First Search (BFS) starting from `source` traversing existing parent edges up the tree.
   - If `target` is reachable as an ancestor of `source`, adding the edge would form an invalid generational cycle and is rejected with a `400 Bad Request`.

---

## 4. Kinship Pathfinding & Terminology Engine

The `KinshipService` provides automated relationship derivation between any two family members in a family:

- **Algorithm**: Bidirectional Breadth-First Search (BFS) over active family relationship edges.
- **Normalized Steps**:
  - 1 step `PARENT` → `'FATHER'` (if male), `'MOTHER'` (if female), or `'PARENT'`
  - 1 step `CHILD` → `'SON'` (if male), `'DAUGHTER'` (if female), or `'CHILD'`
  - 1 step `SPOUSE` → `'HUSBAND'` (if male), `'WIFE'` (if female), or `'SPOUSE'`
  - 1 step `SIBLING` → `'BROTHER'` (if male), `'SISTER'` (if female), or `'SIBLING'`
  - 2 steps `PARENT + PARENT` → `'GRANDFATHER'` / `'GRANDMOTHER'`
  - 2 steps `CHILD + CHILD` → `'GRANDSON'` / `'GRANDDAUGHTER'`
  - 2 steps `PARENT + SIBLING` → `'UNCLE'` / `'AUNT'`
  - 2 steps `SIBLING + CHILD` → `'NEPHEW'` / `'NIECE'`
  - 3 steps `PARENT + SIBLING + CHILD` → `'FIRST_COUSIN'`
- **Output Payload**:
  - `source`: Source member ID & name
  - `target`: Target member ID & name
  - `relationship`: Normalized kinship term
  - `distance`: Graph hop count
  - `path`: Array of step details (`fromName`, `toName`, `step`)

---

## 5. Normalized Tree API (`/api/families/:familyId/tree`)

Optimized for frontend graph renderers such as **React Flow**:
- Returns the full family entity, array of normalized members, relationships, and branches in a single query pass.
- Bypasses deep document nesting to avoid payload bloat and circular reference serialization issues.

---

## 6. Seed Dataset: The Pattara Family

The seeding script (`npm run seed`) populates a realistic 3-generation Indian heritage family:
- **Patriarch & Matriarch**: Anand Pattara & Sita Pattara (Generation 1)
- **Children**:
  - Dev Pattara (Civil Engineer, Branch Root for Dev Branch) & Lakshmi Pattara
  - Maya Pattara (Ayurvedic Physician, Branch Root for Maya Branch) & Vikram Menon
  - Karan Pattara (Botanist, Branch Root for Karan Branch) & Ananya Sharma
- **Grandchildren (Generation 3)**:
  - Tara Pattara, Kabir Pattara, Meera Menon, Rohan Menon, Arjun Pattara, Divya Pattara
- **Total Seed Data**: 14 members, 3 branches, 27 relationships, full audit log.
