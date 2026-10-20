# FamilyRoots Database & Schema Design

## Architecture Philosophy
FamilyRoots uses MongoDB via Mongoose for flexible hierarchical and graph-based family heritage storage.

### 1. Families Collection (`families`)
- `_id`: ObjectId
- `name`: String
- `description`: String
- `coverImage`: String (Storage URL)
- `createdBy`: ObjectId (ref: User)
- `rootMemberIds`: Array<ObjectId> (ref: Member)
- `createdAt`, `updatedAt`: Date

### 2. Family Members Collection (`members`)
- `_id`: ObjectId
- `familyId`: ObjectId (ref: Family)
- `firstName`: String
- `middleName`: String
- `lastName`: String
- `displayName`: String
- `nickname`: String
- `gender`: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN'
- `profilePhoto`: String (Storage URL)
- `dateOfBirth`: String
- `dateOfDeath`: String
- `isLiving`: Boolean
- `birthPlace`: String
- `deathPlace`: String
- `occupation`: String
- `biography`: String
- `branchId`: ObjectId (ref: Branch)
- `linkedUserId`: ObjectId (ref: User, optional)

### 3. Relationships Collection (`relationships`)
First-class graph model:
- `_id`: ObjectId
- `familyId`: ObjectId (ref: Family)
- `sourceMemberId`: ObjectId (ref: Member)
- `targetMemberId`: ObjectId (ref: Member)
- `relationshipType`: String (PARENT, CHILD, SPOUSE, SIBLING, etc.)
- `status`: 'ACTIVE' | 'PENDING' | 'HISTORICAL'
- `createdAt`: Date

### 4. Branches Collection (`branches`)
- `_id`: ObjectId
- `familyId`: ObjectId
- `name`: String
- `description`: String
- `rootMemberId`: ObjectId
- `managerUserId`: ObjectId

### 5. Media & Storage Strategy
Large binaries (photos, documents, audio recordings) are never stored raw in MongoDB. They are persisted via object storage (`IMediaStorageService`) and referenced by metadata keys and optimized preview URLs.
