import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';

@Injectable()
export class UploadService {
  private readonly uploadPath = path.join(process.cwd(), 'storage', 'uploads');

  constructor() {
    fs.ensureDirSync(this.uploadPath);
  }

  async saveFile(file: any): Promise<string> {
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(this.uploadPath, fileName);
    await fs.writeFile(filePath, file.buffer);
    return filePath;
  }

  async getFileContent(filePath: string): Promise<Buffer> {
    return await fs.readFile(filePath);
  }
}
