import { Test, TestingModule } from '@nestjs/testing';
import { HscodeService } from './hscode.service';
import { AiService } from '../ai/ai.service';

describe('HscodeService', () => {
  let service: HscodeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HscodeService,
        {
          provide: AiService,
          useValue: {
            getQdrantClient: jest.fn(() => ({
              getCollections: jest.fn(() =>
                Promise.resolve({ collections: [] }),
              ),
              createCollection: jest.fn(() => Promise.resolve()),
              upsert: jest.fn(() => Promise.resolve()),
              search: jest.fn(() => Promise.resolve([])),
            })),
          },
        },
      ],
    }).compile();

    service = module.get<HscodeService>(HscodeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
