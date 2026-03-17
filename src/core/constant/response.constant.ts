import { User } from 'src/modules/v1/users/entities/user.entity';
import { Admin } from 'src/modules/v1/admin/entities/admin.entity';

export enum ResponseStatus {
  SUCCESS = 'success',
  ERROR = 'error',
}

export class IRequest extends Request {
  user: User;
  admin: Admin;
}
