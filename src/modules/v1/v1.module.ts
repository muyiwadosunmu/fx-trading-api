import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';
import { FxModule } from './fx/fx.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    WalletModule,
    FxModule,
    AdminModule,
  ],
  providers: [],
})
export class V1Module { }
