Moappi - Service
=========

Moappi - Service is a framework for developing streamlined web apps using a combination of Node.js and client side tools such as HTML, CSS, Javascript.

## Run
```
$ node service.js <app name>
```

## Javascript Modules - Moappi API

## moappi.request

Provides access to the HTTP request


### moappi.request.params

(object) with all request parameters from GET & POST

Example:

```js
	moappi.request.params.myParam
```

### moappi.request.cookies

(object) with all request cookies

Example:

```js
	moappi.request.cookies.myCookie
```

### moappi.request.headers

(object) all request headers

Example:

```js
	moappi.request.headers.myHeader
```

### moappi.request.session.get(name,callback)

Gets a session parameter value

Parameters: 

- `name` (string, required) - name of the session parameter you want to get
- `callback` (function, required) - callback function with a single parameter 

Callback(err,val):

- `err` error if we couldn't find this varaible in the session
- `val` values if we could find this in the session

Example:

```js
	moappi.request.session.get('user',function(err,user){
		// now do something with the user
	});
```

### moappi.request.session.set(name,val)

Sets a session parameter value

Parameters: 

- `name` (string, required) - name of the session parameter you want to set
- `val` (object, required) - value you would like to set this session variable to 

Example:

```js
	moappi.request.session.set('user',{'id':123});
```





## moappi.response

Provides access to the HTTP response


### moappi.response.end(result)

Ends the response with a status of 1

Parameters: 

- `result` (object, optional) - adds an object to the response 

Response:

```js
{"header":{"version":"0.3.4","environment":"development","status":1,"detail":"","message":""},"response":"result"}
```

Example:

```js
	moappi.response.end("OK");
```

### moappi.response.error(message)

Ends the response with a status of 0

Parameters: 

- `message` (string, optional) - adds a message to the response

Response:

```js
{"header":{"version":"0.3.4","environment":"development","status":0,"detail":"","message":"error message"}}
```

Example:

```js
	moappi.response.error("error message");
```

### moappi.response.flush(err,result)

Ends the response with either a status of 0 (if err) or status of 1

Parameters: 

- `err` (string, optional) - adds an error message to the response
- `result` (object, optional) - adds a object to the response

Example:

```js
	moappi.response.flush("error message",{});
```


## moappi.api

Access to the moappi api

### moappi.api.call(module,request,params,callback)

Calls a moappi api request 

Parameters: 

- `module` (string, required) - moappi module
- `request` (string, required) - moappi request within the module
- `params` (object, required) - parameters passed to the request
- `callback` (function, required) - callback when request is finished

Callback(err,data):

- `err` (object) - error object (inc message parameter)
- `data` (object) - data result

Example:

```js
	moappi.api.call('module','request',{'param1':'test'},function(err,data){

	));
```

### moappi.api.query(sql,database,params,callback)

Queries a database configured in config file

Parameters: 

- `sql` (string, required) - SQL statement
- `database` (string, required) - database name from config file
- `params` (object, required) - parameters passed to the query
- `callback` (function, required) - callback when request is finished

Callback(err,data):

- `err` (object) - error object (inc message parameter)
- `data` (object) - data result

Example:

```js
	moappi.api.query('SELECT * FROM Test','test',{'param1':'test'},function(err,data){

	));
```



## moappi.options

(object) reference to options object in app.json config file

Example:

```js
	moappi.options.myOption
```


## moappi.global

Access to globally shared object between requests and events

### moappi.global.set(var,key,val)

Set a global variable key

Parameters: 

- `var` (string, required) - variable name
- `key` (string, required) - variable key
- `val` (object, required) - variable value

Example:

```js
	moappi.global.set("myVar","myKey","myVal");
```

### moappi.global.get(var,key)

Gets a global variable key

Parameters: 

- `var` (string, required) - variable name
- `key` (string, required) - variable key
- `callback` (function, required) - callback function

Callback(err,val):

- `err` (object) - err (if any)
- `val` (object) - variable key value

Example:

```js
	moappi.global.get("myVar","myKey",function(err,val){
	});
```


## moappi.zmq

ZeroMQ API 

### moappi.zmq.broadcast.emit(name,obj)

Broadcast emit on configured ZMQ named channel

Parameters: 

- `name` (string, required) - name of ZMQ channel 
- `obj` (object, required) - object to broadcast on channel

Example:

```js
	moappi.zmq.broadcast.emit("channel",{"myObj":12});
```


## moappi.socket

Socket access (socket.io)

### moappi.socket.emit(id,channel,data)

Emit on socket

Parameters: 

- `id` (string, required) -  socket id to emit to
- `channel` (string, required) - channel to emit to
- `data` (object, required) - data to send on channel

Example:

```js
	moappi.socket.emit("123","channel",{"myObj":12});
```

### moappi.socket.broadcast(id,channel,data)

Broadcast on socket

Parameters: 

- `id` (string, required) -  socket id to broadcast on 
- `channel` (string, required) - channel to broadcast on
- `data` (object, required) - data to send on channel

Example:

```js
	moappi.socket.broadcast("123","channel",{"myObj":12});
```

### moappi.socket.connect(id,callback)

Connected to socket

Parameters: 

- `id` (string, required) -  socket id to wait until connected
- `callback` (function, required) - callback when connected

Example:

```js
	moappi.socket.connected("123",function(){
		//Socket ready
	});
```



## moappi.oauth

OAUTH Requests

### moappi.oauth.config

(object) Access to OAUTH config

Example:

```js
	moappi.oauth.config.myConfig
```

### moappi.oauth.call(kind,request,params,callback)

Make an OAUTH call from list of requests in config file

Parameters: 

- `kind` (string, required) -  oauth kind to call (from config file)
- `request` (string, required) - oauth request to call (from config file)
- `params` (object, required) - params to send to oauth call
- `callback` (function, required) - callback when oauth is completed

Callback(err,val):

- `err` (object) - err (if any)
- `data` (object) - data returned from OAUTH call

Example:

```js
	moappi.oauth.call('google','account',{'param1':'test'},function(err,data){
	});
```


## moappi.sql

SQL helper requests

### moappi.sql.format(val,type,limit)

Format value for data type & encode special characters

Parameters: 

- `val` (object, required) -  value to format
- `type` (string, optional) - either 'string' or 'number'
- `limit` (object, optional) - limit size of a string

Returns:

(string) - returns formatted string 

Example:

```js
	moappi.sql.format('test string','string',10)
```

### moappi.sql.values(arry,type,limit)

Format values for data type & encode special characters

Parameters: 

- `arry` (array, required) -  values to format
- `type` (string, optional) - either 'string' or 'number'
- `limit` (object, optional) - limit size of a string

Returns:

(array) - returns an array of formatted string

Example:

```js
	moappi.sql.format(['str1','str2'],'string',10)
```