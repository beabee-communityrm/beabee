import { MigrationInterface, QueryRunner } from "typeorm";

export class UnifyItemStatuses1646649540217 implements MigrationInterface {
  name = "UnifyItemStatuses1646649540217";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notice" RENAME COLUMN "enabled" TO "starts"`
    );
    await queryRunner.query(`ALTER TABLE "poll" DROP COLUMN "closed"`);
    await queryRunner.query(`ALTER TABLE "notice" DROP COLUMN "starts"`);
    await queryRunner.query(`ALTER TABLE "notice" ADD "starts" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notice" DROP COLUMN "starts"`);
    await queryRunner.query(
      `ALTER TABLE "notice" ADD "starts" boolean NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "poll" ADD "closed" boolean NOT NULL DEFAULT true`
    );
    await queryRunner.query(
      `ALTER TABLE "notice" RENAME COLUMN "starts" TO "enabled"`
    );
  }
}
