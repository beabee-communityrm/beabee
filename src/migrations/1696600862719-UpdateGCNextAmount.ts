import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateGCNextAmount1696600862719 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`
        UPDATE "payment_data" SET "data"="data" || '{"nextAmount": null}'::jsonb
        WHERE "method"='gc_direct-debit' AND "data"->>'nextMonthlyAmount' IS NULL;
    `);
    queryRunner.query(`
        UPDATE "payment_data"
        SET "data"=jsonb_set(
                "data",
                '{nextAmount}',
                jsonb_build_object(
                    'monthly', "data"->'nextMonthlyAmount',
                    'chargeable', ("data"->'nextMonthlyAmount')::numeric * 100
                )
            )
        WHERE "method"='gc_direct-debit' AND "data"->>'nextMonthlyAmount' IS NOT NULL;
    `);
    queryRunner.query(
      `UPDATE "payment_data" SET "data"="data"-'nextMonthlyAmount' WHERE "method"='gc_direct-debit'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.query(`
        UPDATE "payment_data"
        SET "data"=jsonb_set(
                "data",
                '{nextMonthlyAmount}',
                "data"->'nextAmount'->'monthly'
            )
        WHERE "method"='gc_direct-debit' AND "data"->'nextAmount' IS NOT NULL;
    `);
    queryRunner.query(`
        UPDATE "payment_data" SET "data"="data" || '{"nextMonthlyAmount": null}'::jsonb
        WHERE "method"='gc_direct-debit' AND "data"->'nextAmount' IS NULL;
    `);
    queryRunner.query(
      `UPDATE "payment_data" SET "data"="data"-'nextAmount' WHERE "method"='gc_direct-debit'`
    );
  }
}
