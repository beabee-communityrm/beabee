import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalloutVariantFormTexts1709297783048
  implements MigrationInterface
{
  name = "AddCalloutVariantFormTexts1709297783048";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_variant" ADD "slideNavigation" jsonb`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_variant" ADD "componentText" jsonb NOT NULL DEFAULT '{}'`
    );

    // Move callout slide navigation text to callout variants
    await queryRunner.query(`
      UPDATE "callout_variant" SET "slideNavigation" = (
        SELECT jsonb_object_agg(k, v) FROM (
          SELECT slide->>'id' as k, (slide->'navigation')::jsonb - 'nextSlideId' as v
          FROM callout c, jsonb_array_elements(c."formSchema"->'slides') AS slide
          WHERE c.id = "callout_variant"."calloutId"
        ) q
      )`);

    // Keep only nextSlideId in callout formSchema->slides->navigation
    await queryRunner.query(`
      UPDATE "callout" SET "formSchema" = jsonb_build_object('slides', (
        SELECT jsonb_agg(v::jsonb) FROM (
          SELECT jsonb_set(slide, '{navigation}', jsonb_build_object('nextSlideId', slide->'navigation'->>'nextSlideId')) as v
          FROM jsonb_array_elements("formSchema"->'slides') AS slide
        ) q
      ))`);

    await queryRunner.query(
      `ALTER TABLE "callout_variant" ALTER COLUMN "slideNavigation" SET NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Merge callout variants slide navigation back to callout
    await queryRunner.query(`
      UPDATE callout SET "formSchema"=jsonb_build_object('slides', (
        SELECT jsonb_agg(v::jsonb)
        FROM (
          SELECT
            jsonb_set(slide, '{navigation}',
              (slide->'navigation')::jsonb || ("slideNavigation"->(slide->>'id'))::jsonb
            ) AS v
          FROM (
            SELECT "formSchema", "slideNavigation" FROM callout_variant cv
            WHERE cv."calloutId" = "callout".id AND cv.name = 'default'
          ) q1, jsonb_array_elements("formSchema"->'slides') AS slide
        ) q2
      ))`);

    await queryRunner.query(
      `ALTER TABLE "callout_variant" DROP COLUMN "componentText"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_variant" DROP COLUMN "slideNavigation"`
    );
  }
}
