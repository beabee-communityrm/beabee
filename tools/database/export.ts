import 'module-alias/register';

import { serialize, deserialize, Document, EJSON } from 'bson';
import _ from 'lodash';

import config from '@config';
import * as db from '@core/database';
import exportTypes, { ModelData, ModelExporter, Properties } from './types';

// Anonymise properties but maintain same mapping to keep links
const valueMap = {};
function anonymiseProperties(item: Document, properties: Properties): Document {
	const newItem = deserialize(serialize(item));

	_.forEach(properties, (anonymiseFn, property) => {
		const value = _.get(item, property);
		if (value) {
			let newValue: unknown;
			if (_.isArray(value)) {
				newValue = value.map(valueItem => anonymiseProperties(valueItem, anonymiseFn() as Properties));
			} else {
				newValue = valueMap[value] || anonymiseFn();
				valueMap[value] = newValue;
			}
			_.set(newItem, property, newValue);
		}
	});

	return newItem;
}

async function runExport({model, properties}: ModelExporter): Promise<ModelData> {
	console.error('Fetching', model.modelName);

	const items = await model.find({}).lean();

	console.error(`Anonymising ${model.modelName}, got ${items.length} items`);
	const newItems = properties ? items.map(item => anonymiseProperties(item, properties)) : items;

	return {
		modelName: model.modelName,
		items: newItems
	};
}

async function main() {
	const exportData = await Promise.all(exportTypes.map(runExport));
	console.log(EJSON.stringify(exportData));
}

db.connect(config.mongo).then(async () => {
	try {
		await main();
	} catch (err) {
		console.error(err);
	}
	await db.close();
});
