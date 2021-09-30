import { MigrationInterface, QueryRunner } from "typeorm";

export class UseEmailInSegmentOngoingEmail1632931118456
  implements MigrationInterface
{
  name = "UseEmailInSegmentOngoingEmail1632931118456";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "segment_ongoing_email" RENAME COLUMN "emailTemplateId" TO "emailId"`
    );
    await queryRunner.query(
      `ALTER TABLE "segment_ongoing_email" DROP COLUMN "emailId"`
    );
    await queryRunner.query(
      `ALTER TABLE "segment_ongoing_email" ADD "emailId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "segment_ongoing_email" ADD CONSTRAINT "FK_fef3c998a2489b528d8eba1e3ba" FOREIGN KEY ("emailId") REFERENCES "email"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "segment_ongoing_email" DROP CONSTRAINT "FK_fef3c998a2489b528d8eba1e3ba"`
    );
    await queryRunner.query(
      `ALTER TABLE "segment_ongoing_email" DROP COLUMN "emailId"`
    );
    await queryRunner.query(
      `ALTER TABLE "segment_ongoing_email" ADD "emailId" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "segment_ongoing_email" RENAME COLUMN "emailId" TO "emailTemplateId"`
    );
  }
}
