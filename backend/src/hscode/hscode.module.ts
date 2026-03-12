import { Module } from '@nestjs/common';
import { HscodeService } from './hscode.service';
import { AiModule } from '../ai/ai.module';
import { HscodeController } from './hscode.controller';

@Module({
  imports: [AiModule],
  controllers: [HscodeController],
  providers: [HscodeService],
  exports: [HscodeService],
})
export class HscodeModule { }
