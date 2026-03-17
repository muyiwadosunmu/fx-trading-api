import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWalletTable1773713212766 implements MigrationInterface {
  name = 'CreateWalletTable1773713212766';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "currency" character varying NOT NULL, "balance" bigint NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "UQ_a38ea8f307374dc7085a6774ae1" UNIQUE ("userId", "currency"), CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD CONSTRAINT "FK_2ecdb33f23e9a6fc392025c0b97" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP CONSTRAINT "FK_2ecdb33f23e9a6fc392025c0b97"`,
    );
    await queryRunner.query(`DROP TABLE "wallets"`);
  }
}
