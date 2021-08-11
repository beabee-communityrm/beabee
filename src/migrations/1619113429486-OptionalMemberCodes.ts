import { MigrationInterface, QueryRunner } from "typeorm";

export class OptionalMemberCodes1619113429486 implements MigrationInterface {
  name = "OptionalMemberCodes1619113429486";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member" ALTER COLUMN "referralCode" DROP NOT NULL`
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "member"."referralCode" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "member" ALTER COLUMN "pollsCode" DROP NOT NULL`
    );
    await queryRunner.query(`COMMENT ON COLUMN "member"."pollsCode" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON COLUMN "member"."pollsCode" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "member" ALTER COLUMN "pollsCode" SET NOT NULL`
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "member"."referralCode" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "member" ALTER COLUMN "referralCode" SET NOT NULL`
    );
  }
}
