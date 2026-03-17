import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';


@Injectable()
export class VerificationSecurity {
  constructor() {}
  /**
   * @method generateResetToken
   * @returns token and expiry date
   */
  generateResetToken() {
    const resetToken = randomBytes(32).toString('hex');
    const currentDate = new Date();

    // generate token expiry date
    const resetTokenExpiresAt = new Date(
      currentDate.getTime() + 1000 * 60 * 10, // Adds 10 Minutes
    );

    return { resetTokenExpiresAt, resetToken };
  }

  // A function to compare reset token
  compareResetToken(resetToken: string, resetTokenFromForm: string): boolean {
    return resetToken === resetTokenFromForm;
  }

  isResetTokenWithinTimeFrame(resetExpiry: Date): boolean {
    const now = new Date();
    const expiry = new Date(resetExpiry);
    if (expiry > now) return true;
    return false;
  }

  hash(text: string) {
    return bcrypt.hashSync(text, bcrypt.genSaltSync());
  }

  compare(text: string, hashedText: string) {
    if (!text || !hashedText) {
      return false;
    }
    return bcrypt.compareSync(text, hashedText);
  };
}
