

exports.set = function(source,name,obj){

	var props = name.split('.');

    if(props.length === 1) {
        source[props] = obj;
        return(obj);
    } else {
        var prop = props.shift();
        if(source[prop] === undefined) return(undefined);
        else return( this.set(source[prop],props.join('.'),obj) );
    }
};

exports.get = function(source,name){
	var props = name.split('.');

	var current = source;

	for(var i=0; i < props.length; i++) 
		if(current[props[i]] !== undefined) current = current[props[i]];
			else return(undefined);

	//Return the current object
	return(current);
};