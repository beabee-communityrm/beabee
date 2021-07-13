import {MigrationInterface, QueryRunner} from "typeorm";

export class AddMemberActivatedField1626197239672 implements MigrationInterface {
    name = 'AddMemberActivatedField1626197239672'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "member" ADD "activated" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "member" DROP COLUMN "activated"`);
    }

}
