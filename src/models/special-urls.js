const moment = require( 'moment' );
const mongoose = require( 'mongoose' );
const { v4: uuidv4 } = require('uuid');

const ObjectId = mongoose.Schema.ObjectId;

module.exports = {
	name: 'SpecialUrls',
	schema: mongoose.Schema( {
		uuid: {
			type: String,
			required: true,
			unique: true,
			default: uuidv4
		},
		group: {
			type: ObjectId,
			ref: 'SpecialUrlGroups',
			required: true
		},
		email: {
			type: String,
			required: true
		},
		firstname: {
			type: String,
			required: true
		},
		lastname: {
			type: String,
			required: true
		},
		expires: Date,
		openCount: {
			type: Number,
			default: 0
		},
		completedCount: {
			type: Number,
			default: 0
		},
		exports: [ {
			export_id: {
				type: ObjectId,
				ref: 'Exports',
				required: true
			},
			status: {
				type: String,
				required: true
			}
		} ]
	}, {
		timestamps: true
	} )
};

module.exports.schema.virtual( 'active' ).get( function () {
	return !this.expires || moment.utc(this.expires).isAfter();
});

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
