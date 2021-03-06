import axios from 'axios';
import express from 'express';

import auth from '@core/authentication';
import { Members } from '@core/database';
import { log } from '@core/logging';
import { wrapAsync } from '@core/utils';

import config from '@config';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(auth.isAdmin);

interface PostcodeResponse {
	status: number
	result: {
		query: string
		result: {
			postcode: string
			latitude: number
			longitude: number
		}|null
	}[]
}

interface PostcodeCache {
	latitude: number,
	longitude: number
}

function cleanPostcode(postcode: string): string {
	return postcode.toLowerCase().replace(/\s/g, '').trim();
}

const postcodeCache: {[key: string]: PostcodeCache|null} = {};

async function getPostcodes(postcodes: string[]): Promise<PostcodeCache[]> {
	const cleanPostcodes = postcodes.map(cleanPostcode);

	const dedupedPostcodes = cleanPostcodes.filter((postcode, i) => cleanPostcodes.indexOf(postcode) === i);
	const unknownPostcodes = dedupedPostcodes.filter(postcode => postcodeCache[postcode] === undefined);
	log.info({
		app: 'map',
		action: 'get-postcodes',
	}, `Getting ${unknownPostcodes.length} postcodes`);

	for (let i = 0; i < unknownPostcodes.length; i += 100) {
		const unknownPostcodesSlice = unknownPostcodes.slice(i, i + 100);
		log.info({
			app: 'map',
			action: 'fetch-postcodes',
			data: unknownPostcodesSlice
		});
		const resp = await axios.post('https://api.postcodes.io/postcodes?filter=postcode,latitude,longitude', {
			postcodes: unknownPostcodesSlice
		});

		const data = resp.data as PostcodeResponse;
		for (const result of data.result) {
			postcodeCache[result.query] = result.result ? {
				latitude: result.result.latitude,
				longitude: result.result.longitude,
			} : null;
		}
	}

	return cleanPostcodes.map(postcode => postcodeCache[postcode]).filter((pc): pc is PostcodeCache => pc !== null);
}

app.get('/', (req, res) => {
	res.render('index');
});

app.get('/locations', wrapAsync(async (req, res) => {
	const members = await Members.find({
		'delivery_address.postcode': {$exists: 1},
		permissions: {$elemMatch: {
			permission: config.permission.memberId,
			date_expires: {$gte: new Date()}
		}},
	}, 'delivery_address.postcode');
	const memberPostcodes = members.map(m => m.delivery_address!.postcode!);
	const postcodes = await getPostcodes(memberPostcodes);
	res.send({postcodes});
}));

export default app;