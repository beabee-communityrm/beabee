import fs from 'fs';
import path from 'path';

import {MigrationInterface, QueryRunner} from 'typeorm';

export class SessionTable1616677358190 implements MigrationInterface {

	public async up(queryRunner: QueryRunner): Promise<void> {
		const sessionSqlPath = path.join(__dirname, 'session.sql');
		const sessionSql = fs.readFileSync(sessionSqlPath).toString();
		await queryRunner.query(sessionSql);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('DROP TABLE session');

	}

}
