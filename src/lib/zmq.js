//Requires
var zmqb = require('./shared/zeromq.broadcast.js');

/* --------------------------------------- Public Members ------------------------------- */

/*
	"name":{
		
		"type":"broadcast" || "process" (TODO)
		
		//Broadcast
		"options":{
			"type":"sub" || "pub"

			"name":string,

			"heartbeat":number,

			"debug":boolean,

			"trace":boolean

			//PUB
			"port":number,

			//SUB
			"publishers":{
				"name":"ip:port"
			}
		}
	}	

*/
function manager(_options) {
	var base = this;

	base.controllers = {};

	//Create a new zmq controller
	for(var name in _options.config) {

		var config = _options.config[name];

		switch(config.type) {
			case "broadcast":
				base.controllers[name] = new broadcast(config.options,_options.events);
			break;

			default:
				console.error("MOAPPI.ZMQ Unrecognized ZMQ type (" + config.type + ")");
			break;
		}
	}
};

//---------------------------------- Broadcast ZMQ --------------------------
//Broadcast ONLY
manager.prototype.emit = function(name,obj) {
	
	var base = this;

	var controller = base.controllers[name];

	if(controller) 
		if(controller.type === "broadcast") controller.emit(obj);
}

function broadcast(config,events){

	var base = this;

	base.config = config;

	base.events = events;

	switch(config.type) {
		
		case "pub":
			base.publisher = new zmqb("pub");

			//Enabling debugging and tracing
			base.publisher.debug(config.debug);
			base.publisher.trace(config.trace);

			//Set the heartbeat
			base.publisher.heartbeat(config.heartbeat);

			//Connect
			base.publisher.connect(config.name,config.port,function() {
				console.log('MOAPPI.ZMQ broadcast.publisher (' + config.name + ') connected on port ' + config.port);
			
				//Trigger the connection event
				base.events.emit('zmq.broadcast','connected',config.name);
			});
		break;

		case "sub":
			//Setup a publisher
			base.subscriber = new zmqb("sub");

			//Enabling debugging and tracing
			base.subscriber.debug(config.debug);
			base.subscriber.trace(config.trace);

			//Set the heartbeat
			base.subscriber.heartbeat(config.heartbeat);

			//Listen for events
			base.subscriber.listen(function(data){

				//Trigger the receive event
				base.events.emit('zmq.broadcast','received',{
					"name":base.config.name,
					"data":data});
			});

			//Connect to 
			base.subscriber.connect(config.name,config.publishers,function() {
				console.log("MOAPPI.ZMQ broadcast.subscriber (" + config.name + ") connected");

				//Trigger the connection event
				base.events.emit('zmq.broadcast','connected',config.name);
			});


		break;

		default:
			console.error("MOAPPI.ZMQ Unrecognized broadcast type (" + config.type + ")");	
		break;
	}
};

broadcast.prototype.send = function(obj) {

	if(this.config.type === pub) this.publisher.send(obj);
	else console.error("MOAPPI.ZMQ Unable to send on broadcast type (" + this.config.type + ")");
};


//Export the manager
module.exports = manager;




