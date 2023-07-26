import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalloutMapSchema1690389664790 implements MigrationInterface {
  name = "AddCalloutMapSchema1690389664790";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "callout" ADD "mapSchema" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "callout" DROP COLUMN "mapSchema"`);
  }
}
