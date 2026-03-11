import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpecialTermsService } from './ai/special-terms.service';
import { ExtractService } from './ai/extract.service';
import { HscodeService } from './hscode/hscode.service';
import { AiService } from './ai/ai.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: SpecialTermsService,
          useValue: { getTermsContent: jest.fn(() => []) },
        },
        { provide: ExtractService, useValue: { extractData: jest.fn() } },
        { provide: HscodeService, useValue: { searchHSCode: jest.fn() } },
        { provide: AiService, useValue: { isOnline: jest.fn() } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
