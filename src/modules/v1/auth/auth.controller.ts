import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { APIRes } from 'src/core/common/api-response';
import { LoggedInUser } from 'src/core/decorators/logged-in-decorator';
import { AuthGuard } from 'src/core/guard/auth.guard';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@LoggedInUser() user: User) {
    return APIRes(user, 'User profile retrieved successfully');
  }

  @Post('register')
  async register(@Body() body: RegisterUserDto) {
    const user = await this.authService.registerUser(body);
    return APIRes(user, 'User created');
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    const data = await this.authService.login(body);
    return APIRes(data, 'Login successful');
  }

  @Post('verify')
  async verify(@Body() body: VerifyEmailDto) {
    const data = await this.authService.verifyOtp(body.email, body.otp);
    return APIRes(data, 'Email verified successfully');
  }
}
