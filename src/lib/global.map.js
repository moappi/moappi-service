//Requires
//var cache = require('./shared/cache.js');

//Shared memory 
//eg  name:{'type':'array','data':[]}
var globals = {};

/* ---------------------------------------- Public Members ------------------------------- */

//Throws Exception
/*
exports.load = function(_config) {

	if(_config) {
		
		for(var prop in _config) {
			
			//Create the variable
			create(prop,_config[prop]);
		}
	}
};
*/

//Get the map variable key
exports.get = function(name,key){

	//Make sure we have this map
	if(!globals[name]) return(undefined);

	switch(globals[name].type) {
		
		case 'json':
		case 'array':
			return(globals[name][key]);
		break;

		default:
			return(undefined);
		break;
	}
};

//Set a map variable key
exports.set = function(name,key,value,options){

	//Make sure we have a valid name
	if(!name) return;

	//By default create a new json map if we can't find this one
	if(!globals[name]) create(name,'json');

	switch(globals[name].type) {
		
		case 'json':
		case 'array':
			globals[name][key] = value;
		break;

		default:
			//Do nothing as we don't support this type
		break;
	}
	
};

//Set a map variable size
exports.size = function(name){
	
	if(!globals[name]) return(undefined);

	switch(globals[name].type) {
		
		case 'json':
			return(Object.keys(globals[name]).length);
		break;

		case 'array':
			return(globals[name].length);
		break;

		default:
			//We don't support this type
			return(undefined);
		break;
	}
	
};

/* ---------------------------------------- Private Members ------------------------------- */

function create(name,type) {

	var obj = {'name':name,'type':type};

	//Initialize the datatype
	switch(type) {
		
		case 'json':
			obj.data = {};
		break;

		case 'array':
			obj.data = [];
		break;

		default:
			console.error("MOAPPI.GLOBAL.MAP Unable to create global map of type '",type,"'");
		break;
	}

	//Set the global variable
	globals[name] = obj;
}
