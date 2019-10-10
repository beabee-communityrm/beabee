const mongoose = require( 'mongoose' );

module.exports = {
	name: 'PageSettings',
	schema: mongoose.Schema( {
		pattern: {
			type: String,
			required: true
		},
		shareUrl: String,
		shareTitle: String,
		shareDescription: String,
		shareImage: String
	} )
};

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
