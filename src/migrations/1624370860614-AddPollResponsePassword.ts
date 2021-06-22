import {MigrationInterface, QueryRunner} from "typeorm";

export class AddPollResponsePassword1624370860614 implements MigrationInterface {
    name = 'AddPollResponsePassword1624370860614'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "poll" ADD "responsePassword" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "poll" DROP COLUMN "responsePassword"`);
    }

}
