//Requires
var cjson = require('cjson'),
	_express = require('express'),
	app = _express(),
	server = require('http').createServer(app),	
	api = require("./lib/api.js"),
	os = require("os"),
	querystring = require('querystring'),
	oauth = require('./lib/oauth/register.js'),
	io = require('socket.io'),
	path = require('path'),
	csrf = require('./lib/shared/csrf.js'),
	fs = require('fs');

//Setup Express modules
var express = {
	
	'bodyParser':require('body-parser'),
	'multer':require('multer'),

	'errorHandler':require('errorhandler'),
	'compress':require('compression'),
	'static':require('serve-static'),
	'cookieParser':require('cookie-parser'),
	'session':require('express-session')
};

//Cache
var cache =  {

	//Stores moappi error pages
	pages:{}
};

//Check to make sure we have an app to run
if( process.argv.length !== 4 ) return console.error("MOAPPI.SERVICE Application name and port are required. Usage 'node service.js <app> <port>'");

//Get the app name & port from the arguments
var appName = process.argv[2];
var port = process.argv[3];

//Read service configuration
var serviceConfig = null;

try
{
	serviceConfig = cjson.load('service.json');
}
catch (e)
{
	console.error("MOAPPI.SERVICE Unable to read service config file '"  + e.message + "'");
}

//Read app and data configuration
var config = null;

try {
	config = cjson.load([path.join(serviceConfig.src,appName,serviceConfig.config)]);
}
catch (e) {
	console.error("MOAPPI.SERVICE Unable to read app config file '"  + e.message + "'");
	return;
}

//Check to see if we have a timeout set for the api
if(!config.app.api.timeout) {

	//If not then use vi testthe default timeout
	config.app.api.timeout = serviceConfig.timeout;
}

//Check to see if we have any cluster options set for this app
if(!config.app.api.cluster) config.app.api.cluster = {};

//Get the modes
var modes = [];

//Add the environment
modes.push(config.app.environment);

//Add the api protection type
if(serviceConfig.protected) modes.push("protected");
	else modes.push("unprotected");

//Add the debug option
if(config.app.api.debug.error) modes.push("debug");

//Add th timer option
if(config.app.api.debug.timer) modes.push("timer");

//Add the events if we are using them
if(config.app.events) modes.push("events");

//Add the sockets if we are using them
if(config.app.api.sockets) modes.push("sockets");

//Add the zmq if we are using them
if(config.app.zmq) modes.push("zmq");

console.log("MOAPPI.SERVICE Starting Service",serviceConfig.version,"(",modes.join(" "),")");

//Determine the default data dir
var dataDir = path.join(serviceConfig.data,appName);

//Override src has been specified
if( config.app.data.src ) {

	dataDir = config.app.data.src;

	console.log("MOAPPI.SERVICE Data directory set to '" + dataDir + "'");
}

//Load the api
api.create( {
	"path":{"app":path.join(serviceConfig.src,appName),"data":dataDir},
	"config":{"app":config.app,"service":serviceConfig},

	"oauth":oauth
});
	
//Register socket.io
if(config.app.api.sockets) {
	
	//Register the socket.io end point
	io = io.listen(server, { log: config.app.api.debug.error });
	
	//Save the socket.io for use later
	api.events.socket.set(io);

	//load the api after the socket has been connected
	io.on('connection', function(socket) {
		
		//Connect the socket
		var hash = api.events.socket.connect(socket);
		
		//Handle the disconnect 
		// insure that we don't create a memory leak
		socket.on('disconnect', function() {
			
			//Signal the disconnect event
			api.events.socket.disconnect(hash);
		});

		//Call the socket.io connection event
		api.events.emit("socket.io","connection",hash);
	});
}

var workers = os.cpus().length + " (cpu)";
if(config.app.api.cluster.workers) workers = config.app.api.cluster.workers + " (manual)";

console.log("MOAPPI.SERVICE Initializing API with cluster",workers);

//Register the SIGTERM termination event
process.on('SIGTERM',function() {

	console.log("MOAPPI.SERVICE Shutdown");

	//Stop the server from taking any new requests
	webServer.close();

	//Stop the api (clears all current requests)
	api.stop();
});

//Configure the express server

//Support parsing of JSON & URL encoded & multi-part forms
var size;
if(serviceConfig.request) size = serviceConfig.request.size;

app.use(express.bodyParser.json({limit:size}));
app.use(express.bodyParser.urlencoded({ limit:size,extended: true }));

//TODO we need to re-configure this to work ONLY with specific file upload api requests
// perhaps add in a confiruation option that will allow the api call to accept a file request
//app.use(express.multer({dest:path.join(dataDir,config.app.data.upload)}));

//Add session support if required
if(config.app.api.session) {

	//Add the cookie parser
	app.use(express.cookieParser());

	//Set the session config
	var _config = {
		'secret': config.app.api.session.secret, 
		'proxy':true, 

		//Required by session module as default behaviour will change in future
		'resave': false,
		'saveUninitialized':true,

		'cookie':{
			'maxAge':config.app.api.session.maxAge,
			'secure':config.app.api.session.secure
		}
	};

	//Determine if we are using any session middleware
	if(config.app.api.session.middleware) {

		switch(config.app.api.session.middleware.type) {
			
			//AWS DynamoDB only supported
			case 'dynamodb':
				var DynamoDBStore = require('connect-dynamodb')(express);
				_config.store = new DynamoDBStore(config.app.api.session.middleware.options);
			break;
			
			default:
				console.error("MOAPPI.SERVICE Unsupported session middleware",config.app.api.session.middleware.type);
			break;
		}
	} 
	
	//Configure express sessions
	app.use(express.session(_config));
}

//Allow for CORS for static content
if(config.app.static.cors) {
	app.use(function(req, res, next) {

	  res.header("Access-Control-Allow-Origin", "*");
	  res.header("Access-Control-Allow-Methods", "GET");
	  res.header("Access-Control-Allow-Headers", "X-Requested-With");

	  next();
	});
}

//Catch Socket Hangups
app.use(function(req, res, next) {

  //Catch socket hangup errors
  req.socket.on("error", function() {
		console.error("MOAPPI.SERVICE Socket Hangup on Request (" + req.url + ")");
	});

  next();
});

//Catch-All Errors
app.use(function(err, req, res, next) {

  console.error("MOAPPI.SERVICE Catch-All",err,req.url);

  //Determine what kind of error this is
  switch(err.status) {

	//Custom error messages
	case 400:
	case 401:
	case 403:
	case 404:
	case 408:

		//Send out the error message
		return error(res,err.status);
	break;

	//Default error messages
	default:
		
		//Send out the default error message
		return error(res,"default");
	break;
  }

  next();
});


//use compression on static content
app.use(express.compress());

//Setup the static routing
app.use(express.static(path.join(serviceConfig.src,appName,config.app.static.src),{ "redirect": true, "index":config.app.static.default}));

//Setup the environment configuration
switch(config.app.environment) {
	case 'production':
		app.use(express.errorHandler());
	break;

	case 'development':
		// Express 3.x 
		//app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
		app.use(express.errorHandler());
	break;
}

//Register the OAuth if required (and we have a valid domain to attach to)
if(config.app.oauth && config.app.domain) oauth.init({'api':api,'config':config.app,'service':serviceConfig,'app':app,'name':appName,'domain':config.app.domain});

//Start the GET API (if we allow for it)	
if( config.app.api.get ) app.get(path.join(config.app.api.src,':module/:id'),processRequest);

//Start the POST API (if we allow for it)	
if( config.app.api.post ) app.post(path.join(config.app.api.src,':module/:id'),processRequest);

//Catch all to spit out Not Found error message
app.get('*', function(req, res) {
  error(res,404);
});


//Setup the listening port
var webServer;

try {
	server.listen(port);
} catch(e) {
	
	console.error("MOAPPI.SERVICE ERROR",appName," can't be started port",port,"in already in use");
	process.exit();
}

console.log("MOAPPI.SERVICE Running",appName,"on port",port);

/* ---------------------------------- Functions -------------------------------- */

function getError(_detail,_error) {
	return({'detail':_detail,'message':_error});
}

function error(res,type) {

	var html = cache.pages[type],
		status = type;

	if(type === "default") status = 404;

	//Get the file if we don't have it in cache
	getPage(type,function(html){
		res.writeHead(type,{});
		res.end(html);
	});	
}

function getPage(type,callback) {

	var html = cache.pages[type];

	//Get the file if we don't have it in routes
	if(!html){

		var _path = serviceConfig.pages[type];

		if(!_path) return callback('Proxy Error (' + type + ')',type);

		//Read the error file
		fs.readFile( path.join(__dirname,_path), 'utf8', function (err,data) {
		  if (err) return callback('Proxy Error',type);
		  
		  //routes the page
		  cache.pages[type] = data;
			
		  //Split the page out
		  callback(data);
		});
	} else callback(html);
}

function processRequest(req, res){
	
	var start;
	
	//Get the proces start time
	if(config.app.api.debug.timer) start = new Date().getTime();

	var useJSONP = false;
	var params;

	//Test for JSONP support
	if( config.app.api.jsonp ) useJSONP = config.app.api.jsonp;

	//Verify that we pass the CSRF test
	if(!csrf.pass(req,config.app.api.csrf)) return error(res,403);

	//Make sure we have a valid request and module
	if( req.params.id !== undefined && req.params.module !== undefined) {

		//Merge the query parameter with the body
		params = req.query;
		for (prop in req.body) { 
		   if (prop in params) { continue; }
		   params[prop] = req.body[prop];
		}

		//Get the header 
		params._headers = {};
		for(prop in req.headers)
			params._headers[prop] = req.headers[prop];
		
		//Determine if this request has files attached to it
		if(req.files) {
			//Create a new files array
			params._files = [];

			//Parse the files & clean paths
			for(fileName in req.files) {	
				var file = req.files[fileName];

				if( file.path ) file.path = file.path.replace(dataDir,'');
				
				if( file._writeStream) if( file._writeStream.path ) file._writeStream.path = file._writeStream.path.replace(dataDir,'');

				params._files[params._files.length] = file;
			}
		}

		//Send over the session
		var session = {};
		if(req.session) session.data = req.session;
		if(req.cookies) session.id = req.cookies['connect.sid'];

		//Call the request via the api
		api._call(false, req.params.module, req.params.id, params, session, function(_err, _results, _redirect, _options){
			
			if(_err) {
				var msg,
					log=true;
				
				//Determine if we should show the detailed error
				if( config.app.api.debug.error ) msg = _err.message;
				else msg = "Request Failed";
				
				//Determine if we should output this error emssage
				// based on logging filtering on the error detail
				if(config.app.api.logging)
					if(config.app.api.logging.filter) 
						if(_err.detail) log = (config.app.api.logging.filter.indexOf(_err.detail) < 0)
					
				//Log the error to the console (if it wasn't filtered out)
				if(log) console.error("MOAPPI.API","("+req.params.module+"/"+req.params.id+")",_err.message);
				
				//Set the error message to the friendly version
				_err.message = msg;
			}
			
			//Determine if this is a redirect request
			if(_redirect) {

				//perform the redirect
				res.redirect(_redirect);
			}
			else 	
			{
				var head = {
				  "Content-Type": "text/json",
				  "Cache-Control": "no-cache"
				};
				
				//If we have custom options to set
				// headers, cookies etc..
				if(_options) {

					//If we have custom headers then write them
					for(var _header in _options.headers)
						head[_header] = _options.headers[_header];
				
					//If we have cookies then write them too
					for(var _cookie in _options.cookies) 
						res.cookie(_cookie,_options.cookies[_cookie].val,_options.cookies[_cookie].options);
				}

				//Write the head (for JSON response)
				res.writeHead(200,head);

				//Create the json response object
				var response = JSON.stringify(api.json(_err,_results));
				
				//Enable JSONP if there is a valid callback and we allow for JSONP
				if( useJSONP && req.query.callback ) response = req.query.callback + "(" + response + ")";
				
				//Write the response
				res.end(response);
			}

			//Output the request time
			if(config.app.api.debug.timer) {
				var end = new Date().getTime() - start;
				console.log("MOAPPI.SERVICE", "(" + req.params.module + "/" + req.params.id + ")","in",end + "ms");
			}
		});
	} else {
		//Create a json response object
		res.end(JSON.stringify(api.json("Unknown Request",undefined)));
	}
}

