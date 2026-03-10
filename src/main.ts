import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

async function bootstrap() {
  dotenv.config();
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Enable CORS for total access during development
  const port = process.env.PORT || 3000;
  console.log(`Application is starting on port ${port}...`);
  await app.listen(port);
}
bootstrap();
