import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOptionalFirstAndLastNameToJoinFlow1656347461817
  implements MigrationInterface
{
  name = "AddOptionalFirstAndLastNameToJoinFlow1656347461817";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormFirstname" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormLastname" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormLastname"`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormFirstname"`
    );
  }
}
