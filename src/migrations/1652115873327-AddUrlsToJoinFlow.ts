import { addThenSetNotNull } from "#core/utils/db";
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUrlsToJoinFlow1652115873327 implements MigrationInterface {
  name = "AddUrlsToJoinFlow1652115873327";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await addThenSetNotNull(queryRunner, "join_flow", "loginUrl");
    await addThenSetNotNull(queryRunner, "join_flow", "setPasswordUrl");
    await addThenSetNotNull(queryRunner, "join_flow", "confirmUrl");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "join_flow" DROP COLUMN "confirmUrl"`);
    await queryRunner.query(
      `ALTER TABLE "join_flow" DROP COLUMN "setPasswordUrl"`
    );
    await queryRunner.query(`ALTER TABLE "join_flow" DROP COLUMN "loginUrl"`);
  }
}
