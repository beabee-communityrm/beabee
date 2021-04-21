import axios from 'axios';
import crypto from 'crypto';
import gunzip from 'gunzip-maybe';
import JSONStream from 'JSONStream';
import tar from 'tar-stream';

import { log as mainLogger } from '@core/logging';
import { cleanEmailAddress } from '@core/utils';

import Member from '@models/Member';

import { NewsletterProvider } from '.';

const log = mainLogger.child({app: 'newsletter-service'});

interface MailchimpConfig {
	api_key: string
	datacenter: string
}

interface Batch {
	id: string
	status: string
	finished_operations: number
	total_operations: number
	errored_operations: number
	response_body_url: string
}

interface DeleteOperation {
	method: 'DELETE'|'POST'
	path: string
	operation_id: string
}
interface PutOperation {
	method: 'PUT'
	path: string
	body: string
	operation_id: string;
}

type Operation = DeleteOperation|PutOperation;

type MergeFields = {[key: string]: string}

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

function mcMemberUrl(listId: string, email: string) {
	const emailHash = crypto.createHash('md5').update(cleanEmailAddress(email)).digest('hex');
	return `lists/${listId}/members/${emailHash}`;
}

function memberToMCMember(member: Member): MCMember {
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

// Ignore 404/405s from delete operations
function validateStatus(statusCode: number, operationId: string) {
	return statusCode < 400 ||
		operationId.startsWith('delete') && (statusCode === 404 || statusCode === 405);
}

export default class MailchimpProvider implements NewsletterProvider {
	private readonly instance;

	constructor(config: MailchimpConfig) {
		this.instance = createInstance(config);
	}

	async updateMember(listId: string, member: Member, oldEmail = member.email): Promise<void> {
		await this.instance.patch(mcMemberUrl(listId, oldEmail), memberToMCMember(member));
	}

	async upsertMembers(listId: string, members: Member[]): Promise<void> {
		const operations: PutOperation[] = members.map(member => ({
			path: mcMemberUrl(listId, member.email),
			method: 'PUT',
			body: JSON.stringify({
				...memberToMCMember(member),
				status_if_new: 'subscribed'
				/*interests: Object.assign(
					{},
					..config.mailchimp.mainListGroups.map(group => ({[group]: true}))
				),*/
			}),
			operation_id: `add_${listId}_${member.id}`
		}));

		await this.dispatchOperations(operations);
	}

	async archiveMembers(listId: string, members: Member[]): Promise<void> {
		const operations: DeleteOperation[] = members.map(member => ({
			path: mcMemberUrl(listId, member.email),
			method: 'DELETE',
			operation_id: `delete_${listId}_${member.id}`
		}));
		await this.dispatchOperations(operations);
	}

	async deleteMembers(listId: string, members: Member[]): Promise<void> {
		const operations: DeleteOperation[] = members.map(member => ({
			path: mcMemberUrl(listId, member.email) + '/actions/permanently-delete',
			method: 'POST',
			operation_id: `delete-permanently_${listId}_${member.id}`
		}));
		await this.dispatchOperations(operations);
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
			return await this.waitForBatch(await this.instance.get('/batches/' + batch.id));
		}
	}

	private async checkBatchErrors(batch: Batch): Promise<boolean> {
		log.info({
			action: 'check-batch-errors',
			data: {
				batchId: batch.id,
				erroredOperations: batch.errored_operations
			}
		});


		if (batch.errored_operations > 0) {
			let isValidBatch = true;

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
						.on('data', (data: any) => {
							if (!validateStatus(data.status_code, data.operation_id)) {
								isValidBatch = false;
								log.error({
									action: 'check-batch-errors',
								}, `Unexpected error for ${data.operation_id}, got ${data.status_code}`);
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
					.on('finish', () => resolve(isValidBatch));
			});
		} else {
			return true;
		}
	}

	private async dispatchOperations(operations: Operation[]): Promise<void> {
		if (operations.length > 20) {
			const batch = await this.createBatch(operations);
			await this.waitForBatch(batch);
			await this.checkBatchErrors(batch);
		} else {
			for (const operation of operations) {
				try {
					await this.instance({
						method: operation.method,
						url: operation.path,
						...operation.method === 'PUT' && {data: JSON.parse(operation.body)},
						validateStatus: (status: number) => validateStatus(status, operation.operation_id)
					});
				} catch (err) {
					console.log(err);
				}
			}
		}
	}
}
