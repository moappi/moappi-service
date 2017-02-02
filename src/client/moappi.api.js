
//!Requires jQuery
(function() {
    
    var moappi = {
        
        //No version info yet until first call
        'version':undefined,
        
        //Assume production environment unless we're told otherwise
        'environment':'production',
        
        /* ---------------- Public Members ---------------- */
        'api': function (path,options) {
            
            var base = this;
            
            //Path to application root
            base.path = path;
            
            //Options include the following
            // login : default login page to forward to 
            // href  : append href (default false)
            // callback : use callbacks instead of redirects
            base.options = options;
            
            if(!base.options) base.options = {};
            
            //By default allow for redirects
            if(base.options.redirect === undefined) base.options.redirect=true;
            
            //Legacy support
            //Use request.get instead
            base.call = function(_module, _id, _params, _callback){
                base.request._call(_module,_id,_params,'GET',_callback);
            };
     
            base.request = {
    
                'get': function(_module, _id, _params, _callback){
                    base.request._call(_module,_id,_params,'GET',_callback);
                },
                'post': function(_module, _id, _params, _callback){
                    base.request._call(_module,_id,_params,'POST',_callback);
                },
                '_call':function(_module,_id,_params,_rType,_callback){
                    //Check the url provided
                    var url = base.path + '/modules/' + _module + '/' + _id;
                    
                    $.ajax({
                        url: url,
                        type:_rType,
                        dataType: moappi._dataType,
                        data: _params,
                        cache: false,
                        headers: { "cache-control": "no-cache" },
                        success: function(data) {
                            
                            //Set the header information
                            moappi._getHeader(data);
                          
                            //Process redirects
                            if(!moappi._redirect.call(base,data)) _callback(data);
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            _callback( moappi._response(textStatus + ":" + errorThrown,undefined) );
                        }
                    });                
                }
            };
    
            //Make a call to a url (can be external)
            base.external = function(_url, _params, _callback, _callbackFunc) {
                
                var jsonp,
                    jsonpCallback;
                
                //determine if we should statically set the callback method
                if(_callbackFunc !== undefined) {
                    jsonp = false;
                    jsonpCallback = _callbackFunc;
                }
                
                //Get data from the provided url
                $.ajax({
                    url: _url,
                    dataType: 'jsonp',
                    data: _params,
                    jsonp: jsonp, 
                    jsonpCallback: jsonpCallback,
                    success: function(data, textStatus, jqXHR) {
                      
                      //Make the callback with the proper moappi response
                      _callback( moappi._response(undefined,data) );
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                      _callback( moappi._response(textStatus + ":" + errorThrown,undefined) );
                    }
                });
            };
            
            //Make a call using oauth
            base.oauth = {
                'get':function(_type,_req,_params,_callback){
                    base.oauth._call(_type,_req,_params,'GET',_callback);   
                },
                'post':function(_type,_req,_params,_callback){
                    base.oauth._call(_type,_req,_params,'POST',_callback);   
                },
                '_call':function(_type,_req,_params,_rType,_callback){
                    //Check the url provided
                    var url = base.path + '/oauth/' + _type + '/call/' + _req;
                    
                    $.ajax({
                        url: url,
                        type:_rType,
                        dataType: moappi._dataType,
                        data: _params,
                        cache: false,
                        headers: { "cache-control": "no-cache" },
                        success: function(data) {
                            
                            //Save the header info
                            moappi._getHeader(data);
                               
                            //Process redirects
                            if(!moappi._redirect.call(base,data)) _callback(data);
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            _callback( moappi._response(textStatus + ":" + errorThrown,undefined) );
                        }
                    }); 
                }
            };
        },
        'socket': function(path){
            if(io !== undefined) return(io.connect(path));
            else return(undefined);
        },
        'auth':{
            'fail':'AUTH.FAIL',
            'redirect':'AUTH.REDIRECT'
        },
        
        /* ---------------- Private Members ---------------- */
        '_dataType':'json',
        '_getHeader':function(data){
            var base = this;
            
            base.version = data.header.version;
            base.environment = data.header.environment;
        },
        '_redirect':function(data){
        
            var base = this;
            
            //Make sure we allow redirects
            if(!base.options.redirect) return(false);
            
            //determine if we need to redirect to the logon for auth failure
            if(!data.header.status){
                
                //Check the header details 
                switch(data.header.detail){
                    
                    //If this was an authentication failure
                    case moappi.auth.fail:
                        
                        //And we have a login redirect
                        if(base.options.login) window.location = moappi._login(base.options.login,base.options.href);
                        
                        return(true);
                    break;
                    
                    //If we have a auth redirect 
                    case moappi.auth.redirect:
                        
                        //Redirect
                        window.location = data.header.message;
                        
                        return(true);
                    break;
                }
            }
            
            return(false);
        },
        '_login':function(login,href){
        
            if(href) {
                var operator = "?";
                if(login.indexOf('?') > 0) operator = "&";
                return(login + operator + 'href=' + encodeURIComponent(window.location.href));
            } else return(login);
        },
        
        //Safe Method
        '_response':function(error, response) {
            var out = {
                'header':header(error),
                'response':response
            };
            
            return(out);
        },
        
        //Safe Method
        '_header':function(error) {
            var header = {
                'version':this.version,
                'status':1,
                'detail':'',
                'message':''
            };
            
            if( error ) {
                header.status = 0;
                header.message = error;
            }
            
            return(header);
        }
    };

    window.moappi = moappi;

}).call(this);