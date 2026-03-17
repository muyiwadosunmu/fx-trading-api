import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { ErrorFilter } from './core/error/error.filter';
import { V1Module } from './modules/v1/v1.module';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 30000, // Cache TTL 30seconds)
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        uri: configService.get<string>('DATABASE_URL'),
        // host: configService.get<string>('DB_HOST', 'localhost'),
        // port: configService.get<number>('DB_PORT', 5432),
        // username: configService.get<string>('DB_USER', 'postgres'),
        // password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'fx_trading_db'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // Auto create/update tables for dev
        logging: process.env.NODE_ENV === 'development' ? true : false, // Set to true if more debugging info is needed
      }),
      inject: [ConfigService],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('ACCESS_TOKEN_SECRET'),
        signOptions: {
          expiresIn: `${configService.getOrThrow<number>('JWT_EXPIRY')}s`,
        },
      }),
      inject: [ConfigService],
    }),
    V1Module,
    CoreModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: ErrorFilter,
    },
  ],
})
export class AppModule {}
