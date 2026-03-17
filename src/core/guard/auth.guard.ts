import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RequestHeaders } from '../constant/header.constant';
import { AuthService } from 'src/modules/v1/auth/auth.service';
import { IRequest } from '../constant/response.constant';
import { User } from 'src/modules/v1/users/entities/user.entity';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    await this.checkUser(request);

    return true;
  }

  async checkUser(request: IRequest): Promise<User> {
    // 1. Extract the token from header
    const token = this.extractBearerToken(request);

    // 2. Verify token is valid and for user
    const { id, scope } = await this.verifyToken(token);

    if (scope === 'admin') {
      throw new UnauthorizedException('Use admin endpoints for admin tokens');
    }

    // user information to request.user
    const user = await this.authService.getUserById(id);

    if (!user) {
      throw new NotFoundException('User not found for this token');
    }

    if (user.isSuspended)
      throw new BadRequestException(
        'This account has been suspended, contact support support@cotrackr.com',
      );

    if (user.isDeleted)
      throw new BadRequestException(
        'This account has been deleted, contact support support@cotrackr.com',
      );
    request.user = user;

    return user;
  }

  /**
   * @method extractBearerToken
   * @param {Request}request request
   * @description This method extracts bearer token from request
   * @return token
   */
  private extractBearerToken(request: IRequest) {
    const token = request.headers[RequestHeaders.AUTHORIZATION]?.split(' ')[1];

    if (!token) throw new UnauthorizedException('Please login to gain access');

    return token;
  }

  /**
   * @method verifyToken
   *
   * @param {string} token token
   * @description This method verifies token & extracts information
   * @return Id
   */
  private async verifyToken(token: string) {
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
    if (!data.sub)
      throw new ForbiddenException('Invalid Token, provide access token');
    // token verification for user
    return { id: data.sub, scope: data.scope };
  }
}
