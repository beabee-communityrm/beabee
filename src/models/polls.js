const mongoose = require( 'mongoose' );

module.exports = {
	name: 'Polls',
	schema: mongoose.Schema( {
		date: {
			type: Date,
			required: true,
			default: Date.now
		},
		question: {
			type: String,
			required: true
		},
		slug: {
			type: String,
			required: true,
			unique: true
		},
		mergeField: String,
		closed: {
			type: Boolean,
			default: false
		},
		allowUpdate: Boolean
	} )
};

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
