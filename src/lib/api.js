//Requires
var fs = require('fs'),
	cjson = require('cjson'),
	cluster = require('./cluster/manager.js'),
	path = require('path'),
	smtpClient = require('./smtp.js'),
	mysql = require('mysql'),
	objByName = require('./shared/object.byName.js'),
	Tokenizer = require('./shared/tokenizer.js'),
	globalMap = require('./global.map.js'),
	guid = require('./shared/guid.js'),
	eventManager = require('./events.js'),
	zmqManager = require('./zmq.js'),
	requests = require('./request.cache.js'),
	sql = require('./shared/sql.js');

//Globals 
var config,
	appPath,
	serviceConfig,
	dataPath,
	version,
	globals,
	oauth,
	connection = {},  //MYSQL connection pools
	events = undefined,
	zmq = undefined,
	sockets = {},
	io = {};

/* ---------------------------------------- Public Members ------------------------------- */

//Throws Exception
//options = {"path":{"app","data},"config":{"app","service"}}
exports.create = function( _options ) {

	//Get the config & options
	config = _options.config.app;
	appPath = path.resolve( _options.path.app);
	dataPath = path.resolve(_options.path.data);
	serviceConfig = _options.config.service;

	//Get the oauth
	oauth = _options.oauth;

	//Get the version of the api
	version = serviceConfig.version;

	//Load the requests controller
	requests.load(config,serviceConfig,appPath);

	//Create a new smtp client
	if( config.smtp ) smtpClient.create(config.smtp);

	//Create a new cluster manager for the requests
	cluster.create(this,dataPath,config.api.cluster,serviceConfig);

	//Create the event controller
	events = new eventManager({
		"app":{
			"path":appPath
		},
		"config":config.events,
		"timeout":config.timeout,

		//API options (we need this when we run an event)
		"options":config.options,

		//OAUTH options
		"oauth":config.oauth,

		//Shared cluster with api used to process events
		"cluster":cluster
	},function(){

		//Create a new zmq controller
		// once we have registered all the events (since zmq will call the event controller)
		if(config.zmq) {
			
			//Create a new zmqManager
			zmq = new zmqManager({
				"config":config.zmq,
				"events":events
			});
		}
	});

	//Create pooled connections to each database (RUN Safe)
	for(var database in config.database) 
		connection[database] = mysql.createPool(config.database[database]);
}

//Setup the globals 
exports.globals = {
	"map":globalMap
};

//Setup the zmq stub
exports.zmq = {
	"broadcast":{
		"emit":function(name,data) {
			if(zmq) zmq.emit(name,data);
		}
	}
};

//Setup the oauth stub
exports.oauth = {
	//"config":config.oauth,

	"call":function(kind,id,params,session,callback){
		oauth.process(kind,id,params,session,callback);
	}
};

//Setup the events stub
exports.events = {
	"emit":function(group,event,data) {
		if(events) events.emit(group,event,data);
	},
	"socket":{
		"set":function(_io){
			io = _io;
		},
		"connect":function(socket){

			//Get the hash
			var hash = guid.get();

			//Save the socket (for later)
			sockets[hash] = socket;

			//Save the hash
			return(hash);
		},
		"disconnect":function(hash){

			//Remove the socket
			if(sockets[hash]) delete sockets[hash];
		},

		// Public
		// Test if this socket is connected
		"connected":function(hash){

			//Determine if we are still connected
			if(sockets[hash]) return true;
			else return(false);
		},

		// Public
		"emit":function(hash,channel,data) {
			
			//Get the socket if we have one
			var socket = sockets[hash];

			if(socket) socket.emit(channel,data);
		},

		// Public
		"broadcast":function(channel,data) {
			
			//Broadcast to all connected sockets
			if(io) io.emit(channel,data);
		},

		// Public
		//Register an event for this channel communication
		// for this hash
		"on":function(hash,channel,group,event){

			var socket = sockets[hash];

			if(socket) {
				
				//Call the event
				socket.on(channel,function(data){
					
					//Call the appropriate event
					events.emit(group,event,{"socket":hash,"data":data});
				});
			}
		}
	}
};

//Call a javascript request
exports.call = function(module, id, params, callback) {
	return exports._call(true, module, id, params, undefined, callback);
}

//Call a javascdript request (allowing private connections)
exports._call = function(allowPrivate, module, id, params, session, callback) {
	var json = [];
	var success = false;

	//Create an empty session if we don't have one
	if(!session) session = {"data":{}};
	
	//Get the request (also does validation on the request and configuration for this request)
	requests.get(module,id,function(err,request) {

		//If we have an error then report it
		if(err) return callback(getError(err));

		//Determine if we have a request and if we are allowed to process it (public vs. private)
		if( allowPrivate || request.config.public ) {

			//Determine the type of request
			switch(request.config.type){
				case 'javascript':
				return _run(request, params, session, callback);

				case 'sql':
				return _query(request, params, session, callback);
			}
		} else callback(getError("Request '" + module + "/" + id + "' cannot be accessed"));
	});
}

exports.query = function(_sql, database, params, session, callback) {
	var json = [];
	var success = false;
	
	//Build the request 
	var request = {};
	request.data = _sql;
	request.config = {'type':'sql','database':database};

	_query(request, params, session, callback);
}

//Send email (if callback omitted then send sync)
exports.sendEmail = function(to,subject,body,callback) {

	if(callback) {

		if( config.smtp ) {
			smtpClient.send(to,subject,body,function(err,result) {
				if(err) callback(getError(err));
				else callback(undefined,result);
			});
		} else callback(getError('Unable to initialize SMTP client'));

	} else {
		if( config.smtp ) {
			smtpClient.send(to,subject,body);
			return;
		} else return("Unable to initialize SMTP client");		
	}
}

//Safe Method
exports.json = function(error, response) {
	var out = {
		'header':createHeader(error),
		'response':response
	};

	return(out);
}

//Stops all api processes from running
exports.stop = function() {

	//Clean the process stack
	cluster.stop();
}

/* ---------------------------------------- Private Members ------------------------------- */

//Safe Method
function createHeader(error) {
	var header = {
		'version':version,
		'environment':config.environment,
		'status':1,
		'detail':'',
		'message':''
	};

	if( error ){
		header.status = 0;
		header.detail = error.detail;
		header.message = error.message;
	}

	return(header);
}

function _run(request, params, session, callback) {

	//Run a new request on the cluster (module request)
	cluster.process({
		'type':'module',
		'request':request,
		'params':params,
		'oauth':config.oauth,
		'options':config.options,
		'session':session},config.timeout,callback);
}

function _query(request, params, session, callback) {

	var success = false;

	//Verify that we have the correct request type
	if( request.config.type !== 'sql' ) return callback(getError("Unable to execute a database query with request type '" + request.config.type + "'"));
	
	//Get the SQL
	var tpl = request.data;

	//Verify the database connection parameters
	var database = connection[request.config.database];
	
	if(!database) return callback(getError("Reference to unknown database '" + request.config.database + "'"));

	//Add the session parameters
	var _params = {
		'session':session.data,
		'params':params,
		'options':config.options
	};

	if(tpl && database) {

		var client,rSQL;

		//Generate the sql statement
		try
		{
			rSQL = tokenizer(tpl, _params);
		}
		catch (e)
		{
			return callback(getError(e.message));
		}

		database.getConnection(function(err, connection) {

			if( err ) return callback(getError(err.message));
			
			// Use the connection
			connection.query(rSQL, function(err, results) {

				// And done with the connection.
				connection.release();

				if( err ) return callback(getError(err.message));

				//Perform the callback
				callback(undefined,results);
			});
		});
	}
}

//get the value from a name array
function getObj(name,values) {

	//Values
	// session
	// params
	//if we only have one value then search for it in the moappi.request.params by default
	
	if(!name.length) return(undefined);

	//Parse special variables
	switch(name[0]) {
		case 'moappi':

			//Make sure there is at least three levels
			if(name.length < 3) return(undefined);

			//Determine what the nested variable is
			switch(name[1]) {

				//Options
				case 'options':
					//remove the moappi.options
					name.splice(0,2);
					
					//Return the value
					return(objByName.get(values.options,name.join('.')));
				break;
				
				//Request 
				case 'request':
					
					//Make sure there is at least 4 levels
					if(name.length < 4) return(undefined);
					
					//Determine what the nested variable is
					switch(name[2]) {
						case 'session': 
							//remove the moappi.request.session
							name.splice(0,3);

							return(objByName.get(values.session,name.join('.')));
						break;

						case 'params': 

							//remove the moappi.request.params
							name.splice(0,3);
							
							return(objByName.get(values.params,name.join('.')));
						break;
					}
				break;

				default:
					return(undefined);
				break;
			}
		break;

		default:
			return(objByName.get(values.params,name.join('.')));
		break;
	}
}

//Parse the name of the object
// eg ${obj,string} or ${obj,string,10} or ${int,number}
function parseName(name) {
	 var n=name.split(','); 
    
    //1 varaible
    //2 type
    //3 length (only for string)
    var type;
    var limit;
    
    if(n.length > 1) type = n[1];
    if(n.length > 2) limit = n[2];
	
	var m = [];
	
	if(n[0]) m = n[0].split('.');

	return({'name':m,'type':type,'limit':limit});
}

//Throws Exception
function tokenizer(source, values) {	
	
	var _tokenizer = new Tokenizer([
		/\${([a-zA-Z0-9\.\,]+)}/ 
	 ],function( src, real, re ){
		return real ? src.replace(re,function(all,name){
	        var n = parseName(name),
				val = getObj(n.name,values);
			
			//If we don't have a type then just use the value
			if(!n.type) return(val);
			else return(sql.format(val,n.type,n.limit));
		}) : src;
	  }
	);

	return(_tokenizer.parse(source).join(''));		
}

function getError(message){
	return({"message":message,"detail":""});
}

