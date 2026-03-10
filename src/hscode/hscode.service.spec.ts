import { Test, TestingModule } from '@nestjs/testing';
import { HscodeService } from './hscode.service';

describe('HscodeService', () => {
  let service: HscodeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HscodeService],
    }).compile();

    service = module.get<HscodeService>(HscodeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
