# API Documentation

## Overview
This API provides JWT-based authentication, file upload capabilities with Multer, and background job processing with BullMQ.

## Environment Variables
Create a `.env` file with the following variables:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Redis Configuration (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Application Configuration
NODE_ENV=development
PORT=3000
```

## Prerequisites
- Redis server running (for BullMQ)
- Node.js and npm installed
- SQLite (included with Node.js) or PostgreSQL/MySQL for production

## Installation
```bash
npm install
```

## Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# (Optional) View database in Prisma Studio
npx prisma studio
```

## Running the Application
```bash
# Development
npm run start:dev

# Production
npm run start:prod
```

## API Endpoints

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
  "access_token": "jwt_token_here",
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
  "access_token": "jwt_token_here",
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
  "email": "user@example.com",
  "createdAt": "2023-01-01T00:00:00.000Z"
}
```

### File Upload

#### POST /upload/file
Upload a file (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: The file to upload (max 5MB, allowed: jpg, jpeg, png, gif, pdf, doc, docx)

**Response:**
```json
{
  "message": "File uploaded successfully",
  "file": {
    "id": "1234567890",
    "originalName": "document.pdf",
    "filename": "file-1234567890-123456789.pdf",
    "path": "uploads/file-1234567890-123456789.pdf",
    "size": 1024,
    "mimetype": "application/pdf",
    "uploadedAt": "2023-01-01T00:00:00.000Z",
    "userId": "1"
  }
}
```

#### GET /upload/files
Get all files uploaded by the current user (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "files": [
    {
      "id": "1234567890",
      "originalName": "document.pdf",
      "filename": "file-1234567890-123456789.pdf",
      "path": "uploads/file-1234567890-123456789.pdf",
      "size": 1024,
      "mimetype": "application/pdf",
      "uploadedAt": "2023-01-01T00:00:00.000Z",
      "userId": "1"
    }
  ]
}
```

#### GET /upload/file/:id
Download a specific file (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:** File download

#### DELETE /upload/file/:id
Delete a specific file (requires authentication, user must own the file).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "File deleted successfully"
}
```

#### GET /upload/files/all
Get all uploaded files (public endpoint for demo).

**Response:**
```json
{
  "files": [...]
}
```

### Queue Management

#### POST /queue/email
Add an email job to the queue (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "to": "recipient@example.com",
  "subject": "Test Email",
  "body": "This is a test email body"
}
```

**Response:**
```json
{
  "message": "Email job added to queue",
  "jobId": "1"
}
```

#### POST /queue/file-processing
Add a file processing job to the queue (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "filename": "document.pdf",
  "filepath": "/path/to/file",
  "userId": "1"
}
```

**Response:**
```json
{
  "message": "File processing job added to queue",
  "jobId": "2"
}
```

#### GET /queue/status/email
Get email queue status.

**Response:**
```json
{
  "queue": "email",
  "waiting": 0,
  "active": 1,
  "completed": 5,
  "failed": 0
}
```

#### GET /queue/status/file-processing
Get file processing queue status.

**Response:**
```json
{
  "queue": "file-processing",
  "waiting": 2,
  "active": 0,
  "completed": 3,
  "failed": 1
}
```

## Features

### JWT Authentication
- Simple JWT-based authentication without Passport
- Token validation middleware
- Protected routes with `@UseGuards(JwtAuthGuard)`
- User registration and login with database storage
- Password hashing with bcrypt
- Real user validation against Prisma database

### File Upload (Multer)
- File upload with size and type restrictions
- Automatic file naming with timestamps
- File metadata storage in database via Prisma
- User-specific file management
- File download and deletion
- Integration with User model for file ownership

### Background Jobs (BullMQ)
- Redis-based job queues
- Email processing queue
- File processing queue
- Job status monitoring
- Retry mechanisms with exponential backoff

## Error Handling
All endpoints return appropriate HTTP status codes and error messages:

- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server errors

## Security Considerations
- JWT tokens expire after 24 hours
- File uploads are restricted by type and size
- User can only access their own files
- Environment variables should be properly configured in production 