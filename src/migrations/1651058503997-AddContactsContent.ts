import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContentContacts1651058503997 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "content" ("id", "data") VALUES ('contacts', '{}'::jsonb) ON CONFLICT DO NOTHING`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
