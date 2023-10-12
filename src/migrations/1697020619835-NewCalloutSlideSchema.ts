import { MigrationInterface, QueryRunner } from "typeorm";

interface Callout {
  slug: string;
  formSchema: { components: CalloutComponentSchema[] };
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

export class NewCalloutSlideSchema1697020619835 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const callouts: Callout[] = await queryRunner.query(
      'SELECT "slug", "formSchema" from "callout"'
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
            id: "slide1",
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

      await queryRunner.query(
        `UPDATE "callout" SET "formSchema"=$1 WHERE "slug"=$2`,
        [newFormSchema, callout.slug]
      );
    }

    await queryRunner.query(
      `UPDATE "callout_response" SET "answers"=jsonb_build_object('slide1', "answers")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "callout" SET "formSchema"=jsonb_build_object('components', "formSchema"->'slides'->0->'components')`
    );
    await queryRunner.query(
      `UPDATE "callout_response" SET "answers"="answers"->'slide1'`
    );
  }
}
