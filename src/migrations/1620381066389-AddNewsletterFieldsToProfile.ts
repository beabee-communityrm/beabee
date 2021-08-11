import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNewsletterFieldsToProfile1620381066389
  implements MigrationInterface
{
  name = "AddNewsletterFieldsToProfile1620381066389";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member_profile" ADD "newsletterStatus" character varying NOT NULL DEFAULT 'unsubscribed'`
    );
    await queryRunner.query(
      `ALTER TABLE "member_profile" ADD "newsletterGroups" jsonb NOT NULL DEFAULT '[]'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member_profile" DROP COLUMN "newsletterGroups"`
    );
    await queryRunner.query(
      `ALTER TABLE "member_profile" DROP COLUMN "newsletterStatus"`
    );
  }
}
