import { User } from 'src/modules/v1/users/entities/user.entity';

export enum ResponseStatus {
  SUCCESS = 'success',
  ERROR = 'error',
}

export class IRequest extends Request {
  user: User;
}
