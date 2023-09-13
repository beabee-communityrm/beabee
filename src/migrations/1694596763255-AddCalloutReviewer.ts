import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalloutReviewer1694596763255 implements MigrationInterface {
  name = "AddCalloutReviewer1694596763255";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "callout_reviewer" ("calloutSlug" character varying NOT NULL, "reviewerId" uuid NOT NULL, CONSTRAINT "PK_6d519d538f3cbdca963451694cf" PRIMARY KEY ("calloutSlug", "reviewerId"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "callout_reviewer"`);
  }
}
