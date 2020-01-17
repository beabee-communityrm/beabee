const moment = require( 'moment' );
const mongoose = require( 'mongoose' );

const ObjectId = mongoose.Schema.ObjectId;

module.exports = {
	name: 'SpecialUrls',
	schema: mongoose.Schema( {
		group: {
			type: ObjectId,
			ref: 'SpecialUrlGroups',
			required: true
		},
		expires: Date,
		actionParams: [Object],
		openCount: {
			type: Number,
			default: 0
		}
	}, {
		timestamps: true
	} )
};

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
