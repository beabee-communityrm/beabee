import { MigrationInterface, QueryRunner } from "typeorm";

export class RenamePaymentDataToContactContribution1713373413805
  implements MigrationInterface
{
  name = "RenamePaymentDataToContactContribution1713373413805";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_data" RENAME TO "contact_contribution"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact_contribution" RENAME TO "payment_data"`
    );
  }
}
