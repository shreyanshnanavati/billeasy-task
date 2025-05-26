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
      details: {
        waiting: waiting.map(job => ({ id: job.id, data: job.data })),
        active: active.map(job => ({ id: job.id, data: job.data })),
        failed: failed.map(job => ({ 
          id: job.id, 
          data: job.data, 
          failedReason: job.failedReason,
          attemptsMade: job.attemptsMade,
        })),
      },
    };
  }

  async getFailedJobs() {
    const failed = await this.fileProcessingQueue.getFailed();
    return failed.map(job => ({
      id: job.id,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    }));
  }

  async retryFailedJob(jobId: string) {
    const job = await this.fileProcessingQueue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.finishedOn && job.failedReason) {
      // Retry the failed job
      await job.retry();
      return {
        message: 'Job retry initiated',
        jobId: job.id,
      };
    } else {
      throw new Error('Job is not in a failed state');
    }
  }

  async retryAllFailedJobs() {
    const failed = await this.fileProcessingQueue.getFailed();
    const retryPromises = failed.map(job => job.retry());
    await Promise.all(retryPromises);
    
    return {
      message: `Retried ${failed.length} failed jobs`,
      count: failed.length,
    };
  }
} 