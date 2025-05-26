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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @UseGuards(JwtAuthGuard)
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
  async getUserFiles(@Request() req) {
    const files = await this.uploadService.getUserFiles(req.user.sub);
    return { files };
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