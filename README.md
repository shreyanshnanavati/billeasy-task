# BillEasy Task - File Processing API

A NestJS application with JWT authentication, file upload, and background job processing using Redis/BullMQ.

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
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
PORT=3000
```

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

**Upload File:**
```bash
POST /upload/file
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

# Form fields: file, title (optional), description (optional)
```

**Get Files:**
```bash
GET /upload/files
Authorization: Bearer <jwt_token>
```

**Get File Details:**
```bash
GET /upload/files/:id
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
- **File Upload:** Multer
- **Background Jobs:** BullMQ + Redis
- **Validation:** class-validator

**Key Patterns:**
- Modular architecture (Auth, Upload, Queue modules)
- Dependency injection via NestJS
- JWT guards for route protection
- Background job processors for async operations
- Repository pattern via Prisma service

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
- Retry logic with exponential backoff
- Real-time status tracking
- Error handling and logging
- Scalable worker processes

## Known Limitations

**Current:**
- Local file storage (not cloud)
- Simulated text extraction
- 5MB file size limit
- SQLite database (single-file)
- No rate limiting

**Production Considerations:**
- Migrate to PostgreSQL/MySQL
- Implement cloud storage (S3)
- Add monitoring and logging
- Implement rate limiting
- Use Redis clustering

## Testing

**API Testing:**

**Using VS Code REST Client:**
1. Install the "REST Client" extension in VS Code
2. Open `test-api.http` file
3. Click "Send Request" above each HTTP request
4. Follow the sequence: Register → Login → Copy JWT token → Update tokens in protected routes
5. **Note:** JWT tokens in the file will expire - replace with fresh tokens from login response

**Using Postman:**
- Import `postman_collection.json` into Postman
- Set up environment variables for base URL and JWT token

**Manual cURL:**
- Use cURL examples in API documentation above

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
├── upload/         # File upload & management  
├── queue/          # Background job processing
├── prisma/         # Database service
└── main.ts         # Application entry point
```

---

**Note:** This is a demonstration project showcasing NestJS patterns. Adapt security and infrastructure for production use.
