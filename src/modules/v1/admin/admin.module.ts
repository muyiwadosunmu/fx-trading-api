import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreModule } from 'src/core/core.module';
import { VerificationSecurity } from 'src/core/security/verification.security';
import { User } from '../users/entities/user.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Admin } from './entities/admin.entity';
import { AdminAuthGuard } from 'src/core/guard/admin-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admin, User]),
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
    ConfigModule,
    CoreModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, VerificationSecurity, AdminAuthGuard],
  exports: [AdminService],
})
export class AdminModule {}
