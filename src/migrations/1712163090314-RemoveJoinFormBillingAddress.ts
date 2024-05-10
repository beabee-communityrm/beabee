import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveJoinFormBillingAddress1712163090314
  implements MigrationInterface
{
  name = "RemoveJoinFormBillingAddress1712163090314";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormBillingaddress"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormBillingaddress" jsonb`
    );
  }
}
