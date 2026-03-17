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
      useFactory: (configService: ConfigService) => {
        const dbSslEnabled =
          (
            configService.get<string>('DB_SSL', 'true') || 'true'
          ).toLowerCase() === 'true';
        const dbSslRejectUnauthorized =
          (
            configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED', 'false') ||
            'false'
          ).toLowerCase() === 'true';

        return {
          type: 'postgres',
          url: configService.get<string>('DATABASE_URL'),
          database: configService.get<string>('DB_NAME', 'fx_trading_db'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: false,
          logging: process.env.NODE_ENV === 'development' ? true : false,
          ssl: dbSslEnabled
            ? { rejectUnauthorized: dbSslRejectUnauthorized }
            : false,
          extra: dbSslEnabled
            ? { ssl: { rejectUnauthorized: dbSslRejectUnauthorized } }
            : undefined,
        };
      },
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
