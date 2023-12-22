import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateCalloutTag1703247945472 implements MigrationInterface {
  name = "UpdateCalloutTag1703247945472";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_tag" DROP CONSTRAINT "FK_2d38f2b925681272ee3a0c65570"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_tag" ALTER COLUMN "calloutSlug" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_tag" ADD CONSTRAINT "FK_2d38f2b925681272ee3a0c65570" FOREIGN KEY ("calloutSlug") REFERENCES "callout"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_tag" DROP CONSTRAINT "FK_2d38f2b925681272ee3a0c65570"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_tag" ALTER COLUMN "calloutSlug" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_tag" ADD CONSTRAINT "FK_2d38f2b925681272ee3a0c65570" FOREIGN KEY ("calloutSlug") REFERENCES "callout"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
