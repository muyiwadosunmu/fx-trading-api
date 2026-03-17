import { Controller, Get, Param, Delete, Put, Body, UseGuards } from '@nestjs/common';
import { APIRes } from 'src/core/common/api-response';
import { Roles } from 'src/core/decorators/roles.decorator';
import { RolesGuard } from 'src/core/guard/roles.guard';
import { Protected } from 'src/core/decorators/access.decorator';
import { Role } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

@Controller('v1/admin/users')
@Protected()
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class AdminController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    async getAllUsers() {
        const users = await this.usersService.findAll();
        return APIRes(users, 'Users retrieved successfully');
    }

    @Get(':id')
    async getUser(@Param('id') id: string) {
        const user = await this.usersService.findOne(id);
        return APIRes(user, 'User retrieved successfully');
    }

    @Put(':id')
    async updateUser(@Param('id') id: string, @Body() body: any) {
        const user = await this.usersService.update(id, body);
        return APIRes(user, 'User updated successfully');
    }

    @Delete(':id')
    @Roles(Role.SUPER_ADMIN) // Only Super Admin can delete users
    async deleteUser(@Param('id') id: string) {
        await this.usersService.remove(id);
        return APIRes(null, 'User deleted successfully');
    }
}
