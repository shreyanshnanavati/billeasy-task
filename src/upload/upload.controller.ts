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
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const uploadedFile = await this.uploadService.saveFileMetadata(file, req.user.sub);
    
    return {
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
  @Get('file/:id')
  async downloadFile(@Param('id') id: string, @Res() res: Response) {
    const file = await this.uploadService.getFileById(id);
    
    if (!file) {
      throw new NotFoundException('File not found');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    // Set a default content type since we don't store mimetype in database
    res.setHeader('Content-Type', 'application/octet-stream');
    
    return res.sendFile(file.path, { root: '.' });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('file/:id')
  async deleteFile(@Param('id') id: string, @Request() req) {
    const file = await this.uploadService.getFileById(id);
    
    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check if user owns the file
    if (file.userId !== req.user.sub) {
      throw new Error('Unauthorized to delete this file');
    }

    const deleted = await this.uploadService.deleteFile(id);
    
    if (!deleted) {
      throw new Error('Failed to delete file');
    }

    return { message: 'File deleted successfully' };
  }

  @Get('files/all')
  async getAllFiles() {
    const files = await this.uploadService.getAllFiles();
    return { files };
  }
} 