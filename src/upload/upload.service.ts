import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

/**
 * File Upload Service
 * 
 * Handles all file upload business logic including:
 * - File metadata storage and management
 * - User-specific file operations with proper isolation
 * - Background job management for file processing
 * - File system operations and cleanup
 * - Failed job retry mechanisms
 * 
 * All operations maintain strict user isolation for security.
 */
@Injectable()
export class UploadService {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService
  ) {}

  /**
   * Save File Metadata
   * 
   * Stores uploaded file information in database and initiates background processing.
   * Associates file with the authenticated user for proper isolation.
   * 
   * @param file - Multer file object containing upload details
   * @param userId - Authenticated user's ID as string
   * @param title - Optional file title for organization
   * @param description - Optional file description
   * @returns Object containing saved file details and metadata
   */
  async saveFileMetadata(
    file: Express.Multer.File, 
    userId: string, 
    title?: string, 
    description?: string
  ) {
    // Create file record with user association for security isolation
    const savedFile = await this.prisma.file.create({
      data: {
        userId: parseInt(userId),
        originalFilename: file.originalname,
        storagePath: file.path,
        title: title || null,
        description: description || null,
        status: 'uploaded',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            // Exclude sensitive user data like password
          },
        },
      },
    });

    // Initiate background processing job for the uploaded file
    await this.queueService.addFileProcessingJob({
      filename: file.filename,
      filepath: file.path,
      userId: userId,
      fileId: savedFile.id.toString(),
    });

    return {
      id: savedFile.id.toString(),
      originalName: savedFile.originalFilename,
      filename: file.filename,
      path: savedFile.storagePath,
      size: file.size,
      mimetype: file.mimetype,
      title: savedFile.title,
      description: savedFile.description,
      uploadedAt: savedFile.uploadedAt,
      userId: savedFile.userId.toString(),
      status: savedFile.status,
      user: savedFile.user,
    };
  }

  /**
   * Get File by ID
   * 
   * Retrieves file information by ID without user verification.
   * Note: This method should be used carefully as it doesn't enforce user isolation.
   * 
   * @param id - File ID as string
   * @returns File object with user details or null if not found
   */
  async getFileById(id: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            // Exclude sensitive user data
          },
        },
      },
    });

    if (!file) return null;

    return {
      id: file.id.toString(),
      originalName: file.originalFilename,
      path: file.storagePath,
      uploadedAt: file.uploadedAt,
      userId: file.userId.toString(),
      status: file.status,
      user: file.user,
    };
  }

  /**
   * Get File with Processing Jobs
   * 
   * Retrieves comprehensive file information including all associated processing jobs.
   * Used for detailed status tracking and job history.
   * 
   * @param id - File ID as string
   * @returns File object with jobs history or null if not found
   */
  async getFileWithJobs(id: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            // Exclude sensitive user data
          },
        },
        jobs: {
          orderBy: {
            startedAt: 'desc', // Most recent jobs first
          },
        },
      },
    });

    if (!file) return null;

    return {
      id: file.id.toString(),
      originalName: file.originalFilename,
      path: file.storagePath,
      title: file.title,
      description: file.description,
      status: file.status,
      extractedData: file.extractedData ? JSON.parse(file.extractedData) : null,
      uploadedAt: file.uploadedAt,
      userId: file.userId.toString(),
      user: file.user,
      jobs: file.jobs.map(job => ({
        id: job.id.toString(),
        jobType: job.jobType,
        status: job.status,
        errorMessage: job.errorMessage,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      })),
    };
  }

  /**
   * Get User Files with Pagination
   * 
   * Retrieves paginated list of files belonging to a specific user.
   * Enforces user isolation by filtering on userId.
   * 
   * @param userId - User ID as string for filtering
   * @param page - Page number for pagination (1-based)
   * @param limit - Number of items per page
   * @returns Object containing files array and pagination metadata
   */
  async getUserFiles(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    // Execute parallel queries for files and total count for efficiency
    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where: { userId: parseInt(userId) }, // Critical: Filter by user ID for isolation
        include: {
          user: {
            select: {
              id: true,
              email: true,
              // Exclude sensitive user data
            },
          },
        },
        orderBy: {
          uploadedAt: 'desc', // Most recent files first
        },
        skip,
        take: limit,
      }),
      this.prisma.file.count({
        where: { userId: parseInt(userId) }, // Count only user's files
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      files: files.map(file => ({
        id: file.id.toString(),
        originalName: file.originalFilename,
        path: file.storagePath,
        title: file.title,
        description: file.description,
        uploadedAt: file.uploadedAt,
        userId: file.userId.toString(),
        status: file.status,
        user: file.user,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Delete File
   * 
   * Removes file from both filesystem and database.
   * Handles cleanup gracefully if physical file is missing.
   * 
   * @param id - File ID as string
   * @returns Boolean indicating success of deletion
   */
  async deleteFile(id: string): Promise<boolean> {
    try {
      const file = await this.prisma.file.findUnique({
        where: { id: parseInt(id) },
      });

      if (!file) return false;

      // Attempt to delete physical file from filesystem
      try {
        await fs.unlink(file.storagePath);
      } catch (error) {
        console.warn('Physical file not found, continuing with database deletion');
      }

      // Remove file record from database
      await this.prisma.file.delete({
        where: { id: parseInt(id) },
      });

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Get All Files (Admin Function)
   * 
   * Retrieves all files across all users.
   * WARNING: This method bypasses user isolation and should only be used by admin functions.
   * 
   * @returns Array of all files in the system
   */
  async getAllFiles() {
    const files = await this.prisma.file.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            // Exclude sensitive user data
          },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return files.map(file => ({
      id: file.id.toString(),
      originalName: file.originalFilename,
      path: file.storagePath,
      uploadedAt: file.uploadedAt,
      userId: file.userId.toString(),
      status: file.status,
      user: file.user,
    }));
  }

  /**
   * Ensure Upload Directory Exists
   * 
   * Creates the uploads directory if it doesn't exist.
   * Used during application initialization.
   */
  async ensureUploadDirectory(): Promise<void> {
    const uploadDir = './uploads';
    try {
      await fs.access(uploadDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(uploadDir, { recursive: true });
    }
  }

  /**
   * Retry Failed Job
   * 
   * Initiates retry for failed file processing jobs.
   * Includes strict ownership verification for security.
   * 
   * @param fileId - File ID as string
   * @param userId - User ID for ownership verification
   * @returns Object containing retry status and job information
   * @throws Error if file not found, access denied, or no failed jobs exist
   */
  async retryFailedJob(fileId: string, userId: string) {
    // Find file with ownership verification and failed jobs
    const file = await this.prisma.file.findFirst({
      where: {
        id: parseInt(fileId),
        userId: parseInt(userId), // Critical: Verify user owns the file
      },
      include: {
        jobs: {
          where: { status: 'failed' },
          orderBy: { startedAt: 'desc' },
          take: 1, // Get most recent failed job
        },
      },
    });

    if (!file) {
      throw new Error('File not found or access denied');
    }

    if (file.jobs.length === 0) {
      throw new Error('No failed jobs found for this file');
    }

    // Reset file status to allow reprocessing
    await this.prisma.file.update({
      where: { id: file.id },
      data: { status: 'uploaded' },
    });

    // Create new processing job for retry
    const job = await this.queueService.addFileProcessingJob({
      filename: file.originalFilename,
      filepath: file.storagePath,
      userId: userId,
      fileId: file.id.toString(),
    });

    return {
      message: 'Job retry initiated',
      jobId: job.id,
      fileId: file.id.toString(),
    };
  }

  /**
   * Get Failed Jobs for User
   * 
   * Retrieves all files with failed processing jobs for a specific user.
   * Used for monitoring and retry functionality.
   * 
   * @param userId - User ID as string for filtering
   * @returns Array of files with failed jobs and error details
   */
  async getFailedJobs(userId: string) {
    const failedFiles = await this.prisma.file.findMany({
      where: {
        userId: parseInt(userId), // Filter by user for isolation
        status: 'failed',
      },
      include: {
        jobs: {
          where: { status: 'failed' },
          orderBy: { startedAt: 'desc' },
          take: 1, // Get most recent failed job per file
        },
        user: {
          select: {
            id: true,
            email: true,
            // Exclude sensitive user data
          },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return failedFiles.map(file => ({
      id: file.id.toString(),
      originalName: file.originalFilename,
      path: file.storagePath,
      title: file.title,
      description: file.description,
      status: file.status,
      uploadedAt: file.uploadedAt,
      userId: file.userId.toString(),
      user: file.user,
      lastFailedJob: file.jobs[0] ? {
        id: file.jobs[0].id.toString(),
        errorMessage: file.jobs[0].errorMessage,
        startedAt: file.jobs[0].startedAt,
        completedAt: file.jobs[0].completedAt,
      } : null,
    }));
  }
} 