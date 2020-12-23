const { default: OptionsService } = require('./services/OptionsService');

module.exports = function( req, res, next ) {
	var flash = req.flash(),
		flashes = [],
		types = Object.keys( flash );

	for ( var t in types ) {
		var key = types[ t ];
		var messages = flash[ key ];

		for ( var m in messages ) {
			var message = messages[ m ];
			var option = OptionsService.getText( 'flash-' + message );

			if ( ! option ) {
				option = message;
			}

			flashes.push( {
				type: key == 'error' ? 'danger' : key,
				message: option
			} );
		}
	}
	res.locals.flashes = flashes;
	next();
};
