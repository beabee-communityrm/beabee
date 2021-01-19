require('module-alias/register');

const config = require( '@config' );

const axios = require( 'axios' );
const crypto = require( 'crypto' );
const JSONStream = require( 'JSONStream' );
const gunzip = require( 'gunzip-maybe' );
const moment = require( 'moment' );
const tar = require( 'tar-stream' );

const mailchimp = require( '@core/mailchimp' );
const db = require( '@core/database' );
const { cleanEmailAddress } = require( '@core/utils' );

function emailToHash(email) {
	return crypto.createHash('md5').update(cleanEmailAddress(email)).digest('hex');
}

// Ignore 405s from delete operations
function validateStatus(statusCode, operationId) {
	return statusCode < 400 ||
		operationId.startsWith('delete') && (statusCode === 404 || statusCode === 405);
}

function memberToOperation(listId, member) {
	const emailHash = emailToHash(member.email);
	const path = 'lists/' + listId + '/members/' + emailHash;

	return member.isActiveMember ? {
		path,
		method: 'PATCH',
		body: JSON.stringify({
			email_address: member.email,
			merge_fields: {
				FNAME: member.firstname,
				LNAME: member.lastname,
				REFLINK: member.referralLink,
				POLLSCODE: member.pollsCode,
				C_DESC: member.contributionDescription,
				C_MNTHAMT: member.contributionMonthlyAmount,
				C_PERIOD: member.contributionPeriod
			},
			status: 'subscribed'
		}),
		operation_id: `add_${listId}_${emailHash}`
	} : {
		path,
		method: 'DELETE',
		operation_id: `delete_${listId}_${emailHash}`
	};
}

async function fetchMembers(startDate, endDate) {
	const dateFilter = {
		...startDate && {$gte: moment(startDate).toDate()},
		$lte: endDate ? moment(endDate).toDate() : new Date()
	};

	console.log('Start date:', startDate ? dateFilter.$gte.toISOString() : 'none');
	console.log('End date:', dateFilter.$lte.toISOString());

	console.log('# Fetching members');

	const permission = await db.Permissions.findOne({slug: 'member'});
	const members = await db.Members.find({
		permissions: {$elemMatch: {
			permission,
			$or: [
				{date_added: dateFilter},
				{date_expires: dateFilter}
			]
		}}
	});

	console.log(`Got ${members.length} members`);

	return members.map(member => {
		console.log(member.isActiveMember ? 'U' : 'D', member.email);

		return {
			firstname: member.firstname,
			lastname: member.lastname,
			email: member.email,
			referralLink: member.referralLink,
			isActiveMember: member.isActiveMember
		};
	});
}

async function processMembers(members) {
	const operations = config.mailchimp.lists
		.map(listId => members.map(memberToOperation.bind(null, listId)))
		.reduce((a, b) => [...a, ...b], []);

	const updates = operations.filter(o => o.method === 'PATCH').length;
	const deletes = operations.filter(o => o.method === 'DELETE').length;

	console.log(`Created ${operations.length} operations, ${updates} updates and ${deletes} deletes`);

	if (operations.length > 30) {
		return await createBatch(operations)
			.then(waitForBatch)
			.then(checkBatchErrors);
	} else {
		return await dispatchOperations(operations);
	}
}

async function createBatch(operations) {
	console.log('# Starting batch job');
	return await mailchimp.batches.create(operations);
}

async function waitForBatch(batch) {
	console.log('# Got update for batch', batch.id);
	console.log('Status:', batch.status);
	console.log(`Operations: ${batch.finished_operations}/${batch.total_operations}`);
	console.log('Errors:', batch.errored_operations);

	if (batch.status === 'finished') {
		return batch;
	} else {
		await new Promise(resolve => setTimeout(resolve, 5000));
		return await waitForBatch(await mailchimp.batches.get(batch.id));
	}
}

async function checkBatchErrors(batch) {
	console.log('# Checking errors');

	if (batch.errored_operations > 0) {
		console.log('Fetching response log file');

		const response = await axios({
			method: 'GET',
			url: batch.response_body_url,
			responseType: 'stream'
		});

		const extract = tar.extract();

		extract.on('entry', (header, stream, next) => {
			stream.on('end', next);

			if (header.type === 'file') {
				console.log('Checking file', header.name);
				stream.pipe(JSONStream.parse('*'))
					.on('data', data => {
						if (!validateStatus(data.status_code, data.operation_id)) {
							console.error(`Unexpected error for ${data.operation_id}, got ${data.status_code}`);
						}
					});
			} else {
				stream.resume();
			}

		});

		await new Promise((resolve, reject) => {
			response.data
				.pipe(gunzip())
				.pipe(extract)
				.on('error', reject)
				.on('finish', resolve);
		});
	} else {
		console.log('No errors');
	}
}

async function dispatchOperations(operations) {
	for (const operation of operations) {
		try {
			await mailchimp.instance({
				method: operation.method,
				url: operation.path,
				...operation.body && {data: JSON.parse(operation.body)},
				validateStatus: status => validateStatus(status, operation.operation_id)
			});
		} catch (err) {
			console.log(err);
		}
	}
}

db.connect(config.mongo).then(async () => {
	const isTest = process.argv[2] === '-n';
	try {
		const [startDate, endDate] = process.argv.slice(isTest ? 3 : 2);
		const members = await fetchMembers(startDate, endDate);
		if (!isTest) {
			await processMembers(members);
		}
	} catch (err) {
		console.error(err);
	}
	await db.close();
});
