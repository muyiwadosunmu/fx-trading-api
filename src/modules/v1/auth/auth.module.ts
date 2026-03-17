import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { VerificationSecurity } from 'src/core/security/verification.security';
import { WebEmail } from 'src/core/email/webEmail';
import { CoreModule } from 'src/core/core.module';
import { DatabaseModule } from 'src/core/database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';

@Module({
  controllers: [AuthController],
  providers: [AuthService, VerificationSecurity, JwtService, WebEmail],
  imports: [CoreModule, TypeOrmModule.forFeature([User]), JwtModule],
  exports: [AuthService, JwtService],
})
export class AuthModule { }
