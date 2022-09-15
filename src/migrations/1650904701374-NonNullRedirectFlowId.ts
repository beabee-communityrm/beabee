import { MigrationInterface, QueryRunner } from "typeorm";

export class NonNullRedirectFlowId1650904701374 implements MigrationInterface {
  name = "NonNullRedirectFlowId1650904701374";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "join_flow" SET "redirectFlowId"='' WHERE "redirectFlowId" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" ALTER COLUMN "redirectFlowId" SET NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" ALTER COLUMN "redirectFlowId" DROP NOT NULL`
    );
  }
}
