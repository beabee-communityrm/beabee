import { MigrationInterface, QueryRunner } from "typeorm";

export class CalloutChannels1715184967411 implements MigrationInterface {
    name = 'CalloutChannels1715184967411'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "callout" ADD "channels" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "callout" DROP COLUMN "channels"`);
    }

}
