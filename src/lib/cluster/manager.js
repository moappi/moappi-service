var clusterMaster = require("./master.js"),
	path = require('path'),
	guid = require('../shared/guid.js'),

	//TODO evaluate if we need messaging for events
	// currently module messaging can do both
	messaging = require('./module/messaging.js');


//Determine which requests are processing
var requests = {
	'processing':{}
};

//Active instance of the api
var api,dir,config,service;

//Initialize the cluster
//config: workers, protected
exports.create = function(_api,_dir,_config,_service) {

	//Save the active instance of the api
	api = _api;

	//Save the config
	config = _config;
	dir = _dir;

	//Save the service config
	service = _service;

	//Register the worker message event
	clusterMaster.on('message',onMessage);

	//Create a new cluster master with a protected worker
	clusterMaster({ exec: path.resolve('./lib/cluster/worker.js') // script to run
				  , size: config.workers // number of workers
				  , env: { 'cwd': _dir}
				  , args: []
				  , debug: config.debug
				  , silent: config.silent
				  , signals: true
	});
}

//Process this request on the cluster
/*
	type,
	
	event,
	dir,
	options

	request,
	params,
	dir,
	options,
	protected
*/
exports.process = function(options,timeout,callback) {

	//Create a new id for this request
	var id = guid.get();

	var request = {
		"type":options.type
	};

	//Get the options for this specific type of request
	switch(options.type){
	
		case "event":
			//Create the friendly name of this request
			request.name = options.event.group + "/" + options.event.id;
			
			//Set the module specific options
			request.options = {
				"event":options.event,
				"options":options.options,
				"oauth":options.oauth,
				"dir":dir,
				"service":service
			};

		break;

		case "module":
			
			//Create the friendly name of this request
			request.name = options.request.module + "/" + options.request.id;
			
			//Set the module specific options
			request.options = {
				"request":options.request,
				"params":options.params,
				"dir":dir,
				"options":options.options,
				"oauth":options.oauth,
				"session":options.session,
				"protected":service.protected,
				"service":service
			};
		break;
	}

	//Cache callback & active session of the request (if we have a session)
	requests.processing[id] = {
		'type':options.type,
		'callback':callback,
		'session':options.session
	};

	//Send this request to be processed by the cluster master
	clusterMaster.send({'type':'process','data':request,'id':id});
}

//Quit the cluster graceful shutdown
exports.stop = function() {

	// graceful shutdown
	clusterMaster.quit();
}


// ----------------------- EVENTS ---------------------- 

function onMessage(m) {

	//Send the message off to this controller
	//NOTE the requests will be modified by this function
	// also will send request on behalf of this process
	messaging.process({
		"worker":this.process,
		"api":api,
		"dir":dir,
		"requests":requests,
		"m":m
	});
}

