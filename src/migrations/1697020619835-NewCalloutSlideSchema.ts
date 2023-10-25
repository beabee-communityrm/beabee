import { MigrationInterface, QueryRunner } from "typeorm";

interface Callout {
  slug: string;
  formSchema: { components: CalloutComponentSchema[] };
  pollMergeField: string | null;
}

interface CalloutComponentSchema {
  type: string;
  label: string;
  components?: CalloutComponentSchema[];
}

function removeButtons(components: CalloutComponentSchema[]) {
  return components
    .filter((component) => component.type !== "button")
    .map((component) => {
      if (component.components) {
        component.components = removeButtons(component.components);
      }
      return component;
    });
}

const SLIDE_ID = "slide1";

/**
 * Converts all old callouts to the new schema format with a single slide
 */
export class NewCalloutSlideSchema1697020619835 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const callouts: Callout[] = await queryRunner.query(
      'SELECT "slug", "formSchema", "pollMergeField" from "callout"'
    );

    for (const callout of callouts) {
      const components = callout.formSchema.components;

      const submitText =
        components[components.length - 1]?.type === "button"
          ? components[components.length - 1].label
          : "Submit";

      const newFormSchema = {
        slides: [
          {
            id: SLIDE_ID,
            title: "Slide 1",
            components: removeButtons(components),
            navigation: {
              prevText: "Prev",
              nextText: "Next",
              nextSlideId: "",
              submitText
            }
          }
        ]
      };

      const pollMergeField = callout.pollMergeField
        ? `${SLIDE_ID}.${callout.pollMergeField}`
        : null;

      await queryRunner.query(
        `UPDATE "callout" SET "formSchema"=$1, "pollMergeField"=$2 WHERE "slug"=$3`,
        [newFormSchema, pollMergeField, callout.slug]
      );
    }

    await queryRunner.query(
      `UPDATE "callout_response" SET "answers"=jsonb_build_object('${SLIDE_ID}', "answers")`
    );

    // Update responseViewSchema, prefixing all the props with slide ID
    await queryRunner.query(
      `UPDATE "callout" SET "responseViewSchema"=jsonb_set(
        "responseViewSchema",
        '{titleProp}',
        CONCAT('"${SLIDE_ID}.', "responseViewSchema"->>'titleProp', '"')::jsonb
      ) WHERE "responseViewSchema"->>'titleProp' != ''`
    );
    await queryRunner.query(
      `UPDATE "callout" SET "responseViewSchema"=jsonb_set(
        "responseViewSchema",
        '{imageProp}',
        CONCAT('"${SLIDE_ID}.', "responseViewSchema"->>'imageProp', '"')::jsonb
      ) WHERE "responseViewSchema"->>'imageProp' != ''`
    );
    await queryRunner.query(
      `UPDATE "callout" SET "responseViewSchema"=jsonb_set(
        "responseViewSchema",
        '{map}',
        jsonb_set(
          "responseViewSchema"->'map',
          '{addressProp}',
          CONCAT('"${SLIDE_ID}.', "responseViewSchema"->'map'->>'addressProp', '"')::jsonb
        )
      ) WHERE "responseViewSchema"->'map'->>'addressProp' != ''`
    );
    await queryRunner.query(
      `UPDATE "callout" SET "responseViewSchema"=jsonb_set(
        "responseViewSchema",
        '{map}',
        jsonb_set(
          "responseViewSchema"->'map',
          '{addressPatternProp}',
          CONCAT('"${SLIDE_ID}.', "responseViewSchema"->'map'->>'addressPatternProp', '"')::jsonb
        )
      ) WHERE "responseViewSchema"->'map'->>'addressPatternProp' != ''`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "callout" SET "formSchema"=jsonb_build_object('components', "formSchema"->'slides'->0->'components')`
    );
    await queryRunner.query(
      `UPDATE "callout_response" SET "answers"="answers"->'${SLIDE_ID}'`
    );
    await queryRunner.query(
      `UPDATE "callout" SET "responseViewSchema"=REPLACE("responseViewSchema"::text, '"${SLIDE_ID}.', '"')::jsonb`
    );
  }
}
