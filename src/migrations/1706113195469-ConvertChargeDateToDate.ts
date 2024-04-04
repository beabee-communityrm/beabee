import { MigrationInterface, QueryRunner } from "typeorm";

export class ConvertChargeDateToDate1706113195469
  implements MigrationInterface
{
  name = "ConvertChargeDateToDate1706113195469";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment" ALTER COLUMN "chargeDate" TYPE TIMESTAMP`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment" ALTER COLUMN "chargeDate" TYPE DATE`
    );
  }
}
