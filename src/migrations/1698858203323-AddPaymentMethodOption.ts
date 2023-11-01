import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaymentMethodOption1698858203323 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`INSERT INTO "option" ("key", "value") VALUES (
      'contribution-payment-methods',
      (SELECT string_agg(value, ',') FROM "content", jsonb_array_elements_text("data"->'paymentMethods') WHERE id='join')
    )`);
    // queryRunner.query(
    //   `UPDATE "content" SET "data"="data"-'paymentMethods' WHERE id='join'`
    // );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
