var tokenizer = require("./tokenizer.js"),
    OAuth = require('./oauth/node.oauth.js'),
    querystring = require('querystring');

//Create new OAUTH client
function client(config){
        
    var base = this;

    //Save the options
    base.config = config;
  
    //Save the oauth client
    base.oa = undefined;
  
    //If we need to take care of refresh tokens
	// NO SUPPORT for OAUTH 1.0

	switch(base.config.version) {

		//UNTESTED!!
		case "1.0":

			/*
			//Set oauth
			base.oa = new OAuth.OAuth(base.config.flow.request.url,
						base.config.access.url,
						base.config.keys.consumer,
						base.config.keys.secret,
						base.config.version,
						base.config.access_uri.url,
						base.config.signature);
			*/
		break;

		case "2.0":

			//Authorization flow
			// NOT required (only for OAUTH authorization)
			var flow = {
				"authorize":"",
				"token":""
			};
			
			//If we have an authorization flow
			// then configure it
			if(base.config.flow) {
				
				//Set the authorization url
				if(base.config.flow.authorize) flow.authorize = base.config.flow.authorize.url;

				//Set the token url if we have a refresh url
				if(base.config.flow.refresh) flow.token = base.config.flow.refresh.url;

				//Otherwise use the token auth flow
				if(base.config.flow.token) flow.token = base.config.flow.token.url;
			}
				
			//Create a new OAuth2 method
			//function(clientId, clientSecret, baseSite, authorizePath, accessTokenPath, customHeaders) 
			base.oa = new OAuth.OAuth2(
				base.config.keys.consumer,
				base.config.keys.secret,
				'',
				flow.authorize,
				flow.token);
					
			//Add other config options
			if(base.config.options) {
				if(base.config.options.useAuthHeader) base.oa.useAuthorizationHeaderforGET(base.config.options.useAuthHeader);
				if(base.config.options.authMethod) base.oa.setAuthMethod(base.config.options.authMethod);
				if(base.config.options.authTokenName) base.oa.setAccessTokenName(base.config.options.authTokenName);
			}
		break;

		default:
			//NOT IMPLEMENTED
		break;
	} 
}

//Call the request from dropbox
client.prototype.call = _call;

module.exports = client;

function _call(_request,token,params,callback,tokenCallback,retry){
    
    var base = this;
    
    //Exit if we don't have a callback
    if(!callback) return;

    //Check to see if we have this request 
    var request = base.config.requests[_request];
    
    //Exit if we don't have a valid request
    if(!request) return callback("OAUTH.CLIENT Unable to find request (" + _request + ")");
    if(!request.url) return callback("OAUTH.CLIENT Request missing url (" + _request + ")");
    
    //Make sure we have all required parameters
    if(!request.options) request.options = {};
    if(!request.headers) request.headers = {};
    if(!request.method) request.method = "GET";
    
    //Perform a shallow copy of params
    var _params = {};
    for(var prop in params) 
        _params[prop] = params[prop];
    
    //Get the url for this request
    var url = tokenizer_oauth(request.url,params);
    
	//remove the parameters that were used in the url
	for(var i=0; i < url.params.length; i++)
		if(params[url.params[i]]) delete params[url.params[i]];
		
	//Set the params to null if we don't have any
	if(!Object.keys(params).length) params = null;
	
	//Get the access token
	var _access;
	
	//Get the token
	if(typeof(token) === "object") _access = token.access;
	else _access = token;
	
    //Determine what method we should use to get this request
	switch(request.method) {
		
		case 'GET':

			//Add the other params to the url
			if(params)
                if(Object.keys(params).length) url.result += "?" + querystring.stringify(params);
            
            //Send the request to the oauth client
            //(url, access_token, options, headers, callback)
			base.oa.get(
				url.result, 
				_access, 
				request.options,
				request.headers,
				function(err,result,response){

                    //Process this request
                    process.call(base,err,result,response,request,token,function(err,data){
                        
                        if(err) return callback(err);
                        
                        switch(data.status){
                            
                            //Retry with the new access token
                            case "retry":
                                
                                //Perform the retry
                                _call.call(base,_request,data.access,_params,callback,tokenCallback,true);
                            break;
                            
                            case "success":
                                
                                //Spit out the response
                                callback(undefined,data.response);
                            break;
                        }
                        
                    },tokenCallback,retry);
				});	
		break;

		case 'POST':

            //if we disable the post body
            if(request.options.usePostBody === false) params = undefined;
 
			//Post the request (add the params to the body of the request)
			//(url, access_token, params, options, headers, callback)
			base.oa.post(
				url.result, 
				_access, 
				params,
				request.options,
				request.headers,
				function(err,result,response){
                    
                    //Process this request
                    process.call(base,err,result,response,request,token,function(err,data){
                        
                        if(err) return callback(err);

                        switch(data.status){
                            
                            //Retry with the new access token
                            case "retry":
                                
                                //Perform the retry
                                _call.call(base,_request,data.access,_params,callback,tokenCallback,true);
                            break;
                            
                            case "success":
                                
                                //Spit out the response
                                callback(undefined,data.response);
                            break;
                        }
                        
                    },tokenCallback,retry);
				});
		break;
		
        default:
            callback("OAUTH.CLIENT Unknown method (" + request.method + ")");
        break;
	}
}

function process(err,result,response,request,token,callback,tokenCallback,retry){
    
    var base = this,
        done = false;
    
	//If we have an error
    if(err) {
		
        //Determine if we need a new token
        // AND this isn't already a retry (make sure we dont create an infinite loop of retries)
		if(base.config.flow) 
			if(base.config.flow.refresh && typeof(token) === "object" && !retry)
				if(base.config.flow.refresh.status === err.statusCode && token.refresh !== undefined) {
					
					//Signal that we're done
					done = true;
					
					//Get the new token
					base.oa.getOAuthAccessToken(token.refresh,base.config.flow.refresh.params,function(err, access_token, refresh_token, results){
						
						if(err) callback(err);
						else {
							
							//Redo the call with the new token
							callback(undefined,{"status":"retry","access":access_token});

							//Also save the token
							if(tokenCallback) tokenCallback(access_token);
						}
					});
				}
            
        if(!done) callback(err);
        
        return;
    }
    
    //Get the mime type of the response
    var mimeType = response.headers["content-type"] || response.headers["Content-Type"];
    
    //Parse the result depending on the mimeType
    if(mimeType) {
        
        //application/json
		try {
			if(mimeType.indexOf("application/json") >= 0) result = JSON.parse(result);
		} catch(e){
			console.error("OAUTH.CLIENT Unable to parse JSON",e.message);
			return callback({"statusCode":400});
		}
    }
                    
    callback(undefined,{"status":"success","response":result});
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
