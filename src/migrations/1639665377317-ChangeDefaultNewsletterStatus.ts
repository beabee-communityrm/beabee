import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeDefaultNewsletterStatus1639665377317
  implements MigrationInterface
{
  name = "ChangeDefaultNewsletterStatus1639665377317";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member_profile" ALTER COLUMN "newsletterStatus" SET DEFAULT 'none'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member_profile" ALTER COLUMN "newsletterStatus" SET DEFAULT 'unsubscribed'`
    );
  }
}
