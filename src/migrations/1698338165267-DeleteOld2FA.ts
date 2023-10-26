import { MigrationInterface, QueryRunner } from "typeorm";

export class DeleteOld2FA1698338165267 implements MigrationInterface {
  name = "DeleteOld2FA1698338165267";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contact" DROP COLUMN "otpActivated"`);
    await queryRunner.query(`ALTER TABLE "contact" DROP COLUMN "otpKey"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact" ADD "otpKey" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "contact" ADD "otpActivated" boolean NOT NULL DEFAULT false`
    );
  }
}
