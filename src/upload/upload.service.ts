import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class UploadService {
  constructor(
    private prisma: PrismaService,
    private queueService: QueueService
  ) {}

  async saveFileMetadata(
    file: Express.Multer.File, 
    userId: string, 
    title?: string, 
    description?: string
  ) {
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
          },
        },
      },
    });

    // Add background job for file processing with file ID
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

  async getFileById(id: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
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

  async getFileWithJobs(id: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        jobs: {
          orderBy: {
            startedAt: 'desc',
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

  async getUserFiles(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    const [files, total] = await Promise.all([
      this.prisma.file.findMany({
        where: { userId: parseInt(userId) },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: {
          uploadedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.file.count({
        where: { userId: parseInt(userId) },
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

  async deleteFile(id: string): Promise<boolean> {
    try {
      const file = await this.prisma.file.findUnique({
        where: { id: parseInt(id) },
      });

      if (!file) return false;

      // Delete physical file
      try {
        await fs.unlink(file.storagePath);
      } catch (error) {
        console.warn('Physical file not found, continuing with database deletion');
      }

      // Remove from database
      await this.prisma.file.delete({
        where: { id: parseInt(id) },
      });

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  async getAllFiles() {
    const files = await this.prisma.file.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
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

  async ensureUploadDirectory(): Promise<void> {
    const uploadDir = './uploads';
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }
  }

  async retryFailedJob(fileId: string, userId: string) {
    // Find the file and verify ownership
    const file = await this.prisma.file.findFirst({
      where: {
        id: parseInt(fileId),
        userId: parseInt(userId),
      },
      include: {
        jobs: {
          where: { status: 'failed' },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!file) {
      throw new Error('File not found or access denied');
    }

    if (file.jobs.length === 0) {
      throw new Error('No failed jobs found for this file');
    }

    // Reset file status to uploaded
    await this.prisma.file.update({
      where: { id: file.id },
      data: { status: 'uploaded' },
    });

    // Add a new job for processing
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

  async getFailedJobs(userId: string) {
    const failedFiles = await this.prisma.file.findMany({
      where: {
        userId: parseInt(userId),
        status: 'failed',
      },
      include: {
        jobs: {
          where: { status: 'failed' },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
        user: {
          select: {
            id: true,
            email: true,
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