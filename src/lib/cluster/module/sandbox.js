
var guid = require('../../shared/guid.js'),
	sql = require('../../shared/sql.js'),
	cookie = require('../../shared/cookie.js');
/*
	'id':id,
	'name':name,
	'console':console,
	'options':m.data.options
*/

function sandbox(config) {

    var base = this;


	/// ------------------ Rquired -------------------------

	//Setup the callback object 
	//   maps callbackID's to callback functions
	//   eg 'b9f78fe3-d4a3-f95c-4bca-57ffb037c213':function(err,data){//do something}
    base.callbacks = {};
    
	//Response Id (so we can match the response to a callback
	base.id = config.id;

	//Friendly name of the request we are making
	base.name = config.name;

	//Console to use
	base.console = config.console;

	//Process to send messages on
	base.process = config.process;

	/// ------------------ Module Specific -------------------------

	//Request to run
	base.request = config.options.request;

	//Base directory
	base.dir = config.options.dir;

	//Parameters to the request
	base.params = config.options.params;

	//Get the cookies associated with the request
	base.cookies = getCookies(base.params);

	//Get the headers
	base.headers = getHeaders(base.params);

	//Custom response options
	base.responseOptions = {
		"headers":{},
		"cookies":{}
	};

	//Setup the sandbox
	base.sandbox = {
			moappi:{},
			global: {},
			console: config.console,
			Buffer:Buffer,
			__filename: base.request.config.src,
			__dirname: '/'
	};

	//Console (help to determine where the error came from)
	base.sandbox.console = {
		'log':function() {
			
			base.console.log(getMessage("MOAPPI.REQUEST",base.request.module,base.request.id,arguments));
		},

		'error':function() {

			base.console.error(getMessage("MOAPPI.REQUEST",base.request.module,base.request.id,arguments));
		}
	};

	//SAFE require function
	base.sandbox.require = function(req) {

		var _req = req.toLowerCase();

		//Check against the grey listed require libraries
		switch(_req) {

			case 'tokenizer':
				return( require('../../shared/tokenizer.js') );
			break;

			//Partyly safe module
			case 'cjson':
				return( require('../../require_safe/cjson.js').create(base.dir) );
			break;

			//Partly safe module
			case 'fs':
				return( require('../../require_safe/fs.js').create(base.dir) );
			break;

			//Partly safe module
			case 'path':
				return( require('../../require_safe/path.js').create(base.dir) );
			break;
		}

		//Determine if we have this in the white list 
		if(config.options.service.require) {

			//Check the blacklist
			// Blacklist overwrites whitelist
			if(config.options.service.require.blacklist) {
				
				if(Array.isArray(config.options.service.require.blacklist)) {

					//This is an array, check against the blacklist
					if(config.options.service.require.blacklist.indexOf(_req) < 0) return(require(req));
				} else {

					//Otherwise this is a boolean (for all required libraries)
					if(!config.options.service.require.blacklist) return(require(req));
				}
			} else {

				//Check the whitelist
				if(config.options.service.require.whitelist) {
					
					if(Array.isArray(config.options.service.require.whitelist)) {

						//This is an array, so check against the whitelist
						if(config.options.service.require.whitelist.indexOf(_req) >= 0) return(require(req));
					} else {

						//Otherwise this is a boolean (for all required libraries
						if(config.options.service.require.whitelist) return(require(req));
					}
				}
			}
		}
				
		//If we make it this far we deny
		return(undefined);
	};
	
	//Set the request
	base.sandbox.moappi.request = {
		'params':base.params,

		'cookie':function(name){
			return(base.cookies[name]);
		},
		'header':function(name){
			return(base.headers[name]);
		},

		'cookies':base.cookies,
		'headers':base.headers
	};

	//Set the options
	base.sandbox.moappi.options = config.options.options;

	//Global variables
	base.sandbox.moappi.global = {

		'map':{

			'get':function(_var,_key,callback){
				//Create a new callback id (random GUID) for this callback
				var callbackID = guid.get();
				base.callbacks[callbackID] = callback;

				process.send({'type':'global.map.get','data':{'var':_var,'key':_key},'callback':callbackID,'id':base.id});		
			},

			'set':function(_var,_key,_value) {

				process.send({'type':'global.map.set','data':{'var':_var,'key':_key,'value':_value},'id':base.id});						
			},

			'size':function(_var,callback){
				//Create a new callback id (random GUID) for this callback
				var callbackID = guid.get();
				base.callbacks[callbackID] = callback;

				process.send({'type':'global.map.size','data':{'var':_var},'callback':callbackID,'id':base.id});		
			}
		}
	};

	//zmq connectivity
	base.sandbox.moappi.zmq = {

		'broadcast':{

			'emit':function(name,params){

				process.send({'type':'zmq.broadcast.emit','data':{'name':name,'params':params},'id':base.id});		
			}
		}
	};

	//Event event connectivity
	base.sandbox.moappi.event = {

		'emit':function(group,event,params){

			process.send({'type':'event.emit','data':{'group':group,'event':event,'params':params},'id':base.id});		
		}
		
	};

	//Sockets.io connectivity
	base.sandbox.moappi.socket = {
		'emit':function(hash,channel,data){

			process.send({'type':'socket.emit','data':{'hash':hash,'channel':channel,'data':data},'id':base.id});		
		},
		'broadcast':function(hash,channel,data){

			process.send({'type':'socket.broadcast','data':{'hash':hash,'channel':channel,'data':data},'id':base.id});		
		},
		'on':function(hash,channel,group,event){

			process.send({'type':'socket.on','data':{'hash':hash,'channel':channel,'group':group,'event':event},'id':base.id});		
		},
		'connected':function(hash,callback){

			//Create a new callback id (random GUID) for this callback
			var callbackID = guid.get();
			base.callbacks[callbackID] = callback;

			process.send({'type':'socket.connected','data':{'hash':hash},'callback':callbackID,'id':base.id});	
		}
	};

	//OAuth Requests
	base.sandbox.moappi.oauth = {
		
		'config':config.options.oauth,

		'call':function(kind, id, params, callback){
			//Create a new callback id (random GUID) for this callback, quene the callback
			var callbackID = guid.get();

			//console.log('Adding callback with ID',callbackID,'to request',sandbox.__filename);
			base.callbacks[callbackID] = callback;

			//Create a request to run (with params)
			var req = {
				'kind':kind,
				'id':id,
				'params':params
			};

			//Run the api command
			process.send({'type':'oauth.call','data':req,'callback':callbackID,'id':base.id});		
		}
	}

	//Response
	base.sandbox.moappi.response = {

		'end':function(result){
	
			//Get the response
			var data = getResponse(undefined,result,base.responseOptions);

			//Send the response back to the manager
			process.send({'type':'response','data':data,'id':base.id});	
		},
		'error':function(msg,detail){
			var data = getResponse({'message':msg,'detail':detail});
			
			//Send the response back to the manager
			process.send({'type':'response','data':data,'id':base.id});
		},
		'flush':function(err,result){
		
			var data = getResponse(err,result);

			//Send the response back to the manager
			process.send({'type':'response','data':data,'id':base.id});
		},
		'redirect':function(url){

			//Send the response back to the manager
			process.send({'type':'redirect','data':url,'id':base.id});
		},
		'cookie':function(name,val,options){
			
			//Set the cookie
			base.responseOptions.cookies[name] = {
				"name":name,
				"val":val,
				"options":options
			};

		},
		'setHeader':function(name,val) {
			
			//Set the custom header
			base.responseOptions.headers[name] = val;
		}
	};

	//set the session info
	base.sandbox.moappi.request.session = {
		'get':function(_var,callback){
			//Create a new callback id (random GUID) for this callback
			var callbackID = guid.get();
			base.callbacks[callbackID] = callback;

			process.send({'type':'session.get','data':{'var':_var},'callback':callbackID,'id':base.id});		
		},
		'set':function(_var,_value,callback) {

			//Create a new callback id (random GUID) for this callback
			var callbackID = guid.get();

			if(callback === undefined) callback = function() {};
			base.callbacks[callbackID] = callback;

			process.send({'type':'session.set','data':{'var':_var,'value':_value},'callback':callbackID,'id':base.id});						
		},
		'id':function(callback){
			//Create a new callback id (random GUID) for this callback
			var callbackID = guid.get();
			base.callbacks[callbackID] = callback;

			process.send({'type':'session.id','data':{},'callback':callbackID,'id':base.id});		
		}
	};

	//Build the sql interface
	base.sandbox.moappi.sql = {

		"format":function(val,type,limit){
			return(sql.format(val,type,limit));
		},

		"values":function(arry,type,limit){
			return(sql.values(arry,type,limit));
		}
	};

	//Build the API interface
	base.sandbox.moappi.api = {
			
		'path':function(path,callback){
			//Create a new callback id (random GUID) for this callback
			var callbackID = guid.get();
			base.callbacks[callbackID] = callback;

			process.send({'type':'path','data':{'path':path},'callback':callbackID,'id':base.id});		
		},

		'version':function(callback){
			//Create a new callback id (random GUID) for this callback
			var callbackID = guid.get();
			base.callbacks[callbackID] = callback;

			process.send({'type':'version','data':{},'callback':callbackID,'id':base.id});		
		},

		'call':function(module, id, params, callback){
			//Create a new callback id (random GUID) for this callback, quene the callback
			var callbackID = guid.get();

			//console.log('Adding callback with ID',callbackID,'to request',sandbox.__filename);
			base.callbacks[callbackID] = callback;

			//Create a request to run (with params)
			var callRequest = {
				'module':module,
				'id':id,
				'params':params
			};

			//Run the api command
			process.send({'type':'request.call','data':callRequest,'callback':callbackID,'id':base.id});		
		},

		'query':function(_sql, database, params, callback){
			//Create a new callback id (random GUID) for this callback, quene the callback
			var callbackID = guid.get();

			//console.log('Adding callback with ID',callbackID,'to request',sandbox.__filename);
			base.callbacks[callbackID] = callback;

			//Create a request to run (with params)
			var callRequest = {
				'sql':_sql,
				'database':database,
				'params':params
			};

			//Run the api command
			process.send({'type':'request.query','data':callRequest,'callback':callbackID,'id':base.id});		
		},

		'email':{
			'send':function(to, subject, body, callback){
				//Create a new callback id (random GUID) for this callback, quene the callback
				var callbackID = guid.get();

				//console.log('Adding callback with ID',callbackID,'to request',sandbox.__filename);
				base.callbacks[callbackID] = callback;

				//Create a request to run (with params)
				var email = {
					'to':to,
					'subject':subject,
					'body':body
				};

				//Run the api command
				process.send({'type':'email.send','data':email,'callback':callbackID,'id':base.id});		
			},

			'sendSync':function(to, subject, body){
		
				//Create a request to run (with params)
				var email = {
					'to':to,
					'subject':subject,
					'body':body
				};

				//Run the api command
				process.send({'type':'email.sendSync','data':email,'id':base.id});		
			},
		}
	};

	//Legacy support of sendEmail (async)
	base.sandbox.moappi.api.sendEmail = base.sandbox.moappi.api.email.send;
};

//------------------------------- Public Methods  ---------------------------------------

sandbox.prototype = {
	
	//REQUIRED
	//Always runs unprotected
	"run":function() {
		var base = this;

		//Run the child script in the sandbox
		try {

			//Manually set the local scope to this
			var moappi = base.sandbox.moappi;
			var global = base.sandbox.global;

			//Set console explicity
			var console =  base.sandbox.console;

			//console = this.console;
			var require = base.sandbox.require;
			var Buffer = base.sandbox.Buffer;
			var __filename = base.sandbox.__filename;
			var __dirname = base.sandbox.__dirname;
			
			//Run in this context (should be called within the context of the sandbox)
			eval(base.request.data);

		} catch(e) {

			//Make sure we return a response even if we throw an exception
			var msg;
			if(!e.name || !e.message) msg = e;
			else msg = e.name + ' ' + e.message;

			var data = getResponse({'message':msg});
			base.process.send({'type':'response','data':data,'id':base.id});
		}
	}
};


//------------------------------- Prviate Methods ---------------------------------------

function getCookies(params) {

  if(params["_headers"] === undefined) return({});
  if(params["_headers"].cookie === undefined) return({});

  //Parse the cookies
  return(cookie.parse(params["_headers"].cookie));
}

function getHeaders(params) {
	if(params["_headers"] === undefined) return({});

	return(params["_headers"]);
}

function getResponse(err,result,options) {

	var out = {
		'result':result,
		'error':err
	};

	if(options) out.options = options;

	return(out);
}

function getMessage(type,mod,req,args) {

	var msg = [];

	for(var arg in args) {

		var obj = args[arg];
		var str;

		//Get the string rep of the object
		switch(typeof obj) {
			
			case "function":
				str = "function";
			break;

			case "undefined":
				str = "undefined";
			break;

			case "object":
				if(obj === null) str = "null";
				else str = JSON.stringify(obj);
			break;

			default:
				str = obj.toString();
			break;

		}
		
		//Add this object to the message
		msg.push(str);
	}

	//Log with more than just the message
	return(type + " (" + mod + "/" + req + ") " + msg.join(" "));
}

//Export the base function
module.exports = sandbox;