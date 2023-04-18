import { MigrationInterface, QueryRunner } from "typeorm";

export class manualMigration1681650701079 implements MigrationInterface {
  name = "manualMigration1681650701079";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact" 
      RENAME TO "app_user"`
    );

    await queryRunner.query(
      `ALTER TABLE "app_user" 
      ADD COLUMN "type" character varying NOT NULL DEFAULT 'contact', 
      ADD COLUMN "creatorId" uuid, 
      ADD COLUMN "apiKeyId" character varying, 
      ADD COLUMN "apiKeySecrethash" character varying`
    );

    await queryRunner.query(
      `ALTER TABLE "contact_role" 
      RENAME TO "user_role"`
    );

    await queryRunner.query(
      `ALTER TABLE "user_role"
      RENAME COLUMN "contactId" TO "appUserId"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_role"
      RENAME COLUMN "appUserId" to "contactId"`
    );

    await queryRunner.query(
      `ALTER TABLE "user_role"
        RENAME TO "contact_role`
    );

    await queryRunner.query(
      `ALTER TABLE "app_user"
      DROP COLUMN "type",
      DROP COLUMN "creatorId", 
      DROP COLUMN "ApiKeyId", 
      DROP COLUMN "apiKeySecrethash"`
    );

    await queryRunner.query(
      `ALTER TABLE "app_user" 
      RENAME TO "contact"`
    );
  }
}
