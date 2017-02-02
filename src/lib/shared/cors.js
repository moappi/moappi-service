var url = require('url');

exports.pass = function(req,cors){

	if(!req) return(false);

	//Check to see if we allow CORS for all domains
	if(cors === true) return(true);

	console.log(req.headers);

	//Get the origin
	var origin = req.get('origin') || req.get('referer');
	if(origin) origin = url.parse(origin).hostname;

	//Get the host
	var host = req.get('host');
	if(host) host = host.toLowerCase();

	//Detmine if the origin matches the host
	var match = (origin === host);

	// if it does then we're done!
	if(match) return(match);

	// OTHERWISE check to see if it's in the CORS exceptions
	if( Array.isArray(cors) )
		if( cors.indexOf(origin) >= 0 ) match = true; 
	
	return(match);
}
