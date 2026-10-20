# FamilyRoots Architecture Overview

## 1. Vision & Core Philosophy
FamilyRoots is a production-grade digital family heritage and genealogy platform designed to preserve family stories, media, complex multi-generational relationships, and historical milestones with modern SaaS-grade precision and warm, heritage-inspired aesthetics.

## 2. Monorepo Structure
```
familyroots/
├── client/          # React + Vite + TypeScript frontend with feature-oriented design
├── server/          # Node.js + Express + TypeScript backend with layered architecture
├── docs/            # Architecture, API, and database schemas
├── package.json     # Workspace management and unified startup
└── server.ts        # Unified production & development container entry point
```

## 3. Core Domain Hierarchy
```
FAMILY
    ↓
FAMILY MEMBERS
    ↓
RELATIONSHIPS (Graph Model)
    ↓
BRANCHES
    ↓
MEMORIES & STORIES
    ↓
EVENTS & MILESTONES
    ↓
HIERARCHICAL PERMISSIONS & AUDIT
```

## 4. Relationship Graph Design
Unlike legacy genealogy systems that restrict modeling to simple `parent_id -> child_id` recursive structures, FamilyRoots treats relationships as **first-class graph edges** between `FamilyMember` nodes:
- `PARENT` / `CHILD`
- `SPOUSE`
- `SIBLING` / `HALF_SIBLING`
- `ADOPTIVE_PARENT` / `ADOPTED_CHILD`
- `STEP_PARENT` / `STEP_CHILD`
- `GUARDIAN`

Validation rules run on the server to prevent circular parentage or self-relationships.

## 5. Security & Authorization
- Role-based and relationship-scoped authorization (`FAMILY_OWNER`, `FAMILY_ADMIN`, `BRANCH_MANAGER`, `PARENT_MANAGER`, `MEMBER`, `CONTRIBUTOR`, `VIEWER`).
- Centralized error handling and standard error codes.
- Rate limiting, Helmet security headers, CORS origin verification, and JWT authentication tokens.
