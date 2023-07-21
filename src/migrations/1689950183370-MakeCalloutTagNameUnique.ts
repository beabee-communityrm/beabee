import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeCalloutTagNameUnique1689950183370
  implements MigrationInterface
{
  name = "MakeCalloutTagNameUnique1689950183370";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_tag" ADD CONSTRAINT "UQ_3e46b5c8434cbfa9f58559ee66b" UNIQUE ("name", "calloutSlug")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_tag" DROP CONSTRAINT "UQ_3e46b5c8434cbfa9f58559ee66b"`
    );
  }
}
