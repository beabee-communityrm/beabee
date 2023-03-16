import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalloutTag1676654870090 implements MigrationInterface {
  name = "AddCalloutTag1676654870090";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "callout_tag" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "calloutSlug" character varying, CONSTRAINT "PK_a976b7ebc872c92866b17e749d3" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_tag" ADD CONSTRAINT "FK_2d38f2b925681272ee3a0c65570" FOREIGN KEY ("calloutSlug") REFERENCES "callout"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_tag" DROP CONSTRAINT "FK_2d38f2b925681272ee3a0c65570"`
    );
    await queryRunner.query(`DROP TABLE "callout_tag"`);
  }
}
