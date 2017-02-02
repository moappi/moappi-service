var OAuth = require('../shared/oauth/node.oauth.js'),
    path = require('path');

exports.oauth=function(config) {

	var base = this;

	//Set the config
	base.config = config;

	//Check to make sure we have eveything we need in the config
	base.config.flow = base.config.flow || {};
	base.config.keys = base.config.keys || {};
	base.config.requests = base.config.requests || {};
	base.config.options = base.config.options || {};

	//Set the version
	base.version = config.version;

	//Create the access points
	base.access = {};

	//Create the oauth object based on the version
	switch(base.config.version) {
	
		case '1.0':

			//Set oauth
			base.oa = new OAuth.OAuth(base.config.flow.request.url,
						base.config.access.url,
						base.config.keys.consumer,
						base.config.keys.secret,
						base.config.version,
						base.config.access_uri.url,
						base.config.signature);
			
			//Set the access methods
			base.access.get = function(url, oauth_token, oauth_token_secret, callback) {
				base.oa.get(url, oauth_token, oauth_token_secret, callback);
			};

			base.access.post = function(url, oauth_token, oauth_token_secret, post_body, post_content_type, callback) { 
				base.oa.post(url, oauth_token, oauth_token_secret, post_body, post_content_type, callback);
			}
		break;

		
		case '2.0':

			//Create a new OAuth method
			base.oa = new OAuth.OAuth2(
				base.config.keys.consumer,
				base.config.keys.secret,
				'',
				base.config.flow.authorize.url,
				base.config.flow.token.url);

			//Add other config options
			if(base.config.options) {
				if(base.config.options.useAuthHeader) base.oa.useAuthorizationHeaderforGET(base.config.options.useAuthHeader);
				if(base.config.options.authMethod) base.oa.setAuthMethod(base.config.options.authMethod);
				if(base.config.options.authTokenName) base.oa.setAccessTokenName(base.config.options.authTokenName);
			}

			//Define the methods for get & post
			base.access.get = function(url, oauth_token, oauth_token_secret, callback) {
				base.oa.get(url, oauth_token, callback);
			};

			base.access.post = function(url, oauth_token, oauth_token_secret, post_body, post_content_type, callback) { 
				base.oa.post(url, oauth_token, post_body, callback); 
			};
		break;
	}
};


//Define the methods for get & post
exports.oauth.prototype.get = function(url, oauth_token, oauth_token_secret, callback) {
		this.access.get.call(this,url, oauth_token, oauth_token_secret, callback);
};

exports.oauth.prototype.post = function(url, oauth_token, oauth_token_secret, post_body, post_content_type, callback) { 
		this.access.post.call(this,url, oauth_token, oauth_token_secret, post_body, post_content_type, callback);
};