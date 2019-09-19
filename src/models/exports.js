const mongoose = require( 'mongoose' );

module.exports = {
	name: 'Exports',
	schema: mongoose.Schema( {
		type: {
			type: String,
			required: true
		},
		description: {
			type: String,
			required: true
		},
		date: {
			type: Date,
			default: Date.now,
			required: true
		},
		params: {
			type: Object
		}
	} )
};

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
