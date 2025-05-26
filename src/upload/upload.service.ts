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

  async getUserFiles(userId: string) {
    const files = await this.prisma.file.findMany({
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
} 