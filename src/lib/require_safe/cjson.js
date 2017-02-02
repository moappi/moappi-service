var cjson = require('cjson'),
	path = require('path');

var root;

exports.create = function(_root) {
	
	root = _root;

	var cjson_safe = {
		"load":function(_path,_options){
			var safeDir = makeSafe(_path);
			
			if( safeDir != null ) return cjson.load(safeDir, _options);
		},
		"extend":cjson.extend,
		"decomment":cjson.decomment,
		"parse":cjson.parse,
		"replace":cjson.replace
	};

	return(cjson_safe);

};

function makeSafe(_dir, _callback)
{
	var safeDir = check(_dir);
	if( safeDir == null && _callback != undefined ) _callback("Error: invalid path '" + _dir + "'");
	return(safeDir);
}

function check(_dir)
{
	var safeDir = path.resolve( path.join(root,_dir) );

	if( safeDir.indexOf(root) != 0 ) return(null);
	else return(safeDir);
}