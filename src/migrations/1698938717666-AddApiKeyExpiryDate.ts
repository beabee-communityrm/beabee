import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApiKeyExpiryDate1698938717666 implements MigrationInterface {
  name = "AddApiKeyExpiryDate1698938717666";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_key" ADD "expires" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_key" DROP COLUMN "expires"`);
  }
}
