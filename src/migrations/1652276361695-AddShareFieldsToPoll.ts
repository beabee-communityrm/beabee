import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShareFieldsToPoll1652276361695 implements MigrationInterface {
  name = "AddShareFieldsToPoll1652276361695";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "poll" ADD "shareTitle" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "poll" ADD "shareDescription" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "poll" DROP COLUMN "shareDescription"`
    );
    await queryRunner.query(`ALTER TABLE "poll" DROP COLUMN "shareTitle"`);
  }
}
