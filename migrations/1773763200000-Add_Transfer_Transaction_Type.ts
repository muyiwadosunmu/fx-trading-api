import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransferTransactionType1773763200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "transactions_type_enum" ADD VALUE IF NOT EXISTS 'TRANSFER'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Enum value removal is intentionally omitted to avoid destructive enum recreation.
  }
}
