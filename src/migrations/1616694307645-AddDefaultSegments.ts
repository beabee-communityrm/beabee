import fs from 'fs';
import path from 'path';

import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddDefaultSegments1616694307645 implements MigrationInterface {

	public async up(queryRunner: QueryRunner): Promise<void> {
		const sqlPath = path.join(__dirname, 'defaultSegments.sql');
		await queryRunner.query(fs.readFileSync(sqlPath).toString());
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('DELETE FROM segment WHERE id IN ($1, $2, $3, $4)', [
			'81664449-adf2-4c3a-aee2-145a96d67726',
			'ce1b2919-85c1-4134-8231-df6b860c0ae2',
			'f66f45bd-d406-45f6-87da-34d2cd55297a',
			'6a233a3b-74f6-4af8-b4cf-e5070a32746a'
		]);
	}

}
