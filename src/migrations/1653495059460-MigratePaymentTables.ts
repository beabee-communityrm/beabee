import { MigrationInterface, QueryRunner } from "typeorm";

export class MigratePaymentTables1653495059460 implements MigrationInterface {
  name = "MigratePaymentTables1653495059460";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "payment" (id, "subscriptionId", "memberId", "status", "description", "amount", "amountRefunded", "chargeDate", "createdAt", "updatedAt")
        SELECT "paymentId", "subscriptionId", "memberId", "status", "description", "amount", "amountRefunded", "chargeDate", "createdAt", "updatedAt"
        FROM "gc_payment"
      `
    );
    await queryRunner.query(
      `INSERT INTO "payment_data" ("memberId", "method", "data")
        SELECT "memberId", 'gc_direct-debit', JSONB_BUILD_OBJECT(
          'customerId', "customerId",
          'mandateId', "mandateId",
          'subscriptionId', "subscriptionId",
          'cancelledAt', "cancelledAt",
          'payFee', COALESCE("payFee", FALSE)
        ) AS "data"
        FROM "gc_payment_data"
      `
    );
    await queryRunner.query(`DROP TABLE "gc_payment"`);
    await queryRunner.query(`DROP TABLE "gc_payment_data"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
