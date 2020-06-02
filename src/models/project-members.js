const mongoose = require( 'mongoose' );

const ObjectId = mongoose.Schema.ObjectId;

module.exports = {
	name: 'ProjectMembers',
	schema: mongoose.Schema( {
		project: {
			type: ObjectId,
			ref: 'Members',
			required: true
		},
		member: {
			type: ObjectId,
			ref: 'Members',
			required: true
		},
		contact: [ {
			date: {
				type: Date,
				required: true,
				default: Date.now
			},
			channel: String
		} ]
	} )
};

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
