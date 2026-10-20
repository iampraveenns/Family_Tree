# FamilyRoots API Specification (Phase 1)

## Base URL
`/api`

## Health Check
- **Endpoint**: `GET /api/health`
- **Response**:
```json
{
  "success": true,
  "message": "FamilyRoots API is running",
  "version": "1.0.0",
  "timestamp": "2026-09-04T17:45:00.000Z",
  "database": {
    "connected": false,
    "status": "offline_fallback"
  }
}
```

## Standard Error Format
All errors follow a unified structure:
```json
{
  "success": false,
  "error": {
    "code": "MEMBER_NOT_FOUND",
    "message": "Family member was not found",
    "details": null
  }
}
```

## Planned Domain Endpoints (Phase 2 & Beyond)
- `/api/auth/register` - Create user account
- `/api/auth/login` - Authenticate and obtain JWT
- `/api/families` - Manage family heritage vaults
- `/api/members` - Manage individual family tree members
- `/api/relationships` - Query and assert graph relationships
- `/api/branches` - Organize family branches
- `/api/memories` - Archive photos, documents, and oral histories
