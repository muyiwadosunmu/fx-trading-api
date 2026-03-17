import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { VerificationSecurity } from 'src/core/security/verification.security';
import { Repository } from 'typeorm';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Role, User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterUserDto } from './dto/register.dto';
import { EmailService } from 'src/core/email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    public readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly verificationSecurity: VerificationSecurity,
    private readonly emailService: EmailService,
  ) {}

  async getUserById(id: string): Promise<User> {
    return this.userRepository.findOne({
      where: { id },
      select: ['id', 'email', 'firstName', 'lastName'],
    });
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
    const otp = Math.floor(100000 + Math.random() * 9000).toString(); // 4 digit OTP
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // Expires in 10 minutes

    const role = Role.USER;

    const user = this.userRepository.create({
      ...body,
      password: hashedPassword,
      otp,
      otpExpiry,
      role,
    });

    await this.userRepository.save(user);

    this.logger.log(`Sending OTP ${otp} to email ${user.email}`);

    await this.emailService.sendRegisterOTP(user.email, user.firstName, otp);

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

    await this.seedInitialWallets(user.id);

    await this.emailService.sendWelcomeEmail(user.email, user.firstName);

    return {
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  private async seedInitialWallets(userId: string): Promise<void> {
    const initialBalance = 50000000;
    const baseCurrencies = ['USD', 'NGN', 'GBP'];

    const existingWallets = await this.walletRepository.find({
      where: { user: { id: userId } },
    });

    const existingCurrencies = new Set(existingWallets.map((w) => w.currency));
    const walletsToCreate = baseCurrencies
      .filter((currency) => !existingCurrencies.has(currency))
      .map((currency) =>
        this.walletRepository.create({
          user: { id: userId } as User,
          currency,
          balance: initialBalance,
        }),
      );

    if (walletsToCreate.length > 0) {
      await this.walletRepository.save(walletsToCreate);
    }
  }

  async generateToken(user: User) {
    const payload = { sub: user.id };
    const token = this.jwtService.sign(payload);
    return token;
  }

  async login(body: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: body.email },
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'password',
        'isSuspended',
        'isEmailVerified',
      ],
    });

    if (!user)
      throw new BadRequestException(
        'No user found with this details, Please sign up',
      );

    if (!user.isEmailVerified)
      throw new BadRequestException(
        'Please verify your email before logging in',
      );

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
