var path = require('path');

var root;

exports.create = function(_root) {
	
	root = _root;

	var path_safe = {
		"join":path.join,
		"normalize":path.normalize,
		"relative":path.relative,
		"dirname":path.dirname,
		"basename":path.basename,
		"extname":path.extname,
		"exists":function(_path,_callback) {
			var safeDir = makeSafe(_path,_callback);
			
			if( safeDir != null ) return path.exists(safeDir, _callback);
		},
		"existsSync":function(_path) {
			var safeDir = makeSafe(_path,function(){});
			
			if( safeDir != null ) return path.existsSync(safeDir);
		},
		"resolve":function() {
			return("Removed due to security reasons");
		}
	};

	return(path_safe);

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