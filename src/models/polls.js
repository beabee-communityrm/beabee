const mongoose = require( 'mongoose' );

module.exports = {
	name: 'Polls',
	schema: mongoose.Schema( {
		question: {
			type: String,
			required: true
		},
		slug: {
			type: String,
			required: true
		},
		closed: {
			type: Boolean
		}
	} )
};

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
