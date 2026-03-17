import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from './src/modules/v1/users/entities/user.entity';
import { Admin } from './src/modules/v1/admin/entities/admin.entity';
import { Transaction } from './src/modules/v1/wallet/entities/transaction.entity';
import { Wallet } from './src/modules/v1/wallet/entities/wallet.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME,
  entities: [User, Admin, Transaction, Wallet],
  migrations: ['migrations/**'],
  logging: ['info', 'error', 'migration'],
  synchronize: false,
});
