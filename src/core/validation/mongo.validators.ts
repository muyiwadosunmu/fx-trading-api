import { IsMongoId } from 'class-validator';
import { ERROR_MESSAGE } from '../constant/validation-error-message.constant';

export class MongoIdValidator {
  @IsMongoId({ message: `id ${ERROR_MESSAGE.MONGO_ID}` })
  id: string;
}
