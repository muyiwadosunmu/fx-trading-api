import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { FxModule } from '../fx/fx.module';
import { AuthModule } from '../auth/auth.module';
import { CoreModule } from 'src/core/core.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    AuthModule,
    JwtModule,
    TypeOrmModule.forFeature([Wallet, Transaction]),
    FxModule,
    CoreModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
