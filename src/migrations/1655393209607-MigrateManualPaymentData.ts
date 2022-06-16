import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrateManualPaymentData1655393209607
  implements MigrationInterface
{
  name = "MigrateManualPaymentData1655393209607";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "payment_data" ("memberId", "data")
        SELECT "memberId", JSONB_BUILD_OBJECT(
          'source', "source",
          'reference', "reference"
        ) AS "data"
        FROM "manual_payment_data"
        ON CONFLICT DO NOTHING
      `
    );

    await queryRunner.query('DROP TABLE "manual_payment_data"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
