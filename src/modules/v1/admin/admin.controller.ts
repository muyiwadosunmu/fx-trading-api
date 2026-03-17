import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { APIRes } from 'src/core/common/api-response';
import { LoggedInAdmin } from 'src/core/decorators/logged-in-admin.decorator';
import { AdminAuthGuard } from 'src/core/guard/admin-auth.guard';
import { AdminService } from './admin.service';
import { Admin } from './entities/admin.entity';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { UpdateAdminProfileDto } from './dto/update-admin-profile.dto';

@Controller('v1/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('register')
  async registerFirstAdmin(@Body() body: RegisterAdminDto) {
    const data = await this.adminService.registerFirstAdmin(body);
    return APIRes(data, 'Super admin created successfully');
  }

  @Post('login')
  async login(@Body() body: AdminLoginDto) {
    const data = await this.adminService.login(body);
    return APIRes(data, 'Admin login successful');
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  async getMe(@LoggedInAdmin() admin: Admin) {
    return APIRes(admin, 'Admin profile retrieved successfully');
  }

  @Patch('me')
  @UseGuards(AdminAuthGuard)
  async updateMe(
    @LoggedInAdmin() admin: Admin,
    @Body() body: UpdateAdminProfileDto,
  ) {
    const data = await this.adminService.updateProfile(admin, body);
    return APIRes(data, 'Admin profile updated successfully');
  }

  @Post('create')
  @UseGuards(AdminAuthGuard)
  async createAdmin(
    @LoggedInAdmin() admin: Admin,
    @Body() body: RegisterAdminDto,
  ) {
    const data = await this.adminService.createAdminBySuperAdmin(admin, body);
    return APIRes(data, 'Admin created successfully');
  }

  @Get('users')
  @UseGuards(AdminAuthGuard)
  async getUsers(@Query() query: ListUsersQueryDto) {
    const users = await this.adminService.getUsers(query);
    return APIRes(users, 'Users retrieved successfully');
  }

  @Patch('users/:id/suspend')
  @UseGuards(AdminAuthGuard)
  async suspendUser(@Param('id') id: string) {
    const user = await this.adminService.suspendUser(id);
    return APIRes(user, 'User suspended successfully');
  }

  @Patch('users/:id/unsuspend')
  @UseGuards(AdminAuthGuard)
  async unsuspendUser(@Param('id') id: string) {
    const user = await this.adminService.unsuspendUser(id);
    return APIRes(user, 'User unsuspended successfully');
  }

  @Patch('admins/:id/suspend')
  @UseGuards(AdminAuthGuard)
  async suspendAdmin(@LoggedInAdmin() admin: Admin, @Param('id') id: string) {
    const data = await this.adminService.suspendAdmin(admin, id);
    return APIRes(data, 'Admin suspended successfully');
  }

  @Patch('admins/:id/unsuspend')
  @UseGuards(AdminAuthGuard)
  async unsuspendAdmin(@LoggedInAdmin() admin: Admin, @Param('id') id: string) {
    const data = await this.adminService.unsuspendAdmin(admin, id);
    return APIRes(data, 'Admin unsuspended successfully');
  }
}
