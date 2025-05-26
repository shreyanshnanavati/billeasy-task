import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
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
} 