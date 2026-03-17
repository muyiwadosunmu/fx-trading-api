import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Main.ts');
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;
  // Graceful shutdown
  process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });
  process.on('uncaughtException', async () => {
    await app.close();
    process.exit(1);
  });
  process.on('unhandledRejection', async () => {
    await app.close();
    process.exit(0);
  });

  app.enableCors({ origin: '*' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.enableVersioning();
  app.setGlobalPrefix('api/');

  await app.listen(port, () => {
    logger.log(
      `APP started on http://localhost:${port} ${process.env.NODE_ENV}`,
    );
  });
}
bootstrap();
