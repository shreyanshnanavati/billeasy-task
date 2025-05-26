import { Controller, Post, Get, Body, UseGuards, Param, Request } from '@nestjs/common';
import { QueueService, FileProcessingJobData } from './queue.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * Queue Management Controller
 * 
 * Handles queue operations and job management including:
 * - File processing job creation
 * - Queue status monitoring
 * - Failed job management and retry functionality
 * 
 * SECURITY NOTE: Some endpoints may need additional user isolation checks
 * to prevent users from accessing or manipulating other users' jobs.
 */
@Controller('queue')
export class QueueController {
  constructor(private queueService: QueueService) {}

  /**
   * Add File Processing Job Endpoint
   * 
   * Creates a new file processing job in the queue.
   * Protected endpoint requiring authentication.
   * 
   * @param fileData - File processing job data including file path and user info
   * @returns Object containing success message and job ID
   * @throws UnauthorizedException if user is not authenticated
   */
  @UseGuards(JwtAuthGuard)
  @Post('file-processing')
  async addFileProcessingJob(@Body() fileData: FileProcessingJobData) {
    const job = await this.queueService.addFileProcessingJob(fileData);
    return {
      message: 'File processing job added to queue',
      jobId: job.id,
    };
  }

  /**
   * Get File Processing Queue Status Endpoint
   * 
   * Retrieves overall queue statistics including waiting, active, completed, and failed jobs.
   * 
   * SECURITY WARNING: This endpoint is not protected and exposes system-wide queue information.
   * Consider adding authentication and user-specific filtering for production use.
   * 
   * @returns Object containing queue status and job details
   */
  @Get('status/file-processing')
  async getFileProcessingQueueStatus() {
    const status = await this.queueService.getFileProcessingQueueStatus();
    return {
      queue: 'file-processing',
      ...status,
    };
  }

  /**
   * Get User-Specific Queue Status Endpoint (SECURE)
   * 
   * Retrieves queue statistics filtered by authenticated user.
   * Shows only jobs belonging to the current user for proper isolation.
   * 
   * @param req - Express request object containing authenticated user info
   * @returns Object containing user-specific queue status and job details
   * @throws UnauthorizedException if user is not authenticated
   */
  @UseGuards(JwtAuthGuard)
  @Get('status/my-jobs')
  async getMyQueueStatus(@Request() req) {
    const status = await this.queueService.getQueueStatusForUser(req.user.sub);
    return {
      queue: 'file-processing',
      userId: req.user.sub,
      ...status,
    };
  }

  /**
   * Get Failed Jobs Endpoint
   * 
   * Retrieves all failed jobs from the queue.
   * Protected endpoint requiring authentication.
   * 
   * SECURITY WARNING: This endpoint returns ALL failed jobs across all users.
   * Consider filtering by user ID to ensure users only see their own failed jobs.
   * 
   * @returns Object containing array of failed jobs
   * @throws UnauthorizedException if user is not authenticated
   */
  @UseGuards(JwtAuthGuard)
  @Get('failed-jobs')
  async getFailedJobs() {
    const failedJobs = await this.queueService.getFailedJobs();
    return { failedJobs };
  }

  /**
   * Get User's Failed Jobs Endpoint (SECURE)
   * 
   * Retrieves failed jobs filtered by authenticated user.
   * Shows only failed jobs belonging to the current user.
   * 
   * @param req - Express request object containing authenticated user info
   * @returns Object containing array of user's failed jobs
   * @throws UnauthorizedException if user is not authenticated
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-failed-jobs')
  async getMyFailedJobs(@Request() req) {
    const failedJobs = await this.queueService.getFailedJobsForUser(req.user.sub);
    return { 
      failedJobs,
      userId: req.user.sub,
      count: failedJobs.length 
    };
  }

  /**
   * Retry Failed Job Endpoint
   * 
   * Retries a specific failed job by job ID.
   * Protected endpoint requiring authentication.
   * 
   * SECURITY WARNING: This endpoint allows retrying ANY job by ID without user verification.
   * Users could potentially retry other users' jobs. Consider adding ownership checks.
   * 
   * @param jobId - ID of the job to retry
   * @returns Object containing retry result or error message
   * @throws UnauthorizedException if user is not authenticated
   */
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

  /**
   * Retry User's Failed Job Endpoint (SECURE)
   * 
   * Securely retries a failed job with ownership verification.
   * Users can only retry their own jobs.
   * 
   * @param jobId - ID of the job to retry
   * @param req - Express request object containing authenticated user info
   * @returns Object containing retry result or error message
   * @throws UnauthorizedException if user is not authenticated
   * @throws ForbiddenException if user doesn't own the job
   */
  @UseGuards(JwtAuthGuard)
  @Post('retry-my-job/:jobId')
  async retryMyFailedJob(@Param('jobId') jobId: string, @Request() req) {
    try {
      const result = await this.queueService.retryFailedJobForUser(jobId, req.user.sub);
      return result;
    } catch (error) {
      return {
        error: error.message,
        success: false,
      };
    }
  }

  /**
   * Retry All Failed Jobs Endpoint
   * 
   * Retries all failed jobs in the queue.
   * Protected endpoint requiring authentication.
   * 
   * SECURITY WARNING: This endpoint retries ALL failed jobs across all users.
   * This could be a security risk as users can trigger retry of other users' jobs.
   * Consider restricting this to admin users only or filtering by user.
   * 
   * @returns Object containing retry result or error message
   * @throws UnauthorizedException if user is not authenticated
   */
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

  /**
   * Retry All User's Failed Jobs Endpoint (SECURE)
   * 
   * Securely retries all failed jobs belonging to the authenticated user.
   * Provides bulk retry functionality with proper user isolation.
   * 
   * @param req - Express request object containing authenticated user info
   * @returns Object containing retry result or error message
   * @throws UnauthorizedException if user is not authenticated
   */
  @UseGuards(JwtAuthGuard)
  @Post('retry-all-my-failed')
  async retryAllMyFailedJobs(@Request() req) {
    try {
      const result = await this.queueService.retryAllFailedJobsForUser(req.user.sub);
      return result;
    } catch (error) {
      return {
        error: error.message,
        success: false,
      };
    }
  }
} 