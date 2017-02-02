var url = require('url');

var debug = false;

exports.pass = function(req,csrf){

	if(!req) return(false);

	//Check to see if we allow CSRF requests
	if(csrf === true) return(true);

	var match = false;

	//Get the host
	var host = req.get('host');
	if(host) host = host.toLowerCase();

	if(debug) console.log(req.headers);

	//Get the origin
	var origin = req.get('origin') || req.get('referer');

	if(origin) {

		if(debug) console.log('checking origin',origin);

		//Get the origin from the url
		origin = url.parse(origin).hostname;

		//Determine if the origin matches the host
		match = (origin === host);

		//If it does then we're done!
		if(match) return(match);

		// OTHERWISE check to see if it's in the CORS exceptions
		if( Array.isArray(csrf) )
			if( csrf.indexOf(origin) >= 0 ) match = true; 

	} else {

		//Try the user-agent as a last ditch effort
		origin = req.get('user-agent');

		if(debug) console.log('checking user-agent',origin);

		//See if the url is in the user agent
		if(origin) origin = origin.toLowerCase();
		else origin = '';

		if( Array.isArray(csrf) )
			for(var i=0; i < csrf.length; i++) {
				//console.log(csrf[i],'in',origin);
				if(origin.indexOf( csrf[i] ) >= 0) {
					match = true;
					break;
				}
			}		
	}

	return(match);
}
