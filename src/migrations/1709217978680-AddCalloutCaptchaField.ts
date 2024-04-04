import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalloutCaptchaField1709217978680 implements MigrationInterface {
  name = "AddCalloutCaptchaField1709217978680";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout" ADD "captcha" character varying NOT NULL DEFAULT 'none'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "callout" DROP COLUMN "captcha"`);
  }
}
