var oauth = require('../shared/oauth.client.js');

//Static store of oauth clients
function ostore(config) {
	
	var base = this;

	//Init the store
	base.store = [];

	//Create the store from the config file
	for(var kind in config) {
		base.store[kind] = new oauth(config[kind]);
	}
};

ostore.prototype.get = function(kind) {

	return(this.store[kind]);
};

module.exports = ostore;