import { ContributionPeriod, PaymentMethod } from "@beabee/beabee-common";
import { MigrationInterface, QueryRunner } from "typeorm";

import { getChargeableAmount } from "#core/utils/payment";

interface PaymentQueryResults {
  id: string;
  data: {
    nextMonthlyAmount: number;
    payFee: boolean;
  };
  contributionPeriod: ContributionPeriod;
}

export class UpdateGCNextAmount1696600862719 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Set nextAmount to null if nextMonthlyAmount is null
    queryRunner.query(`
      UPDATE "payment_data" SET "data"="data" || '{"nextAmount": null}'::jsonb
      WHERE "method"='gc_direct-debit' AND "data"->>'nextMonthlyAmount' IS NULL;
    `);

    // Migrate to nextAmount if nextMonthlyAmount is not null
    const results: PaymentQueryResults[] = await queryRunner.query(`
      SELECT c.id, pd."data", c."contributionPeriod" FROM "payment_data" pd INNER JOIN "contact" c ON pd."contactId"=c.id
      WHERE pd."method"='gc_direct-debit' AND pd."data"->>'nextMonthlyAmount' IS NOT NULL;
    `);

    for (const result of results) {
      const chargeableAmount = getChargeableAmount(
        {
          monthlyAmount: result.data.nextMonthlyAmount,
          period: result.contributionPeriod,
          payFee: result.data.payFee,
          prorate: false
        },
        PaymentMethod.GoCardlessDirectDebit
      );

      const nextAmount = {
        monthly: result.data.nextMonthlyAmount,
        charegable: chargeableAmount
      };

      queryRunner.query(
        `
        UPDATE "payment_data"
        SET "data"=jsonb_set("data", '{nextAmount}', $1)
        WHERE "contactId"=$2 AND "method"='gc_direct-debit';
      `,
        [JSON.stringify(nextAmount), result.id]
      );
    }

    // Remove nextMonthlyAmount
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
