import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterUserDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @MaxLength(10, { message: 'Password must be at most 10 characters long' })
  @MinLength(4, {
    message: 'Password must be at least 4 characters long',
  })
  password: string;
}
