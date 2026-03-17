import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Wallet } from '../../modules/v1/wallet/entities/wallet.entity';
import { Transaction } from '../../modules/v1/wallet/entities/transaction.entity';
import { User } from 'src/modules/v1/users/entities/user.entity';

config();

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'postgres',
    entities: [User, Wallet, Transaction],
    migrations: [__dirname + '/../../../migrations/*{.ts,.js}'],
    synchronize: false,
});


@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.getOrThrow('DB_HOST'),
                port: configService.getOrThrow('DB_PORT'),
                database: configService.getOrThrow('DB_NAME'),
                username: configService.getOrThrow('DB_USER'),
                password: configService.getOrThrow('DB_PASSWORD'),
                entities: [User, Wallet, Transaction],
                synchronize: false, // Turn off synchronize to rely entirely on migrations
            }),
            inject: [ConfigService],
        }),
    ],
})
export class DatabaseModule { }