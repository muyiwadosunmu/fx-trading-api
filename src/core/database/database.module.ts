import { Module } from '@nestjs/common';

// export const AppDataSource = new DataSource({
//   type: 'postgres',
//   host: process.env.DB_HOST || 'localhost',
//   port: parseInt(process.env.DB_PORT || '5432', 10),
//   username: process.env.DB_USER || 'postgres',
//   password: process.env.DB_PASSWORD || 'postgres',
//   database: process.env.DB_NAME || 'postgres',
//   entities: [User, Wallet, Transaction],
//   migrations: [__dirname + '/../../../migrations/*{.ts,.js}'],
//   synchronize: false,
// });

@Module({
  imports: [],
})
export class DatabaseModule {}
