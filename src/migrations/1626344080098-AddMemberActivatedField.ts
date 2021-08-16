import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMemberActivatedField1626344080098
  implements MigrationInterface
{
  name = "AddMemberActivatedField1626344080098";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member" ADD "activated" boolean NOT NULL DEFAULT false`
    );
    // Everyone was assumed activated before the field existed
    await queryRunner.query(`UPDATE "member" SET "activated"=true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member" DROP COLUMN "activated"`);
  }
}
