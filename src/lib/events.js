var fs = require('fs'),
	cjson = require('cjson'),
	events = require('events'),
	path = require('path');

function _events(_options,ready) {

	var base = this;

	//Create an new emitter
	base.emitter = new events.EventEmitter();
	
	//Save the config (event config)
	base.config = _options.config;

	//Save the app info
	base.app = _options.app;

	//Save the options
	base.options = _options.options;

	//Save the oauth
	base.oauth = _options.oauth;

	//Timeout for events
	base.timeout = _options.timeout;

	//Cluster manager for running events
	base.cluster = _options.cluster;

	//Determine if we need to register any events
	if(base.config) base.register(ready);
};

_events.prototype = {

	// ------------------------------ Public Methods -----------------------------
	"emit":function(group,event,data) {
		this.emitter.emit([group,event].join('.'),data);
	},
	
	// ------------------------------ Private Methods -----------------------------

	//Register the events
	"register":function(ready) {
		
		var base = this;

		//Register the events found within the application
		base.getGroups(function(err,groups) {

			if(err) return console.error('MOAPPI.EVENTS Unable to register groups');

			var join = 0;

			//Create an event for each of these 
			for(var i=0; i < groups.length; i++) {
				
				var group = groups[i];
				
				//Wait until all events are registered
				join += Object.keys(group.events).length;

				//Register each event
				for(var event in group.events) {

					base.registerEvent(group.id,event,group.events[event],function(){
						
						join--;

						if(!join && ready) ready();
					});
				}
			}	
		});
	},

	//Create the event
	"registerEvent":function(group,id,details,callback){

		var base = this;

		//Read the event from the file
		base.readEvent(group,details.src,function(err,js){

			if(err) {
				console.error('MOAPPI.EVENTS Unable to register event',group,id,':',err.message);
				return callback();
			}

			//Create a new event based on this javascript
			base.emitter.on([group,id].join('.'),function(data){
				
				//Run the event in the sandbox
				// UNPROTECTED
				//console.log(typeof _sandbox.run);
				//Run a new request on the cluster (module request)
				base.cluster.process({
					'type':'event',
					'event':{
						'group':group,
						'id':id,
						'src':js,
						'data':data},
					'options':base.options,
					'oauth':base.oauth
				},base.timeout,function(){
							//What do we do with this?
							//console.log('EVENT.DONE ',[group,id].join('.'));
						});
			});

			//This is registered so exit
			if(callback) callback();
		});
	},

	//Read the event data
	"readEvent":function(group,src, callback) {
		return fs.readFile(path.join(this.app.path,this.config.src,group,src), 'ascii', callback);
	},
	
	//Read the group configuration file
	"readConfig":function(group) {

		var _config;
		
		try
		{
			_config = cjson.load(path.join(this.app.path,this.config.src,group,'events.json'));
		}
		catch (e)
		{
			console.error("MOAPPI.EVENTS Unable to parse event group",group);
			return;
		}
		
		return(_config);
	},


	//Get the group information
	"getGroups":function(callback) {

		var base = this;

		//Read the events directory to list all events
		fs.readdir(path.join(base.app.path,base.config.src), function(err, files){
			
			if(err) return callback(err.message);

			//Get the groups
			var groups = [];
			
			//Itterate over the returned content
			for(var i in files) {
	 
			   var stats = fs.statSync( path.join(base.app.path,base.config.src,files[i]) );

			   //Only if this is a directory then get the events within
			   if(stats.isDirectory()) {

				   var config = base.readConfig(files[i]);
				   groups.push({"id":files[i],
								"events":config.events});
			   }
			}

			callback(undefined,groups);
		});
	}
};

//Export the class
module.exports = _events;