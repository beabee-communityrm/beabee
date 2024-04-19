import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShareContent1660235362253 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "content" ("id", "data") VALUES ('share', '{}'::jsonb) ON CONFLICT DO NOTHING`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
