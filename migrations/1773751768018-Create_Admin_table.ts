import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminTable1773751768018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "admins_role_enum" AS ENUM('ADMIN', 'SUPER_ADMIN')`,
    );
    await queryRunner.query(`CREATE TABLE "admins" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(), 
            "email" character varying NOT NULL, 
            "firstName" character varying, 
            "lastName" character varying, 
            "role" "admins_role_enum" NOT NULL DEFAULT 'ADMIN', 
            "password" character varying, 
            "isSuspended" boolean NOT NULL DEFAULT false, 
            "isDeleted" boolean NOT NULL DEFAULT false, 
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
            CONSTRAINT "UQ_email_admins" UNIQUE ("email"),
            CONSTRAINT "PK_admins" PRIMARY KEY ("id")
        )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admins"`);
    await queryRunner.query(`DROP TYPE "admins_role_enum"`);
  }
}
