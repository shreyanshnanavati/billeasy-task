import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UploadService {
  constructor(private prisma: PrismaService) {}

  async saveFileMetadata(file: Express.Multer.File, userId: string) {
    const savedFile = await this.prisma.file.create({
      data: {
        userId: parseInt(userId),
        originalFilename: file.originalname,
        storagePath: file.path,
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

    return {
      id: savedFile.id.toString(),
      originalName: savedFile.originalFilename,
      filename: file.filename,
      path: savedFile.storagePath,
      size: file.size,
      mimetype: file.mimetype,
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