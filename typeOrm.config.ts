import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from './src/modules/v1/users/entities/user.entity';
import { Admin } from './src/modules/v1/admin/entities/admin.entity';
import { Transaction } from './src/modules/v1/wallet/entities/transaction.entity';
import { Wallet } from './src/modules/v1/wallet/entities/wallet.entity';

config();

const dbSslEnabled = (process.env.DB_SSL || 'true').toLowerCase() === 'true';
const dbSslRejectUnauthorized =
  (process.env.DB_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  // host: process.env.DB_HOST,
  // port: parseInt(process.env.DB_PORT, 10),
  // username: process.env.DB_USER,
  // password: process.env.DB_PASSWORD,
  // database: process.env.DB_NAME,
  entities: [User, Admin, Transaction, Wallet],
  migrations: ['migrations/**'],
  logging: ['info', 'error', 'migration'],
  synchronize: false,
  ssl: dbSslEnabled ? { rejectUnauthorized: dbSslRejectUnauthorized } : false,
  extra: dbSslEnabled
    ? { ssl: { rejectUnauthorized: dbSslRejectUnauthorized } }
    : undefined,
});
