/* eslint-disable @typescript-eslint/no-unused-vars */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from 'src/modules/v1/users/entities/user.entity';

// Admin decorator
export const LoggedInUser = createParamDecorator(
  async (data = '', ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    const user: User = request.user;

    return user;
  },
);
