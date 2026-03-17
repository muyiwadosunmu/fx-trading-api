import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RequestHeaders } from '../constant/header.constant';
import { IRequest } from '../constant/response.constant';
import { AdminService } from 'src/modules/v1/admin/admin.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IRequest>();
    const token = this.extractBearerToken(request);
    const { id, scope } = await this.verifyToken(token);

    if (scope && scope !== 'admin') {
      throw new ForbiddenException('Invalid admin token');
    }

    const admin = await this.adminService.getAdminById(id);

    if (admin.isSuspended || admin.isDeleted) {
      throw new BadRequestException('Admin account is suspended');
    }

    request.admin = admin;
    return true;
  }

  private extractBearerToken(request: IRequest): string {
    const token = request.headers[RequestHeaders.AUTHORIZATION]?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('Please login to gain access');
    }
    return token;
  }

  private async verifyToken(
    token: string,
  ): Promise<{ id: string; scope?: string }> {
    let data: { sub?: string; scope?: string };

    try {
      data = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('ACCESS_TOKEN_SECRET'),
      });
    } catch (e) {
      if (e?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Session expired, please login again');
      }
      throw new UnauthorizedException('Invalid or malformed token');
    }

    if (!data.sub) {
      throw new ForbiddenException('Invalid Token, provide access token');
    }

    return { id: data.sub, scope: data.scope };
  }
}
