import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { promises as fs } from 'fs';

async function bootstrap() {
  // Ensure uploads directory exists
  try {
    await fs.access('./uploads');
  } catch {
    await fs.mkdir('./uploads', { recursive: true });
  }

  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend integration
  app.enableCors();
  
  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
}
bootstrap();
