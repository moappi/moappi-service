
/* ----------------- node-cache (aka memory-cache) -------------------*/
/* source: https://github.com/ptarjan/node-cache */

var _cache = function(config) {

    var base = this;

    base.cache = {};
    
    base.debug = false;
    
    base.count = {
        "hit":0,
        "miss":0
    };

    if(config) {
        if(config.debug !== undefined) base.debug = config.debug;
    }
};

_cache.prototype.update = function(key, value) {
    
    var base = this;

    if(base.cache[key]) base.cache[key].value = value;
};

_cache.prototype.put = function(key, value, time, timeoutCallback) {
    
    var base = this;
    
    if (base.debug) console.log('caching: '+key+' = '+value+' (@'+time+')');
    
    var oldRecord = base.cache[key];
	
	if (oldRecord) clearTimeout(oldRecord.timeout);
	
	var expire = time + (new Date()).getTime();
	var record = {value: value, expire: expire};

	if (!isNaN(expire)) {
		var timeout = setTimeout(function() {
            base.del(key);
            if (typeof timeoutCallback === 'function') {
                timeoutCallback(key);
            }
        }, time);
        
		record.timeout = timeout;
	}

	base.cache[key] = record;
};

_cache.prototype.del = function(key) {
  
  delete this.cache[key];
};

_cache.prototype.clear = function() {
  this.cache = {};
};

_cache.prototype.get = function(key) {
  var data = this.cache[key];
  if (typeof data != "undefined") {
    if (isNaN(data.expire) || data.expire >= (new Date()).getTime()) {
        if (this.debug) this.count.hit++;
      return data.value;
    } else {
      // free some space
      if (this.debug) this.count.miss++;
      this.del(key);
    }
  } else if (this.debug) {
    this.count.miss++;
  }
  return undefined;
};

_cache.prototype.size = function() { 
  var size = 0, key;
  for (key in this.cache) {
    if (this.cache.hasOwnProperty(key)) 
      if (this.get(key) !== null)
        size++;
  }
  return size;
};

_cache.prototype.memsize = function() { 
  var size = 0, key;
  for (key in this.cache) {
    if (this.cache.hasOwnProperty(key)) 
      size++;
  }
  return size;
};

_cache.prototype.debug = function(bool) {
  this.debug = bool;
};

_cache.prototype.hits = function() {
	return this.count.hit;
};

_cache.prototype.misses = function() {
	return this.count.miss;
};

_cache.prototype.cache = function() {
	return this.cache;
};

//Export the base function
module.exports = _cache;
