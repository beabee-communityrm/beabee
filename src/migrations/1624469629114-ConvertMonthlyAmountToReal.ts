import { MigrationInterface, QueryRunner } from "typeorm";

export class ConvertMonthlyAmountToReal1624469629114
  implements MigrationInterface
{
  name = "ConvertMonthlyAmountToReal1624469629114";

  public async up(queryRunner: QueryRunner): Promise<void> {
    async function convertType(table: string) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "joinFormMonthlyamount2" real`
      );
      await queryRunner.query(
        `UPDATE "${table}" SET "joinFormMonthlyamount2"="joinFormMonthlyamount"`
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "joinFormMonthlyamount"`
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" RENAME COLUMN "joinFormMonthlyamount2" TO "joinFormMonthlyamount"`
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "joinFormMonthlyamount" SET NOT NULL`
      );
    }
    await convertType("join_flow");
    await convertType("restart_flow");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restart_flow" DROP COLUMN "joinFormMonthlyamount"`
    );
    await queryRunner.query(
      `ALTER TABLE "restart_flow" ADD "joinFormMonthlyamount" integer NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormMonthlyamount"`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormMonthlyamount" integer NOT NULL`
    );
  }
}
