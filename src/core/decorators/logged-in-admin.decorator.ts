import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Admin } from 'src/modules/v1/admin/entities/admin.entity';

export const LoggedInAdmin = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Admin => {
    const request = ctx.switchToHttp().getRequest();
    return request.admin as Admin;
  },
);
