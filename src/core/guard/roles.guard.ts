import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../modules/v1/users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { User } from '../../modules/v1/users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles) {
            return true; // No roles required, access is granted
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user || (!user.role)) {
            return false;
        }

        return requiredRoles.some((role) => user.role === role);
    }
}
