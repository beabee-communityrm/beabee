(function () {
	var m = /memberId=([a-z0-9-]+)/.exec(document.cookie);
	window.Membership = {
		memberId: m && m[1]
	};
})();
