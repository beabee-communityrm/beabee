import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveNextContributionAmount1655199299904
  implements MigrationInterface
{
  name = "RemoveNextContributionAmount1655199299904";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "payment_data" SET "data"=jsonb_set("data", '{nextMonthlyAmount}', to_jsonb(sq."nextContributionMonthlyAmount"))
      FROM (
        SELECT "id", "nextContributionMonthlyAmount" FROM "member" WHERE "nextContributionMonthlyAmount" IS NOT NULL
      ) sq
      WHERE "memberId"=sq."id"`
    );
    await queryRunner.query(
      `ALTER TABLE "member" DROP COLUMN "nextContributionMonthlyAmount"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member" ADD "nextContributionMonthlyAmount" real`
    );
  }
}
