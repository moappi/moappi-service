//Requires
var fs = require('fs'),
	path = require('path'),
	cjson = require('cjson');

//Module & Request cache
var cache = {
	"modules":{},
	"requests":{}
};

var config,
	serviceConfig,
	appPath;

/* ---------------------------------------- Public Members ------------------------------- */

//Throws Exception
exports.load = function(_config,_serviceConfig,_appPath) {

	config = _config;

	appPath = _appPath;

	serviceConfig = _serviceConfig;
};

//Get the request from cache
exports.get = function(module,id,callback){
	
	//Get the Module
	getModule(module, function(err,moduleConfig) {

		if(err) return callback(err);
		
		//Verify the config file
		if(!moduleConfig) return callback("Module '" + module + "' not found");
		if(!moduleConfig.requests) return callback("Module '" + module + "' config file is missing the 'requests' object");
		if(!moduleConfig.options) return callback("Module '" + module + "' config file is missing the 'options' object");
		
		var requestConfig = moduleConfig.requests[id];

		if(!requestConfig) return callback("Request '" + module + "/" + id + "' not found");
		
		//Verify the request in the config file
		verify(requestConfig, module, id, function(err) {

			if(err) return callback(err);

			//Get the Request
			getRequest(requestConfig, module, id, function(err,data) {

				if(err) return callback(err);
				
				var _options;

				if(config.options) _options = merge(config.options,moduleConfig.options);
				else _options = moduleConfig.options;
				
				//Build the request
				var request = {
					'id':id,
					'module':module,
					'data':data,
					'config':requestConfig,
					'options':_options
				};

				//Make the callback for the request
				callback(undefined,request);
			});

		});
	});

};

/* ---------------------------------------- Private Members ------------------------------- */

//Get the request from cache (production)
// or just read from the file system (development)
function getRequest(requestConfig,module,id,callback){

	//If we are in production & and we have this module in cache
	if(config.environment === 'production' && cache.requests[module]) {
		
		var cached = cache.requests[module][id];

		//If we have this request in cache then let's look at it
		if(cached) {
			
			//Determine if we need to recheck if this request has been modified
			if( ((new Date()).getTime() - cached.read.getTime()) > serviceConfig.cache ) {
				
				//Get the stats on the file again 
				var mod = stat(module,requestConfig);

				if(!mod) return callback("Request '" + module + "/" + id + "' not found");

				//console.log('REQUEST Cache CHECK',mod.getTime(),cached.mod.getTime());

				//If we haven't modified this file then just return if from cache
				if(mod.getTime() === cached.mod.getTime()) {
					//console.log('REQUEST Cache HIT (timeout)',module,id,mod);

					return callback(undefined,cached.data);
				} 
			} else {
				
				//console.log('REQUEST Cache HIT',module,id);

				//Since we are assuming that this request hasn't changed then spit it out
				return callback(undefined,cached.data);
			}
		}
	}
	
	//Otherwise read the request from the file system
	readRequest(module,requestConfig,function(err,obj){

		if(err) return callback(err);

		//Save the request in the cache

		//If we don't already have a module for this request then create one
		if(!cache.requests[module]) cache.requests[module] = {};

		//Add the date this object was read
		obj.read = new Date();

		//Save the object {"mod","data"}
		cache.requests[module][id] = obj;

		//console.log('REQUEST Cache MISS',module,id);
		
		//Spit out the request data
		callback(undefined,obj.data);
	});

}

//Read the request from the file system
function readRequest(module, request, callback) {
	
	var file = path.join(appPath,config.api.src,module,request.src);

	var wait = 2;

	var mod,data;

	fs.stat(file, function(err,stats){

		if(err) return callback(err.message);

		mod = stats.mtime;

		wait--;
		if(!wait) callback(undefined,{"mod":mod,"data":data});
		
	});

	fs.readFile(path.join(appPath,config.api.src,module,request.src), 'ascii', function(err,_data){
		
		if(err) return callback(err.message);

		data = _data;

		wait--;
		if(!wait) callback(undefined,{"mod":mod,"data":data});
	});
}

function stat(module,request) {

	var fname = "module.json";
	
	if(request) fname = request.src;

	var file = path.join(appPath,config.api.src,module,fname);
	
	var stats;
	
	try {
		stats = fs.statSync(file);
	} catch(e) {
		return(undefined);
	}
	
	if(!stats) return(undefined);
	else return(stats.mtime);
}


//Get the module config from cache (production)
// or just read from the file system (development)
function getModule(module,callback){

	//If we are in production signal to use the cache
	if(config.environment === 'production') {
		
		var cached = cache.modules[module];

		//Get the request from cache
		if(cached) {
				
			//Determine if we need to recheck if this request has been modified
			if( ((new Date()).getTime() - cached.read.getTime()) > serviceConfig.cache ) {
				
				//Get the stats on the file again 
				var mod = stat(module);

				if(!mod) return callback("Module '" + module + "' not found");
				
				//If we haven't modified this file then just return if from cache
				if(mod.getTime() === cached.mod.getTime()) {
					//console.log('MODULE Cache HIT (timout)',module,mod);

					return callback(undefined,cached.data);
				}
				
			} else {
				
				//console.log('MODULE Cache HIT', module);

				//Since we are assuming that this request hasn't changed then spit it out
				return callback(undefined,cached.data);
			}	
		}
	}

	//Otherwise read the module from the file system
	readModule(module,function(err,obj){

		if(err) return callback(err);

		//Save the module config in the cache

		//Add the date this object was read
		obj.read = new Date();

		//Save the object {"mod","data"}
		cache.modules[module] = obj;

		//console.log('MODULE Cache MISS', module);
		
		//Spit out the request data
		callback(undefined,obj.data);
	});

}

//Read the module config from the file system
function readModule(module, callback) {

	var file = path.join(appPath,config.api.src,module,'module.json');

	//TODO we can make this async
	//Get the stat for this file
	var mod = stat(module);

	if(!mod) return callback("Module '" + module + "' not found");

	//Read service configuration
	var moduleConfig;
	
	try
	{
		moduleConfig = cjson.load(file);
	}
	catch (e)
	{
		return callback("Unable to read module '" + module + "'");
	}
	
	return callback(undefined, {"mod":mod,"data":moduleConfig});
}

function verify(requestConfig, module, id, callback) {

	if(!requestConfig.src) return callback("Missing 'src' property for request '" + module + "/" + id + "' in module.json");
	if(!requestConfig.type) return callback("Missing 'type' property for request '" + module + "/" + id + "' in module.json");
	if(requestConfig.public === undefined ) return callback("Missing 'public' property for request '" + module + "/" + id + "' in module.json");

	//Special properties
	switch(requestConfig.type) {

		case 'javascript': break;
		case 'sql':
			if(!requestConfig.database) return callback("Missing the 'database' property for request '" + module + "/" + id + "' in module.json");
			break;
		default:
			return callback("Unknown request type '" + requestConfig.type + "' for request '" + module + "/" + id + "'");
			break;
	}

	return callback(undefined, true);
}

//Merge Objects
function merge(obj1,obj2){
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}

