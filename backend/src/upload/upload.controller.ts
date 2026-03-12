import { Controller, Post, Delete, Param, UseInterceptors, UploadedFiles, Body } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import * as fs from 'fs-extra';
import * as path from 'path';

@Controller('upload')
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

    @Post()
    @UseInterceptors(FilesInterceptor('files', 10, {
        limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit as requested
    }))
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
    @UseInterceptors(FilesInterceptor('files', 5, {
        limits: { fileSize: 10 * 1024 * 1024 } // Rules are smaller
    }))
    async uploadRuleFiles(@UploadedFiles() files: any[]) {
        const destPath = path.join(process.cwd(), 'data', 'special_terms');
        await fs.ensureDir(destPath);

        const filePaths = await Promise.all(
            files.map(async (file) => {
                // Security: Use path.basename to prevent Path Traversal
                const safeName = path.basename(file.originalname);
                const filePath = path.join(destPath, safeName);
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
        // Security: Path.basename to prevent deleting system files
        const safeName = path.basename(filename);
        const filePath = path.join(process.cwd(), 'data', 'special_terms', safeName);
        const trashPath = path.join(process.cwd(), 'data', '.trash', safeName);

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
            const safeName = path.basename(filename);
            const filePath = path.join(destPath, safeName);
            const trashPath = path.join(trashDir, safeName);
            if (await fs.pathExists(filePath)) {
                await fs.move(filePath, trashPath, { overwrite: true });
                deleted.push(filename);
            }
        }
        return { message: `Moved ${deleted.length} files to trash successfully`, deleted };
    }
}
