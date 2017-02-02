var dateFormatter = require('./dateFormat.js');

//Escape a string as mysql
function _escape(str) {

    return str.replace(/[\0\x08\x09\x1a\n\r"'\\]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
                return "\\"+char; // prepends a backslash to backslash, percent,
                                  // and double/single quotes
        }
    });
}

//Get the formatted sql for this value
function _format(value) {

	switch(typeof value) {
		case "number":return(value);
		case "string":return(_escape(value));
		case "boolean":return(value?1:0);
		case "object":
			if( value instanceof Date ) return(dateFormatter.format(value,"yyyy-MM-dd HH:mm:ss"));
		break;
		case "undefined":return('undefined');
		default:return(value.toString());
	}

	return(value);
}

//Format the array as mysql values
function _values(arry,type,limit){
    
	var out;

	if(!Array.isArray(arry)) return("()");

	//Itterate over the array
	// format the objects by type
    for(var i=0; i < arry.length; i++)
        arry[i] = _format(arry[i],type,limit);
    
	//Determine what type we're looking for
    switch(type){
        case "number":
			//Set the parameters
			out = "(" + arry.join(",") + ")";
        break;
        
        default:
			//Set the parameters
			out = "('" + arry.join("','") + "')";
        break;
    }
    
	return(out);    
}

//Parse the value of the object by it's type
function _formatByType(val,type,limit){
    
	var out = val;

	//Determine what type we want to format as
	// currently only allow number and string
	switch(type) {
		case 'number':
			
			//if we don't have a number then set it to NULL
			// otherwise set it as a number
			if( isNaN(out) ) out = 'NULL';
			else out = Number(out);
		break;
		
		case 'string':
			
			//if we don't have a value then set it to an empty string
			if(out === undefined || out === null) out = '';
			
			//Limit the size of the string
			if(limit) 
				if(!isNaN(limit))
					if(limit > 0)
						out = out.substring(0,limit);
		break;

		default:
			//Unsupported
		break;
	}
	
    
	//Format the string
    return(_format(out));
}

//Format an object (for mysql)
// formats the value by type
exports.format = _formatByType;

//Get the values formatted (for mysql)
//  eg ('test','me',..) or (120,10,..)
exports.values = _values;