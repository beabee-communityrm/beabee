import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExtraJoinFormFields1712158796671 implements MigrationInterface {
  name = "AddExtraJoinFormFields1712158796671";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormBillingaddress" jsonb`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormVatnumber" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormVatnumber"`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormBillingaddress"`
    );
  }
}
