import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameRedirectFlowToPaymentFlow1651068668585
  implements MigrationInterface
{
  name = "RenameRedirectFlowToPaymentFlow1651068668585";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" RENAME COLUMN "redirectFlowId" TO "paymentFlowId"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" RENAME COLUMN "paymentFlowId" TO "redirectFlowId"`
    );
  }
}
