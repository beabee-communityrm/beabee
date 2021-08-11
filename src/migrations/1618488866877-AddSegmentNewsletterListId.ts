import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSegmentNewsletterListId1618488866877
  implements MigrationInterface
{
  name = "AddSegmentNewsletterListId1618488866877";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "segment" ADD "newsletterListId" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "segment" DROP COLUMN "newsletterListId"`
    );
  }
}
