import axios from 'axios';
import crypto from 'crypto';
import gunzip from 'gunzip-maybe';
import JSONStream from 'JSONStream';
import tar from 'tar-stream';

import { log as mainLogger } from '@core/logging';
import { cleanEmailAddress } from '@core/utils';

import Member from '@models/Member';

import { NewsletterMember, NewsletterProvider } from '.';

const log = mainLogger.child({app: 'newsletter-service'});

interface MailchimpConfig {
	api_key: string
	datacenter: string
	list_id: string
}

interface Batch {
	id: string
	status: string
	finished_operations: number
	total_operations: number
	errored_operations: number
	response_body_url: string
}

interface OperationNoBody {
	method: 'GET'|'DELETE'|'POST'
	path: string
	operation_id: string
}

interface OperationWithBody {
	method: 'PUT'|'POST'
	path: string
	body: string
	operation_id: string;
}

type Operation = OperationNoBody|OperationWithBody;

interface OperationResponse {
	status_code: number
	response: string
	operation_id: string
}

type MergeFields = {
	FNAME: string
	LNAME: string
	[key: string]: string
}

interface MCMember {
	email_address: string
	merge_fields: MergeFields
}

function createInstance(config: MailchimpConfig) {
	const instance = axios.create({
		baseURL: `https://${config.datacenter}.api.mailchimp.com/3.0/`,
		auth: {
			username: 'user',
			password: config.api_key
		},
	});

	instance.interceptors.request.use(config => {
		log.debug({
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
			status: error.response.status,
			data: error.response.data
		}, 'MailChimp API returned with status ' + error.response.status);
		return Promise.reject(error);
	});

	return instance;
}

function memberToMCMember(member: Member): MCMember {
	return {
		email_address: member.email,
		merge_fields: {
			FNAME: member.firstname,
			LNAME: member.lastname,
			REFCODE: member.referralCode || '',
			POLLSCODE: member.pollsCode || '',
			C_DESC: member.contributionDescription,
			C_MNTHAMT: member.contributionMonthlyAmount?.toString() || '',
			C_PERIOD: member.contributionPeriod || ''
		}
	};
}

// Ignore 404/405s from delete operations
function validateOperationStatus(statusCode: number, operationId: string) {
	return statusCode < 400 ||
		operationId.startsWith('delete') && (statusCode === 404 || statusCode === 405);
}

export default class MailchimpProvider implements NewsletterProvider {
	private readonly instance;
	private readonly listId;

	constructor(config: MailchimpConfig) {
		this.instance = createInstance(config);
		this.listId = config.list_id;
	}

	async addTagToMembers(members: Member[], tag: string): Promise<void> {
		const operations: Operation[] = members.map(member => ({
			path: this.memberUrl(member.email) + '/tags',
			method: 'POST',
			body: JSON.stringify({
				tags: [{name: tag, status: 'active'}]
			}),
			operation_id: `tag_${member.id}`
		}));
		await this.dispatchOperations(operations);
	}

	async removeTagFromMembers(members: Member[], tag: string): Promise<void> {
		const operations: Operation[] = members.map(member => ({
			path: this.memberUrl(member.email) + '/tags',
			method: 'POST',
			body: JSON.stringify({
				tags: [{name: tag, status: 'inactive'}]
			}),
			operation_id: `tag_${member.id}`
		}));
		await this.dispatchOperations(operations);
	}

	async getMembers(): Promise<NewsletterMember[]> {
		const operation: Operation = {
			path: `lists/${this.listId}/members`,
			method: 'GET',
			operation_id: 'get'
		};

		const batch = await this.createBatch([operation]);
		const finishedBatch = await this.waitForBatch(batch);
		const members = await this.getBatchResponses(finishedBatch);
		return (members as MCMember[]).map(member => ({
			email: member.email_address,
			firstname: member.merge_fields.FNAME,
			lastname: member.merge_fields.LNAME
		}));
	}

	async updateMember(member: Member, oldEmail = member.email): Promise<void> {
		await this.instance.patch(this.memberUrl(oldEmail), memberToMCMember(member));
	}

	async updateMemberFields(member: Member, fields: Record<string, string>): Promise<void> {
		await this.instance.patch(this.memberUrl(member.email), {
			merge_fields: fields
		});
	}

	async upsertMembers(members: Member[], optIn: boolean, groups: string[] = []): Promise<void> {
		const operations: Operation[] = members.map(member => ({
			path: this.memberUrl(member.email),
			method: 'PUT',
			body: JSON.stringify({
				...memberToMCMember(member),
				status_if_new: optIn ? 'subscribed' : 'unsubscribed',
				interests: Object.assign({}, ...groups.map(group => ({[group]: true})))
			}),
			operation_id: `add_${member.id}`
		}));

		await this.dispatchOperations(operations);
	}

	async archiveMembers(members: Member[]): Promise<void> {
		const operations: Operation[] = members.map(member => ({
			path: this.memberUrl(member.email),
			method: 'DELETE',
			operation_id: `delete_${member.id}`
		}));
		await this.dispatchOperations(operations);
	}

	async deleteMembers(members: Member[]): Promise<void> {
		const operations: Operation[] = members.map(member => ({
			path: this.memberUrl(member.email) + '/actions/permanently-delete',
			method: 'POST',
			operation_id: `delete-permanently_${member.id}`
		}));
		await this.dispatchOperations(operations);
	}

	private memberUrl(email: string) {
		const emailHash = crypto.createHash('md5').update(cleanEmailAddress(email)).digest('hex');
		return `lists/${this.listId}/members/${emailHash}`;
	}

	private async createBatch(operations: Operation[]): Promise<Batch> {
		log.info({
			action: 'create-batch',
			data: {
				operationCount: operations.length
			}
		});
		const response = await this.instance.post('/batches/', {operations});
		return response.data as Batch;
	}

	private async waitForBatch(batch: Batch): Promise<Batch> {
		log.info({
			action: 'wait-for-batch',
			data: {
				batchId: batch.id,
				finishedOperations: batch.finished_operations,
				totalOperations: batch.total_operations,
				erroredOperations: batch.errored_operations
			}
		});

		if (batch.status === 'finished') {
			return batch;
		} else {
			await new Promise(resolve => setTimeout(resolve, 5000));
			return await this.waitForBatch((await this.instance.get('/batches/' + batch.id)).data);
		}
	}

	private async getBatchResponses(batch: Batch): Promise<any[]> {
		log.info({
			action: 'get-batch-responses',
			data: {
				batchId: batch.id,
				finishedOperations: batch.finished_operations,
				totalOperations: batch.total_operations,
				erroredOperations: batch.errored_operations
			}
		});


		const batchResponses: any[] = [];

		const response = await axios({
			method: 'GET',
			url: batch.response_body_url,
			responseType: 'stream'
		});

		const extract = tar.extract();

		extract.on('entry', (header, stream, next) => {
			stream.on('end', next);

			if (header.type === 'file') {
				log.info({
					action: 'checking-batch-error-file',
					data: {
						name: header.name
					}
				});
				stream.pipe(JSONStream.parse('*'))
					.on('data', (data: OperationResponse) => {
						if (validateOperationStatus(data.status_code, data.operation_id)) {
							log.error({
								action: 'check-batch-errors',
								data
							}, `Unexpected error for ${data.operation_id}, got ${data.status_code}`);
						} else {
							batchResponses.push(JSON.parse(data.response));
						}
					});
			} else {
				stream.resume();
			}

		});

		return await new Promise((resolve, reject) => {
			response.data
				.pipe(gunzip())
				.pipe(extract)
				.on('error', reject)
				.on('finish', () => resolve(batchResponses));
		});
	}

	private async dispatchOperations(operations: Operation[]): Promise<void> {
		if (operations.length > 20) {
			const batch = await this.createBatch(operations);
			const finishedBatch = await this.waitForBatch(batch);
			await this.getBatchResponses(finishedBatch); // Just check for errors
		} else {
			for (const operation of operations) {
				try {
					await this.instance({
						method: operation.method,
						url: operation.path,
						...operation.method === 'PUT' && {data: JSON.parse(operation.body)},
						validateStatus: (status: number) => validateOperationStatus(status, operation.operation_id)
					});
				} catch (err) {
					console.log(err);
				}
			}
		}
	}
}
