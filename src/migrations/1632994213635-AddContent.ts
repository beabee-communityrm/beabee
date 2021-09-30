import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContent1632994213635 implements MigrationInterface {
  name = "AddContent1632994213635";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "content" ("id" character varying NOT NULL, "updated" TIMESTAMP NOT NULL DEFAULT now(), "data" jsonb NOT NULL, CONSTRAINT "PK_6a2083913f3647b44f205204e36" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "content"`);
  }
}
