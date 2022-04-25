import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaymentMethodToJoinForm1650900384747
  implements MigrationInterface
{
  name = "AddPaymentMethodToJoinForm1650900384747";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormPaymentmethod" character varying NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormPaymentmethod"`
    );
  }
}
