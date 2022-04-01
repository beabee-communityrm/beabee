import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveOldLoginOverride1648824632717 implements MigrationInterface {
  name = "RemoveOldLoginOverride1648824632717";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" DROP COLUMN "loginOverride"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" ADD "loginOverride" jsonb`);
  }
}
