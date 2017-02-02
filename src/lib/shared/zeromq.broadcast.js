var zmq = require('zmq');

//Create a new object
// type can be either 'pub' or 'sub'
var _export = function(type){
    
    var base = this;
    
    if(type !== 'pub' && type !== 'sub') throw 'zmqb - Incorrect type "' + type + '"';
    
    //Set the type of ZMQp object this is (master or worker)
    base.type = type;
    
    //Heartbeat timeouts
    base.heartbeatTimeout = {};

	//SUB ONLY
	base.listeners = [];
    
    //ZMQb options
    base.options = {
        
         //Spit any error messages to the console
        'debug':false,

        //Trace message flow
        'trace':false,
        
        //Heartbeat timeout
        // default no heartbeat
        'heartbeat':0
    };
};


//------------------------------ Shared Methods -----------------------------------

//Connect to port and list to available nodes

// SUB : param === available subscriber array
// PUB : param === port 
_export.prototype.connect = function(id,param,callback) {
    var base = this;

    //Our current id
    base.id = id;
    
	//Depending on the type connect the sub/pub
	switch(base.type) {

		//Subscriber
		// also sends heartbeat out
		case 'sub':

			//Create a new subscriber
			base.sub = zmq.socket('sub');

            //Available publishers
            base.available = param;

			//Connect to the list of available publishers
			for(var i in base.available) {
				
				//Connect to the publisher
				base.sub.connect('tcp://' + base.available[i]);

				//Set the heartbeat timeout
				// if we need one
				if(base.options.heartbeat) {
					
					//Set the heartbeat timeout
					base._setHeartbeatInterval(i,base.available[i]);
				}
			}
			
			//Subscribe to our channel
			//  and all channel
			base.sub.subscribe('all');
			
			if(base.options.debug) console.log('TRACE zmqb.connect - Subscribing to channels ["all"]');
			
			//Setup message receiving for the subscriber
			base.sub.on('message', function(data){
				base._receive(data);
			});
			
			if(callback) callback();

		break;

		//Publisher
		case 'pub':
			//Create a new publisher
			base.pub = zmq.socket('pub');
			 
			//Bind to a particular port
			base.pub.bind('tcp://0.0.0.0:'+param, function(error) {
                
                //Handle errors
                if(error) {
                    if(callback) callback('Unable to connect to port ' + error.message);
                    return console.error('ERROR zmqb.connect - Unable to connect to port ' + error.message);
                }
	
				//Setup the heartbeat if needed
				if(base.options.heartbeat) {
					
					//Trace message
					if(base.options.debug) console.log('DEBUG zmqb.connect - Sending heartbeat every ' + base.options.heartbeat + 'ms');
					
					//Set the worker timeout
					setInterval(function() {
						
						//Send heartbeat message
						base.pub.send( message.get('all',base.id,'heart','-',1) );    
						
					},base.options.heartbeat*0.9);
				}
				
				if(callback) callback();
			});    
		break;
	}
};

_export.prototype.debug = function(_debug) {
    
    var base = this;
    
    base.options.debug = _debug;
};

_export.prototype.trace = function(_trace) {
    
    var base = this;
    
    base.options.trace = _trace;
};

_export.prototype.heartbeat = function(_interval){
    
    var base = this;
    
    base.options.heartbeat = _interval;
};

//------------------------------ Public Methods (PUB) -----------------------------------

//Send this object to all listening pubs
_export.prototype.send = function(obj) {
    
    var base = this;

	if(base.type !== 'pub') return;
    
	var msg = '';
	
	if(obj) msg = obj.toString();

	//Send the message to all subs
	base.pub.send( message.get('all',base.id,'signal','-',1,msg) );
};

//------------------------------ Public Methods (SUB) -----------------------------------

//Send this object to all listening pubs
_export.prototype.listen = function(callback) {
    
    var base = this;

	if(base.type !== 'sub') return;
    
	//Register this callback 
	if(callback) base.listeners.push(callback);
};


//------------------------------ Shared Events -----------------------------------

//Subscribe on receive event
_export.prototype._receive = function(data) {
 
    var base = this;  
    
    //Parse the message
    var msg = message.parse(data.toString());
    
    //if(base.options.trace) console.log('TRACE zmqp._receive - Received message of type ' + msg.type);
    
    //Make sure the message is valid
    if(msg) {
        switch(msg.type) {
            
            //------------------ Shared Events ---------------------
            
            case 'heart':
                base._heartbeat(msg);
            break;
            
            //------------------ Sub Events ---------------------
            case 'signal':
                base._signal(msg.message);
            break;

            //------------------ Default Error ---------------------
            default:
                if(base.options.debug) console.error("ERROR zmqpb._receive - Unrecognized event type" + msg.type);
            break;
        }
    } else {
        
        if(base.options.debug) console.error('ERROR zmqb._receive - Dropping incorrectly formed message ' + data.toString());
    }
};

//Signal the listeners (SUB)
// with this data
_export.prototype._signal = function(data) {
 
    var base = this;  
    
	//Call the listeners
	for(var i =0; i < base.listeners.length; i++)
		base.listeners[i](data);
};

//------------------------------ Heartbeat Events -----------------------------------

//Set the heartbeat timeout
_export.prototype._setHeartbeatInterval = function(name,tcp) {
    
    var base = this;
    
    //Set the new heartbeat timeout
    base.heartbeatTimeout[name] = setInterval(function() {
        
        //Try to reconnect if we reach the timeout
        base._reconnect(tcp);
        
    },base.options.heartbeat);
};

//Reconnect to this server
_export.prototype._reconnect = function(tcp) {
    
    var base = this;
    
    if(base.options.trace) console.log('TRACE zmqb._reconnect - Trying reconnect with ' + tcp);
    
    //Disconnect 
    // insures that we don't connect twice
    base.sub.disconnect('tcp://' + tcp);
    
    //Try to reconnect
    base.sub.connect('tcp://' + tcp);
};

//Heart beat received
_export.prototype._heartbeat = function(msg) {
    var base = this;  
    
    //Contact the requester of this heart beat back with an ACK
    //Trace message
    if(base.options.trace)
        if(base.options.trace.heartbeat) console.log('TRACE zmqb._heartbeat - Heartbeat received from ' + msg.from);
    
    //Get the server info for this heartbeat
    var tcp = base.available[msg.from];
    
    //Check to see if we have a server tcp address
    if(tcp && base.heartbeatTimeout[msg.from]) {
        //Clear the existing timeout
        clearInterval( base.heartbeatTimeout[msg.from] );
        
        //Set a new heartbeat interval
        base._setHeartbeatInterval(msg.from,tcp);
    }
};


//------------------------------ Shared -----------------------------------
var message = {
    'get':function(to,from,type,id,status,msg){
    
        var packet = [to,from,type,id,status];
        
        if(msg) packet.push(msg);
        
        return(packet.join(' '));
    },
    
    'parse':function(data) {
    
        data = data.split(' ');
        
        if(data.length < 5) {
            if(base.options.debug) console.error("ERROR zmqb.message - Not enough parameters in message");
            return;
        }
        
        var msg;
        
        //Check to see if we have a message
        if(data.length > 5) msg = data.slice(5, data.length).join(' ');
        
        return({
           'to':data[0],
           'from':data[1],
           'type':data[2],
           'id':data[3],
           'status':data[4],
           'message':msg
        });
    }
};

var guid = {
	'get': function() {
        return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
	}
};

function S4() {
        return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}

//------------------------------ Exports -----------------------------------
module.exports = _export;