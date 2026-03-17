import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebEmail } from 'src/core/email/webEmail';
import { VerificationSecurity } from 'src/core/security/verification.security';
import { User, Role } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    public readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly verificationSecurity: VerificationSecurity,
    private readonly webEmail: WebEmail,
  ) { }

  async getUserById(id: string): Promise<User> {
    return this.userRepository.findOne({ where: { id } });
  }

  async registerUser(body: RegisterUserDto): Promise<User> {
    const alreadyExist = await this.userRepository.findOne({
      where: { email: body.email },
    });

    if (alreadyExist)
      throw new ConflictException(
        'A user with this email already exists, Please login to continue or signup with a different email',
      );

    const hashedPassword = this.verificationSecurity.hash(body.password);

    // Generate OTP for email verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // Expires in 10 minutes

    // Check if this is the first user
    const userCount = await this.userRepository.count();
    const role = userCount === 0 ? Role.SUPER_ADMIN : Role.USER;

    const user = this.userRepository.create({
      ...body,
      password: hashedPassword,
      otp,
      otpExpiry,
      role,
    });

    await this.userRepository.save(user);

    this.logger.log(`Sending OTP ${otp} to email ${user.email}`);

    delete user.password;
    delete user.otp;
    return user;
  }

  async verifyOtp(email: string, otp: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.isEmailVerified) {
      throw new BadRequestException('Email already verified');
    }
    if (user.otp !== otp || user.otpExpiry < new Date()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    user.isEmailVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await this.userRepository.save(user);

    return {
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
      }
    }
  }

  async generateToken(user: User) {
    const payload = { sub: user.id };
    const token = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRY'),
      secret: this.configService.get('ACCESS_TOKEN_SECRET'),
    });
    return token;
  }

  async login(body: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: body.email },
      select: ['id', 'email', 'firstName', 'lastName', 'password', 'isSuspended', 'isEmailVerified'],
    });

    if (!user)
      throw new BadRequestException(
        'No user found with this details, Please sign up',
      );

    if (!user.isEmailVerified)
      throw new BadRequestException('Please verify your email before logging in');

    if (user.isSuspended)
      throw new BadRequestException('Account is suspended, contact support');

    const isPasswordCorrect = this.verificationSecurity.compare(
      body.password,
      user.password,
    );

    if (!isPasswordCorrect) throw new BadRequestException('Incorrect Password');

    return {
      token: await this.generateToken(user),
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
