import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../core/guard/auth.guard';


export function Protected() {
  return applyDecorators(UseGuards(AuthGuard));
}
