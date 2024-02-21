import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalloutVariant1708534754022 implements MigrationInterface {
  name = "AddCalloutVariant1708534754022";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "callout_variant" ("calloutId" uuid NOT NULL, "locale" character varying NOT NULL, "title" character varying NOT NULL, "excerpt" character varying NOT NULL, "intro" character varying NOT NULL, "thanksTitle" character varying NOT NULL, "thanksText" character varying NOT NULL, "thanksRedirect" character varying, "shareTitle" character varying, "shareDescription" character varying, CONSTRAINT "PK_e27da2090333df954797676bb02" PRIMARY KEY ("calloutId", "locale"))`
    );

    await queryRunner.query(
      `INSERT INTO "callout_variant" (
        "calloutId", "locale", "title", "excerpt", "intro", "thanksTitle", "thanksText",
        "thanksRedirect", "shareTitle", "shareDescription"
      )
      SELECT "id", 'default', "title", "excerpt", "intro", "thanksTitle", "thanksText",
        "thanksRedirect", "shareTitle", "shareDescription"
      FROM "callout"`
    );

    await queryRunner.query(`ALTER TABLE "callout" DROP COLUMN "intro"`);
    await queryRunner.query(`ALTER TABLE "callout" DROP COLUMN "title"`);
    await queryRunner.query(`ALTER TABLE "callout" DROP COLUMN "excerpt"`);
    await queryRunner.query(`ALTER TABLE "callout" DROP COLUMN "thanksTitle"`);
    await queryRunner.query(`ALTER TABLE "callout" DROP COLUMN "thanksText"`);
    await queryRunner.query(
      `ALTER TABLE "callout" DROP COLUMN "thanksRedirect"`
    );
    await queryRunner.query(`ALTER TABLE "callout" DROP COLUMN "shareTitle"`);
    await queryRunner.query(
      `ALTER TABLE "callout" DROP COLUMN "shareDescription"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_variant" ADD CONSTRAINT "FK_59870aea0a069e0beadd31b5853" FOREIGN KEY ("calloutId") REFERENCES "callout"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_variant" DROP CONSTRAINT "FK_59870aea0a069e0beadd31b5853"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout" ADD "shareDescription" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "callout" ADD "shareTitle" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "callout" ADD "thanksRedirect" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "callout" ADD "thanksText" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout" ADD "thanksTitle" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout" ADD "excerpt" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout" ADD "title" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout" ADD "intro" character varying NOT NULL`
    );

    await queryRunner.query(
      `UPDATE "callout" SET
        "intro" = "callout_variant"."intro",
        "title" = "callout_variant"."title",
        "excerpt" = "callout_variant"."excerpt",
        "thanksTitle" = "callout_variant"."thanksTitle",
        "thanksText" = "callout_variant"."thanksText",
        "thanksRedirect" = "callout_variant"."thanksRedirect",
        "shareTitle" = "callout_variant"."shareTitle",
        "shareDescription" = "callout_variant"."shareDescription"
      FROM "callout_variant"
      WHERE "callout"."id" = "callout_variant"."calloutId" && "callout_variant"."locale" = 'default'`
    );

    await queryRunner.query(`DROP TABLE "callout_variant"`);
  }
}
