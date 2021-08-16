import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailAndPasswordToJoinFlow1621513644609
  implements MigrationInterface
{
  name = "AddEmailAndPasswordToJoinFlow1621513644609";

  public async up(queryRunner: QueryRunner): Promise<void> {
    async function addThenSetNotNull(table: string, column: string) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "${column}" character varying`
      );
      await queryRunner.query(`UPDATE "${table}" SET "${column}"=''`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" SET NOT NULL`
      );
    }

    await addThenSetNotNull("join_flow", "joinFormEmail");
    await addThenSetNotNull("join_flow", "joinFormPasswordHash");
    await addThenSetNotNull("join_flow", "joinFormPasswordSalt");
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormPasswordIterations" integer NOT NULL DEFAULT '1000'`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormPasswordTries" integer NOT NULL DEFAULT '0'`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormPasswordResetcode" character varying`
    );

    await addThenSetNotNull("restart_flow", "joinFormEmail");
    await addThenSetNotNull("restart_flow", "joinFormPasswordHash");
    await addThenSetNotNull("restart_flow", "joinFormPasswordSalt");
    await queryRunner.query(
      `ALTER TABLE "restart_flow" ADD "joinFormPasswordIterations" integer NOT NULL DEFAULT '1000'`
    );
    await queryRunner.query(
      `ALTER TABLE "restart_flow" ADD "joinFormPasswordTries" integer NOT NULL DEFAULT '0'`
    );
    await queryRunner.query(
      `ALTER TABLE "restart_flow" ADD "joinFormPasswordResetcode" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restart_flow" DROP COLUMN "joinFormPasswordResetcode"`
    );
    await queryRunner.query(
      `ALTER TABLE "restart_flow" DROP COLUMN "joinFormPasswordTries"`
    );
    await queryRunner.query(
      `ALTER TABLE "restart_flow" DROP COLUMN "joinFormPasswordIterations"`
    );
    await queryRunner.query(
      `ALTER TABLE "restart_flow" DROP COLUMN "joinFormPasswordSalt"`
    );
    await queryRunner.query(
      `ALTER TABLE "restart_flow" DROP COLUMN "joinFormPasswordHash"`
    );
    await queryRunner.query(
      `ALTER TABLE "restart_flow" DROP COLUMN "joinFormEmail"`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormPasswordResetcode"`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormPasswordTries"`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormPasswordIterations"`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormPasswordSalt"`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormPasswordHash"`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "joinFormEmail"`
    );
  }
}
