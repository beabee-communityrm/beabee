import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveRestartFlow1635350051303 implements MigrationInterface {
  name = "RemoveRestartFlow1635350051303";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" DROP COLUMN "activated"`);
    await queryRunner.query(`DROP TABLE "restart_flow"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member" ADD "activated" boolean NOT NULL DEFAULT false`
    );
  }
}
