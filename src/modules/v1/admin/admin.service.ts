import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated } from 'src/core/common/pagination/interfaces/paginated.interfaces';
import { PaginationProvider } from 'src/core/common/pagination/providers/pagination.provider';
import { VerificationSecurity } from 'src/core/security/verification.security';
import { FindOptionsOrder, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Admin, AdminRole } from './entities/admin.entity';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { UpdateAdminProfileDto } from './dto/update-admin-profile.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly paginationProvider: PaginationProvider,
    private readonly verificationSecurity: VerificationSecurity,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async registerFirstAdmin(body: RegisterAdminDto) {
    const count = await this.adminRepository.count();
    if (count > 0) {
      throw new BadRequestException(
        'First admin already exists. Ask a super admin to create additional admins.',
      );
    }

    const exists = await this.adminRepository.findOne({
      where: { email: body.email },
    });
    if (exists) {
      throw new ConflictException('Admin with this email already exists');
    }

    const admin = this.adminRepository.create({
      ...body,
      password: this.verificationSecurity.hash(body.password),
      role: AdminRole.SUPER_ADMIN,
    });

    const saved = await this.adminRepository.save(admin);
    delete saved.password;
    return saved;
  }

  async createAdminBySuperAdmin(
    actor: Admin,
    body: RegisterAdminDto,
  ): Promise<Admin> {
    this.ensureSuperAdmin(actor);

    const exists = await this.adminRepository.findOne({
      where: { email: body.email },
    });
    if (exists) {
      throw new ConflictException('Admin with this email already exists');
    }

    const admin = this.adminRepository.create({
      ...body,
      password: this.verificationSecurity.hash(body.password),
      role: AdminRole.ADMIN,
    });

    const saved = await this.adminRepository.save(admin);
    delete saved.password;
    return saved;
  }

  async login(body: AdminLoginDto) {
    const admin = await this.adminRepository.findOne({
      where: { email: body.email },
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'role',
        'password',
        'isSuspended',
        'isDeleted',
      ],
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (admin.isSuspended || admin.isDeleted) {
      throw new BadRequestException('Admin account is suspended');
    }

    const ok = this.verificationSecurity.compare(body.password, admin.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      token: await this.generateToken(admin),
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
    };
  }

  async getAdminById(id: string): Promise<Admin> {
    const admin = await this.adminRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'role',
        'isSuspended',
        'isDeleted',
      ],
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }

  async updateProfile(
    actor: Admin,
    dto: UpdateAdminProfileDto,
  ): Promise<Admin> {
    const admin = await this.adminRepository.findOne({
      where: { id: actor.id },
    });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    admin.firstName = dto.firstName ?? admin.firstName;
    admin.lastName = dto.lastName ?? admin.lastName;

    const saved = await this.adminRepository.save(admin);
    delete saved.password;
    return saved;
  }

  async listUsers(query: ListUsersQueryDto): Promise<Paginated<User>> {
    const { search, page = 1, limit = 10 } = query;
    const direction =
      (query.order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const filters: FindOptionsWhere<User>[] = [];

    if (search?.trim()) {
      const pattern = `%${search.trim()}%`;
      filters.push({ firstName: ILike(pattern) });
      filters.push({ lastName: ILike(pattern) });
      filters.push({ email: ILike(pattern) });
    }

    const order: FindOptionsOrder<User> = { createdAt: direction };

    return this.paginationProvider.paginateQuery(
      { limit, page },
      this.userRepository,
      filters.length > 0 ? filters : undefined,
      order,
    );
  }

  async suspendUser(id: string): Promise<User> {
    return this.setUserSuspension(id, true);
  }

  async unsuspendUser(id: string): Promise<User> {
    return this.setUserSuspension(id, false);
  }

  async suspendAdmin(actor: Admin, id: string): Promise<Admin> {
    this.ensureSuperAdmin(actor);

    if (actor.id === id) {
      throw new BadRequestException('Super admin cannot suspend self');
    }

    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    admin.isSuspended = true;
    const saved = await this.adminRepository.save(admin);
    delete saved.password;
    return saved;
  }

  async unsuspendAdmin(actor: Admin, id: string): Promise<Admin> {
    this.ensureSuperAdmin(actor);

    const admin = await this.adminRepository.findOne({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    admin.isSuspended = false;
    const saved = await this.adminRepository.save(admin);
    delete saved.password;
    return saved;
  }

  private async setUserSuspension(id: string, value: boolean): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isSuspended = value;
    return this.userRepository.save(user);
  }

  private ensureSuperAdmin(actor: Admin): void {
    if (actor.role !== AdminRole.SUPER_ADMIN) {
      throw new UnauthorizedException(
        'Only super admin can perform this action',
      );
    }
  }

  private async generateToken(admin: Admin): Promise<string> {
    const payload = { sub: admin.id, scope: 'admin' };
    return this.jwtService.sign(payload);
  }
}
