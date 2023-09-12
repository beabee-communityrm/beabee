import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalloutResponseViewSchema1692289610630
  implements MigrationInterface
{
  name = "AddCalloutResponseViewSchema1692289610630";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout" RENAME COLUMN "mapSchema" TO "responseViewSchema"`
    );
    await queryRunner.query(
      `UPDATE "callout" SET "responseViewSchema"=jsonb_set('{"titleProp": "title", "imageProp": "file", "gallery": false}', '{map}', "responseViewSchema") WHERE "responseViewSchema" IS NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout" RENAME COLUMN "responseViewSchema" TO "mapSchema"`
    );
    await queryRunner.query(
      `UPDATE "callout" SET "mapSchema"="mapSchema"->'map' WHERE "mapSchema" IS NOT NULL`
    );
  }
}
