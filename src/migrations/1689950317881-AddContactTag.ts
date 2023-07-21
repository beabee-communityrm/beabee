import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContactTag1689950317881 implements MigrationInterface {
  name = "AddContactTag1689950317881";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "contact_tag" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, CONSTRAINT "PK_e46544545a47cff21d83da44cf1" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4f430fb165d3f0dfdfe5121c7c" ON "contact_tag" ("name") `
    );
    await queryRunner.query(
      `CREATE TABLE "contact_profile_tag" ("date" TIMESTAMP NOT NULL DEFAULT now(), "profileContact" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_7af1e3cffcb40c1628d7cc1afb6" PRIMARY KEY ("profileContact", "tagId"))`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_profile_tag" ADD CONSTRAINT "FK_4b15df2e029d612898880c5d914" FOREIGN KEY ("profileContact") REFERENCES "contact_profile"("contactId") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_profile_tag" ADD CONSTRAINT "FK_5dee04ef2ddece93655fcffc7b7" FOREIGN KEY ("tagId") REFERENCES "contact_tag"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );

    // Convert old tags to new tags

    const profiles: { contactId: string; tags: string[] }[] =
      await queryRunner.query(
        `SELECT "contactId", "tags" FROM contact_profile`
      );

    const uniqueTags = profiles
      .flatMap((p) => p.tags)
      .filter((t, i, a) => a.indexOf(t) === i);

    const tagIdByName: Record<string, string> = {};
    for (const tag of uniqueTags) {
      const [{ id }]: { id: string }[] = await queryRunner.query(
        `INSERT INTO contact_tag (name, description) VALUES ($1, '') RETURNING id`,
        [tag]
      );
      console.log(id);
      tagIdByName[tag] = id;
    }

    // Add tags to contact_profile_tag

    const tagInserts = profiles.flatMap((p) =>
      p.tags.map((tagName) => [p.contactId, tagIdByName[tagName]] as const)
    );

    const placeholders = tagInserts
      .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
      .join(", ");

    await queryRunner.query(
      `INSERT INTO contact_profile_tag ("profileContact", "tagId") VALUES ${placeholders}`,
      tagInserts.flat()
    );

    // Drop old tags column

    await queryRunner.query(`ALTER TABLE "contact_profile" DROP COLUMN "tags"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact_profile_tag" DROP CONSTRAINT "FK_5dee04ef2ddece93655fcffc7b7"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_profile_tag" DROP CONSTRAINT "FK_4b15df2e029d612898880c5d914"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_profile" ADD "tags" jsonb NOT NULL DEFAULT '[]'`
    );
    await queryRunner.query(`DROP TABLE "contact_profile_tag"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4f430fb165d3f0dfdfe5121c7c"`
    );
    await queryRunner.query(`DROP TABLE "contact_tag"`);
  }
}
