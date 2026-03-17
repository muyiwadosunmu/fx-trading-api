import { IsEmail, IsString, Max, Min } from 'class-validator';

export class RegisterUserDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @Max(10, { message: 'Password must be at most 10 characters long' })
  @Min(4, {
    message: 'Password must be at least 4 characters long',
  })
  password: string;
}
