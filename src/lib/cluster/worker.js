var fs = require('fs'),
    vm = require('vm'),
	guid = require('../shared/guid.js');

var sandbox = {
	"event":require('./event/sandbox.js'),
	"module":require('./module/sandbox.js')
};

//Active requests (one to one for sandbox's)
var active = {};

//--------------------------- Messaging -----------------------------

//Setup the callback messaging from the parent
process.on('message', function(m) {

	//Get the request id
	var id = m.id;

	//Determine what type of event this is
	switch(m.type) {

		//Process a new request
		case 'process':

			/*
				type,
				name,
				options
			*/

			//Based on the type create a new sandbox
			var sandboxType = sandbox[m.data.type];

			if(!sandboxType) return console.error("MOAPPI.WORKER (",m.data.name,") Unable to find sandbox type");

			//Create a new protected sandbox for this request
			var _sandbox = new sandboxType({
				'id':id,
				'name':m.data.name,
				'console':console,
				'process':process,
				'options':m.data.options
			});

			//Add this sandbox to the active requests
			//  that this worker is servicing
			active[id] = _sandbox;

			//Run the request in the sandbox on this process
			_sandbox.run();
		break;
		
		//Response from the worker manager
		case 'response':
			//Get the active sandbox
			var _sandbox = active[id];
			
			//Get the callback if we have one
			if(!m.callback || !_sandbox) return console.error("MOAPPI.WORKER Callback or Sandbox Not Found");
			
			if(typeof(_sandbox.callbacks[m.callback]) !== "function") return console.error("MOAPPI.WORKER (",_sandbox.name,") Unable to perform callback of type (",typeof(_sandbox.callbacks[m.callback]),")");
				
			//Run the callback safely
			try {
				//Invoke this callback with the err/data
				_sandbox.callbacks[m.callback](m.data.error, m.data.result);

				//Remove the callback from the stack
				delete _sandbox.callbacks[m.callback];
			}
			catch (e) {
				console.error("MOAPPI.WORKER (",_sandbox.name,")",e.name,e.message);
			}
			
		break;

		case 'remove':
			
			//Remove the request from the active quene
			delete active[id];
		break;

		default:
			if(_sandbox) console.error("MOAPPI.WORKER (",_sandbox.name,") Unable to process event",m.type);
			 else console.error("MOAPPI.WORKER Callback or Sandbox Not Found");
		break;
	}
});

