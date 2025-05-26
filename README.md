# BillEasy Task - File Processing API

A NestJS application with JWT authentication, file upload, background job processing, pagination, retry mechanisms, and rate limiting using Redis/BullMQ.

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env  # Edit JWT_SECRET and other configs

# Setup database
npx prisma generate
npx prisma migrate dev --name init

# Start Redis (required for background jobs)
redis-server

# Run the application
npm run start:dev
```

Application runs at `http://localhost:3000`

## Environment Setup

Create `.env` file:

```env
# Database Configuration
DATABASE_URL="file:./prisma/dev.db"

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Redis Configuration (for background jobs)
REDIS_HOST=localhost
REDIS_PORT=6379

# Application Configuration
NODE_ENV=development
PORT=3000

# File Processing Configuration (for testing different processing times)
FILE_PROCESSING_MIN_TIME=10000  # Minimum processing time in ms (default: 3 seconds)
FILE_PROCESSING_MAX_TIME=50000  # Maximum processing time in ms (default: 5 seconds)
```

## API Features

### Pagination
- **Endpoint**: `GET /upload/files?page=1&limit=10`
- **Features**: Configurable page size (1-100), total count, navigation metadata
- **Default**: Page 1, limit 10

### Rate Limiting
- **Upload Limit**: 5 uploads per minute per user
- **Global Limit**: 10 requests per minute
- **Response**: 429 Too Many Requests when exceeded

### Retry Mechanisms
- **Auto Retry**: Exponential backoff (3 attempts)
- **Manual Retry**: 
  - `POST /upload/files/:id/retry` - Retry specific file
  - `POST /queue/retry-job/:jobId` - Retry specific job
  - `POST /queue/retry-all-failed` - Retry all failed jobs
- **Failed Jobs**: `GET /upload/files/failed` - List user's failed jobs

## API Documentation

> 📖 **For detailed API documentation with request/response examples, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**

### Authentication Flow

**Register:**
```bash
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Login:**
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com", 
  "password": "password123"
}
```

**Protected Routes:**
```bash
GET /auth/profile
Authorization: Bearer <jwt_token>
```

### File Management

**Upload File (Rate Limited):**
```bash
POST /upload/file
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

# Form fields: file, title (optional), description (optional)
# Rate limit: 5 uploads per minute per user
```

**Get Files with Pagination:**
```bash
# Default pagination (page 1, limit 10)
GET /upload/files
Authorization: Bearer <jwt_token>

# Custom pagination
GET /upload/files?page=2&limit=5
Authorization: Bearer <jwt_token>
```

**Get Failed Jobs:**
```bash
GET /upload/files/failed
Authorization: Bearer <jwt_token>
```

**Retry Failed Job:**
```bash
POST /upload/files/:id/retry
Authorization: Bearer <jwt_token>
```

**Get File Details:**
```bash
GET /upload/files/:id
Authorization: Bearer <jwt_token>
```

### Queue Management

**Get Queue Status:**
```bash
GET /queue/status/file-processing
```

**Retry Operations:**
```bash
# Retry specific job
POST /queue/retry-job/:jobId
Authorization: Bearer <jwt_token>

# Retry all failed jobs
POST /queue/retry-all-failed
Authorization: Bearer <jwt_token>
```

**Health Check:**
```bash
GET /health
```

## Architecture & Design Choices

**Tech Stack:**
- **Framework:** NestJS with TypeScript
- **Database:** SQLite with Prisma ORM
- **Authentication:** JWT (custom implementation)
- **File Upload:** Multer with rate limiting
- **Background Jobs:** BullMQ + Redis
- **Rate Limiting:** @nestjs/throttler
- **Validation:** class-validator

**Key Patterns:**
- Modular architecture (Auth, Upload, Queue modules)
- Dependency injection via NestJS
- JWT guards for route protection
- Background job processors for async operations
- Repository pattern via Prisma service
- Pagination with metadata
- Comprehensive retry mechanisms

## Database Schema

```sql
-- Users: id, email, password, created_at
-- Files: id, user_id, original_filename, storage_path, title, description, status, extracted_data, uploaded_at
-- Jobs: id, file_id, job_type, status, error_message, started_at, completed_at
```

**Relationships:**
- User → Files (1:many)
- File → Jobs (1:many)

## Background Job Processing

**Workflow:**
1. File uploaded → Job queued in Redis
2. Worker processes file asynchronously
3. Extracts metadata, text content, file hash
4. Updates database with processing status
5. Stores extracted data

**Features:**
- Retry logic with exponential backoff (3 attempts)
- Manual retry for failed jobs
- Bulk retry operations
- Real-time status tracking
- Error handling and logging
- Scalable worker processes

## Testing

**API Testing:**

**Using VS Code REST Client:**
1. Install the "REST Client" extension in VS Code
2. Open `test-api-enhanced.http` file
3. Click "Send Request" above each HTTP request
4. Follow the sequence: Register → Login → Copy JWT token → Update tokens in protected routes
5. **Note:** JWT tokens in the file will expire - replace with fresh tokens from login response

**Using Postman:**
- Import `postman_collection.json` into Postman
- Set up environment variables for base URL and JWT token

**Manual cURL:**
- Use cURL examples in API documentation above

## Testing Features

### Pagination Testing
```bash
# Test different page sizes
GET /upload/files?page=1&limit=5
GET /upload/files?page=2&limit=3
GET /upload/files  # Default pagination
```

### Rate Limiting Testing
```bash
# Upload 6 files quickly - 6th should be rate limited
POST /upload/file (repeat 6 times quickly)
# Expected: 429 Too Many Requests on 6th upload
```

### Retry Testing
```bash
# Get failed jobs
GET /upload/files/failed

# Retry specific file
POST /upload/files/:id/retry

# Retry all failed jobs
POST /queue/retry-all-failed
```

### Processing Time Testing
You can configure file processing times to test different scenarios:

**Fast Processing (for quick testing):**
```env
FILE_PROCESSING_MIN_TIME=500   # 0.5 seconds
FILE_PROCESSING_MAX_TIME=1000  # 1 second
```

**Slow Processing (for testing status checks):**
```env
FILE_PROCESSING_MIN_TIME=10000  # 10 seconds
FILE_PROCESSING_MAX_TIME=15000  # 15 seconds
```

**Very Slow Processing (for testing retry mechanisms):**
```env
FILE_PROCESSING_MIN_TIME=30000  # 30 seconds
FILE_PROCESSING_MAX_TIME=60000  # 60 seconds
```

After changing these values, restart the application to see the effects.

## Current Limitations

**Current:**
- Local file storage (not cloud)
- Simulated text extraction
- 5MB file size limit
- SQLite database (single-file)
- Basic rate limiting (in-memory)

**Production Considerations:**
- Migrate to PostgreSQL/MySQL
- Implement cloud storage (S3)
- Add monitoring and logging
- Use Redis for rate limiting storage
- Use Redis clustering
- Implement more sophisticated retry strategies
- Add file type validation
- Implement file scanning for security

## Development Tools

```bash
npx prisma studio     # Database GUI
redis-cli monitor     # Redis monitoring
npm run start:debug   # Debug mode
```

## Project Structure

```
src/
├── auth/           # JWT authentication
├── upload/         # File upload & management with pagination & rate limiting
├── queue/          # Background job processing with retry mechanisms
├── prisma/         # Database service
└── main.ts         # Application entry point
```

---

**Note:** This is a demonstration project showcasing NestJS patterns. Adapt security and infrastructure for production use.
