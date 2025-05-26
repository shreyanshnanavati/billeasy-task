import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface FileProcessingJobData {
  filename: string;
  filepath: string;
  userId: string;
  fileId?: string;
}

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('file-processing') private fileProcessingQueue: Queue,
  ) {}

  async addFileProcessingJob(data: FileProcessingJobData) {
    return this.fileProcessingQueue.add('process-file', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  async getFileProcessingQueueStatus() {
    const waiting = await this.fileProcessingQueue.getWaiting();
    const active = await this.fileProcessingQueue.getActive();
    const completed = await this.fileProcessingQueue.getCompleted();
    const failed = await this.fileProcessingQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
} 