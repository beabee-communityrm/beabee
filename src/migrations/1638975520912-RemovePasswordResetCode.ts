import { MigrationInterface, QueryRunner } from "typeorm";

export class RemovePasswordResetCode1638975520912
  implements MigrationInterface
{
  name = "RemovePasswordResetCode1638975520912";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormPasswordResetcode"`
    );
    await queryRunner.query(
      `ALTER TABLE "member" DROP COLUMN "passwordResetcode"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member" ADD "passwordResetcode" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormPasswordResetcode" character varying`
    );
  }
}
