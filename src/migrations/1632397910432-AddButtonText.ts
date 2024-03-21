import { MigrationInterface, QueryRunner } from "typeorm";
import { addThenSetNotNull } from "#core/utils/db";

export class AddButtonText1632397910432 implements MigrationInterface {
  name = "AddButtonText1632397910432";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await addThenSetNotNull(queryRunner, "notice", "buttonText");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notice" DROP COLUMN "buttonText"`);
  }
}
