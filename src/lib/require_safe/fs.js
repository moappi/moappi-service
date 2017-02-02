var fs = require('fs'),
	wrench = require('wrench'),
	path = require('path');

var root;

exports.create = function(_root) {
	
	root = _root;

	var fs_safe = {
		"readdir":function(_path,_callback){
			var safeDir = makeSafe(_path,_callback);
			
			if( safeDir != null ) return fs.readdir(safeDir, _callback);
		},
		"readdirSync":function(_path){
			var safeDir = makeSafe(_path);
			
			if( safeDir != null ) return fs.readdirSync(safeDir);
		},
		"rename":function(_path1,_path2,_callback){
			var _p1s = makeSafe(_path1,_callback);
			var _p2s = makeSafe(_path2,_callback);
			
			if( _p1s != null && _p2s != null ) return fs.rename(_p1s,_p2s,_callback);
		},
		"renameSync":function(_path1,_path2){
			var _p1s = makeSafe(_path1);
			var _p2s = makeSafe(_path2);
			
			if( _p1s != null && _p2s != null ) return fs.renameSync(_p1s,_p2s);
		},	
		"stat":function(_path1,_callback){
			var _p1s = makeSafe(_path1,_callback);
			
			if( _p1s != null ) return fs.stat(_p1s,_callback);
		},	
		"statSync":function(_path1){
			var _p1s = makeSafe(_path1);
			
			if( _p1s != null ) return fs.statSync(_p1s);
		},	
		"fstat":fs.stat,	
		"fstatSync":fs.statSync,
		"unlink":function(_path1,_callback){
			var _p1s = makeSafe(_path1,_callback);
			
			if( _p1s != null ) return fs.unlink(_p1s,_callback);
		},	
		"unlinkSync":function(_path1){
			var _p1s = makeSafe(_path1);
			
			if( _p1s != null ) return fs.unlinkSync(_p1s);
		},
		"rmdir":function(_path1,_callback){
			var _p1s = makeSafe(_path1,_callback);
			
			if( _p1s != null ) return fs.rmdir(_p1s,_callback);
		},	
		"rmdirSync":function(_path1){
			var _p1s = makeSafe(_path1);
			
			if( _p1s != null ) return fs.rmdirSync(_p1s);
		},	
		"mkdir":function(_path1,_mode,_callback){
			var _p1s = makeSafe(_path1,_callback);
			
			if( _p1s != null ) return fs.mkdir(_p1s,_mode,_callback);
		},	
		"mkdirSync":function(_path1,_mode){
			var _p1s = makeSafe(_path1);
			
			if( _p1s != null ) return fs.mkdirSync(_p1s,_mode);
		},
		"close":fs.close,	
		"closeSync":fs.closeSync,
		"open":function(_path1,_flags,_mode,_callback){
			var _p1s = makeSafe(_path1,_callback);
			
			if( _p1s != null ) return fs.open(_p1s,_flags,_mode,_callback);
		},	
		"openSync":function(_path1,_flags,_mode){
			var _p1s = makeSafe(_path1);
			
			if( _p1s != null ) return fs.openSync(_p1s,_flags,_mode);
		},
		"fsync":fs.fsync,	
		"fsyncSync":fs.fsyncSync,

		"write":fs.write,	
		"writeSync":fs.writeSync,

		"read":fs.read,	
		"readSync":fs.readSync,

		"readFile":function(_path1,_encoding,_callback){
			var _p1s = makeSafe(_path1,_callback);
			
			if( _p1s != null ) return fs.readFile(_p1s,_encoding,_callback);
		},	
		"readFileSync":function(_path1,_encoding){
			var _p1s = makeSafe(_path1);
			
			if( _p1s != null ) return fs.readFileSync(_p1s,_encoding);
		},

		"writeFile":function(_path1,_data,_encoding,_callback){
			var _p1s = makeSafe(_path1,_callback);
			
			if( _p1s != null ) return fs.writeFile(_p1s,_data,_encoding,_callback);
		},	
		"writeFileSync":function(_path1,_data,_encoding){
			var _p1s = makeSafe(_path1);
			
			if( _p1s != null ) return fs.writeFileSync(_p1s,_data,_encoding);
		},

		"createReadStream":function(_path1,_options){
			var _p1s = makeSafe(_path1);
			
			if( _p1s != null ) return fs.createReadStream(_p1s,_options);
		},	
		"createWriteStream":function(_path1,_options){
			var _p1s = makeSafe(_path1);
			
			if( _p1s != null ) return fs.createWriteStream(_p1s,_options);
		},

		//Extended fs with wrench (recursive functions)
		"rmdirSyncRecursive":function(_path1,_options){
			var _p1s = makeSafe(_path1);

			if( _p1s != null ) return wrench.rmdirSyncRecursive(_p1s,_options);
		}
	};

	return(fs_safe);

};

function makeSafe(_dir, _callback)
{
	var safeDir = check(_dir);
	if( safeDir == null && _callback !== undefined ) _callback("Error: invalid path '" + _dir + "'");
	return(safeDir);
}

function check(_dir)
{
	var safeDir = path.resolve( path.join(root,_dir) );

	if( safeDir.indexOf(root) !== 0 ) return(null);
	else return(safeDir);
}

/*
	readdir
	readdirSync

	rename
	renameSync

	stat
	statSync

	fstat
	fstatSync
	
	unlink
	unlinkSync

	rmdir
	rmdirSync

	mkdir
	mkdirSync
	
	close
	closeSync

	open
	openSync

	fsync
	fsyncSync

	write
	writeSync

	read
	readSync
	
	readFile
	readFileSync
	
	writeFile
	writeFileSync

	createReadStream
	createWriteStream
*/