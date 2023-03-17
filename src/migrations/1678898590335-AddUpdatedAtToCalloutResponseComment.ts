import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUpdatedAtToCalloutResponseComment1678898590335
  implements MigrationInterface
{
  name = "AddUpdatedAtToCalloutResponseComment1678898590335";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response_comment" DROP COLUMN "updatedAt"`
    );
  }
}
