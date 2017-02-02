var ostore = require('./ostore.js'),
    path = require('path'),
	tokenizer = require("../shared/tokenizer.js"),
	url = require('url'),
	guid = require('../shared/guid.js'),
	cors = require('../shared/cors.js');

var config,api,service,app,domain,oStore;

function init(_config) {
	
	//App config
	config = _config.config;
	
	//API, App (express)
	api = _config.api;
	app = _config.app;

	//Service Config
	service = _config.service;

	//App url (for callback)
	domain = {'name':_config.name,'domain':_config.domain};
	
	//Add the access_uri to the config (only way that I can figure we can do this)
	for(var kind in config.oauth) 
		if(config.oauth[kind].version === '1.0') config.oauth[kind].flow.access_uri = {"url":getAccessURI(kind,'callback')};
	
	//Create a new oauth store
	// from the oauth providers
	oStore = new ostore(config.oauth);

	//Request an OAuth Request Token, and redirects the user to authorize it
	app.get('/oauth/:kind', function(req, res) {

		//Get the oauth obj
		var oauth = oStore.get(req.params.kind);

		//Check to make sure we have one of this kind in the store
		if(!oauth) return res.status(404).send('Not found');

		if(oauth.config.trace) console.log('TRACE MOAPPI.OAUTH: Authorization flow for oauth/' + req.params.kind + ' started..');
		
		//Determine which version
		switch(oauth.config.version) {
		
			case '1.0':

				oauth.oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results){
	
				  if(error) {
					console.error("ERROR MOAPPI.OAUTH OAuth Login Error (" + JSON.stringify(error) + ")");
					res.status(401).send("OAuth Login Error:" + JSON.stringify(error));
				  } else { 
					  
						//Create the oauth in the session (if required)
						if(!req.session.oauth) req.session.oauth = {};
						
						//Create this kind of session
						req.session.oauth[req.params.kind] = {
							'token':oauth_token,
							'secret':oauth_token_secret
						};
					
						// redirect the user to authorize the token
						res.redirect(oauth.config.flow.authorize.url + "?oauth_token=" + oauth_token + "&oauth_callback=" + getAccessURI(req.params.kind,'callback'));
				  }
				});
			break;
			
			case '2.0':

				//Get the authorization header from the config file (if we have one)
				var params = oauth.config.flow.authorize.params || {};

				//Add the redirect_uri to the params
				params['redirect_uri'] = getAccessURI(req.params.kind,'token');

				//Create the oauth in the session
				if(!req.session.oauth) req.session.oauth = {};
				
				//Create the oauth for this kind in the session
				if(!req.session.oauth[req.params.kind]) req.session.oauth[req.params.kind] = {};

				//SECURITY - Create a new state for this request that we will store in the session to stop forgery attempts
				params.state = guid.get();

				//Store the state in the session to compare later
				req.session.oauth[req.params.kind].state = params.state;

				//Set the redirect
				// if we have a href and we're allowed to redirect using href
				if(req.query && oauth.config.flow.redirect)
					if(req.query.href && oauth.config.flow.redirect.href) {
						
						var href = url.parse(req.query.href);

						//Make sure the host matches this host (for security)
						if(href.host !== req.headers.host) {
							if(oauth.config.trace) console.log('TRACE MOAPPI.OAUTH: oauth/' + req.params.kind,'unable to redirect, domain mismatch - found',href.host,'expected',req.headers.host);
						} else {
							//Save the href in the session, so we can redirect later
							req.session.oauth[req.params.kind].redirect = req.query.href;
							
							if(oauth.config.trace) console.log('TRACE MOAPPI.OAUTH: oauth/' + req.params.kind + ' query redirect ',req.query.href);
						}	
					}
						
				//Get the authorization redirect
				var redirect = oauth.oa.getAuthorizeUrl(params);
				if(oauth.config.trace) console.log('TRACE MOAPPI.OAUTH: oauth/' + req.params.kind + ' redirected to ' + redirect);
				res.redirect(redirect);
			break;

			default:
				 //Check to make sure we have one of this kind in the store
				res.status(404).send('Not found');
			break;
		}
	});
	
	//OAUTH 2.0 only
	app.get('/oauth/:kind/token', function(req, res) {

		//Get the oauth obj
		var oauth = oStore.get(req.params.kind);

		//Check to make sure we have one of this kind in the store
		if(!oauth) return res.status(404).send('Not Found');

		switch(oauth.config.version) {
		
			case '2.0':

				//Make sure we have a parameter for the code
				var _code = oauth.config.options.code || "code";

				//Get the code
				var code = req.query.code;

				//Get the code
				if(!code) return res.status(404).send('Not Found');
				
				//Verify the session
				if(!req.session.oauth) return res.status(401).send('Not Authorized - OAUTH.' + req.params.kind.toUpperCase() + ' (Invalid Session)');
				
				//Create the oauth for this kind in the session
				if(!req.session.oauth[req.params.kind]) return res.status(401).send('Not Authorized - OAUTH.' + req.params.kind.toUpperCase() + ' (Invalid Session)');
				
				//SECURITY - Verify the state against that found in the session
				//  prevent Cross-Site Request Forgery requests
				if(req.session.oauth[req.params.kind].state !== req.query.state) return res.status(401).send('Not Authorized - OAUTH.' +  req.params.kind.toUpperCase() + ' (Invalid State)');

				//Get the token custom parameters
				var params = oauth.config.flow.token.params || {};

				//Set the redirect_uri to this page (Dropbox required)
				params['redirect_uri'] = getAccessURI(req.params.kind,'token');

				if(oauth.config.trace) console.log('TRACE MOAPPI.OAUTH: oauth/',req.params.kind,'/token code ',code);

				// Obtaining access_token
				oauth.oa.getOAuthAccessToken(
					code,
					params,
					function(e, access_token, refresh_token, results){
						
						if(e) {
							console.error('ERROR MOAPPI.OAUTH oauth/ ' + req.params.kind + ' Unable to aquire token (' + JSON.stringify(e) + ')');
							res.status(200).send("<b>Error</b> Unable to authenticate to " + req.params.kind);
						} else {
							
							try {
								//Store the access token in the session
								req.session.oauth[req.params.kind].access = {
									'refresh':refresh_token,
									'token':access_token
								};
								
								//Put the data into a new data property
								req.session.oauth[req.params.kind].data = {};
								
								if(oauth.config.trace) console.log('TRACE MOAPPI.OAUTH: oauth/' + req.params.kind + '/token access token returned ',access_token);

								//Save the response output to the session (for use later)
								if(results) for(var prop in results) req.session.oauth[req.params.kind].data[prop] = results[prop];

								//Call the oauth.connection event with the response
								api.events.emit('oauth','connection',{"kind":req.params.kind,"data":results});

								//Redirect to the href page
								if(req.session.oauth[req.params.kind].redirect) {
									if(oauth.config.trace) console.log('TRACE MOAPPI.OAUTH: oauth/' + req.params.kind + '/token param redirect ',req.session.oauth[req.params.kind].redirect);
									return res.redirect(req.session.oauth[req.params.kind].redirect);
								}

								//Redirect to the page specified in the params
								if(config.oauth[req.params.kind].flow.redirect.url) {
									if(oauth.config.trace) console.log('TRACE MOAPPI.OAUTH: oauth/' + req.params.kind + '/token url redirect ',config.oauth[req.params.kind].flow.redirect.url);
									return res.redirect(config.oauth[req.params.kind].flow.redirect.url);
								}
								
								if(oauth.config.trace) console.log('TRACE MOAPPI.OAUTH: oauth/' + req.params.kind + '/token default redirect ',config.static.default);

								//Otherwise redirect to the default page
								res.redirect(config.static.default);
							} catch(err) {
								console.error('ERROR MOAPPI.OAUTH oauth/' + req.params.kind + '/token ',JSON.stringify(err));
								res.status(200).send("<b>Error</b> Unable to authenticate to " + req.params.kind);
							}
						}
				});
			break;

			default:
				res.status(404).send('Not supported');
			break;
		}
	});
		
	//OAUTH 1.0 only
	app.get('/oauth/:kind/callback', function(req, res) {
		
		//Get the oauth obj
		var oauth = oStore.get(req.params.kind);

		//Check to make sure we have one of this kind in the store
		if(!oauth) return res.status(404).send('Not Found');

		//Verify that we pass the CORS test
		if(!cors.pass(req,oauth.config.cors)) return res.status(403).send('Forbidden');

		//Check to make sure we are logged on to this oauth provider
		if(!req.session.oauth[req.params.kind]) return res.status(404).send('Not Found');

		oauth.oa.getOAuthAccessToken(
			req.session.oauth[req.params.kind].token, 
			req.session.oauth[req.params.kind].secret, 
			req.param('oauth_verifier'), 
			function(error, oauth_access_token, oauth_access_token_secret, results2) {
				
				if(error) {
					console.error("ERROR MOAPPI.OAUTH OAuth callback error (" + JSON.stringify(error) + ")");
					res.status(401).send("<b>Error</b> Unable to authenticate to " + req.params.kind);
				}
				else {
			
					// store the access token in the session
					req.session.oauth[req.params.kind].access = {
						'token':oauth_access_token,
						'secret':oauth_access_token_secret
					};

					//Save the response output to the session (for use later)
					if(results2) for(var prop in results2) req.session[prop] = results2[prop];
					
					//Call the oauth.connection event with the response
					api.events.emit('oauth','connection',results2);

					//Redirect to the application page
					if(config.oauth[req.params.kind].flow.redirect) res.redirect(config.oauth[req.params.kind].flow.redirect);
					else res.redirect(config.static.default);
				}

		});
	});
	
	//Setup the method to make calls to the api for this 
	// ONLY allow for post
	// ONLY allows for OAUTH 2.0 
	app.post('/oauth/:kind/call/:request', function(req,res){

		//console.log('OAUTH.POST RECEIVED',req.params.kind,'/',req.params.request);

		//Merge the query parameter with the body
		var params = req.query;
		for(prop in req.body) { 
			if (prop in params) { continue; }
			params[prop] = req.body[prop];
		}

		//Process the request
		processRequest(req.params.kind, req.params.request, params, req.session,  function(err,obj){

			//If we have an error
			if(err) {
				
				//Determine what type it is
				switch(err.type){
					
					//CORS error
					case "cors":
						res.status(403).send(err.msg);
					break;
					
					//Authothorized access
					case "unauthorized":
						res.end( JSON.stringify(api.json(getError(service.authFail,err.msg))) );
					break;

					//oauth, notconfigured error
					default:
						res.end( JSON.stringify(api.json(getError(undefined,err.msg))) );
					break;
				}
			} else {

				//Spit out the result (make sure we format into json
				res.end(getResponse(err,obj,{"kind":req.params.kind,"request":req.params.request}));
			}
		},req);
	});
}

function processRequest(kind,request,params,session,callback,req) {

	//Get the oauth obj
	var oauth = oStore.get(kind);

	if(!oauth) return callback({"type":"notconfigured","msg":"OAUTH provider not configured (" + kind + ")"});

	//Verify that we pass the CORS test
	// if we are using a request
	if(req)
		if(!cors.pass(req,oauth.config.cors)) return callback({"type":"cors","msg":"Forbidden"});

	//Check to make sure we are authenticated first
	if(!session.oauth) return callback({"type":"unauthorized","msg":"Unathorized"});
	if(!session.oauth[kind]) return callback({"type":"unauthorized","msg":"Unathorized"});
	if(!session.oauth[kind].access) return callback({"type":"unauthorized","msg":"Unathorized"});
	
	//Build the token object
	// access : access token
	// refreh : refresh token
	var token = {
		"access":session.oauth[kind].access.token,
		"refresh":session.oauth[kind].access.refresh
	};

	//Make the call to the oauth client
	// this will take care of any refresh token updates etc..
	oauth.call(request,token,params,function(err,obj){
		
		if(err) return callback({"type":"oauth","msg":err});
		else return callback(undefined,obj);

	},function(access_token){
	
		//Refresh token secured another new token
		session.oauth[kind].access.token = access_token;

		//Call the oauth.refresh event with the token
		api.events.emit('oauth','refresh',{'kind':kind,'token':access_token,'session':session});
	});
		
}

exports.init = init;
exports.process = processRequest;

//URI access helper
function getAccessURI(kind,func) {
	return('https://' + path.join(domain.name + '.' + domain.domain,'oauth',kind,func));
}

//Moappi formatted error message
function getError(_detail,_error) {
	return({'detail':_detail,'message':_error});
}

//Callback function used to handle oauth output
function getResponse(error, data, request) {
	
	if(error) {

		if(typeof error === "object") {
			try{
				error = JSON.strigify(error);
			} catch(e) {
			}
		}

		var msg = error;

		if(!config.api.debug.error) msg = 'Request Failed';
	
		//Log the error
		// TODO with the request!
		console.error("ERROR MOAPPI.OAUTH ",request.kind,"/",request.request,error);

		return( JSON.stringify(api.json(getError(undefined,msg))) );
	} else {

		var out;

		//Make sure we have data
		if(data) {

			//Try parsing the data as json
			try {

				//Parse the data
				out = JSON.parse(data);
			} catch(e) {

				//Ok so this isn't json
				out = data;
			}
		}

		return( JSON.stringify(api.json(undefined,out)) );
	}
}


//Throws Exception
function tokenizer_oauth(source, values) {

	var params = [];

	var _tokenizer = new tokenizer([
		/\${([a-zA-Z0-9]+)}/ 
	 ],function( src, real, re ){
		return real ? src.replace(re,function(all,name){
			
			//save the parameter name that we replaced
			params.push(name);

			//return the value
			return values[name];
		}) : src;
	  }
	);

	return({'params':params,'result':_tokenizer.parse(source).join('')});		
}