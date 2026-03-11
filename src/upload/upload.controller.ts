import {
  Controller,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFiles,
  Body,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import * as fs from 'fs-extra';
import * as path from 'path';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files'))
  async uploadFiles(@UploadedFiles() files: any[]) {
    // Using any[] as a quick fix if Multer types are still problematic,
    // but @types/multer should fix Express.Multer.File
    const filePaths = await Promise.all(
      files.map((file) => this.uploadService.saveFile(file)),
    );
    return {
      message: 'Files uploaded successfully',
      paths: filePaths,
    };
  }

  @Post('rule')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadRuleFiles(@UploadedFiles() files: any[]) {
    const destPath = path.join(process.cwd(), 'data', 'special_terms');
    await fs.ensureDir(destPath);

    const filePaths = await Promise.all(
      files.map(async (file) => {
        // Keep original name for rule files instead of adding timestamp
        // because rules are often referenced by name
        const filePath = path.join(destPath, file.originalname);
        await fs.writeFile(filePath, file.buffer);
        return filePath;
      }),
    );

    return {
      message: 'Rule files uploaded successfully',
      paths: filePaths,
    };
  }
  @Delete('rule/:filename')
  async deleteRuleFile(@Param('filename') filename: string) {
    const filePath = path.join(
      process.cwd(),
      'data',
      'special_terms',
      filename,
    );
    const trashPath = path.join(process.cwd(), 'data', '.trash', filename);

    if (await fs.pathExists(filePath)) {
      await fs.ensureDir(path.join(process.cwd(), 'data', '.trash'));
      // Move to trash instead of unlink
      await fs.move(filePath, trashPath, { overwrite: true });
      return { message: `File ${filename} moved to trash successfully` };
    }
    return { message: `File ${filename} not found` };
  }

  @Post('rule/multi-delete')
  async multiDeleteRuleFiles(@Body('filenames') filenames: string[]) {
    const destPath = path.join(process.cwd(), 'data', 'special_terms');
    const trashDir = path.join(process.cwd(), 'data', '.trash');
    await fs.ensureDir(trashDir);

    const deleted: string[] = [];
    for (const filename of filenames) {
      const filePath = path.join(destPath, filename);
      const trashPath = path.join(trashDir, filename);
      if (await fs.pathExists(filePath)) {
        await fs.move(filePath, trashPath, { overwrite: true });
        deleted.push(filename);
      }
    }
    return {
      message: `Moved ${deleted.length} files to trash successfully`,
      deleted,
    };
  }
}
