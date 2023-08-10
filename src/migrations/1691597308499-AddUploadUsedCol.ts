import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUploadUsedCol1691597308499 implements MigrationInterface {
  name = "AddUploadUsedCol1691597308499";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "upload_flow" ADD "used" boolean NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "upload_flow" DROP COLUMN "used"`);
  }
}
