import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWalletTransactionTable1773713253955
  implements MigrationInterface
{
  name = 'CreateWalletTransactionTable1773713253955';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum" AS ENUM('FUND', 'CONVERT', 'TRADE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."transactions_type_enum" NOT NULL, "fromCurrency" character varying, "toCurrency" character varying, "amount" bigint NOT NULL, "rate" numeric(20,6), "status" character varying NOT NULL DEFAULT 'SUCCESS', "idempotencyKey" character varying, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "UQ_6d1ba5257de3f10ef9f0ee4054a" UNIQUE ("idempotencyKey"), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_e9389f5bc3a4e981dc6ebd3a1a6" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_e9389f5bc3a4e981dc6ebd3a1a6"`,
    );
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
  }
}
