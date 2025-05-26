import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  Res,
  NotFoundException,
  Body,
  ForbiddenException,
  BadRequestException,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * File Upload Controller
 * 
 * Handles all file upload and management operations including:
 * - File upload with metadata
 * - User-specific file listing with pagination
 * - File status tracking and job management
 * - Failed job retry functionality
 * 
 * All endpoints are protected and user-isolated for security.
 */
@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  /**
   * Upload File Endpoint
   * 
   * Allows authenticated users to upload files with optional metadata.
   * Includes rate limiting (5 uploads per minute) and file validation.
   * Files are processed asynchronously in background jobs.
   * 
   * @param file - Uploaded file from multipart form data
   * @param req - Express request object containing authenticated user info
   * @param metadata - Optional file metadata (title, description)
   * @returns Object containing file ID, status, and file details
   * @throws BadRequestException if no file is uploaded
   * @throws UnauthorizedException if user is not authenticated
   */
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 uploads per minute per user
  @Post('file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File, 
    @Request() req,
    @Body() metadata?: { title?: string; description?: string }
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Save file metadata with authenticated user's ID for user isolation
    const uploadedFile = await this.uploadService.saveFileMetadata(
      file, 
      req.user.sub, 
      metadata?.title, 
      metadata?.description
    );
    
    return {
      fileId: uploadedFile.id,
      status: 'uploaded',
      message: 'File uploaded successfully',
      file: uploadedFile,
    };
  }

  /**
   * Get User Files Endpoint
   * 
   * Retrieves paginated list of files belonging to the authenticated user only.
   * Supports pagination with configurable page size and limits.
   * 
   * @param req - Express request object containing authenticated user info
   * @param page - Page number for pagination (default: 1, min: 1)
   * @param limit - Items per page (default: 10, min: 1, max: 100)
   * @returns Object containing user's files and pagination metadata
   * @throws UnauthorizedException if user is not authenticated
   */
  @UseGuards(JwtAuthGuard)
  @Get('files')
  async getUserFiles(
    @Request() req,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10
  ) {
    // Validate pagination parameters to prevent abuse
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 10; // Max 100 items per page

    // Fetch only files belonging to the authenticated user
    const result = await this.uploadService.getUserFiles(req.user.sub, page, limit);
    return result;
  }

  /**
   * Get Failed Jobs Endpoint
   * 
   * Retrieves all failed processing jobs for the authenticated user's files.
   * Used for monitoring and retry functionality.
   * 
   * @param req - Express request object containing authenticated user info
   * @returns Object containing list of failed jobs for user's files
   * @throws UnauthorizedException if user is not authenticated
   */
  @UseGuards(JwtAuthGuard)
  @Get('files/failed')
  async getFailedJobs(@Request() req) {
    // Get failed jobs only for the authenticated user's files
    const failedJobs = await this.uploadService.getFailedJobs(req.user.sub);
    return { failedJobs };
  }

  /**
   * Retry Failed Job Endpoint
   * 
   * Allows users to retry failed processing jobs for their own files.
   * Includes ownership verification to ensure users can only retry their own jobs.
   * 
   * @param id - File ID to retry processing for
   * @param req - Express request object containing authenticated user info
   * @returns Object containing retry status and job information
   * @throws ForbiddenException if user doesn't own the file
   * @throws BadRequestException if no failed jobs exist for the file
   * @throws UnauthorizedException if user is not authenticated
   */
  @UseGuards(JwtAuthGuard)
  @Post('files/:id/retry')
  async retryFailedJob(@Param('id') id: string, @Request() req) {
    try {
      // Retry job with user ID verification for security
      const result = await this.uploadService.retryFailedJob(id, req.user.sub);
      return result;
    } catch (error) {
      if (error.message === 'File not found or access denied') {
        throw new ForbiddenException('You are not authorized to retry this job');
      }
      if (error.message === 'No failed jobs found for this file') {
        throw new BadRequestException('No failed jobs found for this file');
      }
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get File Status Endpoint
   * 
   * Retrieves detailed information about a specific file and its processing jobs.
   * Includes strict ownership verification - users can only access their own files.
   * 
   * @param id - File ID to retrieve status for
   * @param req - Express request object containing authenticated user info
   * @returns Object containing file details and associated job history
   * @throws NotFoundException if file doesn't exist
   * @throws ForbiddenException if user doesn't own the file
   * @throws UnauthorizedException if user is not authenticated
   */
  @UseGuards(JwtAuthGuard)
  @Get('files/:id')
  async getFileStatus(@Param('id') id: string, @Request() req) {
    const fileWithJobs = await this.uploadService.getFileWithJobs(id);
    
    if (!fileWithJobs) {
      throw new NotFoundException('File not found');
    }

    // Critical security check: Ensure user can only access their own files
    if (fileWithJobs.userId !== req.user.sub) {
      throw new ForbiddenException('You are not authorized to access this file');
    }

    return fileWithJobs;
  }
} 