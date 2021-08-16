import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameListIdToTag1619099359790 implements MigrationInterface {
  name = "RenameListIdToTag1619099359790";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "segment" RENAME COLUMN "newsletterListId" TO "newsletterTag"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "segment" RENAME COLUMN "newsletterTag" TO "newsletterListId"`
    );
  }
}
