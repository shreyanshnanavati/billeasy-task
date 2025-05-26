import { Controller, Post, Get, Body, UseGuards, Param } from '@nestjs/common';
import { QueueService, FileProcessingJobData } from './queue.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('queue')
export class QueueController {
  constructor(private queueService: QueueService) {}

  @UseGuards(JwtAuthGuard)
  @Post('file-processing')
  async addFileProcessingJob(@Body() fileData: FileProcessingJobData) {
    const job = await this.queueService.addFileProcessingJob(fileData);
    return {
      message: 'File processing job added to queue',
      jobId: job.id,
    };
  }

  @Get('status/file-processing')
  async getFileProcessingQueueStatus() {
    const status = await this.queueService.getFileProcessingQueueStatus();
    return {
      queue: 'file-processing',
      ...status,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('failed-jobs')
  async getFailedJobs() {
    const failedJobs = await this.queueService.getFailedJobs();
    return { failedJobs };
  }

  @UseGuards(JwtAuthGuard)
  @Post('retry-job/:jobId')
  async retryFailedJob(@Param('jobId') jobId: string) {
    try {
      const result = await this.queueService.retryFailedJob(jobId);
      return result;
    } catch (error) {
      return {
        error: error.message,
        success: false,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('retry-all-failed')
  async retryAllFailedJobs() {
    try {
      const result = await this.queueService.retryAllFailedJobs();
      return result;
    } catch (error) {
      return {
        error: error.message,
        success: false,
      };
    }
  }
} 