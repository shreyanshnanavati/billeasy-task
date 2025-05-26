import { Processor, Process } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface FileProcessingJobData {
  filename: string;
  filepath: string;
  userId: string;
  fileId?: string;
}

@Injectable()
@Processor('file-processing')
export class FileProcessingProcessor {
  private readonly logger = new Logger(FileProcessingProcessor.name);

  constructor(private prisma: PrismaService) {}

  @Process('process-file')
  async handleFileProcessing(job: Job<FileProcessingJobData>) {
    const { filename, filepath, userId } = job.data;
    
    this.logger.log(`Starting file processing for: ${filename}`);
    
    try {
      // Find the file record in database
      const fileRecord = await this.prisma.file.findFirst({
        where: {
          storagePath: filepath,
          userId: parseInt(userId),
        },
      });

      if (!fileRecord) {
        throw new Error(`File record not found for path: ${filepath}`);
      }

      // Update status to processing
      await this.prisma.file.update({
        where: { id: fileRecord.id },
        data: { status: 'processing' },
      });

      // Create a job record
      const jobRecord = await this.prisma.job.create({
        data: {
          fileId: fileRecord.id,
          jobType: 'file-processing',
          status: 'processing',
          startedAt: new Date(),
        },
      });

      // Simulate file processing with various operations
      const extractedData = await this.processFile(filepath, filename);

      // Simulate processing time (1 minute)
      const processingTime = 60000;
      await new Promise(resolve => setTimeout(resolve, processingTime));

      // Update file status to processed and save extracted data
      await this.prisma.file.update({
        where: { id: fileRecord.id },
        data: {
          status: 'processed',
          extractedData: JSON.stringify(extractedData),
        },
      });

      // Update job status to completed
      await this.prisma.job.update({
        where: { id: jobRecord.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      this.logger.log(`File processing completed for: ${filename}`);
      
      return {
        success: true,
        extractedData,
        processingTime: Math.round(processingTime),
      };

    } catch (error) {
      this.logger.error(`File processing failed for: ${filename}`, error.stack);
      
      // Try to find the file record for error handling
      const fileRecord = await this.prisma.file.findFirst({
        where: {
          storagePath: filepath,
          userId: parseInt(userId),
        },
      });

      if (fileRecord) {
        // Update file status to failed
        await this.prisma.file.update({
          where: { id: fileRecord.id },
          data: { status: 'failed' },
        });

        // Update or create job record with error
        const existingJob = await this.prisma.job.findFirst({
          where: { fileId: fileRecord.id },
        });

        if (existingJob) {
          await this.prisma.job.update({
            where: { id: existingJob.id },
            data: {
              status: 'failed',
              errorMessage: error.message,
              completedAt: new Date(),
            },
          });
        } else {
          await this.prisma.job.create({
            data: {
              fileId: fileRecord.id,
              jobType: 'file-processing',
              status: 'failed',
              errorMessage: error.message,
              startedAt: new Date(),
              completedAt: new Date(),
            },
          });
        }
      }

      throw error;
    }
  }

  private async processFile(filepath: string, filename: string) {
    try {
      // Read the file
      const fileBuffer = await fs.readFile(filepath);
      
      // Calculate file hash (checksum)
      const hash = createHash('sha256').update(fileBuffer).digest('hex');
      
      // Get file stats
      const stats = await fs.stat(filepath);
      
      // Simulate text extraction based on file type
      let extractedText = '';
      const fileExtension = filename.split('.').pop()?.toLowerCase();
      
      if (['txt', 'md', 'json', 'js', 'ts', 'html', 'css'].includes(fileExtension || '')) {
        // For text files, extract actual content
        extractedText = fileBuffer.toString('utf8').substring(0, 500); // First 500 chars
      } else if (['pdf', 'doc', 'docx'].includes(fileExtension || '')) {
        // Simulate document text extraction
        extractedText = `[Simulated] Document content extracted from ${filename}. This would contain the actual text content in a real implementation.`;
      } else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension || '')) {
        // Simulate image metadata extraction
        extractedText = `[Simulated] Image metadata: ${filename}, dimensions and EXIF data would be extracted here.`;
      } else {
        // Generic file processing
        extractedText = `[Simulated] Binary file processed: ${filename}`;
      }

      return {
        fileHash: hash,
        fileSize: stats.size,
        fileType: fileExtension,
        extractedText,
        processedAt: new Date().toISOString(),
        metadata: {
          originalName: filename,
          mimeType: this.getMimeType(fileExtension || ''),
          lastModified: stats.mtime.toISOString(),
        },
      };
    } catch (error) {
      throw new Error(`Failed to process file: ${error.message}`);
    }
  }

  private getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      'txt': 'text/plain',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'json': 'application/json',
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'html': 'text/html',
      'css': 'text/css',
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }
} 