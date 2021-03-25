import {MigrationInterface, QueryRunner} from "typeorm";

export class AddSegmentOrder1616693016456 implements MigrationInterface {
    name = 'AddSegmentOrder1616693016456'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "segment" ADD "order" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "segment" DROP COLUMN "order"`);
    }

}
