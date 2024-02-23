import { MigrationInterface, QueryRunner } from "typeorm";

interface Callout {
  id: string;
  slug: string;
}

export class AddCalloutId1708615794655 implements MigrationInterface {
  name = "AddCalloutId1708615794655";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new ID columns
    await queryRunner.query(
      `ALTER TABLE "callout" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" ADD "calloutId" uuid`
    );
    await queryRunner.query(`ALTER TABLE "callout_tag" ADD "calloutId" uuid`);

    // Map callout slugs to new IDs
    await queryRunner.query(
      `UPDATE option SET value = callout.id FROM callout WHERE option.key = 'join-survey' AND option.value = callout.slug`
    );
    await queryRunner.query(
      `UPDATE option SET value = callout.id FROM callout WHERE option.key = 'cancellation-survey' AND option.value = callout.slug`
    );
    await queryRunner.query(
      `UPDATE callout_response SET "calloutId" = callout.id FROM callout WHERE callout_response."calloutSlug" = callout.slug`
    );
    await queryRunner.query(
      `UPDATE callout_tag SET "calloutId" = callout.id FROM callout WHERE callout_tag."calloutSlug" = callout.slug`
    );

    // Add NOT NULL constraint
    await queryRunner.query(
      `ALTER TABLE "callout_response" ALTER COLUMN "calloutId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_tag" ALTER COLUMN "calloutId" SET NOT NULL`
    );

    // Drop old slug columns
    await queryRunner.query(
      `ALTER TABLE "callout_tag" DROP CONSTRAINT "FK_2d38f2b925681272ee3a0c65570"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" DROP CONSTRAINT "FK_5d04ff6c1cd96b3e445cf2a3d32"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" DROP CONSTRAINT "UQ_df2d4c28d0a020a3bffefb15bfe"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" DROP COLUMN "calloutSlug"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_tag" DROP COLUMN "calloutSlug"`
    );

    // Set new constraints and foreign keys
    await queryRunner.query(
      `ALTER TABLE "callout" DROP CONSTRAINT "PK_37691db8708a2a24cfd6bb21cf3"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout" ADD CONSTRAINT "PK_b0de4e3682528ac95da8263cfea" PRIMARY KEY ("id")`
    );
    await queryRunner.query(
      `ALTER TABLE "callout" ADD CONSTRAINT "UQ_de88a9685333c7cb1ec489eecff" UNIQUE ("slug")`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" ADD CONSTRAINT "UQ_ae51c380c43e64a302d053bd797" UNIQUE ("calloutId", "number")`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" ADD CONSTRAINT "FK_20dde5f7157ed8ea7487aea9e03" FOREIGN KEY ("calloutId") REFERENCES "callout"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_tag" ADD CONSTRAINT "FK_9b11580085023b7262507b6fa18" FOREIGN KEY ("calloutId") REFERENCES "callout"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add old slug columns
    await queryRunner.query(
      `ALTER TABLE "callout_response" ADD "calloutSlug" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_tag" ADD "calloutSlug" character varying`
    );

    // Map callout IDs to old slugs
    await queryRunner.query(
      `UPDATE option SET value = callout.slug FROM callout WHERE option.key = 'join-survey' AND option.value = callout.id::text`
    );
    await queryRunner.query(
      `UPDATE option SET value = callout.slug FROM callout WHERE option.key = 'cancellation-survey' AND option.value = callout.id::text`
    );
    await queryRunner.query(
      `UPDATE callout_response SET "calloutSlug" = callout.slug FROM callout WHERE callout_response."calloutId" = callout.id`
    );
    await queryRunner.query(
      `UPDATE callout_tag SET "calloutSlug" = callout.slug FROM callout WHERE callout_tag."calloutId" = callout.id`
    );

    // Add NOT NULL constraint
    await queryRunner.query(
      `ALTER TABLE "callout_response" ALTER COLUMN "calloutSlug" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_tag" ALTER COLUMN "calloutSlug" SET NOT NULL`
    );

    // Drop constraints
    await queryRunner.query(
      `ALTER TABLE "callout" DROP CONSTRAINT "UQ_de88a9685333c7cb1ec489eecff"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" DROP CONSTRAINT "FK_20dde5f7157ed8ea7487aea9e03"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" DROP CONSTRAINT "UQ_ae51c380c43e64a302d053bd797"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_tag" DROP CONSTRAINT "FK_9b11580085023b7262507b6fa18"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout" DROP CONSTRAINT "PK_b0de4e3682528ac95da8263cfea"`
    );

    // Add old slug constraints and foreign keys
    await queryRunner.query(
      `ALTER TABLE "callout" ADD CONSTRAINT "PK_37691db8708a2a24cfd6bb21cf3" PRIMARY KEY ("slug")`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_tag" ADD CONSTRAINT "FK_2d38f2b925681272ee3a0c65570" FOREIGN KEY ("calloutSlug") REFERENCES "callout"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" ADD CONSTRAINT "FK_5d04ff6c1cd96b3e445cf2a3d32" FOREIGN KEY ("calloutSlug") REFERENCES "callout"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" ADD CONSTRAINT "UQ_df2d4c28d0a020a3bffefb15bfe" UNIQUE ("calloutSlug", "number")`
    );

    // Remove ID columns
    await queryRunner.query(`ALTER TABLE "callout" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE callout_response DROP COLUMN "calloutId"`
    );
    await queryRunner.query(`ALTER TABLE callout_tag DROP COLUMN "calloutId"`);
  }
}
