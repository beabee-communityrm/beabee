import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateApiKeyModel1686233596892 implements MigrationInterface {
  name = "UpdateApiKeyModel1686233596892";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_key" DROP CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11"`
    );
    await queryRunner.query(`ALTER TABLE "api_key" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "api_key" ADD "id" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "api_key" ADD CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11" PRIMARY KEY ("id")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_key" DROP CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11"`
    );
    await queryRunner.query(`ALTER TABLE "api_key" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "api_key" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`
    );
    await queryRunner.query(
      `ALTER TABLE "api_key" ADD CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11" PRIMARY KEY ("id")`
    );
  }
}
