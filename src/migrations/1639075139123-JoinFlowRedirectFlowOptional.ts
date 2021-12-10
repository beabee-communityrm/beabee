import { MigrationInterface, QueryRunner } from "typeorm";

export class JoinFlowRedirectFlowOptional1639075139123
  implements MigrationInterface
{
  name = "JoinFlowRedirectFlowOptional1639075139123";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "sessionToken"`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" ALTER COLUMN "redirectFlowId" DROP NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" ALTER COLUMN "redirectFlowId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "sessionToken" character varying NOT NULL`
    );
  }
}
