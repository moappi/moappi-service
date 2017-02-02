
var path = require('path'),
	objByName = require('../../shared/object.byName.js');

//Messaging for modules

/*
	worker,
	api,
	dir,
	requests,
	m
*/

exports.process = function(options) {

	//Just cause I'm lazy and don't want to change the stuff below
	var worker = options.worker,
		api = options.api,
		requests = options.requests,
		m = options.m,
		dir = options.dir;

	//Get the active request
	var request = requests.processing[m.id];

	switch(m.type) {

		// ------------------------------------- Base ------------------------------------------------

		case 'response':
		
			//Check to make sure we have a request
			if(!requests.processing[m.id]) return console.error('MOAPPI.MESSAGING Request not found');

			//Callback the response (as we're finished)
			if(request.callback) request.callback(m.data.error, m.data.result,undefined,m.data.options);

			//Remove the request
			delete requests.processing[m.id];

			//Signal back to the worker that this process can be removed
			m.type = 'remove';
			worker.send(m);
		break;

		case 'redirect':

			//Callback the response (as we're finished)
			if(request.callback) request.callback(undefined,undefined,m.data);

			//Remove the request
			delete requests.processing[m.id];

			//Remove the request from the worker
			m.type = 'remove';
			worker.send(m);
		break;

		case 'path':
			
			//Set the message as a response
			m.type = 'response';

			//Get the version from the api as a response
			m.data = getResponse(undefined,path.join(dir,m.data.path));

			//Resend the response message back to the worker
			worker.send(m);
		break;

		case 'version':

			//Set the message as a response
			m.type = 'response';
			
			//Get the version from the api as a response
			m.data = getResponse(undefined,api.version());

			//Resend the response message back to the worker
			worker.send(m);
		break;

		// ------------------------------------- OAUTH Requests ------------------------------------------------

		case 'oauth.call':

			//Extract the request that we need to run (request should be part of the data)
			var req = m.data;

			//Get the session
			var session = request.session;

			//Get the session data if we have any
			if(session) session = session.data;

			//Call the module from the api
			api.oauth.call(req.kind, req.id, req.params, session, function(err,result) {
				
				//Set the message as a response
				m.type = 'response';

				//include trace of error
				if(err) err.message = "FAILED OAUTH/" + [req.kind,req.id].join("/") + ": " + err.msg;

				//Get the response
				m.data = getResponse(err,result);

				//Resend the message back to the worker
				worker.send(m);
			});
		break;

		// ------------------------------------- Requests ------------------------------------------------

		case 'request.call':

			//Extract the request that we need to run (request should be part of the data)
			var callRequest = m.data;

			//Call the module from the api
			api._call(true, callRequest.module, callRequest.id, callRequest.params, request.session, function(err,result) {
				
				//Set the message as a response
				m.type = 'response';

				//include trace of error
				if(err) err.message = "FAILED " + [callRequest.module,callRequest.id].join("/") + ": " + err.message;
				
				//Get the response
				m.data = getResponse(err,result);

				//Resend the message back to the worker
				worker.send(m);
			});
		break;

		case 'request.query':

			//Extract the request that we need to run (request should be part of the data)
			var query = m.data;

			//Call the module from the api
			api.query(query.sql, query.database, query.params, function(err,result) {
				
				//Set the message as a response
				m.type = 'response';
				
				//TODO include trace of error (direct SQL query)

				//Get the response
				m.data = getResponse(err,result);

				//Send it back to the worker
				worker.send(m);
			});
		break;

		// ------------------------------------- Events ------------------------------------------------

		case 'event.emit':
		
			//Don't wait up as there is no callback
			api.events.emit(m.data.group,m.data.event,m.data.params);
		break;

		// ------------------------------------- ZMQ ------------------------------------------------

		case 'zmq.broadcast.emit':
		
			//Don't wait up as there is no callback
			api.zmq.broadcast.emit(m.data.name,m.data.params);
		break;

		// ------------------------------------- Sockets ------------------------------------------------

		case 'socket.emit':
		
			//Don't wait up as there is no callback
			api.events.socket.emit(m.data.hash,m.data.channel,m.data.data);
		break;

		case 'socket.broadcast':
		
			//Don't wait up as there is no callback
			api.events.socket.broadcast(m.data.hash,m.data.channel,m.data.data);
		break;

		case 'socket.on':
		
			//Don't wait up as there is no callback
			api.events.socket.on(m.data.hash,m.data.channel,m.data.group,m.data.event);
		break;

		case 'socket.connected':

			//Set the message as a response
			m.type = 'response';

			//Wait for the callback
			var connected = api.events.socket.connected(m.data.hash);
				
			//Get the version from the api as a response
			m.data = getResponse(undefined,connected);

			//Resend the response message back to the worker
			worker.send(m);
			
		break;


		// ------------------------------------- Globals ------------------------------------------------
		case 'global.map.get':
			
			//Set the message as a response
			m.type = 'response';

			//Get the global variable (if we have one)
			m.data = getResponse(undefined,api.globals.map.get(m.data.var,m.data.key));

			//Resend the response message back to the process
			worker.send(m);			
		break;

		case 'global.map.set': 
			
			//Set the global variable
			api.globals.map.set(m.data.var,m.data.key,m.data.value);

			//Dont bother with a response since they aren't listening
		break;

		case 'global.map.size': 
			
			//Set the message as a response
			m.type = 'response';

			//Get the global variable (if we have one)
			m.data = getResponse(undefined,api.globals.map.size(m.data.var));

			//Resend the response message back to the process
			worker.send(m);	
		break;


		// ------------------------------------- Email ------------------------------------------------

		case 'email.send':

			//Extract the request that we need to run (request should be part of the data)
			var email = m.data;

			//Call the module from the api
			api.sendEmail(email.to,email.subject,email.body, function(err,result) {
				
				//Set the message as a response
				m.type = 'response';
				
				//Get the response
				m.data = getResponse(err,result);

				//Send it back to the worker
				worker.send(m);
			});
		break;

		case 'email.sendSync':

			//Extract the request that we need to run (request should be part of the data)
			var email = m.data;

			//Call the module from the api
			api.sendEmail(email.to,email.subject,email.body);
		break;


		// ------------------------------------- Session ------------------------------------------------

		case 'session.id':
			//Set the message as a response
			m.type = 'response';
			
			//Get the version from the api as a response
			if(request.session) m.data = getResponse(undefined,request.session.id);
			else m.data = getResponse('Session not configured');

			//Resend the response message back to the process
			worker.send(m);
		break;

		case 'session.get':
			//Set the message as a response
			m.type = 'response';

			//Get the version from the api as a response
			if(request.session) {

				var result = objByName.get(request.session.data,m.data.var);

				if(result === undefined) m.data = getResponse('Session missing ' + m.data.var);
					else m.data = getResponse(undefined,result);
			} else m.data = getResponse('Session not configured');

			//Resend the response message back to the process
			worker.send(m);
		break;

		case 'session.set':
			//Set the message as a response
			m.type = 'response';

			//don't send a response just set the session variable
			if(request.session) {
				var result = objByName.set(request.session.data,m.data.var, m.data.value);

				if(result === undefined) m.data = getResponse('Session missing ' + m.data.value);
					else m.data = getResponse(undefined,m.data.value);
			} else {
				m.data = getResponse('Session not configured');
			}

			//Resend the response message back to the process
			worker.send(m);
		break;

		default:
			console.error('MOAPPI.MESSAGING Request received an unknown api event type from process', m);
		break;
	}
}


// ----------------------- EVENTS ---------------------- 

function getResponse(err,result) {
	return({
		'result':result,
		'error':err
	});
}