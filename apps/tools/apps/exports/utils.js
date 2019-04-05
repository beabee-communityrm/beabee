module.exports = {
	isLocalPostcode: postcode => (
		/^BS\d\D?$/.test(postcode.replace(/ /g, '').slice(0, -3))
	)
};
