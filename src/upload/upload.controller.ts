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

@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

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

  @UseGuards(JwtAuthGuard)
  @Get('files')
  async getUserFiles(
    @Request() req,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10
  ) {
    // Validate pagination parameters
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 10; // Max 100 items per page

    const result = await this.uploadService.getUserFiles(req.user.sub, page, limit);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('files/failed')
  async getFailedJobs(@Request() req) {
    const failedJobs = await this.uploadService.getFailedJobs(req.user.sub);
    return { failedJobs };
  }

  @UseGuards(JwtAuthGuard)
  @Post('files/:id/retry')
  async retryFailedJob(@Param('id') id: string, @Request() req) {
    try {
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

  @UseGuards(JwtAuthGuard)
  @Get('files/:id')
  async getFileStatus(@Param('id') id: string, @Request() req) {
    const fileWithJobs = await this.uploadService.getFileWithJobs(id);
    
    if (!fileWithJobs) {
      throw new NotFoundException('File not found');
    }

    // Check if user owns the file
    if (fileWithJobs.userId !== req.user.sub) {
      throw new ForbiddenException('You are not authorized to access this file');
    }

    return fileWithJobs;
  }
} 