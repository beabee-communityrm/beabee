import {MigrationInterface, QueryRunner} from "typeorm";

export class MakeImageFieldNonNullable1646649663368 implements MigrationInterface {
    name = 'MakeImageFieldNonNullable1646649663368'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "poll" ALTER COLUMN "image" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "poll" ALTER COLUMN "image" DROP NOT NULL`);
    }

}
