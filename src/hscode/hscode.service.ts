import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';

@Injectable()
export class HscodeService implements OnModuleInit {
  private readonly logger = new Logger(HscodeService.name);
  private readonly collectionName = 'hscode_vectors';

  constructor(private aiService: AiService) {}

  async onModuleInit() {
    await this.initCollection();
  }

  private async initCollection() {
    try {
      const client = this.aiService.getQdrantClient();
      const collections = await client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName,
      );

      if (!exists) {
        this.logger.log(`Creating Qdrant collection: ${this.collectionName}`);
        await client.createCollection(this.collectionName, {
          vectors: { size: 768, distance: 'Cosine' },
        });

        await this.seedSampleData();
      }
    } catch (error) {
      this.logger.error('Error initializing Qdrant collection:', error);
    }
  }

  private async seedSampleData() {
    const client = this.aiService.getQdrantClient();
    const points = [
      {
        id: 1,
        vector: new Array(768).fill(0).map(() => Math.random()),
        payload: {
          description: 'Macbook Air M2',
          hscode: '8471.30.00',
          tax_rate: '10%',
        },
      },
      {
        id: 2,
        vector: new Array(768).fill(0).map(() => Math.random()),
        payload: {
          description: 'iPhone 15 Pro Max',
          hscode: '8517.13.00',
          tax_rate: '12%',
        },
      },
    ];
    await client.upsert(this.collectionName, { points });
    this.logger.log('Sample HSCode data seeded.');
  }

  async searchHSCode(description: string) {
    const client = this.aiService.getQdrantClient();
    const searchResult = await client.search(this.collectionName, {
      vector: new Array(768).fill(0.1),
      limit: 1,
      with_payload: true,
    });

    if (searchResult.length > 0 && searchResult[0].payload) {
      const payload: any = searchResult[0].payload;
      return {
        item: description,
        suggestedHSCode: payload.hscode,
        confidence: searchResult[0].score,
        taxRate: payload.tax_rate,
      };
    }

    return null;
  }

  async calculateTax(value: number, rate: string) {
    const numericValue = Number(value);
    const numericRate = parseFloat(rate) / 100;
    return numericValue * numericRate;
  }
}
