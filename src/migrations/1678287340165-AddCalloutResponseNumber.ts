import { MigrationInterface, QueryRunner } from "typeorm";

interface Callout {
  slug: string;
}

export class AddCalloutResponseNumber1678287340165
  implements MigrationInterface
{
  name = "AddCalloutResponseNumber1678287340165";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response" ADD "number" integer`
    );
    const callouts: Callout[] = await queryRunner.query(
      'SELECT "slug" FROM "callout"'
    );
    for (const callout of callouts) {
      await queryRunner.query(
        `UPDATE callout_response cr1 SET number = cr2.number
        FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt") AS number FROM callout_response WHERE "calloutSlug" = $1) cr2
        WHERE cr1.id = cr2.id`,
        [callout.slug]
      );
    }

    await queryRunner.query(
      `ALTER TABLE "callout_response" ALTER COLUMN "number" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" ADD CONSTRAINT "UQ_df2d4c28d0a020a3bffefb15bfe" UNIQUE ("calloutSlug", "number")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response" DROP CONSTRAINT "UQ_df2d4c28d0a020a3bffefb15bfe"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" DROP COLUMN "number"`
    );
  }
}
