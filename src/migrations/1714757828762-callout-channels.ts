import { MigrationInterface, QueryRunner } from "typeorm";

export class CalloutChannels1714757828762 implements MigrationInterface {
    name = 'CalloutChannels1714757828762'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."callout_channels_enum" AS ENUM('telegram')`);
        await queryRunner.query(`ALTER TABLE "callout" ADD "channels" "public"."callout_channels_enum" NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "callout" DROP COLUMN "channels"`);
        await queryRunner.query(`DROP TYPE "public"."callout_channels_enum"`);
    }

}
