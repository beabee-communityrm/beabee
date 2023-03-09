import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeBucketNonNullable1678358909981 implements MigrationInterface {
  name = "MakeBucketNonNullable1678358909981";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "callout_response" SET "bucket" = '' WHERE "bucket" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" ALTER COLUMN "bucket" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" ALTER COLUMN "bucket" SET DEFAULT ''`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response" ALTER COLUMN "bucket" DROP DEFAULT`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" ALTER COLUMN "bucket" DROP NOT NULL`
    );
  }
}
