import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

/**
 * File Processing Job Data Interface
 * 
 * Defines the structure of data required for file processing jobs.
 */
export interface FileProcessingJobData {
  filename: string;  // Original filename
  filepath: string;  // Path to the uploaded file
  userId: string;    // ID of the user who uploaded the file
  fileId?: string;   // Optional database file record ID
}

/**
 * Queue Service
 * 
 * Manages background job processing using Bull queue system including:
 * - File processing job creation and management
 * - Queue status monitoring and statistics
 * - Failed job handling and retry mechanisms
 * - Job lifecycle management
 * 
 * Uses Redis as the backing store for job persistence and distribution.
 */
@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('file-processing') private fileProcessingQueue: Queue,
  ) {}

  /**
   * Add File Processing Job
   * 
   * Creates a new file processing job in the queue with retry configuration.
   * Jobs are configured with exponential backoff for failed attempts.
   * 
   * @param data - File processing job data including file info and user ID
   * @returns Promise resolving to the created job object
   */
  async addFileProcessingJob(data: FileProcessingJobData) {
    return this.fileProcessingQueue.add('process-file', data, {
      attempts: 3,        // Maximum retry attempts
      backoff: {
        type: 'exponential',
        delay: 2000,      // Initial delay of 2 seconds, doubles each retry
      },
    });
  }

  /**
   * Get File Processing Queue Status
   * 
   * Retrieves comprehensive queue statistics including job counts and details.
   * Provides visibility into queue health and job distribution.
   * 
   * SECURITY NOTE: This method returns system-wide queue information.
   * Consider filtering by user context if user-specific data is needed.
   * 
   * @returns Object containing queue statistics and job details
   */
  async getFileProcessingQueueStatus() {
    // Fetch all job categories in parallel for efficiency
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

  /**
   * Get Failed Jobs
   * 
   * Retrieves all failed jobs from the queue with error details.
   * Used for monitoring and debugging failed processing attempts.
   * 
   * SECURITY WARNING: This method returns ALL failed jobs across all users.
   * In a multi-tenant system, consider filtering by user ID for security.
   * 
   * @returns Array of failed job objects with error information
   */
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

  /**
   * Get Failed Jobs for Specific User
   * 
   * Retrieves failed jobs filtered by user ID for proper user isolation.
   * This is the secure version that should be used in multi-tenant systems.
   * 
   * @param userId - User ID to filter jobs by
   * @returns Array of failed job objects belonging to the specified user
   */
  async getFailedJobsForUser(userId: string) {
    const failed = await this.fileProcessingQueue.getFailed();
    // Filter jobs to only include those belonging to the specified user
    const userFailedJobs = failed.filter(job => job.data.userId === userId);
    
    return userFailedJobs.map(job => ({
      id: job.id,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    }));
  }

  /**
   * Retry Failed Job
   * 
   * Retries a specific failed job by its ID.
   * Validates job exists and is in failed state before retry.
   * 
   * SECURITY WARNING: This method doesn't verify job ownership.
   * Users could potentially retry other users' jobs if they know the job ID.
   * Consider adding user context validation.
   * 
   * @param jobId - ID of the job to retry
   * @returns Object containing retry status and job ID
   * @throws Error if job not found or not in failed state
   */
  async retryFailedJob(jobId: string) {
    const job = await this.fileProcessingQueue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Verify job is actually failed before allowing retry
    if (job.finishedOn && job.failedReason) {
      // Retry the failed job - this will reset attempts and re-queue
      await job.retry();
      return {
        message: 'Job retry initiated',
        jobId: job.id,
      };
    } else {
      throw new Error('Job is not in a failed state');
    }
  }

  /**
   * Retry Failed Job with User Verification
   * 
   * Securely retries a failed job with ownership verification.
   * Ensures users can only retry their own jobs.
   * 
   * @param jobId - ID of the job to retry
   * @param userId - User ID for ownership verification
   * @returns Object containing retry status and job ID
   * @throws Error if job not found, access denied, or not in failed state
   */
  async retryFailedJobForUser(jobId: string, userId: string) {
    const job = await this.fileProcessingQueue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    // Critical security check: Verify user owns the job
    if (job.data.userId !== userId) {
      throw new Error('Access denied: You can only retry your own jobs');
    }

    // Verify job is actually failed before allowing retry
    if (job.finishedOn && job.failedReason) {
      // Retry the failed job - this will reset attempts and re-queue
      await job.retry();
      return {
        message: 'Job retry initiated',
        jobId: job.id,
      };
    } else {
      throw new Error('Job is not in a failed state');
    }
  }

  /**
   * Retry All Failed Jobs
   * 
   * Retries all failed jobs in the queue simultaneously.
   * Useful for bulk recovery after system issues.
   * 
   * SECURITY WARNING: This method retries ALL failed jobs across all users.
   * This could be a security risk in multi-tenant systems as users can
   * trigger retry of other users' jobs. Consider restricting to admin users.
   * 
   * @returns Object containing retry status and count of retried jobs
   */
  async retryAllFailedJobs() {
    const failed = await this.fileProcessingQueue.getFailed();
    
    // Retry all failed jobs in parallel for efficiency
    const retryPromises = failed.map(job => job.retry());
    await Promise.all(retryPromises);
    
    return {
      message: `Retried ${failed.length} failed jobs`,
      count: failed.length,
    };
  }

  /**
   * Retry All Failed Jobs for Specific User
   * 
   * Securely retries all failed jobs belonging to a specific user.
   * Provides bulk retry functionality with proper user isolation.
   * 
   * @param userId - User ID to filter and retry jobs for
   * @returns Object containing retry status and count of retried jobs
   */
  async retryAllFailedJobsForUser(userId: string) {
    const failed = await this.fileProcessingQueue.getFailed();
    
    // Filter to only include jobs belonging to the specified user
    const userFailedJobs = failed.filter(job => job.data.userId === userId);
    
    // Retry only the user's failed jobs in parallel
    const retryPromises = userFailedJobs.map(job => job.retry());
    await Promise.all(retryPromises);
    
    return {
      message: `Retried ${userFailedJobs.length} failed jobs for user`,
      count: userFailedJobs.length,
      userId: userId,
    };
  }

  /**
   * Get Queue Status for Specific User
   * 
   * Retrieves queue statistics filtered by user ID for proper isolation.
   * Shows only jobs belonging to the specified user.
   * 
   * @param userId - User ID to filter jobs by
   * @returns Object containing user-specific queue statistics
   */
  async getQueueStatusForUser(userId: string) {
    // Fetch all job categories in parallel for efficiency
    const waiting = await this.fileProcessingQueue.getWaiting();
    const active = await this.fileProcessingQueue.getActive();
    const completed = await this.fileProcessingQueue.getCompleted();
    const failed = await this.fileProcessingQueue.getFailed();

    // Filter jobs by user ID for security isolation
    const userWaiting = waiting.filter(job => job.data.userId === userId);
    const userActive = active.filter(job => job.data.userId === userId);
    const userCompleted = completed.filter(job => job.data.userId === userId);
    const userFailed = failed.filter(job => job.data.userId === userId);

    return {
      waiting: userWaiting.length,
      active: userActive.length,
      completed: userCompleted.length,
      failed: userFailed.length,
      details: {
        waiting: userWaiting.map(job => ({ id: job.id, data: job.data })),
        active: userActive.map(job => ({ id: job.id, data: job.data })),
        failed: userFailed.map(job => ({ 
          id: job.id, 
          data: job.data, 
          failedReason: job.failedReason,
          attemptsMade: job.attemptsMade,
        })),
      },
    };
  }
} 