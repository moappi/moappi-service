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


