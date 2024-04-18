import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContentEmail1660562732237 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "content" ("id", "data") VALUES ('email', '{}'::jsonb) ON CONFLICT DO NOTHING`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
