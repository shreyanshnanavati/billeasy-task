# API Documentation

## Overview
This API provides JWT-based authentication and file upload capabilities with Multer.

## Environment Variables
Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Redis Configuration (for background jobs)
REDIS_HOST=localhost
REDIS_PORT=6379

# Application Configuration
NODE_ENV=development
PORT=3000
```

## Prerequisites
- Redis server running (for background jobs)
- Node.js and npm installed
- SQLite (included with Node.js)

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

### Health Check

#### GET /health
Health check endpoint (no authentication required).

**Response:**
```json
{
  "status": "ok"
}
```

### Authentication

#### POST /auth/register
Register a new user.

**Request Body:**
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
}
```

#### POST /auth/login
Login with existing credentials.

**Request Body:**
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "test@example.com",
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

### File Upload

#### POST /upload/file
Upload a file (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: The file to upload (required)
- `title`: Optional title for the file
- `description`: Optional description for the file

**Response:**
```json
{
  "message": "File uploaded successfully",
  "file": {
    "id": 1,
    "originalFilename": "test.txt",
    "storagePath": "uploads/file-123456789.txt",
    "title": "My Test Document",
    "description": "This is a test document for API testing",
    "status": "uploaded",
    "uploadedAt": "2023-01-01T00:00:00.000Z",
    "userId": 1
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
      "id": 1,
      "originalFilename": "test.txt",
      "storagePath": "uploads/file-123456789.txt",
      "title": "My Test Document",
      "description": "This is a test document for API testing",
      "status": "uploaded",
      "uploadedAt": "2023-01-01T00:00:00.000Z",
      "userId": 1
    }
  ]
}
```

#### GET /upload/files/:id
Get details of a specific file (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": 1,
  "originalFilename": "test.txt",
  "storagePath": "uploads/file-123456789.txt",
  "title": "My Test Document",
  "description": "This is a test document for API testing",
  "status": "uploaded",
  "uploadedAt": "2023-01-01T00:00:00.000Z",
  "userId": 1
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
- File upload with optional metadata (title, description)
- Automatic file naming with timestamps
- File metadata storage in database via Prisma
- User-specific file management
- Integration with User model for file ownership

### Background Jobs (BullMQ)
- Redis-based job queues for file processing
- Automatic job creation on file upload
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

## Testing
Use the provided `test-api.http` file with VS Code REST Client extension:

1. Install "REST Client" extension in VS Code
2. Open `test-api.http` file
3. Click "Send Request" above each HTTP request
4. Follow the sequence: Register → Login → Copy JWT token → Update tokens in protected routes
5. **Note:** JWT tokens in the file will expire - replace with fresh tokens from login response 