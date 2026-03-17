import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFieldsToUser1773713205000 implements MigrationInterface {
  name = 'AddFieldsToUser1773713205000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('USER', 'ADMIN', 'SUPER_ADMIN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isSuspended" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isDeleted" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isDeleted"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isSuspended"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
