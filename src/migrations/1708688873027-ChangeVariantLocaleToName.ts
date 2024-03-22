import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeVariantLocaleToName1708688873027
  implements MigrationInterface
{
  name = "ChangeVariantLocaleToName1708688873027";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_variant" DROP CONSTRAINT "FK_59870aea0a069e0beadd31b5853"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_variant" RENAME COLUMN "locale" TO "name"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_variant" ADD CONSTRAINT "FK_0b3fcedbb2f66d24718bbe58d41" FOREIGN KEY ("calloutId") REFERENCES "callout"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_variant" DROP CONSTRAINT "FK_0b3fcedbb2f66d24718bbe58d41"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_variant" RENAME COLUMN "name" TO "locale"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_variant" ADD CONSTRAINT "FK_59870aea0a069e0beadd31b5853" FOREIGN KEY ("calloutId") REFERENCES "callout"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
