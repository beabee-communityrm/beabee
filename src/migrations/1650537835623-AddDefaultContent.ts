import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDefaultContent1650537835623 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "content" ("id", "data") VALUES ('join', '{"title": "Join now!", "periods": [{"name": "monthly", "presetAmounts": [3, 5, 10]}, {"name": "annually", "presetAmounts": [36, 60, 120]}], "subtitle": "<p><br></p>", "initialAmount": 5, "initialPeriod": "monthly", "showNoContribution": false}'::jsonb) ON CONFLICT DO NOTHING`
    );
    await queryRunner.query(
      `INSERT INTO "content" ("id", "data") VALUES ('join/setup', '{"welcome": "Welcome to the community!", "showNewsletterOptIn": false}'::jsonb) ON CONFLICT DO NOTHING`
    );
    await queryRunner.query(
      `INSERT INTO "content" ("id", "data") VALUES ('profile', '{"introMessage": "<p><br></p>", "footerMessage": "You make this possible!", "welcomeMessage": "Welcome to your online membership"}'::jsonb) ON CONFLICT DO NOTHING`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {}
}
