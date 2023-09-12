import { MigrationInterface, QueryRunner } from "typeorm";

export class PaymentDataCancelledAt1694009247783 implements MigrationInterface {
  name = "PaymentDataCancelledAt1694009247783";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_data" ADD "cancelledAt" TIMESTAMP`
    );
    await queryRunner.query(
      `UPDATE "payment_data" SET "cancelledAt" = ("data" ->> 'cancelledAt')::timestamp, "data" = "data" - 'cancelledAt'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "payment_data" SET "data" = jsonb_set("data", '{cancelledAt}', "cancelledAt")`
    );
    await queryRunner.query(
      `ALTER TABLE "payment_data" DROP COLUMN "cancelledAt"`
    );
  }
}
