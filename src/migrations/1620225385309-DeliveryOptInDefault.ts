import { MigrationInterface, QueryRunner } from "typeorm";

export class DeliveryOptInDefault1620225385309 implements MigrationInterface {
  name = "DeliveryOptInDefault1620225385309";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "member_profile"."deliveryOptIn" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "member_profile" ALTER COLUMN "deliveryOptIn" SET DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "member_profile" ALTER COLUMN "deliveryOptIn" DROP DEFAULT`
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "member_profile"."deliveryOptIn" IS NULL`
    );
  }
}
