import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalloutResponseBucket1676460782435
  implements MigrationInterface
{
  name = "AddCalloutResponseBucket1676460782435";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response" ADD "bucket" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response" DROP COLUMN "bucket"`
    );
  }
}
