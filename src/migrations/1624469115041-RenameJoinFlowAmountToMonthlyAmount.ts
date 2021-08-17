import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameJoinFlowAmountToMonthlyAmount1624469115041
  implements MigrationInterface
{
  name = "RenameJoinFlowAmountToMonthlyAmount1624469115041";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" RENAME COLUMN "joinFormAmount" TO "joinFormMonthlyamount"`
    );
    await queryRunner.query(
      `ALTER TABLE "restart_flow" RENAME COLUMN "joinFormAmount" TO "joinFormMonthlyamount"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restart_flow" RENAME COLUMN "joinFormMonthlyamount" TO "joinFormAmount"`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" RENAME COLUMN "joinFormMonthlyamount" TO "joinFormAmount"`
    );
  }
}
