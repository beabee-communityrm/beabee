import { MigrationInterface, QueryRunner } from "typeorm";

import { addThenSetNotNull } from "#core/utils/db";

export class AddEmailAndPasswordToJoinFlow1621513644609
  implements MigrationInterface {
  name = "AddEmailAndPasswordToJoinFlow1621513644609";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await addThenSetNotNull(queryRunner, "join_flow", "joinFormEmail");
    await addThenSetNotNull(queryRunner, "join_flow", "joinFormPasswordHash");
    await addThenSetNotNull(queryRunner, "join_flow", "joinFormPasswordSalt");
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormPasswordIterations" integer NOT NULL DEFAULT '1000'`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormPasswordTries" integer NOT NULL DEFAULT '0'`
    );
    await queryRunner.query(
      `ALTER TABLE "join_flow" ADD "joinFormPasswordResetcode" character varying`
    );

    await addThenSetNotNull(queryRunner, "restart_flow", "joinFormEmail");
    await addThenSetNotNull(
      queryRunner,
      "restart_flow",
      "joinFormPasswordHash"
    );
    await addThenSetNotNull(
      queryRunner,
      "restart_flow",
      "joinFormPasswordSalt"
    );
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
