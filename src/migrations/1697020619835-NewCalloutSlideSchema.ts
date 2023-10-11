import { MigrationInterface, QueryRunner } from "typeorm";

interface Callout {
  slug: string;
  formSchema: { components: unknown[] };
}

export class NewCalloutSlideSchema1697020619835 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const callouts: Callout[] = await queryRunner.query(
      'SELECT "slug", "formSchema" from "callout"'
    );

    for (const callout of callouts) {
      const newFormSchema = {
        slides: [
          {
            id: "slide1",
            components: callout.formSchema.components,
            navigation: {
              prevText: "",
              nextText: "",
              nextSlideId: "",
              submitText: "Submit" // TODO: use actual button component?
            }
          }
        ]
      };

      await queryRunner.query(
        `UPDATE "callout" SET "formSchema"=$1 WHERE "slug"=$2`,
        [newFormSchema, callout.slug]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "callout" SET "formSchema"=jsonb_build_object('components', "formSchema"->'slides'->0->'components')`
    );
  }
}
