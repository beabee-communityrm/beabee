import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmptyGeneralContent1650535712817 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "content" ("id", "data") VALUES ('general', '{}'::jsonb) ON CONFLICT DO NOTHING`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
