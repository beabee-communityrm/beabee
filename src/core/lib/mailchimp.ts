import axios from 'axios';
import crypto from 'crypto';
import config from '@config';

import { log } from '@core/logging' ;
import { cleanEmailAddress } from '@core/utils' ;
import Member from '@models/Member';

export interface Batch {
	id: string
	status: string
	finished_operations: number
	total_operations: number
	errored_operations: number
	response_body_url: string
}

export interface DeleteOperation {
	method: 'DELETE'
	path: string
	operation_id: string
}
export interface PatchOperation {
	method: 'PATCH'
	path: string
	body: string
	operation_id: string;
}

export type Operation = DeleteOperation|PatchOperation;

interface List {
	members: {
		create(email: string, data?: any): Promise<void>
		upsert(email: string, data?: any): Promise<void>
		update(email: string, data?: any): Promise<void>
		delete(email: string): Promise<void>
		permanentlyDelete(email: string): Promise<void>
	}
}

type MergeFields = {[key: string]: string}
interface MCMember {
	email_address: string
	merge_fields: MergeFields
}

function createInstance(endpoint: string) {
	const instance = axios.create({
		baseURL: `https://${config.mailchimp.datacenter}.api.mailchimp.com/3.0${endpoint}`,
		auth: {
			username: 'user',
			password: config.mailchimp.api_key
		}
	});

	instance.interceptors.request.use(config => {
		log.debug({
			app: 'mailchimp' + endpoint,
			url: config.url,
			method: config.method,
			sensitive: {
				params: config.params,
				data: config.data
			}
		});

		return config;
	});

	instance.interceptors.response.use(response => {
		return response;
	}, error => {
		log.error({
			app: 'mailchimp' + endpoint,
			status: error.response.status,
			data: error.response.data
		}, 'MailChimp API returned with status ' + error.response.status);
		return Promise.reject(error);
	});

	return instance;
}

function emailToHash(email: string) {
	return crypto.createHash('md5').update(cleanEmailAddress(email)).digest('hex');
}

function lists(listId: string): List {
	const listInstance = createInstance('/lists/' + listId);

	return {
		members: {
			async create(email, data) {
				await listInstance.post('/members', {
					email_address: email,
					...data
				});
			},
			async upsert(email, data) {
				await listInstance.put('/members/' + emailToHash(email), data);
			},
			async update(email, data) {
				await listInstance.patch('/members/' + emailToHash(email), data);
			},
			async delete(email) {
				await listInstance.delete('/members/' + emailToHash(email));
			},
			async permanentlyDelete(email: string) {
				await listInstance.post('/members/' + emailToHash(email) + '/actions/delete-permanent');
			}
		}
	};
}

const batchInstance = createInstance('/batches');

const mainListInstance = lists(config.mailchimp.mainList);

export function memberToMCMember(member: Member): MCMember {
	return {
		email_address: member.email,
		merge_fields: {
			FNAME: member.firstname,
			LNAME: member.lastname,
			REFCODE: member.referralCode,
			POLLSCODE: member.pollsCode,
			C_DESC: member.contributionDescription,
			C_MNTHAMT: member.contributionMonthlyAmount?.toString() || '',
			C_PERIOD: member.contributionPeriod || ''
		}
	};
}

export default {
	instance: createInstance(''),
	lists,
	batches: {
		async create(operations: Operation[]): Promise<Batch> {
			const response = await batchInstance.post('/', {operations});
			return response.data as Batch;
		},
		async get(batchId: string): Promise<Batch> {
			const response = await batchInstance.get('/' + batchId);
			return response.data as Batch;
		}
	},
	mainList: {
		async addMember(member: Member): Promise<void> {
			await mainListInstance.members.upsert(member.email, {
				...memberToMCMember(member),
				interests: Object.assign(
					{},
					...config.mailchimp.mainListGroups.map(group => ({[group]: true}))
				),
				status_if_new: 'subscribed'
			});
		},
		async updateMemberDetails(member: Member, oldEmail=member.email): Promise<void> {
			await mainListInstance.members.update(oldEmail, memberToMCMember(member));
		},
		async updateMemberFields(member: Member, fields: MergeFields): Promise<void> {
			await mainListInstance.members.update(member.email, {
				merge_fields: fields
			});
		},
		async permanentlyDeleteMember(member: Member): Promise<void> {
			await mainListInstance.members.permanentlyDelete(member.email);
		}
	}
};
