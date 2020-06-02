const mongoose = require( 'mongoose' );

const ObjectId = mongoose.Schema.ObjectId;

module.exports = {
	name: 'Projects',
	schema: mongoose.Schema( {
		date: {
			type: Date,
			required: true,
			default: Date.now
		},
		owner: {
			type: ObjectId,
			ref: 'Members',
			required: true
		},
		title: {
			type: String,
			required: true
		},
		description: {
			type: String,
			required: true
		},
		status: {
			type: String,
			required: true
		},
		polls: [ {
			type: ObjectId,
			ref: 'Polls',
			required: true
		} ]
	} )
};

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
