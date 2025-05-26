# API Documentation

## Overview
Detailed API specifications for the BillEasy Task file processing API with JWT authentication, pagination, retry mechanisms, and rate limiting.

> 💡 **Quick Start Guide**: See [README.md](./README.md) for setup instructions and feature overview.

## Base URL
```
http://localhost:3000
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## API Endpoints

### Health Check

#### GET /health
Health check endpoint (no authentication required).

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2023-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "development"
}
```

### Authentication

#### POST /auth/register
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
}
```

#### POST /auth/login
Login with existing credentials.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
}
```

#### GET /auth/profile
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": 1,
  "email": "test@example.com",
  "createdAt": "2023-01-01T00:00:00.000Z"
}
```

### File Upload & Management

#### POST /upload/file
Upload a file (requires authentication, rate limited to 5 uploads per minute per user).

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: The file to upload (required, max 5MB)
- `title`: Optional title for the file
- `description`: Optional description for the file

**Rate Limiting:**
- 5 uploads per minute per user
- Returns 429 Too Many Requests if limit exceeded

**Response:**
```json
{
  "fileId": "1",
  "status": "uploaded",
  "message": "File uploaded successfully",
  "file": {
    "id": "1",
    "originalName": "test.txt",
    "filename": "file-123456789.txt",
    "path": "uploads/file-123456789.txt",
    "size": 1024,
    "mimetype": "text/plain",
    "title": "My Test Document",
    "description": "This is a test document for API testing",
    "uploadedAt": "2023-01-01T00:00:00.000Z",
    "userId": "1",
    "status": "uploaded",
    "user": {
      "id": 1,
      "email": "test@example.com"
    }
  }
}
```

#### GET /upload/files
Get all files uploaded by the current user with pagination (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page`: Page number (default: 1, minimum: 1)
- `limit`: Items per page (default: 10, minimum: 1, maximum: 100)

**Examples:**
- `GET /upload/files` - Default pagination (page 1, limit 10)
- `GET /upload/files?page=2&limit=5` - Page 2 with 5 items per page
- `GET /upload/files?page=1&limit=20` - Page 1 with 20 items per page

**Response:**
```json
{
  "files": [
    {
      "id": "1",
      "originalName": "test.txt",
      "path": "uploads/file-123456789.txt",
      "title": "My Test Document",
      "description": "This is a test document for API testing",
      "uploadedAt": "2023-01-01T00:00:00.000Z",
      "userId": "1",
      "status": "uploaded",
      "user": {
        "id": 1,
        "email": "test@example.com"
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalItems": 25,
    "itemsPerPage": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

#### GET /upload/files/failed
Get all failed jobs for the current user (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "failedJobs": [
    {
      "id": "1",
      "originalName": "failed-file.txt",
      "path": "uploads/file-123456789.txt",
      "title": "Failed Document",
      "description": "This document failed processing",
      "status": "failed",
      "uploadedAt": "2023-01-01T00:00:00.000Z",
      "userId": "1",
      "user": {
        "id": 1,
        "email": "test@example.com"
      },
      "lastFailedJob": {
        "id": "1",
        "errorMessage": "Processing failed due to invalid format",
        "startedAt": "2023-01-01T00:01:00.000Z",
        "completedAt": "2023-01-01T00:02:00.000Z"
      }
    }
  ]
}
```

#### POST /upload/files/:id/retry
Retry a failed job for a specific file (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Job retry initiated",
  "jobId": "123",
  "fileId": "1"
}
```

**Error Responses:**
- `403 Forbidden`: User doesn't own the file
- `400 Bad Request`: No failed jobs found for this file

#### GET /upload/files/:id
Get details of a specific file (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "1",
  "originalName": "test.txt",
  "path": "uploads/file-123456789.txt",
  "title": "My Test Document",
  "description": "This is a test document for API testing",
  "status": "processed",
  "extractedData": {
    "fileHash": "abc123...",
    "fileSize": 1024,
    "fileType": "txt",
    "extractedText": "File content...",
    "processedAt": "2023-01-01T00:05:00.000Z",
    "metadata": {
      "originalName": "test.txt",
      "mimeType": "text/plain",
      "lastModified": "2023-01-01T00:00:00.000Z"
    }
  },
  "uploadedAt": "2023-01-01T00:00:00.000Z",
  "userId": "1",
  "user": {
    "id": 1,
    "email": "test@example.com"
  },
  "jobs": [
    {
      "id": "1",
      "jobType": "file-processing",
      "status": "completed",
      "errorMessage": null,
      "startedAt": "2023-01-01T00:01:00.000Z",
      "completedAt": "2023-01-01T00:05:00.000Z"
    }
  ]
}
```

## Queue Management

#### POST /queue/file-processing
Manually add a file processing job (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "filename": "test.txt",
  "filepath": "uploads/file-123456789.txt",
  "userId": "1",
  "fileId": "1"
}
```

**Response:**
```json
{
  "message": "File processing job added to queue",
  "jobId": "123"
}
```

#### GET /queue/status/file-processing
Get file processing queue status with detailed information.

**⚠️ SECURITY WARNING**: This endpoint exposes system-wide queue information and is not user-specific. Consider using the secure alternative `/queue/status/my-jobs` for user-specific data.

**Response:**
```json
{
  "queue": "file-processing",
  "waiting": 2,
  "active": 1,
  "completed": 10,
  "failed": 1,
  "details": {
    "waiting": [
      {
        "id": "124",
        "data": {
          "filename": "pending.txt",
          "filepath": "uploads/file-124.txt",
          "userId": "1"
        }
      }
    ],
    "active": [
      {
        "id": "123",
        "data": {
          "filename": "processing.txt",
          "filepath": "uploads/file-123.txt",
          "userId": "1"
        }
      }
    ],
    "failed": [
      {
        "id": "122",
        "data": {
          "filename": "failed.txt",
          "filepath": "uploads/file-122.txt",
          "userId": "1"
        },
        "failedReason": "File not found",
        "attemptsMade": 3
      }
    ]
  }
}
```

#### GET /queue/status/my-jobs 🔒
Get queue status filtered by authenticated user (SECURE).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "queue": "file-processing",
  "userId": "1",
  "waiting": 1,
  "active": 0,
  "completed": 5,
  "failed": 0,
  "details": {
    "waiting": [
      {
        "id": "124",
        "data": {
          "filename": "my-pending.txt",
          "filepath": "uploads/file-124.txt",
          "userId": "1"
        }
      }
    ],
    "active": [],
    "failed": []
  }
}
```

#### GET /queue/failed-jobs
Get all failed jobs in the queue (requires authentication).

**⚠️ SECURITY WARNING**: This endpoint returns ALL failed jobs across all users. Use `/queue/my-failed-jobs` for user-specific failed jobs.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "failedJobs": [
    {
      "id": "122",
      "data": {
        "filename": "failed.txt",
        "filepath": "uploads/file-122.txt",
        "userId": "1"
      },
      "failedReason": "File not found",
      "attemptsMade": 3,
      "processedOn": 1640995200000,
      "finishedOn": 1640995260000
    }
  ]
}
```

#### GET /queue/my-failed-jobs 🔒
Get failed jobs filtered by authenticated user (SECURE).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "failedJobs": [
    {
      "id": "122",
      "data": {
        "filename": "my-failed.txt",
        "filepath": "uploads/file-122.txt",
        "userId": "1"
      },
      "failedReason": "File not found",
      "attemptsMade": 3,
      "processedOn": 1640995200000,
      "finishedOn": 1640995260000
    }
  ],
  "userId": "1",
  "count": 1
}
```

#### POST /queue/retry-job/:jobId
Retry a specific failed job by job ID (requires authentication).

**⚠️ SECURITY WARNING**: This endpoint allows retrying ANY job by ID without user verification. Use `/queue/retry-my-job/:jobId` for secure job retry with ownership verification.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Job retry initiated",
  "jobId": "122"
}
```

**Error Response:**
```json
{
  "error": "Job not found",
  "success": false
}
```

#### POST /queue/retry-my-job/:jobId 🔒
Securely retry a failed job with ownership verification (SECURE).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Job retry initiated",
  "jobId": "122"
}
```

**Error Responses:**
```json
{
  "error": "Access denied: You can only retry your own jobs",
  "success": false
}
```

#### POST /queue/retry-all-failed
Retry all failed jobs in the queue (requires authentication).

**⚠️ SECURITY WARNING**: This endpoint retries ALL failed jobs across all users. Use `/queue/retry-all-my-failed` to retry only your own failed jobs.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Retried 3 failed jobs",
  "count": 3
}
```

#### POST /queue/retry-all-my-failed 🔒
Securely retry all failed jobs belonging to authenticated user (SECURE).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Retried 2 failed jobs for user",
  "count": 2,
  "userId": "1"
}
```

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Access denied (e.g., trying to access another user's files)
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server errors

### Error Response Format
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

## Rate Limiting Details

### Upload Rate Limiting
- **Limit**: 5 uploads per minute per user
- **Scope**: Per authenticated user (based on JWT token)
- **Reset**: Every 60 seconds
- **Headers**: Rate limit info included in response headers

### Global Rate Limiting
- **Limit**: 10 requests per minute (default for other endpoints)
- **Scope**: Global across all users
- **Reset**: Every 60 seconds

### Rate Limit Headers
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1640995200
```

## Pagination Details

### Query Parameters
- `page`: Page number (integer, minimum: 1, default: 1)
- `limit`: Items per page (integer, minimum: 1, maximum: 100, default: 10)

### Pagination Response
```json
{
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 47,
    "itemsPerPage": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Validation Rules
- Invalid page numbers default to 1
- Invalid limits default to 10
- Maximum limit is capped at 100 items per page

## File Processing Workflow

1. **Upload**: File uploaded via `POST /upload/file`
2. **Queue**: Background job automatically created
3. **Processing**: Worker processes file (configurable processing time via environment variables)
4. **Completion**: File status updated, extracted data stored
5. **Retry**: Manual retry available for failed jobs

### Configurable Processing Time
The file processing time can be configured via environment variables for testing:
- `FILE_PROCESSING_MIN_TIME`: Minimum processing time in milliseconds (default: 3000)
- `FILE_PROCESSING_MAX_TIME`: Maximum processing time in milliseconds (default: 5000)

### File Status Values
- `uploaded`: File uploaded, processing queued
- `processing`: File currently being processed
- `processed`: File processing completed successfully
- `failed`: File processing failed

### Job Status Values
- `queued`: Job waiting in queue
- `processing`: Job currently being processed
- `completed`: Job completed successfully
- `failed`: Job failed (retry available)

## Security Considerations

- JWT tokens expire after 24 hours
- File uploads restricted to 5MB
- User can only access their own files
- Rate limiting prevents abuse
- File type validation (configurable)
- Path traversal protection

### Queue Security Implementation

The queue system provides both legacy and secure endpoints for backward compatibility:

#### 🔒 Secure Endpoints (Recommended)
These endpoints implement proper user isolation and should be used in production:

- `GET /queue/status/my-jobs` - User-specific queue status
- `GET /queue/my-failed-jobs` - User's failed jobs only
- `POST /queue/retry-my-job/:jobId` - Retry with ownership verification
- `POST /queue/retry-all-my-failed` - Retry user's failed jobs only

#### ⚠️ Legacy Endpoints (Security Warnings)
These endpoints have security limitations and should be avoided or restricted:

- `GET /queue/status/file-processing` - Exposes system-wide data
- `GET /queue/failed-jobs` - Shows all users' failed jobs
- `POST /queue/retry-job/:jobId` - No ownership verification
- `POST /queue/retry-all-failed` - Affects all users' jobs

#### Security Features
- **User Isolation**: Secure endpoints filter data by authenticated user ID
- **Ownership Verification**: Job operations verify user owns the resource
- **Access Control**: JWT authentication required for all protected endpoints
- **Data Filtering**: Database queries include user ID constraints

#### Migration Strategy
1. Use secure endpoints for new implementations
2. Legacy endpoints maintained for backward compatibility
3. Security warnings documented for legacy endpoints
4. Plan migration to secure endpoints for existing clients

## Testing

Use the provided test files for comprehensive API testing:

- **`test-api-enhanced.http`**: Test new features (pagination, retry, rate limiting)
- **`test-api.http`**: Test basic functionality
- **`postman_collection.json`**: Postman collection for API testing

### Test Scenarios

1. **Authentication Flow**: Register → Login → Access protected routes
2. **File Upload**: Upload files with metadata
3. **Pagination**: Test different page sizes and navigation
4. **Rate Limiting**: Upload multiple files to trigger rate limit
5. **Retry Mechanisms**: Test failed job retry functionality
6. **Error Handling**: Test various error scenarios 