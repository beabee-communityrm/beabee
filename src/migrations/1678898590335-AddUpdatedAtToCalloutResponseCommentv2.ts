import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUpdatedAtToCalloutResponseCommentv21678898590335
  implements MigrationInterface
{
  name = "AddUpdatedAtToCalloutResponseCommentv21678898590335";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_reponse_comment" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_reponse_comment" DROP COLUMN "updatedAt"`
    );
  }
}
