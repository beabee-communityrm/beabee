import moment from 'moment';
import { Brackets, EntityRepository, Repository } from 'typeorm';

import { Notice } from '@models/Notice';

@EntityRepository(Notice)
export default class NoticeRespository extends Repository<Notice> {
	async findActive(): Promise<Notice[]> {
		return this.createQueryBuilder('notice')
			.where('notice.enabled = TRUE')
			.andWhere(new Brackets(qb => {
				qb.where('notice.expires IS NULL')
					.orWhere('notice.expires > :now', {now: moment.utc().toDate()});
			}))
			.getMany();
	}
}
