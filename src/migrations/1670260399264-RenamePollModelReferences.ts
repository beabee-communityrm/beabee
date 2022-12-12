import { MigrationInterface, QueryRunner } from "typeorm";

export class RenamePollModelReferences1670260399264
  implements MigrationInterface
{
  name = "RenamePollModelReferences1670260399264";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response" DROP CONSTRAINT "FK_43a6462a28190634780a43e141a"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" RENAME COLUMN "pollSlug" TO "calloutSlug"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" ADD CONSTRAINT "FK_5d04ff6c1cd96b3e445cf2a3d32" FOREIGN KEY ("calloutSlug") REFERENCES "callout"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "callout_response" DROP CONSTRAINT "FK_5d04ff6c1cd96b3e445cf2a3d32"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" RENAME COLUMN "calloutSlug" TO "pollSlug"`
    );
    await queryRunner.query(
      `ALTER TABLE "callout_response" ADD CONSTRAINT "FK_43a6462a28190634780a43e141a" FOREIGN KEY ("pollSlug") REFERENCES "callout"("slug") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
