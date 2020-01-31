const mongoose = require( 'mongoose' );

const ObjectId = mongoose.Schema.ObjectId;

module.exports = {
	name: 'PollAnswers',
	schema: mongoose.Schema( {
		poll: {
			type: ObjectId,
			ref: 'Polls',
			required: true
		},
		member: {
			type: ObjectId,
			ref: 'Members'
		},
		answer: {
			type: String,
			required: true
		},
		additionalAnswers: {
			type: Object
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
	})
};

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
