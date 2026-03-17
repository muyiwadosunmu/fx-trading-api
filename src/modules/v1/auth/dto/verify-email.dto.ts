import { IsEmail, IsNotEmpty } from "class-validator";

export class VerifyEmailDto {
    @IsEmail()
    email: string;

    @IsNotEmpty()
    otp: string;
}

