import { MigrationInterface, QueryRunner } from "typeorm";

export class CalloutChannels1715083484502 implements MigrationInterface {
  name = "CalloutChannels1715083484502";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."callout_channels_enum" AS ENUM('telegram')`
    );
    await queryRunner.query(
      `ALTER TABLE "callout" ADD "channels" "public"."callout_channels_enum"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "callout" DROP COLUMN "channels"`);
    await queryRunner.query(`DROP TYPE "public"."callout_channels_enum"`);
  }
}
