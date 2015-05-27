(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            currentQueue[queueIndex].run();
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
"use strict";
var Promise = require("./promise/promise").Promise;
var polyfill = require("./promise/polyfill").polyfill;
exports.Promise = Promise;
exports.polyfill = polyfill;
},{"./promise/polyfill":8,"./promise/promise":9}],5:[function(require,module,exports){
"use strict";
/* global toString */

var isArray = require("./utils").isArray;
var isFunction = require("./utils").isFunction;

/**
  Returns a promise that is fulfilled when all the given promises have been
  fulfilled, or rejected if any of them become rejected. The return promise
  is fulfilled with an array that gives all the values in the order they were
  passed in the `promises` array argument.

  Example:

  ```javascript
  var promise1 = RSVP.resolve(1);
  var promise2 = RSVP.resolve(2);
  var promise3 = RSVP.resolve(3);
  var promises = [ promise1, promise2, promise3 ];

  RSVP.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `RSVP.all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  var promise1 = RSVP.resolve(1);
  var promise2 = RSVP.reject(new Error("2"));
  var promise3 = RSVP.reject(new Error("3"));
  var promises = [ promise1, promise2, promise3 ];

  RSVP.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @for RSVP
  @param {Array} promises
  @param {String} label
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
*/
function all(promises) {
  /*jshint validthis:true */
  var Promise = this;

  if (!isArray(promises)) {
    throw new TypeError('You must pass an array to all.');
  }

  return new Promise(function(resolve, reject) {
    var results = [], remaining = promises.length,
    promise;

    if (remaining === 0) {
      resolve([]);
    }

    function resolver(index) {
      return function(value) {
        resolveAll(index, value);
      };
    }

    function resolveAll(index, value) {
      results[index] = value;
      if (--remaining === 0) {
        resolve(results);
      }
    }

    for (var i = 0; i < promises.length; i++) {
      promise = promises[i];

      if (promise && isFunction(promise.then)) {
        promise.then(resolver(i), reject);
      } else {
        resolveAll(i, promise);
      }
    }
  });
}

exports.all = all;
},{"./utils":13}],6:[function(require,module,exports){
(function (process,global){
"use strict";
var browserGlobal = (typeof window !== 'undefined') ? window : {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var local = (typeof global !== 'undefined') ? global : (this === undefined? window:this);

// node
function useNextTick() {
  return function() {
    process.nextTick(flush);
  };
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function() {
    node.data = (iterations = ++iterations % 2);
  };
}

function useSetTimeout() {
  return function() {
    local.setTimeout(flush, 1);
  };
}

var queue = [];
function flush() {
  for (var i = 0; i < queue.length; i++) {
    var tuple = queue[i];
    var callback = tuple[0], arg = tuple[1];
    callback(arg);
  }
  queue = [];
}

var scheduleFlush;

// Decide what async method to use to triggering processing of queued callbacks:
if (typeof process !== 'undefined' && {}.toString.call(process) === '[object process]') {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else {
  scheduleFlush = useSetTimeout();
}

function asap(callback, arg) {
  var length = queue.push([callback, arg]);
  if (length === 1) {
    // If length is 1, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    scheduleFlush();
  }
}

exports.asap = asap;
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":3}],7:[function(require,module,exports){
"use strict";
var config = {
  instrument: false
};

function configure(name, value) {
  if (arguments.length === 2) {
    config[name] = value;
  } else {
    return config[name];
  }
}

exports.config = config;
exports.configure = configure;
},{}],8:[function(require,module,exports){
(function (global){
"use strict";
/*global self*/
var RSVPPromise = require("./promise").Promise;
var isFunction = require("./utils").isFunction;

function polyfill() {
  var local;

  if (typeof global !== 'undefined') {
    local = global;
  } else if (typeof window !== 'undefined' && window.document) {
    local = window;
  } else {
    local = self;
  }

  var es6PromiseSupport = 
    "Promise" in local &&
    // Some of these methods are missing from
    // Firefox/Chrome experimental implementations
    "resolve" in local.Promise &&
    "reject" in local.Promise &&
    "all" in local.Promise &&
    "race" in local.Promise &&
    // Older version of the spec had a resolver object
    // as the arg rather than a function
    (function() {
      var resolve;
      new local.Promise(function(r) { resolve = r; });
      return isFunction(resolve);
    }());

  if (!es6PromiseSupport) {
    local.Promise = RSVPPromise;
  }
}

exports.polyfill = polyfill;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./promise":9,"./utils":13}],9:[function(require,module,exports){
"use strict";
var config = require("./config").config;
var configure = require("./config").configure;
var objectOrFunction = require("./utils").objectOrFunction;
var isFunction = require("./utils").isFunction;
var now = require("./utils").now;
var all = require("./all").all;
var race = require("./race").race;
var staticResolve = require("./resolve").resolve;
var staticReject = require("./reject").reject;
var asap = require("./asap").asap;

var counter = 0;

config.async = asap; // default async is asap;

function Promise(resolver) {
  if (!isFunction(resolver)) {
    throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
  }

  if (!(this instanceof Promise)) {
    throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
  }

  this._subscribers = [];

  invokeResolver(resolver, this);
}

function invokeResolver(resolver, promise) {
  function resolvePromise(value) {
    resolve(promise, value);
  }

  function rejectPromise(reason) {
    reject(promise, reason);
  }

  try {
    resolver(resolvePromise, rejectPromise);
  } catch(e) {
    rejectPromise(e);
  }
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value, error, succeeded, failed;

  if (hasCallback) {
    try {
      value = callback(detail);
      succeeded = true;
    } catch(e) {
      failed = true;
      error = e;
    }
  } else {
    value = detail;
    succeeded = true;
  }

  if (handleThenable(promise, value)) {
    return;
  } else if (hasCallback && succeeded) {
    resolve(promise, value);
  } else if (failed) {
    reject(promise, error);
  } else if (settled === FULFILLED) {
    resolve(promise, value);
  } else if (settled === REJECTED) {
    reject(promise, value);
  }
}

var PENDING   = void 0;
var SEALED    = 0;
var FULFILLED = 1;
var REJECTED  = 2;

function subscribe(parent, child, onFulfillment, onRejection) {
  var subscribers = parent._subscribers;
  var length = subscribers.length;

  subscribers[length] = child;
  subscribers[length + FULFILLED] = onFulfillment;
  subscribers[length + REJECTED]  = onRejection;
}

function publish(promise, settled) {
  var child, callback, subscribers = promise._subscribers, detail = promise._detail;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    invokeCallback(settled, child, callback, detail);
  }

  promise._subscribers = null;
}

Promise.prototype = {
  constructor: Promise,

  _state: undefined,
  _detail: undefined,
  _subscribers: undefined,

  then: function(onFulfillment, onRejection) {
    var promise = this;

    var thenPromise = new this.constructor(function() {});

    if (this._state) {
      var callbacks = arguments;
      config.async(function invokePromiseCallback() {
        invokeCallback(promise._state, thenPromise, callbacks[promise._state - 1], promise._detail);
      });
    } else {
      subscribe(this, thenPromise, onFulfillment, onRejection);
    }

    return thenPromise;
  },

  'catch': function(onRejection) {
    return this.then(null, onRejection);
  }
};

Promise.all = all;
Promise.race = race;
Promise.resolve = staticResolve;
Promise.reject = staticReject;

function handleThenable(promise, value) {
  var then = null,
  resolved;

  try {
    if (promise === value) {
      throw new TypeError("A promises callback cannot return that same promise.");
    }

    if (objectOrFunction(value)) {
      then = value.then;

      if (isFunction(then)) {
        then.call(value, function(val) {
          if (resolved) { return true; }
          resolved = true;

          if (value !== val) {
            resolve(promise, val);
          } else {
            fulfill(promise, val);
          }
        }, function(val) {
          if (resolved) { return true; }
          resolved = true;

          reject(promise, val);
        });

        return true;
      }
    }
  } catch (error) {
    if (resolved) { return true; }
    reject(promise, error);
    return true;
  }

  return false;
}

function resolve(promise, value) {
  if (promise === value) {
    fulfill(promise, value);
  } else if (!handleThenable(promise, value)) {
    fulfill(promise, value);
  }
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) { return; }
  promise._state = SEALED;
  promise._detail = value;

  config.async(publishFulfillment, promise);
}

function reject(promise, reason) {
  if (promise._state !== PENDING) { return; }
  promise._state = SEALED;
  promise._detail = reason;

  config.async(publishRejection, promise);
}

function publishFulfillment(promise) {
  publish(promise, promise._state = FULFILLED);
}

function publishRejection(promise) {
  publish(promise, promise._state = REJECTED);
}

exports.Promise = Promise;
},{"./all":5,"./asap":6,"./config":7,"./race":10,"./reject":11,"./resolve":12,"./utils":13}],10:[function(require,module,exports){
"use strict";
/* global toString */
var isArray = require("./utils").isArray;

/**
  `RSVP.race` allows you to watch a series of promises and act as soon as the
  first promise given to the `promises` argument fulfills or rejects.

  Example:

  ```javascript
  var promise1 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve("promise 1");
    }, 200);
  });

  var promise2 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve("promise 2");
    }, 100);
  });

  RSVP.race([promise1, promise2]).then(function(result){
    // result === "promise 2" because it was resolved before promise1
    // was resolved.
  });
  ```

  `RSVP.race` is deterministic in that only the state of the first completed
  promise matters. For example, even if other promises given to the `promises`
  array argument are resolved, but the first completed promise has become
  rejected before the other promises became fulfilled, the returned promise
  will become rejected:

  ```javascript
  var promise1 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      resolve("promise 1");
    }, 200);
  });

  var promise2 = new RSVP.Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error("promise 2"));
    }, 100);
  });

  RSVP.race([promise1, promise2]).then(function(result){
    // Code here never runs because there are rejected promises!
  }, function(reason){
    // reason.message === "promise2" because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  @method race
  @for RSVP
  @param {Array} promises array of promises to observe
  @param {String} label optional string for describing the promise returned.
  Useful for tooling.
  @return {Promise} a promise that becomes fulfilled with the value the first
  completed promises is resolved with if the first completed promise was
  fulfilled, or rejected with the reason that the first completed promise
  was rejected with.
*/
function race(promises) {
  /*jshint validthis:true */
  var Promise = this;

  if (!isArray(promises)) {
    throw new TypeError('You must pass an array to race.');
  }
  return new Promise(function(resolve, reject) {
    var results = [], promise;

    for (var i = 0; i < promises.length; i++) {
      promise = promises[i];

      if (promise && typeof promise.then === 'function') {
        promise.then(resolve, reject);
      } else {
        resolve(promise);
      }
    }
  });
}

exports.race = race;
},{"./utils":13}],11:[function(require,module,exports){
"use strict";
/**
  `RSVP.reject` returns a promise that will become rejected with the passed
  `reason`. `RSVP.reject` is essentially shorthand for the following:

  ```javascript
  var promise = new RSVP.Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  var promise = RSVP.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @for RSVP
  @param {Any} reason value that the returned promise will be rejected with.
  @param {String} label optional string for identifying the returned promise.
  Useful for tooling.
  @return {Promise} a promise that will become rejected with the given
  `reason`.
*/
function reject(reason) {
  /*jshint validthis:true */
  var Promise = this;

  return new Promise(function (resolve, reject) {
    reject(reason);
  });
}

exports.reject = reject;
},{}],12:[function(require,module,exports){
"use strict";
function resolve(value) {
  /*jshint validthis:true */
  if (value && typeof value === 'object' && value.constructor === this) {
    return value;
  }

  var Promise = this;

  return new Promise(function(resolve) {
    resolve(value);
  });
}

exports.resolve = resolve;
},{}],13:[function(require,module,exports){
"use strict";
function objectOrFunction(x) {
  return isFunction(x) || (typeof x === "object" && x !== null);
}

function isFunction(x) {
  return typeof x === "function";
}

function isArray(x) {
  return Object.prototype.toString.call(x) === "[object Array]";
}

// Date.now is not available in browsers < IE9
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now#Compatibility
var now = Date.now || function() { return new Date().getTime(); };


exports.objectOrFunction = objectOrFunction;
exports.isFunction = isFunction;
exports.isArray = isArray;
exports.now = now;
},{}],14:[function(require,module,exports){
(function (DeLorean) {
  'use strict';

  // There are two main concepts in Flux structure: **Dispatchers** and **Stores**.
  // Action Creators are simply helpers but doesn't require any framework level
  // abstraction.

  var Dispatcher, Store;

  // ## Private Helper Functions

  // Helper functions are private functions to be used in codebase.
  // It's better using two underscore at the beginning of the function.

  /* `__hasOwn` function is a shortcut for `Object#hasOwnProperty` */
  function __hasOwn(object, prop) {
    return Object.prototype.hasOwnProperty.call(object, prop);
  }

  // Use `__generateActionName` function to generate action names.
  // E.g. If you create an action with name `hello` it will be
  // `action:hello` for the Flux.
  function __generateActionName(name) {
    return 'action:' + name;
  }

  /* It's used by the schemes to save the original version (not calculated)
     of the data. */
  function __generateOriginalName(name) {
    return 'original:' + name;
  }

  // `__findDispatcher` is a private function for **React components**.
  function __findDispatcher(view) {
     // Provide a useful error message if no dispatcher is found in the chain
    if (view == null) {
      throw 'No dispatcher found. The DeLoreanJS mixin requires a "dispatcher" property to be passed to a component, or one of it\'s ancestors.';
    }
    /* `view` should be a component instance. If a component don't have
        any dispatcher, it tries to find a dispatcher from the parents. */
    if (!view.props.dispatcher) {
      return __findDispatcher(view._owner);
    }
    return view.props.dispatcher;
  }

  // `__clone` creates a deep copy of an object.
  function __clone(obj) {
    if (obj === null || typeof obj !== 'object') { return obj; }
    var copy = obj.constructor();
    for (var attr in obj) {
      if (__hasOwn(obj, attr)) {
        copy[attr] = __clone(obj[attr]);
      }
    }
    return copy;
  }

  // `__extend` adds props to obj
  function __extend(obj, props) {
    props = __clone(props);
    for (var prop in props) {
      if (props.hasOwnProperty(prop)) {
        obj[prop] = props[prop];
      }
    }
    return obj;
  }

  // ## Dispatcher

  // The dispatcher is **the central hub** that **manages all data flow** in
  // a Flux application. It is essentially a _registry of callbacks into the
  // stores_. Each store registers itself and provides a callback. When the
  // dispatcher responds to an action, all stores in the application are sent
  // the data payload provided by the action via the callbacks in the registry.
  Dispatcher = (function () {

    // ### Dispatcher Helpers

    // Rollback listener adds a `rollback` event listener to the bunch of
    // stores.
    function __rollbackListener(stores) {

      function __listener() {
        for (var i in stores) {
          stores[i].listener.emit('__rollback');
        }
      }

      /* If any of them fires `rollback` event, all of the stores
         will be emitted to be rolled back with `__rollback` event. */
      for (var j in stores) {
        stores[j].listener.on('rollback', __listener);
      }
    }

    // ### Dispatcher Prototype
    function Dispatcher(stores) {
      var self = this;
      // `DeLorean.EventEmitter` is `require('events').EventEmitter` by default.
      // you can change it using `DeLorean.Flux.define('EventEmitter', AnotherEventEmitter)`
      this.listener = new DeLorean.EventEmitter();
      this.stores = stores;

      /* Stores should be listened for rollback events. */
      __rollbackListener(Object.keys(stores).map(function (key) {
        return stores[key];
      }));
    }

    // `dispatch` method dispatch the event with `data` (or **payload**)
    Dispatcher.prototype.dispatch = function () {
      var self = this, stores, deferred, args;
      args = Array.prototype.slice.call(arguments);
      
      this.listener.emit.apply(this.listener, ['dispatch'].concat(args));
      
      /* Stores are key-value pairs. Collect store instances into an array. */
      stores = (function () {
        var stores = [], store;
        for (var storeName in self.stores) {
          store = self.stores[storeName];
          /* Store value must be an _instance of Store_. */
          if (!store instanceof Store) {
            throw 'Given store is not a store instance';
          }
          stores.push(store);
        }
        return stores;
      }());

      // Store instances should wait for finish. So you can know if all the
      // stores are dispatched properly.
      deferred = this.waitFor(stores, args[0]);

      /* Payload should send to all related stores. */
      for (var storeName in self.stores) {
        self.stores[storeName].dispatchAction.apply(self.stores[storeName], args);
      }

      // `dispatch` returns deferred object you can just use **promise**
      // for dispatching: `dispatch(..).then(..)`.
      return deferred;
    };

    // `waitFor` is actually a _semi-private_ method. Because it's kind of internal
    // and you don't need to call it from outside most of the times. It takes
    // array of store instances (`[Store, Store, Store, ...]`). It will create
    // a promise and return it. _Whenever store changes, it resolves the promise_.
    Dispatcher.prototype.waitFor = function (stores, actionName) {
      var self = this, promises;
      promises = (function () {
        var __promises = [], promise;

        /* `__promiseGenerator` generates a simple promise that resolves itself when
            related store is changed. */
        function __promiseGenerator(store) {
          // `DeLorean.Promise` is `require('es6-promise').Promise` by default.
          // you can change it using `DeLorean.Flux.define('Promise', AnotherPromise)`
          return new DeLorean.Promise(function (resolve, reject) {
            store.listener.once('change', resolve);
          });
        }

        for (var i in stores) {
          // Only generate promises for stores that ae listening for this action
          if (stores[i].actions && stores[i].actions[actionName] != null) {
            promise = __promiseGenerator(stores[i]);
            __promises.push(promise);
          }
        }
        return __promises;
      }());
      // When all the promises are resolved, dispatcher emits `change:all` event.
      return DeLorean.Promise.all(promises).then(function () {
        self.listener.emit('change:all');
      });
    };

    // `registerAction` method adds a method to the prototype. So you can just use
    // `dispatcherInstance.actionName()`.
    Dispatcher.prototype.registerAction = function (action, callback) {
      /* The callback must be a function. */
      if (typeof callback === 'function') {
        this[action] = callback.bind(this.stores);
      } else {
        throw 'Action callback should be a function.';
      }
    };

    // `register` method adds an global action callback to the dispatcher.
    Dispatcher.prototype.register = function (callback) {
      /* The callback must be a function. */
      if (typeof callback === 'function') {
        this.listener.on('dispatch', callback);
      } else {
        throw 'Global callback should be a function.';
      }
    };

    // `getStore` returns the store from stores hash.
    // You can also use `dispatcherInstance.stores[storeName]` but
    // it checks if the store really exists.
    Dispatcher.prototype.getStore = function (storeName) {
      if (!this.stores[storeName]) {
        throw 'Store ' + storeName + ' does not exist.';
      }
      return this.stores[storeName].getState();
    };

    // ### Shortcuts

    Dispatcher.prototype.on = function () {
      return this.listener.on.apply(this.listener, arguments);
    };

    Dispatcher.prototype.off = function () {
      return this.listener.removeListener.apply(this.listener, arguments);
    };

    Dispatcher.prototype.emit = function () {
      return this.listener.emit.apply(this.listener, arguments);
    };

    return Dispatcher;
  }());

  // ## Store

  // Stores contain the application state and logic. Their role is somewhat similar
  // to a model in a traditional MVC, but they manage the state of many objects.
  // Unlike MVC models, they are not instances of one object, nor are they the
  // same as Backbone's collections. More than simply managing a collection of
  // ORM-style objects, stores manage the application state for a particular
  // domain within the application.
  Store = (function () {

    // ### Store Prototype
    function Store(args) {
      if (!this.state) {
        this.state = {};
      }

      // `DeLorean.EventEmitter` is `require('events').EventEmitter` by default.
      // you can change it using `DeLorean.Flux.define('EventEmitter', AnotherEventEmitter)`
      this.listener = new DeLorean.EventEmitter();
      this.bindActions();
      this.buildScheme();

      this.initialize.apply(this, arguments);
    }

    Store.prototype.initialize = function () {

    };

    Store.prototype.get = function (arg) {
      return this.state[arg];
    };

    // `set` method updates the data defined at the `scheme` of the store.
    Store.prototype.set = function (arg1, value) {
      var changedProps = [];
      if (typeof arg1 === 'object') {
        for (var keyName in arg1) {
          changedProps.push(keyName);
          this.setValue(keyName, arg1[keyName]);
        }
      } else {
        changedProps.push(arg1);
        this.setValue(arg1, value);
      }
      this.recalculate(changedProps);
      return this.state[arg1];
    };

    // `set` method updates the data defined at the `scheme` of the store.
    Store.prototype.setValue = function (key, value) {
      var scheme = this.scheme, definition;
      if (scheme && this.scheme[key]) {
        definition = scheme[key];

        // This will allow you to directly set falsy values before falling back to the definition default
        this.state[key] = (typeof value !== 'undefined') ? value : definition.default;

        if (typeof definition.calculate === 'function') {
          this.state[__generateOriginalName(key)] = value;
          this.state[key] = definition.calculate.call(this, value);
        }
      } else {
        // Scheme **must** include the key you wanted to set.
        if (console != null) {
          console.warn('Scheme must include the key, ' + key + ', you are trying to set. ' + key + ' will NOT be set on the store.');
        }
      }
      return this.state[key];
    };

    // Removes the scheme format and standardizes all the shortcuts.
    // If you run `formatScheme({name: 'joe'})` it will return you
    // `{name: {default: 'joe'}}`. Also if you run `formatScheme({fullname: function () {}})`
    // it will return `{fullname: {calculate: function () {}}}`.
    Store.prototype.formatScheme = function (scheme) {
      var formattedScheme = {}, definition, defaultValue, calculatedValue;
      for (var keyName in scheme) {
        definition = scheme[keyName];
        defaultValue = null;
        calculatedValue = null;

        formattedScheme[keyName] = {default: null};

        /* {key: 'value'} will be {key: {default: 'value'}} */
        defaultValue = (definition && typeof definition === 'object') ?
                        definition.default : definition;
        formattedScheme[keyName].default = defaultValue;

        /* {key: function () {}} will be {key: {calculate: function () {}}} */
        if (definition && typeof definition.calculate === 'function') {
          calculatedValue = definition.calculate;
          /* Put a dependency array on formattedSchemes with calculate defined */
          if (definition.deps) {
            formattedScheme[keyName].deps = definition.deps;
          } else {
            formattedScheme[keyName].deps = [];
          }

        } else if (typeof definition === 'function') {
          calculatedValue = definition;
        }
        if (calculatedValue) {
          formattedScheme[keyName].calculate = calculatedValue;
        }
      }
      return formattedScheme;
    };

    /* Applying `scheme` to the store if exists. */
    Store.prototype.buildScheme = function () {
      var scheme, calculatedData, keyName, definition, dependencyMap, dependents, dep, changedProps = [];

      if (typeof this.scheme === 'object') {
        /* Scheme must be formatted to standardize the keys. */
        scheme = this.scheme = this.formatScheme(this.scheme);
        dependencyMap = this.__dependencyMap = {};

        /* Set the defaults first */
        for (keyName in scheme) {
          definition = scheme[keyName];
          this.state[keyName] = __clone(definition.default);
        }

        /* Set the calculations */
        for (keyName in scheme) {
          definition = scheme[keyName];
          if (definition.calculate) {
            // Create a dependency map - {keyName: [arrayOfKeysThatDependOnIt]}
            dependents = definition.deps || [];

            for (var i = 0; i < dependents.length; i++) {
              dep = dependents[i];
              if (dependencyMap[dep] == null) {
                dependencyMap[dep] = [];
              }
              dependencyMap[dep].push(keyName);
            }

            this.state[__generateOriginalName(keyName)] = definition.default;
            this.state[keyName] = definition.calculate.call(this, definition.default);
            changedProps.push(keyName);
          }
        }
        // Recalculate any properties dependent on those that were just set
        this.recalculate(changedProps);
      }
    };

    Store.prototype.recalculate = function (changedProps) {
      var scheme = this.scheme, dependencyMap = this.__dependencyMap, didRun = [], definition, keyName, dependents, dep;
      // Only iterate over the properties that just changed
      for (var i = 0; i < changedProps.length; i++) {
        dependents = dependencyMap[changedProps[i]];
        // If there are no properties dependent on this property, do nothing
        if (dependents == null) {
          continue;
        }
        // Iterate over the dependendent properties
        for (var d = 0; d < dependents.length; d++) {
          dep = dependents[d];
          // Do nothing if this value has already been recalculated on this change batch
          if (didRun.indexOf(dep) !== -1) {
            continue;
          }
          // Calculate this value
          definition = scheme[dep];
          this.state[dep] = definition.calculate.call(this,
                            this.state[__generateOriginalName(dep)] || definition.default);

          // Make sure this does not get calculated again in this change batch
          didRun.push(dep);
        }
      }
      // Update Any deps on the deps
      if (didRun.length > 0) {
        this.recalculate(didRun);
      }
      this.listener.emit('change');
    };

    Store.prototype.getState = function () {
      return this.state;
    };

    Store.prototype.clearState = function () {
      this.state = {};
      return this;
    };

    Store.prototype.resetState = function () {
      this.buildScheme();
      this.listener.emit('change');
      return this;
    };

    // Stores must have a `actions` hash of `actionName: methodName`
    // `methodName` is the `this.store`'s prototype method..
    Store.prototype.bindActions = function () {
      var callback;

      this.emitChange = this.listener.emit.bind(this.listener, 'change');
      this.emitRollback = this.listener.emit.bind(this.listener, 'rollback');
      this.rollback = this.listener.on.bind(this.listener, '__rollback');
      this.emit = this.listener.emit.bind(this.listener);

      for (var actionName in this.actions) {
        if (__hasOwn(this.actions, actionName)) {
          callback = this.actions[actionName];
          if (typeof this[callback] !== 'function') {
            throw 'Callback \'' + callback + '\' defined for action \'' + actionName + '\' should be a method defined on the store!';
          }
          /* And `actionName` should be a name generated by `__generateActionName` */
          this.listener.on(__generateActionName(actionName), this[callback].bind(this));
        }
      }
    };

    // `dispatchAction` called from a dispatcher. You can also call anywhere but
    // you probably won't need to do. It simply **emits an event with a payload**.
    Store.prototype.dispatchAction = function (actionName, data) {
      this.listener.emit(__generateActionName(actionName), data);
    };

    // ### Shortcuts

    // `listenChanges` is a shortcut for `Object.observe` usage. You can just use
    // `Object.observe(object, function () { ... })` but everytime you use it you
    // repeat yourself. DeLorean has a shortcut doing this properly.
    Store.prototype.listenChanges = function (object) {
      var self = this, observer;
      if (!Object.observe) {
        console.error('Store#listenChanges method uses Object.observe, you should fire changes manually.');
        return;
      }

      observer = Array.isArray(object) ? Array.observe : Object.observe;

      observer(object, function (changes) {
        self.listener.emit('change', changes);
      });
    };

    // `onChange` simply listens changes and calls a callback. Shortcut for
    // a `on('change')` command.
    Store.prototype.onChange = function (callback) {
      this.listener.on('change', callback);
    };

    return Store;
  }());

  // ### Flux Wrapper
  DeLorean.Flux = {

    // `createStore` generates a store based on the definition
    createStore: function (definition) {
      /* store parameter must be an `object` */
      if (typeof definition !== 'object') {
        throw 'Stores should be defined by passing the definition to the constructor';
      }

      // extends the store with the definition attributes
      var Child = function () { return Store.apply(this, arguments); };
      var Surrogate = function () { this.constructor = Child; };
      Surrogate.prototype = Store.prototype;
      Child.prototype = new Surrogate();

      __extend(Child.prototype, definition);

      return new Child();
    },

    // `createDispatcher` generates a dispatcher with actions to dispatch.
    /* `actionsToDispatch` should be an object. */
    createDispatcher: function (actionsToDispatch) {
      var actionsOfStores, dispatcher, callback, triggers, triggerMethod;

      // If it has `getStores` method it should be get and pass to the `Dispatcher`
      if (typeof actionsToDispatch.getStores === 'function') {
        actionsOfStores = actionsToDispatch.getStores();
      }

      /* If there are no stores defined, it's an empty object. */
      dispatcher = new Dispatcher(actionsOfStores || {});

      /* Now call `registerAction` method for every action. */
      for (var actionName in actionsToDispatch) {
        if (__hasOwn(actionsToDispatch, actionName)) {
          /* `getStores` & `viewTriggers` are special properties, it's not an action. Also an extra check to make sure we're binding to a function */
          if (actionName !== 'getStores' && actionName !== 'viewTriggers' && typeof actionsToDispatch[actionName] === 'function') {
            callback = actionsToDispatch[actionName];
            dispatcher.registerAction(actionName, callback.bind(dispatcher));
          }
        }
      }

      /* Bind triggers */
      triggers = actionsToDispatch.viewTriggers;
      for (var triggerName in triggers) {
        triggerMethod = triggers[triggerName];
        if (typeof dispatcher[triggerMethod] === 'function') {
          dispatcher.on(triggerName, dispatcher[triggerMethod]);
        } else {
          if (console != null) {
            console.warn(triggerMethod + ' should be a method defined on your dispatcher. The ' + triggerName + ' trigger will not be bound to any method.');
          }
        }
      }

      return dispatcher;
    },
    // ### `DeLorean.Flux.define`
    // It's a key to _hack_ DeLorean easily. You can just inject something
    // you want to define.
    define: function (key, value) {
      DeLorean[key] = value;
    }
  };

  // Store and Dispatcher are the only base classes of DeLorean.
  DeLorean.Dispatcher = Dispatcher;
  DeLorean.Store = Store;

  // ## Built-in React Mixin
  DeLorean.Flux.mixins = {
    // It should be inserted to the React components which
    // used in Flux.
    // Simply `mixin: [Flux.mixins.storeListener]` will work.
    storeListener: {

      trigger: function () {
        this.__dispatcher.emit.apply(this.__dispatcher, arguments);
      },

      // After the component mounted, listen changes of the related stores
      componentDidMount: function () {
        var self = this, store, storeName;

        /* `__changeHandler` is a **listener generator** to pass to the `onChange` function. */
        function __changeHandler(store, storeName) {
          return function () {
            var state, args;
            /* If the component is mounted, change state. */
            if (self.isMounted()) {
              self.setState(self.getStoreStates());
            }
            // When something changes it calls the components `storeDidChanged` method if exists.
            if (self.storeDidChange) {
              args = [storeName].concat(Array.prototype.slice.call(arguments, 0));
              self.storeDidChange.apply(self, args);
            }
          };
        }

        // Remember the change handlers so they can be removed later
        this.__changeHandlers = {};

        /* Generate and bind the change handlers to the stores. */
        for (storeName in this.__watchStores) {
          if (__hasOwn(this.stores, storeName)) {
            store = this.stores[storeName];
            this.__changeHandlers[storeName] = __changeHandler(store, storeName);
            store.onChange(this.__changeHandlers[storeName]);
          }
        }
      },

      // When a component unmounted, it should stop listening.
      componentWillUnmount: function () {
        for (var storeName in this.__changeHandlers) {
          if (__hasOwn(this.stores, storeName)) {
            var store = this.stores[storeName];
            store.listener.removeListener('change', this.__changeHandlers[storeName]);
          }
        }
      },

      getInitialState: function () {
        var self = this, state, storeName;

        /* The dispatcher should be easy to access and it should use `__findDispatcher`
           method to find the parent dispatchers. */
        this.__dispatcher = __findDispatcher(this);

        // If `storesDidChange` method presents, it'll be called after all the stores
        // were changed.
        if (this.storesDidChange) {
          this.__dispatcher.on('change:all', function () {
            self.storesDidChange();
          });
        }

        // Since `dispatcher.stores` is harder to write, there's a shortcut for it.
        // You can use `this.stores` from the React component.
        this.stores = this.__dispatcher.stores;

        this.__watchStores = {};
        if (this.watchStores != null) {
          for (var i = 0; i < this.watchStores.length;  i++) {
            storeName = this.watchStores[i];
            this.__watchStores[storeName] = this.stores[storeName];
          }
        } else {
          this.__watchStores = this.stores;
          if (console != null && Object.keys != null && Object.keys(this.stores).length > 4) {
            console.warn('Your component is watching changes on all stores, you may want to define a "watchStores" property in order to only watch stores relevant to this component.');
          }
        }

        return this.getStoreStates();
      },

      getStoreStates: function () {
        var state = {stores: {}}, store;

        /* Set `state.stores` for all present stores with a `setState` method defined. */
        for (var storeName in this.__watchStores) {
          if (__hasOwn(this.stores, storeName)) {
            state.stores[storeName] = this.__watchStores[storeName].getState();
          }
        }
        return state;
      },

      // `getStore` is a shortcut to get the store from the state.
      getStore: function (storeName) {
        return this.state.stores[storeName];
      }
    }
  };

  // ## DeLorean API
  // DeLorean can be used in **CommonJS** projects.
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {

    var requirements = require('./requirements');
    for (var requirement in requirements) {
      DeLorean.Flux.define(requirement, requirements[requirement]);
    }
    module.exports = DeLorean;

  // It can be also used in **AMD** projects, too.
  // And if there is no module system initialized, just pass the DeLorean
  // to the `window`.
  } else {
    if (typeof define === 'function' && define.amd) {
      define(['./requirements.js'], function (requirements) {
        // Import Modules in require.js pattern
        for (var requirement in requirements) {
          DeLorean.Flux.define(requirement, requirements[requirement]);
        }

        return DeLorean;
      });
    } else {
      window.DeLorean = DeLorean;
    }
  }

})({});

},{"./requirements":15}],15:[function(require,module,exports){
// ## Dependency injection file.

// You can change dependencies using `DeLorean.Flux.define`. There are
// two dependencies now: `EventEmitter` and `Promise`
var requirements;

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = requirements = {
    // DeLorean uses **Node.js native EventEmitter** for event emittion
    EventEmitter: require('events').EventEmitter,
    // and **es6-promise** for Deferred object management.
    Promise: require('es6-promise').Promise
  };
} else if (typeof define === 'function' && define.amd) {
  define(function (require, exports, module) {
    var events = require('events'),
        promise = require('es6-promise');

    // Return the module value - http://requirejs.org/docs/api.html#cjsmodule
    // Using simplified wrapper
    return {
      // DeLorean uses **Node.js native EventEmitter** for event emittion
      EventEmitter: require('events').EventEmitter,
      // and **es6-promise** for Deferred object management.
      Promise: require('es6-promise').Promise
    };
  });
} else {
  window.DeLorean = DeLorean;
}

// It's better you don't change them if you really need to.

// This library needs to work for Browserify and also standalone.
// If DeLorean is defined, it means it's called from the browser, not
// the browserify.

if (typeof DeLorean !== 'undefined') {
  for (var requirement in requirements) {
    DeLorean.Flux.define(requirement, requirements[requirement]);
  }
}

},{"es6-promise":4,"events":2}],16:[function(require,module,exports){
/*! Flight v1.5.0 | (c) Twitter, Inc. | MIT License */
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define(factory);
	else if(typeof exports === 'object')
		exports["flight"] = factory();
	else
		root["flight"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/* Copyright 2013 Twitter, Inc. Licensed under The MIT License. http://opensource.org/licenses/MIT */

!(__WEBPACK_AMD_DEFINE_ARRAY__ = [
    __webpack_require__(1),
    __webpack_require__(2),
    __webpack_require__(3),
    __webpack_require__(4),
    __webpack_require__(5),
    __webpack_require__(6),
    __webpack_require__(7)
  ], __WEBPACK_AMD_DEFINE_RESULT__ = function(advice, component, compose, debug, logger, registry, utils) {
    'use strict';

    return {
      advice: advice,
      component: component,
      compose: compose,
      debug: debug,
      logger: logger,
      registry: registry,
      utils: utils
    };

  }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/* Copyright 2013 Twitter, Inc. Licensed under The MIT License. http://opensource.org/licenses/MIT */

!(__WEBPACK_AMD_DEFINE_ARRAY__ = [
    __webpack_require__(7)
  ], __WEBPACK_AMD_DEFINE_RESULT__ = function(utils) {
    'use strict';

    var advice = {

      around: function(base, wrapped) {
        return function composedAround() {
          // unpacking arguments by hand benchmarked faster
          var i = 0, l = arguments.length, args = new Array(l + 1);
          args[0] = base.bind(this);
          for (; i < l; i++) {
            args[i + 1] = arguments[i];
          }
          return wrapped.apply(this, args);
        };
      },

      before: function(base, before) {
        var beforeFn = (typeof before == 'function') ? before : before.obj[before.fnName];
        return function composedBefore() {
          beforeFn.apply(this, arguments);
          return base.apply(this, arguments);
        };
      },

      after: function(base, after) {
        var afterFn = (typeof after == 'function') ? after : after.obj[after.fnName];
        return function composedAfter() {
          var res = (base.unbound || base).apply(this, arguments);
          afterFn.apply(this, arguments);
          return res;
        };
      },

      // a mixin that allows other mixins to augment existing functions by adding additional
      // code before, after or around.
      withAdvice: function() {
        ['before', 'after', 'around'].forEach(function(m) {
          this[m] = function(method, fn) {
            var methods = method.trim().split(' ');

            methods.forEach(function(i) {
              utils.mutateProperty(this, i, function() {
                if (typeof this[i] == 'function') {
                  this[i] = advice[m](this[i], fn);
                } else {
                  this[i] = fn;
                }

                return this[i];
              });
            }, this);
          };
        }, this);
      }
    };

    return advice;
  }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));


/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/* Copyright 2013 Twitter, Inc. Licensed under The MIT License. http://opensource.org/licenses/MIT */

!(__WEBPACK_AMD_DEFINE_ARRAY__ = [
    __webpack_require__(1),
    __webpack_require__(7),
    __webpack_require__(3),
    __webpack_require__(8),
    __webpack_require__(6),
    __webpack_require__(5),
    __webpack_require__(4)
  ], __WEBPACK_AMD_DEFINE_RESULT__ = function(advice, utils, compose, withBase, registry, withLogging, debug) {
    'use strict';

    var functionNameRegEx = /function (.*?)\s?\(/;
    var ignoredMixin = {
      withBase: true,
      withLogging: true
    };

    // teardown for all instances of this constructor
    function teardownAll() {
      var componentInfo = registry.findComponentInfo(this);

      componentInfo && Object.keys(componentInfo.instances).forEach(function(k) {
        var info = componentInfo.instances[k];
        // It's possible that a previous teardown caused another component to teardown,
        // so we can't assume that the instances object is as it was.
        if (info && info.instance) {
          info.instance.teardown();
        }
      });
    }

    function attachTo(selector/*, options args */) {
      // unpacking arguments by hand benchmarked faster
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) {
        args[i - 1] = arguments[i];
      }

      if (!selector) {
        throw new Error('Component needs to be attachTo\'d a jQuery object, native node or selector string');
      }

      var options = utils.merge.apply(utils, args);
      var componentInfo = registry.findComponentInfo(this);

      $(selector).each(function(i, node) {
        if (componentInfo && componentInfo.isAttachedTo(node)) {
          // already attached
          return;
        }

        (new this).initialize(node, options);
      }.bind(this));
    }

    function prettyPrintMixins() {
      //could be called from constructor or constructor.prototype
      var mixedIn = this.mixedIn || this.prototype.mixedIn || [];
      return mixedIn.map(function(mixin) {
        if (mixin.name == null) {
          // function name property not supported by this browser, use regex
          var m = mixin.toString().match(functionNameRegEx);
          return (m && m[1]) ? m[1] : '';
        }
        return (!ignoredMixin[mixin.name] ? mixin.name : '');
      }).filter(Boolean).join(', ');
    };


    // define the constructor for a custom component type
    // takes an unlimited number of mixin functions as arguments
    // typical api call with 3 mixins: define(timeline, withTweetCapability, withScrollCapability);
    function define(/*mixins*/) {
      // unpacking arguments by hand benchmarked faster
      var l = arguments.length;
      var mixins = new Array(l);
      for (var i = 0; i < l; i++) {
        mixins[i] = arguments[i];
      }

      var Component = function() {};

      Component.toString = Component.prototype.toString = prettyPrintMixins;
      if (debug.enabled) {
        Component.describe = Component.prototype.describe = Component.toString();
      }

      // 'options' is optional hash to be merged with 'defaults' in the component definition
      Component.attachTo = attachTo;
      // enables extension of existing "base" Components
      Component.mixin = function() {
        var newComponent = define(); //TODO: fix pretty print
        var newPrototype = Object.create(Component.prototype);
        newPrototype.mixedIn = [].concat(Component.prototype.mixedIn);
        newPrototype.defaults = utils.merge(Component.prototype.defaults);
        newPrototype.attrDef = Component.prototype.attrDef;
        compose.mixin(newPrototype, arguments);
        newComponent.prototype = newPrototype;
        newComponent.prototype.constructor = newComponent;
        return newComponent;
      };
      Component.teardownAll = teardownAll;

      // prepend common mixins to supplied list, then mixin all flavors
      if (debug.enabled) {
        mixins.unshift(withLogging);
      }
      mixins.unshift(withBase, advice.withAdvice, registry.withRegistration);
      compose.mixin(Component.prototype, mixins);

      return Component;
    }

    define.teardownAll = function() {
      registry.components.slice().forEach(function(c) {
        c.component.teardownAll();
      });
      registry.reset();
    };

    return define;
  }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));


/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/* Copyright 2013 Twitter, Inc. Licensed under The MIT License. http://opensource.org/licenses/MIT */

!(__WEBPACK_AMD_DEFINE_ARRAY__ = [
    __webpack_require__(7)
  ], __WEBPACK_AMD_DEFINE_RESULT__ = function(utils) {
    'use strict';

    var dontLock = ['mixedIn', 'attrDef'];

    function setWritability(obj, writable) {
      Object.keys(obj).forEach(function (key) {
        if (dontLock.indexOf(key) < 0) {
          utils.propertyWritability(obj, key, writable);
        }
      });
    }

    function mixin(base, mixins) {
      base.mixedIn = Object.prototype.hasOwnProperty.call(base, 'mixedIn') ? base.mixedIn : [];

      for (var i = 0; i < mixins.length; i++) {
        if (base.mixedIn.indexOf(mixins[i]) == -1) {
          setWritability(base, false);
          mixins[i].call(base);
          base.mixedIn.push(mixins[i]);
        }
      }

      setWritability(base, true);
    }

    return {
      mixin: mixin
    };

  }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/* Copyright 2013 Twitter, Inc. Licensed under The MIT License. http://opensource.org/licenses/MIT */

!(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(6)], __WEBPACK_AMD_DEFINE_RESULT__ = function(registry) {
    'use strict';

    // ==========================================
    // Search object model
    // ==========================================

    function traverse(util, searchTerm, options) {
      options = options || {};
      var obj = options.obj || window;
      var path = options.path || ((obj == window) ? 'window' : '');
      var props = Object.keys(obj);
      props.forEach(function(prop) {
        if ((tests[util] || util)(searchTerm, obj, prop)) {
          console.log([path, '.', prop].join(''), '->', ['(', typeof obj[prop], ')'].join(''), obj[prop]);
        }
        if (Object.prototype.toString.call(obj[prop]) == '[object Object]' && (obj[prop] != obj) && path.split('.').indexOf(prop) == -1) {
          traverse(util, searchTerm, {obj: obj[prop], path: [path,prop].join('.')});
        }
      });
    }

    function search(util, expected, searchTerm, options) {
      if (!expected || typeof searchTerm == expected) {
        traverse(util, searchTerm, options);
      } else {
        console.error([searchTerm, 'must be', expected].join(' '));
      }
    }

    var tests = {
      'name': function(searchTerm, obj, prop) {return searchTerm == prop;},
      'nameContains': function(searchTerm, obj, prop) {return prop.indexOf(searchTerm) > -1;},
      'type': function(searchTerm, obj, prop) {return obj[prop] instanceof searchTerm;},
      'value': function(searchTerm, obj, prop) {return obj[prop] === searchTerm;},
      'valueCoerced': function(searchTerm, obj, prop) {return obj[prop] == searchTerm;}
    };

    function byName(searchTerm, options) {search('name', 'string', searchTerm, options);}
    function byNameContains(searchTerm, options) {search('nameContains', 'string', searchTerm, options);}
    function byType(searchTerm, options) {search('type', 'function', searchTerm, options);}
    function byValue(searchTerm, options) {search('value', null, searchTerm, options);}
    function byValueCoerced(searchTerm, options) {search('valueCoerced', null, searchTerm, options);}
    function custom(fn, options) {traverse(fn, null, options);}

    // ==========================================
    // Event logging
    // ==========================================

    var ALL = 'all'; //no filter

    //log nothing by default
    var logFilter = {
      eventNames: [],
      actions: []
    }

    function filterEventLogsByAction(/*actions*/) {
      var actions = [].slice.call(arguments);

      logFilter.eventNames.length || (logFilter.eventNames = ALL);
      logFilter.actions = actions.length ? actions : ALL;
      saveLogFilter();
    }

    function filterEventLogsByName(/*eventNames*/) {
      var eventNames = [].slice.call(arguments);

      logFilter.actions.length || (logFilter.actions = ALL);
      logFilter.eventNames = eventNames.length ? eventNames : ALL;
      saveLogFilter();
    }

    function hideAllEventLogs() {
      logFilter.actions = [];
      logFilter.eventNames = [];
      saveLogFilter();
    }

    function showAllEventLogs() {
      logFilter.actions = ALL;
      logFilter.eventNames = ALL;
      saveLogFilter();
    }

    function saveLogFilter() {
      try {
        if (window.localStorage) {
          localStorage.setItem('logFilter_eventNames', logFilter.eventNames);
          localStorage.setItem('logFilter_actions', logFilter.actions);
        }
      } catch (ignored) {};
    }

    function retrieveLogFilter() {
      var eventNames, actions;
      try {
        eventNames = (window.localStorage && localStorage.getItem('logFilter_eventNames'));
        actions = (window.localStorage && localStorage.getItem('logFilter_actions'));
      } catch (ignored) {
        return;
      }
      eventNames && (logFilter.eventNames = eventNames);
      actions && (logFilter.actions = actions);

      // reconstitute arrays in place
      Object.keys(logFilter).forEach(function(k) {
        var thisProp = logFilter[k];
        if (typeof thisProp == 'string' && thisProp !== ALL) {
          logFilter[k] = thisProp ? thisProp.split(',') : [];
        }
      });
    }

    return {

      enable: function(enable) {
        this.enabled = !!enable;

        if (enable && window.console) {
          console.info('Booting in DEBUG mode');
          console.info('You can configure event logging with DEBUG.events.logAll()/logNone()/logByName()/logByAction()');
        }

        retrieveLogFilter();

        window.DEBUG = this;
      },

      warn: function (message) {
        if (!window.console) { return; }
        var fn = (console.warn || console.log);
        fn.call(console, this.toString() + ': ' + message);
      },

      registry: registry,

      find: {
        byName: byName,
        byNameContains: byNameContains,
        byType: byType,
        byValue: byValue,
        byValueCoerced: byValueCoerced,
        custom: custom
      },

      events: {
        logFilter: logFilter,

        // Accepts any number of action args
        // e.g. DEBUG.events.logByAction("on", "off")
        logByAction: filterEventLogsByAction,

        // Accepts any number of event name args (inc. regex or wildcards)
        // e.g. DEBUG.events.logByName(/ui.*/, "*Thread*");
        logByName: filterEventLogsByName,

        logAll: showAllEventLogs,
        logNone: hideAllEventLogs
      }
    };
  }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));


/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/* Copyright 2013 Twitter, Inc. Licensed under The MIT License. http://opensource.org/licenses/MIT */

!(__WEBPACK_AMD_DEFINE_ARRAY__ = [
    __webpack_require__(7)
  ], __WEBPACK_AMD_DEFINE_RESULT__ = function(utils) {
    'use strict';

    var actionSymbols = {
      on: '<-',
      trigger: '->',
      off: 'x '
    };

    function elemToString(elem) {
      var tagStr = elem.tagName ? elem.tagName.toLowerCase() : elem.toString();
      var classStr = elem.className ? '.' + (elem.className) : '';
      var result = tagStr + classStr;
      return elem.tagName ? ['\'', '\''].join(result) : result;
    }

    function log(action, component, eventArgs) {
      if (!window.DEBUG || !window.DEBUG.enabled) {
        return;
      }
      var name, eventType, elem, fn, payload, logFilter, toRegExp, actionLoggable, nameLoggable, info;

      if (typeof eventArgs[eventArgs.length - 1] == 'function') {
        fn = eventArgs.pop();
        fn = fn.unbound || fn; // use unbound version if any (better info)
      }

      if (eventArgs.length == 1) {
        elem = component.$node[0];
        eventType = eventArgs[0];
      } else if ((eventArgs.length == 2) && typeof eventArgs[1] == 'object' && !eventArgs[1].type) {
        //2 args, first arg is not elem
        elem = component.$node[0];
        eventType = eventArgs[0];
        if (action == "trigger") {
          payload = eventArgs[1];
        }
      } else {
        //2+ args, first arg is elem
        elem = eventArgs[0];
        eventType = eventArgs[1];
        if (action == "trigger") {
          payload = eventArgs[2];
        }
      }

      name = typeof eventType == 'object' ? eventType.type : eventType;

      logFilter = DEBUG.events.logFilter;

      // no regex for you, actions...
      actionLoggable = logFilter.actions == 'all' || (logFilter.actions.indexOf(action) > -1);
      // event name filter allow wildcards or regex...
      toRegExp = function(expr) {
        return expr.test ? expr : new RegExp('^' + expr.replace(/\*/g, '.*') + '$');
      };
      nameLoggable =
        logFilter.eventNames == 'all' ||
        logFilter.eventNames.some(function(e) {return toRegExp(e).test(name);});

      if (actionLoggable && nameLoggable) {
        info = [actionSymbols[action], action, '[' + name + ']'];
        payload && info.push(payload);
        info.push(elemToString(elem));
        info.push(component.constructor.describe.split(' ').slice(0,3).join(' '));
        console.groupCollapsed && action == 'trigger' && console.groupCollapsed(action, name);
        // IE9 doesn't define `apply` for console methods, but this works everywhere:
        Function.prototype.apply.call(console.info, console, info);
      }
    }

    function withLogging() {
      this.before('trigger', function() {
        log('trigger', this, utils.toArray(arguments));
      });
      if (console.groupCollapsed) {
        this.after('trigger', function() {
          console.groupEnd();
        });
      }
      this.before('on', function() {
        log('on', this, utils.toArray(arguments));
      });
      this.before('off', function() {
        log('off', this, utils.toArray(arguments));
      });
    }

    return withLogging;
  }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));


/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/* Copyright 2013 Twitter, Inc. Licensed under The MIT License. http://opensource.org/licenses/MIT */

!(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function() {
    'use strict';

    function parseEventArgs(instance, args) {
      var element, type, callback;
      var end = args.length;

      if (typeof args[end - 1] == 'function') {
        end -= 1;
        callback = args[end];
      }

      if (typeof args[end - 1] == 'object') {
        end -= 1;
      }

      if (end == 2) {
        element = args[0];
        type = args[1];
      } else {
        element = instance.node;
        type = args[0];
      }

      return {
        element: element,
        type: type,
        callback: callback
      };
    }

    function matchEvent(a, b) {
      return (
        (a.element == b.element) &&
        (a.type == b.type) &&
        (b.callback == null || (a.callback == b.callback))
      );
    }

    function Registry() {

      var registry = this;

      (this.reset = function() {
        this.components = [];
        this.allInstances = {};
        this.events = [];
      }).call(this);

      function ComponentInfo(component) {
        this.component = component;
        this.attachedTo = [];
        this.instances = {};

        this.addInstance = function(instance) {
          var instanceInfo = new InstanceInfo(instance);
          this.instances[instance.identity] = instanceInfo;
          this.attachedTo.push(instance.node);

          return instanceInfo;
        };

        this.removeInstance = function(instance) {
          delete this.instances[instance.identity];
          var indexOfNode = this.attachedTo.indexOf(instance.node);
          (indexOfNode > -1) && this.attachedTo.splice(indexOfNode, 1);

          if (!Object.keys(this.instances).length) {
            //if I hold no more instances remove me from registry
            registry.removeComponentInfo(this);
          }
        };

        this.isAttachedTo = function(node) {
          return this.attachedTo.indexOf(node) > -1;
        };
      }

      function InstanceInfo(instance) {
        this.instance = instance;
        this.events = [];

        this.addBind = function(event) {
          this.events.push(event);
          registry.events.push(event);
        };

        this.removeBind = function(event) {
          for (var i = 0, e; e = this.events[i]; i++) {
            if (matchEvent(e, event)) {
              this.events.splice(i, 1);
            }
          }
        };
      }

      this.addInstance = function(instance) {
        var component = this.findComponentInfo(instance);

        if (!component) {
          component = new ComponentInfo(instance.constructor);
          this.components.push(component);
        }

        var inst = component.addInstance(instance);

        this.allInstances[instance.identity] = inst;

        return component;
      };

      this.removeInstance = function(instance) {
        //remove from component info
        var componentInfo = this.findComponentInfo(instance);
        componentInfo && componentInfo.removeInstance(instance);

        //remove from registry
        delete this.allInstances[instance.identity];
      };

      this.removeComponentInfo = function(componentInfo) {
        var index = this.components.indexOf(componentInfo);
        (index > -1) && this.components.splice(index, 1);
      };

      this.findComponentInfo = function(which) {
        var component = which.attachTo ? which : which.constructor;

        for (var i = 0, c; c = this.components[i]; i++) {
          if (c.component === component) {
            return c;
          }
        }

        return null;
      };

      this.findInstanceInfo = function(instance) {
        return this.allInstances[instance.identity] || null;
      };

      this.getBoundEventNames = function(instance) {
        return this.findInstanceInfo(instance).events.map(function(ev) {
          return ev.type;
        });
      };

      this.findInstanceInfoByNode = function(node) {
        var result = [];
        Object.keys(this.allInstances).forEach(function(k) {
          var thisInstanceInfo = this.allInstances[k];
          if (thisInstanceInfo.instance.node === node) {
            result.push(thisInstanceInfo);
          }
        }, this);
        return result;
      };

      this.on = function(componentOn) {
        var instance = registry.findInstanceInfo(this), boundCallback;

        // unpacking arguments by hand benchmarked faster
        var l = arguments.length, i = 1;
        var otherArgs = new Array(l - 1);
        for (; i < l; i++) {
          otherArgs[i - 1] = arguments[i];
        }

        if (instance) {
          boundCallback = componentOn.apply(null, otherArgs);
          if (boundCallback) {
            otherArgs[otherArgs.length - 1] = boundCallback;
          }
          var event = parseEventArgs(this, otherArgs);
          instance.addBind(event);
        }
      };

      this.off = function(/*el, type, callback*/) {
        var event = parseEventArgs(this, arguments),
            instance = registry.findInstanceInfo(this);

        if (instance) {
          instance.removeBind(event);
        }

        //remove from global event registry
        for (var i = 0, e; e = registry.events[i]; i++) {
          if (matchEvent(e, event)) {
            registry.events.splice(i, 1);
          }
        }
      };

      // debug tools may want to add advice to trigger
      registry.trigger = function() {};

      this.teardown = function() {
        registry.removeInstance(this);
      };

      this.withRegistration = function() {
        this.after('initialize', function() {
          registry.addInstance(this);
        });

        this.around('on', registry.on);
        this.after('off', registry.off);
        //debug tools may want to add advice to trigger
        window.DEBUG && (false).enabled && this.after('trigger', registry.trigger);
        this.after('teardown', {obj: registry, fnName: 'teardown'});
      };

    }

    return new Registry;
  }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));


/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/* Copyright 2013 Twitter, Inc. Licensed under The MIT License. http://opensource.org/licenses/MIT */

!(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(4)], __WEBPACK_AMD_DEFINE_RESULT__ = function(debug) {
    'use strict';

    var DEFAULT_INTERVAL = 100;

    function canWriteProtect() {
      var writeProtectSupported = debug.enabled && !Object.propertyIsEnumerable('getOwnPropertyDescriptor');
      if (writeProtectSupported) {
        //IE8 getOwnPropertyDescriptor is built-in but throws exeption on non DOM objects
        try {
          Object.getOwnPropertyDescriptor(Object, 'keys');
        } catch (e) {
         return false;
        }
      }

      return writeProtectSupported;
    }

    var utils = {

      isDomObj: function(obj) {
        return !!(obj.nodeType || (obj === window));
      },

      toArray: function(obj, from) {
        from = from || 0;
        var len = obj.length, arr = new Array(len - from);
        for (var i = from; i < len; i++) {
          arr[i - from] = obj[i];
        }
        return arr;
      },

      // returns new object representing multiple objects merged together
      // optional final argument is boolean which specifies if merge is recursive
      // original objects are unmodified
      //
      // usage:
      //   var base = {a:2, b:6};
      //   var extra = {b:3, c:4};
      //   merge(base, extra); //{a:2, b:3, c:4}
      //   base; //{a:2, b:6}
      //
      //   var base = {a:2, b:6};
      //   var extra = {b:3, c:4};
      //   var extraExtra = {a:4, d:9};
      //   merge(base, extra, extraExtra); //{a:4, b:3, c:4. d: 9}
      //   base; //{a:2, b:6}
      //
      //   var base = {a:2, b:{bb:4, cc:5}};
      //   var extra = {a:4, b:{cc:7, dd:1}};
      //   merge(base, extra, true); //{a:4, b:{bb:4, cc:7, dd:1}}
      //   base; //{a:2, b:{bb:4, cc:5}};

      merge: function(/*obj1, obj2,....deepCopy*/) {
        // unpacking arguments by hand benchmarked faster
        var l = arguments.length,
            args = new Array(l + 1);

        if (l === 0) {
          return {};
        }

        for (var i = 0; i < l; i++) {
          args[i + 1] = arguments[i];
        }

        //start with empty object so a copy is created
        args[0] = {};

        if (args[args.length - 1] === true) {
          //jquery extend requires deep copy as first arg
          args.pop();
          args.unshift(true);
        }

        return $.extend.apply(undefined, args);
      },

      // updates base in place by copying properties of extra to it
      // optionally clobber protected
      // usage:
      //   var base = {a:2, b:6};
      //   var extra = {c:4};
      //   push(base, extra); //{a:2, b:6, c:4}
      //   base; //{a:2, b:6, c:4}
      //
      //   var base = {a:2, b:6};
      //   var extra = {b: 4 c:4};
      //   push(base, extra, true); //Error ("utils.push attempted to overwrite 'b' while running in protected mode")
      //   base; //{a:2, b:6}
      //
      // objects with the same key will merge recursively when protect is false
      // eg:
      // var base = {a:16, b:{bb:4, cc:10}};
      // var extra = {b:{cc:25, dd:19}, c:5};
      // push(base, extra); //{a:16, {bb:4, cc:25, dd:19}, c:5}
      //
      push: function(base, extra, protect) {
        if (base) {
          Object.keys(extra || {}).forEach(function(key) {
            if (base[key] && protect) {
              throw new Error('utils.push attempted to overwrite "' + key + '" while running in protected mode');
            }

            if (typeof base[key] == 'object' && typeof extra[key] == 'object') {
              // recurse
              this.push(base[key], extra[key]);
            } else {
              // no protect, so extra wins
              base[key] = extra[key];
            }
          }, this);
        }

        return base;
      },

      // If obj.key points to an enumerable property, return its value
      // If obj.key points to a non-enumerable property, return undefined
      getEnumerableProperty: function(obj, key) {
        return obj.propertyIsEnumerable(key) ? obj[key] : undefined;
      },

      // build a function from other function(s)
      // utils.compose(a,b,c) -> a(b(c()));
      // implementation lifted from underscore.js (c) 2009-2012 Jeremy Ashkenas
      compose: function() {
        var funcs = arguments;

        return function() {
          var args = arguments;

          for (var i = funcs.length - 1; i >= 0; i--) {
            args = [funcs[i].apply(this, args)];
          }

          return args[0];
        };
      },

      // Can only unique arrays of homogeneous primitives, e.g. an array of only strings, an array of only booleans, or an array of only numerics
      uniqueArray: function(array) {
        var u = {}, a = [];

        for (var i = 0, l = array.length; i < l; ++i) {
          if (u.hasOwnProperty(array[i])) {
            continue;
          }

          a.push(array[i]);
          u[array[i]] = 1;
        }

        return a;
      },

      debounce: function(func, wait, immediate) {
        if (typeof wait != 'number') {
          wait = DEFAULT_INTERVAL;
        }

        var timeout, result;

        return function() {
          var context = this, args = arguments;
          var later = function() {
            timeout = null;
            if (!immediate) {
              result = func.apply(context, args);
            }
          };
          var callNow = immediate && !timeout;

          timeout && clearTimeout(timeout);
          timeout = setTimeout(later, wait);

          if (callNow) {
            result = func.apply(context, args);
          }

          return result;
        };
      },

      throttle: function(func, wait) {
        if (typeof wait != 'number') {
          wait = DEFAULT_INTERVAL;
        }

        var context, args, timeout, throttling, more, result;
        var whenDone = this.debounce(function() {
          more = throttling = false;
        }, wait);

        return function() {
          context = this; args = arguments;
          var later = function() {
            timeout = null;
            if (more) {
              result = func.apply(context, args);
            }
            whenDone();
          };

          if (!timeout) {
            timeout = setTimeout(later, wait);
          }

          if (throttling) {
            more = true;
          } else {
            throttling = true;
            result = func.apply(context, args);
          }

          whenDone();
          return result;
        };
      },

      countThen: function(num, base) {
        return function() {
          if (!--num) { return base.apply(this, arguments); }
        };
      },

      delegate: function(rules) {
        return function(e, data) {
          var target = $(e.target), parent;

          Object.keys(rules).forEach(function(selector) {
            if (!e.isPropagationStopped() && (parent = target.closest(selector)).length) {
              data = data || {};
              e.currentTarget = data.el = parent[0];
              return rules[selector].apply(this, [e, data]);
            }
          }, this);
        };
      },

      // ensures that a function will only be called once.
      // usage:
      // will only create the application once
      //   var initialize = utils.once(createApplication)
      //     initialize();
      //     initialize();
      //
      // will only delete a record once
      //   var myHanlder = function () {
      //     $.ajax({type: 'DELETE', url: 'someurl.com', data: {id: 1}});
      //   };
      //   this.on('click', utils.once(myHandler));
      //
      once: function(func) {
        var ran, result;

        return function() {
          if (ran) {
            return result;
          }

          ran = true;
          result = func.apply(this, arguments);

          return result;
        };
      },

      propertyWritability: function(obj, prop, writable) {
        if (canWriteProtect() && obj.hasOwnProperty(prop)) {
          Object.defineProperty(obj, prop, { writable: writable });
        }
      },

      // Property locking/unlocking
      mutateProperty: function(obj, prop, op) {
        var writable;

        if (!canWriteProtect() || !obj.hasOwnProperty(prop)) {
          op.call(obj);
          return;
        }

        writable = Object.getOwnPropertyDescriptor(obj, prop).writable;

        Object.defineProperty(obj, prop, { writable: true });
        op.call(obj);
        Object.defineProperty(obj, prop, { writable: writable });

      }

    };

    return utils;
  }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));


/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/* Copyright 2013 Twitter, Inc. Licensed under The MIT License. http://opensource.org/licenses/MIT */

!(__WEBPACK_AMD_DEFINE_ARRAY__ = [
    __webpack_require__(7),
    __webpack_require__(6),
    __webpack_require__(4)
  ], __WEBPACK_AMD_DEFINE_RESULT__ = function(utils, registry, debug) {
    'use strict';

    // common mixin allocates basic functionality - used by all component prototypes
    // callback context is bound to component
    var componentId = 0;

    function teardownInstance(instanceInfo) {
      instanceInfo.events.slice().forEach(function(event) {
        var args = [event.type];

        event.element && args.unshift(event.element);
        (typeof event.callback == 'function') && args.push(event.callback);

        this.off.apply(this, args);
      }, instanceInfo.instance);
    }

    function checkSerializable(type, data) {
      try {
        window.postMessage(data, '*');
      } catch (e) {
        debug.warn.call(this, [
          'Event "', type, '" was triggered with non-serializable data. ',
          'Flight recommends you avoid passing non-serializable data in events.'
        ].join(''));
      }
    }

    function warnAboutReferenceType(key) {
      debug.warn.call(this, [
        'Attribute "', key, '" defaults to an array or object. ',
        'Enclose this in a function to avoid sharing between component instances.'
      ].join(''));
    }

    function initAttributes(attrs) {
      var definedKeys = [], incomingKeys;

      this.attr = new this.attrDef;

      if (debug.enabled && window.console) {
        for (var key in this.attrDef.prototype) {
          definedKeys.push(key);
        }
        incomingKeys = Object.keys(attrs);

        for (var i = incomingKeys.length - 1; i >= 0; i--) {
          if (definedKeys.indexOf(incomingKeys[i]) == -1) {
            debug.warn.call(this, 'Passed unused attribute "' + incomingKeys[i] + '".');
            break;
          }
        }
      }

      for (var key in this.attrDef.prototype) {
        if (typeof attrs[key] == 'undefined') {
          if (this.attr[key] === null) {
            throw new Error('Required attribute "' + key +
                            '" not specified in attachTo for component "' + this.toString() + '".');
          }
          // Warn about reference types in attributes
          if (debug.enabled && typeof this.attr[key] === 'object') {
            warnAboutReferenceType.call(this, key);
          }
        } else {
          this.attr[key] = attrs[key];
        }

        if (typeof this.attr[key] == 'function') {
          this.attr[key] = this.attr[key].call(this);
        }
      }

    }

    function initDeprecatedAttributes(attrs) {
      // merge defaults with supplied options
      // put options in attr.__proto__ to avoid merge overhead
      var attr = Object.create(attrs);

      for (var key in this.defaults) {
        if (!attrs.hasOwnProperty(key)) {
          attr[key] = this.defaults[key];
          // Warn about reference types in defaultAttrs
          if (debug.enabled && typeof this.defaults[key] === 'object') {
            warnAboutReferenceType.call(this, key);
          }
        }
      }

      this.attr = attr;

      Object.keys(this.defaults || {}).forEach(function(key) {
        if (this.defaults[key] === null && this.attr[key] === null) {
          throw new Error('Required attribute "' + key +
                          '" not specified in attachTo for component "' + this.toString() + '".');
        }
      }, this);
    }

    function proxyEventTo(targetEvent) {
      return function(e, data) {
        $(e.target).trigger(targetEvent, data);
      };
    }

    function withBase() {

      // delegate trigger, bind and unbind to an element
      // if $element not supplied, use component's node
      // other arguments are passed on
      // event can be either a string specifying the type
      // of the event, or a hash specifying both the type
      // and a default function to be called.
      this.trigger = function() {
        var $element, type, data, event, defaultFn;
        var lastIndex = arguments.length - 1, lastArg = arguments[lastIndex];

        if (typeof lastArg != 'string' && !(lastArg && lastArg.defaultBehavior)) {
          lastIndex--;
          data = lastArg;
        }

        if (lastIndex == 1) {
          $element = $(arguments[0]);
          event = arguments[1];
        } else {
          $element = this.$node;
          event = arguments[0];
        }

        if (event.defaultBehavior) {
          defaultFn = event.defaultBehavior;
          event = $.Event(event.type);
        }

        type = event.type || event;

        if (debug.enabled && window.postMessage) {
          checkSerializable.call(this, type, data);
        }

        if (typeof this.attr.eventData == 'object') {
          data = $.extend(true, {}, this.attr.eventData, data);
        }

        $element.trigger((event || type), data);

        if (defaultFn && !event.isDefaultPrevented()) {
          (this[defaultFn] || defaultFn).call(this, event, data);
        }

        return $element;
      };


      this.on = function() {
        var $element, type, callback, originalCb;
        var lastIndex = arguments.length - 1, origin = arguments[lastIndex];

        if (typeof origin == 'object') {
          //delegate callback
          originalCb = utils.delegate(
            this.resolveDelegateRules(origin)
          );
        } else if (typeof origin == 'string') {
          originalCb = proxyEventTo(origin);
        } else {
          originalCb = origin;
        }

        if (lastIndex == 2) {
          $element = $(arguments[0]);
          type = arguments[1];
        } else {
          $element = this.$node;
          type = arguments[0];
        }

        if (typeof originalCb != 'function' && typeof originalCb != 'object') {
          throw new Error('Unable to bind to "' + type +
                          '" because the given callback is not a function or an object');
        }

        callback = originalCb.bind(this);
        callback.target = originalCb;
        callback.context = this;

        $element.on(type, callback);

        // store every bound version of the callback
        originalCb.bound || (originalCb.bound = []);
        originalCb.bound.push(callback);

        return callback;
      };

      this.off = function() {
        var $element, type, callback;
        var lastIndex = arguments.length - 1;

        if (typeof arguments[lastIndex] == 'function') {
          callback = arguments[lastIndex];
          lastIndex -= 1;
        }

        if (lastIndex == 1) {
          $element = $(arguments[0]);
          type = arguments[1];
        } else {
          $element = this.$node;
          type = arguments[0];
        }

        if (callback) {
          //this callback may be the original function or a bound version
          var boundFunctions = callback.target ? callback.target.bound : callback.bound || [];
          //set callback to version bound against this instance
          boundFunctions && boundFunctions.some(function(fn, i, arr) {
            if (fn.context && (this.identity == fn.context.identity)) {
              arr.splice(i, 1);
              callback = fn;
              return true;
            }
          }, this);
          $element.off(type, callback);
        } else {
          // Loop through the events of `this` instance
          // and unbind using the callback
          registry.findInstanceInfo(this).events.forEach(function (event) {
            if (type == event.type) {
              $element.off(type, event.callback);
            }
          });
        }

        return $element;
      };

      this.resolveDelegateRules = function(ruleInfo) {
        var rules = {};

        Object.keys(ruleInfo).forEach(function(r) {
          if (!(r in this.attr)) {
            throw new Error('Component "' + this.toString() + '" wants to listen on "' + r + '" but no such attribute was defined.');
          }
          rules[this.attr[r]] = (typeof ruleInfo[r] == 'string') ? proxyEventTo(ruleInfo[r]) : ruleInfo[r];
        }, this);

        return rules;
      };

      this.select = function(attributeKey) {
        return this.$node.find(this.attr[attributeKey]);
      };

      // New-style attributes

      this.attributes = function(attrs) {

        var Attributes = function() {};

        if (this.attrDef) {
          Attributes.prototype = new this.attrDef;
        }

        for (var name in attrs) {
          Attributes.prototype[name] = attrs[name];
        }

        this.attrDef = Attributes;
      };

      // Deprecated attributes

      this.defaultAttrs = function(defaults) {
        utils.push(this.defaults, defaults, true) || (this.defaults = defaults);
      };

      this.initialize = function(node, attrs) {
        attrs = attrs || {};
        this.identity || (this.identity = componentId++);

        if (!node) {
          throw new Error('Component needs a node');
        }

        if (node.jquery) {
          this.node = node[0];
          this.$node = node;
        } else {
          this.node = node;
          this.$node = $(node);
        }

        if (this.attrDef) {
          initAttributes.call(this, attrs);
        } else {
          initDeprecatedAttributes.call(this, attrs);
        }

        return this;
      };

      this.teardown = function() {
        teardownInstance(registry.findInstanceInfo(this));
      };
    }

    return withBase;
  }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));


/***/ }
/******/ ])
});

},{}],17:[function(require,module,exports){
/*
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

(function (Hogan) {
  // Setup regex  assignments
  // remove whitespace according to Mustache spec
  var rIsWhitespace = /\S/,
      rQuot = /\"/g,
      rNewline =  /\n/g,
      rCr = /\r/g,
      rSlash = /\\/g,
      rLineSep = /\u2028/,
      rParagraphSep = /\u2029/;

  Hogan.tags = {
    '#': 1, '^': 2, '<': 3, '$': 4,
    '/': 5, '!': 6, '>': 7, '=': 8, '_v': 9,
    '{': 10, '&': 11, '_t': 12
  };

  Hogan.scan = function scan(text, delimiters) {
    var len = text.length,
        IN_TEXT = 0,
        IN_TAG_TYPE = 1,
        IN_TAG = 2,
        state = IN_TEXT,
        tagType = null,
        tag = null,
        buf = '',
        tokens = [],
        seenTag = false,
        i = 0,
        lineStart = 0,
        otag = '{{',
        ctag = '}}';

    function addBuf() {
      if (buf.length > 0) {
        tokens.push({tag: '_t', text: new String(buf)});
        buf = '';
      }
    }

    function lineIsWhitespace() {
      var isAllWhitespace = true;
      for (var j = lineStart; j < tokens.length; j++) {
        isAllWhitespace =
          (Hogan.tags[tokens[j].tag] < Hogan.tags['_v']) ||
          (tokens[j].tag == '_t' && tokens[j].text.match(rIsWhitespace) === null);
        if (!isAllWhitespace) {
          return false;
        }
      }

      return isAllWhitespace;
    }

    function filterLine(haveSeenTag, noNewLine) {
      addBuf();

      if (haveSeenTag && lineIsWhitespace()) {
        for (var j = lineStart, next; j < tokens.length; j++) {
          if (tokens[j].text) {
            if ((next = tokens[j+1]) && next.tag == '>') {
              // set indent to token value
              next.indent = tokens[j].text.toString()
            }
            tokens.splice(j, 1);
          }
        }
      } else if (!noNewLine) {
        tokens.push({tag:'\n'});
      }

      seenTag = false;
      lineStart = tokens.length;
    }

    function changeDelimiters(text, index) {
      var close = '=' + ctag,
          closeIndex = text.indexOf(close, index),
          delimiters = trim(
            text.substring(text.indexOf('=', index) + 1, closeIndex)
          ).split(' ');

      otag = delimiters[0];
      ctag = delimiters[delimiters.length - 1];

      return closeIndex + close.length - 1;
    }

    if (delimiters) {
      delimiters = delimiters.split(' ');
      otag = delimiters[0];
      ctag = delimiters[1];
    }

    for (i = 0; i < len; i++) {
      if (state == IN_TEXT) {
        if (tagChange(otag, text, i)) {
          --i;
          addBuf();
          state = IN_TAG_TYPE;
        } else {
          if (text.charAt(i) == '\n') {
            filterLine(seenTag);
          } else {
            buf += text.charAt(i);
          }
        }
      } else if (state == IN_TAG_TYPE) {
        i += otag.length - 1;
        tag = Hogan.tags[text.charAt(i + 1)];
        tagType = tag ? text.charAt(i + 1) : '_v';
        if (tagType == '=') {
          i = changeDelimiters(text, i);
          state = IN_TEXT;
        } else {
          if (tag) {
            i++;
          }
          state = IN_TAG;
        }
        seenTag = i;
      } else {
        if (tagChange(ctag, text, i)) {
          tokens.push({tag: tagType, n: trim(buf), otag: otag, ctag: ctag,
                       i: (tagType == '/') ? seenTag - otag.length : i + ctag.length});
          buf = '';
          i += ctag.length - 1;
          state = IN_TEXT;
          if (tagType == '{') {
            if (ctag == '}}') {
              i++;
            } else {
              cleanTripleStache(tokens[tokens.length - 1]);
            }
          }
        } else {
          buf += text.charAt(i);
        }
      }
    }

    filterLine(seenTag, true);

    return tokens;
  }

  function cleanTripleStache(token) {
    if (token.n.substr(token.n.length - 1) === '}') {
      token.n = token.n.substring(0, token.n.length - 1);
    }
  }

  function trim(s) {
    if (s.trim) {
      return s.trim();
    }

    return s.replace(/^\s*|\s*$/g, '');
  }

  function tagChange(tag, text, index) {
    if (text.charAt(index) != tag.charAt(0)) {
      return false;
    }

    for (var i = 1, l = tag.length; i < l; i++) {
      if (text.charAt(index + i) != tag.charAt(i)) {
        return false;
      }
    }

    return true;
  }

  // the tags allowed inside super templates
  var allowedInSuper = {'_t': true, '\n': true, '$': true, '/': true};

  function buildTree(tokens, kind, stack, customTags) {
    var instructions = [],
        opener = null,
        tail = null,
        token = null;

    tail = stack[stack.length - 1];

    while (tokens.length > 0) {
      token = tokens.shift();

      if (tail && tail.tag == '<' && !(token.tag in allowedInSuper)) {
        throw new Error('Illegal content in < super tag.');
      }

      if (Hogan.tags[token.tag] <= Hogan.tags['$'] || isOpener(token, customTags)) {
        stack.push(token);
        token.nodes = buildTree(tokens, token.tag, stack, customTags);
      } else if (token.tag == '/') {
        if (stack.length === 0) {
          throw new Error('Closing tag without opener: /' + token.n);
        }
        opener = stack.pop();
        if (token.n != opener.n && !isCloser(token.n, opener.n, customTags)) {
          throw new Error('Nesting error: ' + opener.n + ' vs. ' + token.n);
        }
        opener.end = token.i;
        return instructions;
      } else if (token.tag == '\n') {
        token.last = (tokens.length == 0) || (tokens[0].tag == '\n');
      }

      instructions.push(token);
    }

    if (stack.length > 0) {
      throw new Error('missing closing tag: ' + stack.pop().n);
    }

    return instructions;
  }

  function isOpener(token, tags) {
    for (var i = 0, l = tags.length; i < l; i++) {
      if (tags[i].o == token.n) {
        token.tag = '#';
        return true;
      }
    }
  }

  function isCloser(close, open, tags) {
    for (var i = 0, l = tags.length; i < l; i++) {
      if (tags[i].c == close && tags[i].o == open) {
        return true;
      }
    }
  }

  function stringifySubstitutions(obj) {
    var items = [];
    for (var key in obj) {
      items.push('"' + esc(key) + '": function(c,p,t,i) {' + obj[key] + '}');
    }
    return "{ " + items.join(",") + " }";
  }

  function stringifyPartials(codeObj) {
    var partials = [];
    for (var key in codeObj.partials) {
      partials.push('"' + esc(key) + '":{name:"' + esc(codeObj.partials[key].name) + '", ' + stringifyPartials(codeObj.partials[key]) + "}");
    }
    return "partials: {" + partials.join(",") + "}, subs: " + stringifySubstitutions(codeObj.subs);
  }

  Hogan.stringify = function(codeObj, text, options) {
    return "{code: function (c,p,i) { " + Hogan.wrapMain(codeObj.code) + " }," + stringifyPartials(codeObj) +  "}";
  }

  var serialNo = 0;
  Hogan.generate = function(tree, text, options) {
    serialNo = 0;
    var context = { code: '', subs: {}, partials: {} };
    Hogan.walk(tree, context);

    if (options.asString) {
      return this.stringify(context, text, options);
    }

    return this.makeTemplate(context, text, options);
  }

  Hogan.wrapMain = function(code) {
    return 'var t=this;t.b(i=i||"");' + code + 'return t.fl();';
  }

  Hogan.template = Hogan.Template;

  Hogan.makeTemplate = function(codeObj, text, options) {
    var template = this.makePartials(codeObj);
    template.code = new Function('c', 'p', 'i', this.wrapMain(codeObj.code));
    return new this.template(template, text, this, options);
  }

  Hogan.makePartials = function(codeObj) {
    var key, template = {subs: {}, partials: codeObj.partials, name: codeObj.name};
    for (key in template.partials) {
      template.partials[key] = this.makePartials(template.partials[key]);
    }
    for (key in codeObj.subs) {
      template.subs[key] = new Function('c', 'p', 't', 'i', codeObj.subs[key]);
    }
    return template;
  }

  function esc(s) {
    return s.replace(rSlash, '\\\\')
            .replace(rQuot, '\\\"')
            .replace(rNewline, '\\n')
            .replace(rCr, '\\r')
            .replace(rLineSep, '\\u2028')
            .replace(rParagraphSep, '\\u2029');
  }

  function chooseMethod(s) {
    return (~s.indexOf('.')) ? 'd' : 'f';
  }

  function createPartial(node, context) {
    var prefix = "<" + (context.prefix || "");
    var sym = prefix + node.n + serialNo++;
    context.partials[sym] = {name: node.n, partials: {}};
    context.code += 't.b(t.rp("' +  esc(sym) + '",c,p,"' + (node.indent || '') + '"));';
    return sym;
  }

  Hogan.codegen = {
    '#': function(node, context) {
      context.code += 'if(t.s(t.' + chooseMethod(node.n) + '("' + esc(node.n) + '",c,p,1),' +
                      'c,p,0,' + node.i + ',' + node.end + ',"' + node.otag + " " + node.ctag + '")){' +
                      't.rs(c,p,' + 'function(c,p,t){';
      Hogan.walk(node.nodes, context);
      context.code += '});c.pop();}';
    },

    '^': function(node, context) {
      context.code += 'if(!t.s(t.' + chooseMethod(node.n) + '("' + esc(node.n) + '",c,p,1),c,p,1,0,0,"")){';
      Hogan.walk(node.nodes, context);
      context.code += '};';
    },

    '>': createPartial,
    '<': function(node, context) {
      var ctx = {partials: {}, code: '', subs: {}, inPartial: true};
      Hogan.walk(node.nodes, ctx);
      var template = context.partials[createPartial(node, context)];
      template.subs = ctx.subs;
      template.partials = ctx.partials;
    },

    '$': function(node, context) {
      var ctx = {subs: {}, code: '', partials: context.partials, prefix: node.n};
      Hogan.walk(node.nodes, ctx);
      context.subs[node.n] = ctx.code;
      if (!context.inPartial) {
        context.code += 't.sub("' + esc(node.n) + '",c,p,i);';
      }
    },

    '\n': function(node, context) {
      context.code += write('"\\n"' + (node.last ? '' : ' + i'));
    },

    '_v': function(node, context) {
      context.code += 't.b(t.v(t.' + chooseMethod(node.n) + '("' + esc(node.n) + '",c,p,0)));';
    },

    '_t': function(node, context) {
      context.code += write('"' + esc(node.text) + '"');
    },

    '{': tripleStache,

    '&': tripleStache
  }

  function tripleStache(node, context) {
    context.code += 't.b(t.t(t.' + chooseMethod(node.n) + '("' + esc(node.n) + '",c,p,0)));';
  }

  function write(s) {
    return 't.b(' + s + ');';
  }

  Hogan.walk = function(nodelist, context) {
    var func;
    for (var i = 0, l = nodelist.length; i < l; i++) {
      func = Hogan.codegen[nodelist[i].tag];
      func && func(nodelist[i], context);
    }
    return context;
  }

  Hogan.parse = function(tokens, text, options) {
    options = options || {};
    return buildTree(tokens, '', [], options.sectionTags || []);
  }

  Hogan.cache = {};

  Hogan.cacheKey = function(text, options) {
    return [text, !!options.asString, !!options.disableLambda, options.delimiters, !!options.modelGet].join('||');
  }

  Hogan.compile = function(text, options) {
    options = options || {};
    var key = Hogan.cacheKey(text, options);
    var template = this.cache[key];

    if (template) {
      var partials = template.partials;
      for (var name in partials) {
        delete partials[name].instance;
      }
      return template;
    }

    template = this.generate(this.parse(this.scan(text, options.delimiters), text, options), text, options);
    return this.cache[key] = template;
  }
})(typeof exports !== 'undefined' ? exports : Hogan);

},{}],18:[function(require,module,exports){
/*
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// This file is for use with Node.js. See dist/ for browser files.

var Hogan = require('./compiler');
Hogan.Template = require('./template').Template;
Hogan.template = Hogan.Template;
module.exports = Hogan;

},{"./compiler":17,"./template":19}],19:[function(require,module,exports){
/*
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var Hogan = {};

(function (Hogan) {
  Hogan.Template = function (codeObj, text, compiler, options) {
    codeObj = codeObj || {};
    this.r = codeObj.code || this.r;
    this.c = compiler;
    this.options = options || {};
    this.text = text || '';
    this.partials = codeObj.partials || {};
    this.subs = codeObj.subs || {};
    this.buf = '';
  }

  Hogan.Template.prototype = {
    // render: replaced by generated code.
    r: function (context, partials, indent) { return ''; },

    // variable escaping
    v: hoganEscape,

    // triple stache
    t: coerceToString,

    render: function render(context, partials, indent) {
      return this.ri([context], partials || {}, indent);
    },

    // render internal -- a hook for overrides that catches partials too
    ri: function (context, partials, indent) {
      return this.r(context, partials, indent);
    },

    // ensurePartial
    ep: function(symbol, partials) {
      var partial = this.partials[symbol];

      // check to see that if we've instantiated this partial before
      var template = partials[partial.name];
      if (partial.instance && partial.base == template) {
        return partial.instance;
      }

      if (typeof template == 'string') {
        if (!this.c) {
          throw new Error("No compiler available.");
        }
        template = this.c.compile(template, this.options);
      }

      if (!template) {
        return null;
      }

      // We use this to check whether the partials dictionary has changed
      this.partials[symbol].base = template;

      if (partial.subs) {
        // Make sure we consider parent template now
        if (!partials.stackText) partials.stackText = {};
        for (key in partial.subs) {
          if (!partials.stackText[key]) {
            partials.stackText[key] = (this.activeSub !== undefined && partials.stackText[this.activeSub]) ? partials.stackText[this.activeSub] : this.text;
          }
        }
        template = createSpecializedPartial(template, partial.subs, partial.partials,
          this.stackSubs, this.stackPartials, partials.stackText);
      }
      this.partials[symbol].instance = template;

      return template;
    },

    // tries to find a partial in the current scope and render it
    rp: function(symbol, context, partials, indent) {
      var partial = this.ep(symbol, partials);
      if (!partial) {
        return '';
      }

      return partial.ri(context, partials, indent);
    },

    // render a section
    rs: function(context, partials, section) {
      var tail = context[context.length - 1];

      if (!isArray(tail)) {
        section(context, partials, this);
        return;
      }

      for (var i = 0; i < tail.length; i++) {
        context.push(tail[i]);
        section(context, partials, this);
        context.pop();
      }
    },

    // maybe start a section
    s: function(val, ctx, partials, inverted, start, end, tags) {
      var pass;

      if (isArray(val) && val.length === 0) {
        return false;
      }

      if (typeof val == 'function') {
        val = this.ms(val, ctx, partials, inverted, start, end, tags);
      }

      pass = !!val;

      if (!inverted && pass && ctx) {
        ctx.push((typeof val == 'object') ? val : ctx[ctx.length - 1]);
      }

      return pass;
    },

    // find values with dotted names
    d: function(key, ctx, partials, returnFound) {
      var found,
          names = key.split('.'),
          val = this.f(names[0], ctx, partials, returnFound),
          doModelGet = this.options.modelGet,
          cx = null;

      if (key === '.' && isArray(ctx[ctx.length - 2])) {
        val = ctx[ctx.length - 1];
      } else {
        for (var i = 1; i < names.length; i++) {
          found = findInScope(names[i], val, doModelGet);
          if (found !== undefined) {
            cx = val;
            val = found;
          } else {
            val = '';
          }
        }
      }

      if (returnFound && !val) {
        return false;
      }

      if (!returnFound && typeof val == 'function') {
        ctx.push(cx);
        val = this.mv(val, ctx, partials);
        ctx.pop();
      }

      return val;
    },

    // find values with normal names
    f: function(key, ctx, partials, returnFound) {
      var val = false,
          v = null,
          found = false,
          doModelGet = this.options.modelGet;

      for (var i = ctx.length - 1; i >= 0; i--) {
        v = ctx[i];
        val = findInScope(key, v, doModelGet);
        if (val !== undefined) {
          found = true;
          break;
        }
      }

      if (!found) {
        return (returnFound) ? false : "";
      }

      if (!returnFound && typeof val == 'function') {
        val = this.mv(val, ctx, partials);
      }

      return val;
    },

    // higher order templates
    ls: function(func, cx, partials, text, tags) {
      var oldTags = this.options.delimiters;

      this.options.delimiters = tags;
      this.b(this.ct(coerceToString(func.call(cx, text)), cx, partials));
      this.options.delimiters = oldTags;

      return false;
    },

    // compile text
    ct: function(text, cx, partials) {
      if (this.options.disableLambda) {
        throw new Error('Lambda features disabled.');
      }
      return this.c.compile(text, this.options).render(cx, partials);
    },

    // template result buffering
    b: function(s) { this.buf += s; },

    fl: function() { var r = this.buf; this.buf = ''; return r; },

    // method replace section
    ms: function(func, ctx, partials, inverted, start, end, tags) {
      var textSource,
          cx = ctx[ctx.length - 1],
          result = func.call(cx);

      if (typeof result == 'function') {
        if (inverted) {
          return true;
        } else {
          textSource = (this.activeSub && this.subsText && this.subsText[this.activeSub]) ? this.subsText[this.activeSub] : this.text;
          return this.ls(result, cx, partials, textSource.substring(start, end), tags);
        }
      }

      return result;
    },

    // method replace variable
    mv: function(func, ctx, partials) {
      var cx = ctx[ctx.length - 1];
      var result = func.call(cx);

      if (typeof result == 'function') {
        return this.ct(coerceToString(result.call(cx)), cx, partials);
      }

      return result;
    },

    sub: function(name, context, partials, indent) {
      var f = this.subs[name];
      if (f) {
        this.activeSub = name;
        f(context, partials, this, indent);
        this.activeSub = false;
      }
    }

  };

  //Find a key in an object
  function findInScope(key, scope, doModelGet) {
    var val;

    if (scope && typeof scope == 'object') {

      if (scope[key] !== undefined) {
        val = scope[key];

      // try lookup with get for backbone or similar model data
      } else if (doModelGet && scope.get && typeof scope.get == 'function') {
        val = scope.get(key);
      }
    }

    return val;
  }

  function createSpecializedPartial(instance, subs, partials, stackSubs, stackPartials, stackText) {
    function PartialTemplate() {};
    PartialTemplate.prototype = instance;
    function Substitutions() {};
    Substitutions.prototype = instance.subs;
    var key;
    var partial = new PartialTemplate();
    partial.subs = new Substitutions();
    partial.subsText = {};  //hehe. substext.
    partial.buf = '';

    stackSubs = stackSubs || {};
    partial.stackSubs = stackSubs;
    partial.subsText = stackText;
    for (key in subs) {
      if (!stackSubs[key]) stackSubs[key] = subs[key];
    }
    for (key in stackSubs) {
      partial.subs[key] = stackSubs[key];
    }

    stackPartials = stackPartials || {};
    partial.stackPartials = stackPartials;
    for (key in partials) {
      if (!stackPartials[key]) stackPartials[key] = partials[key];
    }
    for (key in stackPartials) {
      partial.partials[key] = stackPartials[key];
    }

    return partial;
  }

  var rAmp = /&/g,
      rLt = /</g,
      rGt = />/g,
      rApos = /\'/g,
      rQuot = /\"/g,
      hChars = /[&<>\"\']/;

  function coerceToString(val) {
    return String((val === null || val === undefined) ? '' : val);
  }

  function hoganEscape(str) {
    str = coerceToString(str);
    return hChars.test(str) ?
      str
        .replace(rAmp, '&amp;')
        .replace(rLt, '&lt;')
        .replace(rGt, '&gt;')
        .replace(rApos, '&#39;')
        .replace(rQuot, '&quot;') :
      str;
  }

  var isArray = Array.isArray || function(a) {
    return Object.prototype.toString.call(a) === '[object Array]';
  };

})(typeof exports !== 'undefined' ? exports : Hogan);

},{}],20:[function(require,module,exports){
/*!
* vdom-virtualize
* Copyright 2014 by Marcel Klehr <mklehr@gmx.net>
*
* (MIT LICENSE)
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
* THE SOFTWARE.
*/
var VNode = require("virtual-dom/vnode/vnode")
  , VText = require("virtual-dom/vnode/vtext")

module.exports = createVNode

function createVNode(domNode, key) {
  key = key || null // XXX: Leave out `key` for now... merely used for (re-)ordering

  if(domNode.nodeType == 1) return createFromElement(domNode, key)
  if(domNode.nodeType == 3) return createFromTextNode(domNode, key)
  return
}

createVNode.fromHTML = function(html, key) {
  var domNode = document.createElement('div'); // create container
  domNode.innerHTML = html; // browser parses HTML into DOM tree
  domNode = domNode.children[0] || domNode; // select first node in tree
  return createVNode(domNode, key);
};

function createFromTextNode(tNode) {
  return new VText(tNode.nodeValue)
}


function createFromElement(el) {
  var tagName = el.tagName
  , namespace = el.namespaceURI == 'http://www.w3.org/1999/xhtml'? null : el.namespaceURI
  , properties = getElementProperties(el)
  , children = []

  for (var i = 0; i < el.childNodes.length; i++) {
    children.push(createVNode(el.childNodes[i]/*, i*/))
  }

  return new VNode(tagName, properties, children, null, namespace)
}


function getElementProperties(el) {
  var obj = {}

  props.forEach(function(propName) {
    if(!el[propName]) return

    // Special case: style
    // .style is a DOMStyleDeclaration, thus we need to iterate over all
    // rules to create a hash of applied css properties.
    //
    // You can directly set a specific .style[prop] = value so patching with vdom
    // is possible.
    if("style" == propName) {
      var css = {}
        , styleProp
      for(var i=0; i<el.style.length; i++) {
        styleProp = el.style[i]
        css[styleProp] = el.style.getPropertyValue(styleProp) // XXX: add support for "!important" via getPropertyPriority()!
      }

      obj[propName] = css
      return
    }

    // Special case: dataset
    // we can iterate over .dataset with a simple for..in loop.
    // The all-time foo with data-* attribs is the dash-snake to camelCase
    // conversion.
    // However, I'm not sure if this is compatible with h()
    //
    // .dataset properties are directly accessible as transparent getters/setters, so
    // patching with vdom is possible.
    if("dataset" == propName) {
      var data = {}
      for(var p in el.dataset) {
        data[p] = el.dataset[p]
      }

      obj[propName] = data
      return
    }

    // Special case: attributes
    // some properties are only accessible via .attributes, so
    // that's what we'd do, if vdom-create-element could handle this.
    if("attributes" == propName) return
    if("tabIndex" == propName && el.tabIndex === -1) return


    // default: just copy the property
    obj[propName] = el[propName]
    return
  })

  return obj
}

/**
 * DOMNode property white list
 * Taken from https://github.com/Raynos/react/blob/dom-property-config/src/browser/ui/dom/DefaultDOMPropertyConfig.js
 */
var props =

module.exports.properties = [
 "accept"
,"accessKey"
,"action"
,"alt"
,"async"
,"autoComplete"
,"autoPlay"
,"cellPadding"
,"cellSpacing"
,"checked"
,"className"
,"colSpan"
,"content"
,"contentEditable"
,"controls"
,"crossOrigin"
,"data"
,"dataset"
,"defer"
,"dir"
,"download"
,"draggable"
,"encType"
,"formNoValidate"
,"href"
,"hrefLang"
,"htmlFor"
,"httpEquiv"
,"icon"
,"id"
,"label"
,"lang"
,"list"
,"loop"
,"max"
,"mediaGroup"
,"method"
,"min"
,"multiple"
,"muted"
,"name"
,"noValidate"
,"pattern"
,"placeholder"
,"poster"
,"preload"
,"radioGroup"
,"readOnly"
,"rel"
,"required"
,"rowSpan"
,"sandbox"
,"scope"
,"scrollLeft"
,"scrolling"
,"scrollTop"
,"selected"
,"span"
,"spellCheck"
,"src"
,"srcDoc"
,"srcSet"
,"start"
,"step"
,"style"
,"tabIndex"
,"target"
,"title"
,"type"
,"value"

// Non-standard Properties
,"autoCapitalize"
,"autoCorrect"
,"property"

, "attributes"
]

var attrs =
module.exports.attrs = [
 "allowFullScreen"
,"allowTransparency"
,"charSet"
,"cols"
,"contextMenu"
,"dateTime"
,"disabled"
,"form"
,"frameBorder"
,"height"
,"hidden"
,"maxLength"
,"role"
,"rows"
,"seamless"
,"size"
,"width"
,"wmode"

// SVG Properties
,"cx"
,"cy"
,"d"
,"dx"
,"dy"
,"fill"
,"fx"
,"fy"
,"gradientTransform"
,"gradientUnits"
,"offset"
,"points"
,"r"
,"rx"
,"ry"
,"spreadMethod"
,"stopColor"
,"stopOpacity"
,"stroke"
,"strokeLinecap"
,"strokeWidth"
,"textAnchor"
,"transform"
,"version"
,"viewBox"
,"x1"
,"x2"
,"x"
,"y1"
,"y2"
,"y"
]

},{"virtual-dom/vnode/vnode":49,"virtual-dom/vnode/vtext":51}],21:[function(require,module,exports){
var createElement = require("./vdom/create-element.js")

module.exports = createElement

},{"./vdom/create-element.js":33}],22:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":53}],23:[function(require,module,exports){
var h = require("./virtual-hyperscript/index.js")

module.exports = h

},{"./virtual-hyperscript/index.js":40}],24:[function(require,module,exports){
/*!
 * Cross-Browser Split 1.1.1
 * Copyright 2007-2012 Steven Levithan <stevenlevithan.com>
 * Available under the MIT License
 * ECMAScript compliant, uniform cross-browser split method
 */

/**
 * Splits a string into an array of strings using a regex or string separator. Matches of the
 * separator are not included in the result array. However, if `separator` is a regex that contains
 * capturing groups, backreferences are spliced into the result each time `separator` is matched.
 * Fixes browser bugs compared to the native `String.prototype.split` and can be used reliably
 * cross-browser.
 * @param {String} str String to split.
 * @param {RegExp|String} separator Regex or string to use for separating the string.
 * @param {Number} [limit] Maximum number of items to include in the result array.
 * @returns {Array} Array of substrings.
 * @example
 *
 * // Basic use
 * split('a b c d', ' ');
 * // -> ['a', 'b', 'c', 'd']
 *
 * // With limit
 * split('a b c d', ' ', 2);
 * // -> ['a', 'b']
 *
 * // Backreferences in result array
 * split('..word1 word2..', /([a-z]+)(\d+)/i);
 * // -> ['..', 'word', '1', ' ', 'word', '2', '..']
 */
module.exports = (function split(undef) {

  var nativeSplit = String.prototype.split,
    compliantExecNpcg = /()??/.exec("")[1] === undef,
    // NPCG: nonparticipating capturing group
    self;

  self = function(str, separator, limit) {
    // If `separator` is not a regex, use `nativeSplit`
    if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
      return nativeSplit.call(str, separator, limit);
    }
    var output = [],
      flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "") + (separator.extended ? "x" : "") + // Proposed for ES6
      (separator.sticky ? "y" : ""),
      // Firefox 3+
      lastLastIndex = 0,
      // Make `global` and avoid `lastIndex` issues by working with a copy
      separator = new RegExp(separator.source, flags + "g"),
      separator2, match, lastIndex, lastLength;
    str += ""; // Type-convert
    if (!compliantExecNpcg) {
      // Doesn't need flags gy, but they don't hurt
      separator2 = new RegExp("^" + separator.source + "$(?!\\s)", flags);
    }
    /* Values for `limit`, per the spec:
     * If undefined: 4294967295 // Math.pow(2, 32) - 1
     * If 0, Infinity, or NaN: 0
     * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
     * If negative number: 4294967296 - Math.floor(Math.abs(limit))
     * If other: Type-convert, then use the above rules
     */
    limit = limit === undef ? -1 >>> 0 : // Math.pow(2, 32) - 1
    limit >>> 0; // ToUint32(limit)
    while (match = separator.exec(str)) {
      // `separator.lastIndex` is not reliable cross-browser
      lastIndex = match.index + match[0].length;
      if (lastIndex > lastLastIndex) {
        output.push(str.slice(lastLastIndex, match.index));
        // Fix browsers whose `exec` methods don't consistently return `undefined` for
        // nonparticipating capturing groups
        if (!compliantExecNpcg && match.length > 1) {
          match[0].replace(separator2, function() {
            for (var i = 1; i < arguments.length - 2; i++) {
              if (arguments[i] === undef) {
                match[i] = undef;
              }
            }
          });
        }
        if (match.length > 1 && match.index < str.length) {
          Array.prototype.push.apply(output, match.slice(1));
        }
        lastLength = match[0].length;
        lastLastIndex = lastIndex;
        if (output.length >= limit) {
          break;
        }
      }
      if (separator.lastIndex === match.index) {
        separator.lastIndex++; // Avoid an infinite loop
      }
    }
    if (lastLastIndex === str.length) {
      if (lastLength || !separator.test("")) {
        output.push("");
      }
    } else {
      output.push(str.slice(lastLastIndex));
    }
    return output.length > limit ? output.slice(0, limit) : output;
  };

  return self;
})();

},{}],25:[function(require,module,exports){
'use strict';

var OneVersionConstraint = require('individual/one-version');

var MY_VERSION = '7';
OneVersionConstraint('ev-store', MY_VERSION);

var hashKey = '__EV_STORE_KEY@' + MY_VERSION;

module.exports = EvStore;

function EvStore(elem) {
    var hash = elem[hashKey];

    if (!hash) {
        hash = elem[hashKey] = {};
    }

    return hash;
}

},{"individual/one-version":27}],26:[function(require,module,exports){
(function (global){
'use strict';

/*global window, global*/

var root = typeof window !== 'undefined' ?
    window : typeof global !== 'undefined' ?
    global : {};

module.exports = Individual;

function Individual(key, value) {
    if (key in root) {
        return root[key];
    }

    root[key] = value;

    return value;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],27:[function(require,module,exports){
'use strict';

var Individual = require('./index.js');

module.exports = OneVersion;

function OneVersion(moduleName, version, defaultValue) {
    var key = '__INDIVIDUAL_ONE_VERSION_' + moduleName;
    var enforceKey = key + '_ENFORCE_SINGLETON';

    var versionValue = Individual(enforceKey, version);

    if (versionValue !== version) {
        throw new Error('Can only have one copy of ' +
            moduleName + '.\n' +
            'You already have version ' + versionValue +
            ' installed.\n' +
            'This means you cannot install version ' + version);
    }

    return Individual(key, defaultValue);
}

},{"./index.js":26}],28:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"min-document":1}],29:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],30:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}],31:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":36}],32:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook.js")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, propName, propValue, previous);
        } else if (isHook(propValue)) {
            removeProperty(node, propName, propValue, previous)
            if (propValue.hook) {
                propValue.hook(node,
                    propName,
                    previous ? previous[propName] : undefined)
            }
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, propName, propValue, previous) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        } else if (previousValue.unhook) {
            previousValue.unhook(node, propName, propValue)
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"../vnode/is-vhook.js":44,"is-object":29}],33:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("../vnode/is-vnode.js")
var isVText = require("../vnode/is-vtext.js")
var isWidget = require("../vnode/is-widget.js")
var handleThunk = require("../vnode/handle-thunk.js")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var node = (vnode.namespace === null) ?
        doc.createElement(vnode.tagName) :
        doc.createElementNS(vnode.namespace, vnode.tagName)

    var props = vnode.properties
    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"../vnode/handle-thunk.js":42,"../vnode/is-vnode.js":45,"../vnode/is-vtext.js":46,"../vnode/is-widget.js":47,"./apply-properties":32,"global/document":28}],34:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],35:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("../vnode/is-widget.js")
var VPatch = require("../vnode/vpatch.js")

var render = require("./create-element")
var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = render(vText, renderOptions)

        if (parentNode && newNode !== domNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    var updating = updateWidget(leftVNode, widget)
    var newNode

    if (updating) {
        newNode = widget.update(leftVNode, domNode) || domNode
    } else {
        newNode = render(widget, renderOptions)
    }

    var parentNode = domNode.parentNode

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    if (!updating) {
        destroyWidget(domNode, leftVNode)
    }

    return newNode
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = render(vNode, renderOptions)

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, moves) {
    var childNodes = domNode.childNodes
    var keyMap = {}
    var node
    var remove
    var insert

    for (var i = 0; i < moves.removes.length; i++) {
        remove = moves.removes[i]
        node = childNodes[remove.from]
        if (remove.key) {
            keyMap[remove.key] = node
        }
        domNode.removeChild(node)
    }

    var length = childNodes.length
    for (var j = 0; j < moves.inserts.length; j++) {
        insert = moves.inserts[j]
        node = keyMap[insert.key]
        // this is the weirdest bug i've ever seen in webkit
        domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../vnode/is-widget.js":47,"../vnode/vpatch.js":50,"./apply-properties":32,"./create-element":33,"./update-widget":37}],36:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches) {
    return patchRecursive(rootNode, patches)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions) {
        renderOptions = { patch: patchRecursive }
        if (ownerDocument !== document) {
            renderOptions.document = ownerDocument
        }
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./dom-index":34,"./patch-op":35,"global/document":28,"x-is-array":30}],37:[function(require,module,exports){
var isWidget = require("../vnode/is-widget.js")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"../vnode/is-widget.js":47}],38:[function(require,module,exports){
'use strict';

var EvStore = require('ev-store');

module.exports = EvHook;

function EvHook(value) {
    if (!(this instanceof EvHook)) {
        return new EvHook(value);
    }

    this.value = value;
}

EvHook.prototype.hook = function (node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = this.value;
};

EvHook.prototype.unhook = function(node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = undefined;
};

},{"ev-store":25}],39:[function(require,module,exports){
'use strict';

module.exports = SoftSetHook;

function SoftSetHook(value) {
    if (!(this instanceof SoftSetHook)) {
        return new SoftSetHook(value);
    }

    this.value = value;
}

SoftSetHook.prototype.hook = function (node, propertyName) {
    if (node[propertyName] !== this.value) {
        node[propertyName] = this.value;
    }
};

},{}],40:[function(require,module,exports){
'use strict';

var isArray = require('x-is-array');

var VNode = require('../vnode/vnode.js');
var VText = require('../vnode/vtext.js');
var isVNode = require('../vnode/is-vnode');
var isVText = require('../vnode/is-vtext');
var isWidget = require('../vnode/is-widget');
var isHook = require('../vnode/is-vhook');
var isVThunk = require('../vnode/is-thunk');

var parseTag = require('./parse-tag.js');
var softSetHook = require('./hooks/soft-set-hook.js');
var evHook = require('./hooks/ev-hook.js');

module.exports = h;

function h(tagName, properties, children) {
    var childNodes = [];
    var tag, props, key, namespace;

    if (!children && isChildren(properties)) {
        children = properties;
        props = {};
    }

    props = props || properties || {};
    tag = parseTag(tagName, props);

    // support keys
    if (props.hasOwnProperty('key')) {
        key = props.key;
        props.key = undefined;
    }

    // support namespace
    if (props.hasOwnProperty('namespace')) {
        namespace = props.namespace;
        props.namespace = undefined;
    }

    // fix cursor bug
    if (tag === 'INPUT' &&
        !namespace &&
        props.hasOwnProperty('value') &&
        props.value !== undefined &&
        !isHook(props.value)
    ) {
        props.value = softSetHook(props.value);
    }

    transformProperties(props);

    if (children !== undefined && children !== null) {
        addChild(children, childNodes, tag, props);
    }


    return new VNode(tag, props, childNodes, key, namespace);
}

function addChild(c, childNodes, tag, props) {
    if (typeof c === 'string') {
        childNodes.push(new VText(c));
    } else if (isChild(c)) {
        childNodes.push(c);
    } else if (isArray(c)) {
        for (var i = 0; i < c.length; i++) {
            addChild(c[i], childNodes, tag, props);
        }
    } else if (c === null || c === undefined) {
        return;
    } else {
        throw UnexpectedVirtualElement({
            foreignObject: c,
            parentVnode: {
                tagName: tag,
                properties: props
            }
        });
    }
}

function transformProperties(props) {
    for (var propName in props) {
        if (props.hasOwnProperty(propName)) {
            var value = props[propName];

            if (isHook(value)) {
                continue;
            }

            if (propName.substr(0, 3) === 'ev-') {
                // add ev-foo support
                props[propName] = evHook(value);
            }
        }
    }
}

function isChild(x) {
    return isVNode(x) || isVText(x) || isWidget(x) || isVThunk(x);
}

function isChildren(x) {
    return typeof x === 'string' || isArray(x) || isChild(x);
}

function UnexpectedVirtualElement(data) {
    var err = new Error();

    err.type = 'virtual-hyperscript.unexpected.virtual-element';
    err.message = 'Unexpected virtual child passed to h().\n' +
        'Expected a VNode / Vthunk / VWidget / string but:\n' +
        'got:\n' +
        errorString(data.foreignObject) +
        '.\n' +
        'The parent vnode is:\n' +
        errorString(data.parentVnode)
        '\n' +
        'Suggested fix: change your `h(..., [ ... ])` callsite.';
    err.foreignObject = data.foreignObject;
    err.parentVnode = data.parentVnode;

    return err;
}

function errorString(obj) {
    try {
        return JSON.stringify(obj, null, '    ');
    } catch (e) {
        return String(obj);
    }
}

},{"../vnode/is-thunk":43,"../vnode/is-vhook":44,"../vnode/is-vnode":45,"../vnode/is-vtext":46,"../vnode/is-widget":47,"../vnode/vnode.js":49,"../vnode/vtext.js":51,"./hooks/ev-hook.js":38,"./hooks/soft-set-hook.js":39,"./parse-tag.js":41,"x-is-array":30}],41:[function(require,module,exports){
'use strict';

var split = require('browser-split');

var classIdSplit = /([\.#]?[a-zA-Z0-9_:-]+)/;
var notClassId = /^\.|#/;

module.exports = parseTag;

function parseTag(tag, props) {
    if (!tag) {
        return 'DIV';
    }

    var noId = !(props.hasOwnProperty('id'));

    var tagParts = split(tag, classIdSplit);
    var tagName = null;

    if (notClassId.test(tagParts[1])) {
        tagName = 'DIV';
    }

    var classes, part, type, i;

    for (i = 0; i < tagParts.length; i++) {
        part = tagParts[i];

        if (!part) {
            continue;
        }

        type = part.charAt(0);

        if (!tagName) {
            tagName = part;
        } else if (type === '.') {
            classes = classes || [];
            classes.push(part.substring(1, part.length));
        } else if (type === '#' && noId) {
            props.id = part.substring(1, part.length);
        }
    }

    if (classes) {
        if (props.className) {
            classes.push(props.className);
        }

        props.className = classes.join(' ');
    }

    return props.namespace ? tagName : tagName.toUpperCase();
}

},{"browser-split":24}],42:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":43,"./is-vnode":45,"./is-vtext":46,"./is-widget":47}],43:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],44:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],45:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":48}],46:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":48}],47:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],48:[function(require,module,exports){
module.exports = "2"

},{}],49:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false
    var hasThunks = false
    var descendantHooks = false
    var hooks

    for (var propName in properties) {
        if (properties.hasOwnProperty(propName)) {
            var property = properties[propName]
            if (isVHook(property) && property.unhook) {
                if (!hooks) {
                    hooks = {}
                }

                hooks[propName] = property
            }
        }
    }

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }

            if (!hasThunks && child.hasThunks) {
                hasThunks = true
            }

            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
                descendantHooks = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        } else if (!hasThunks && isThunk(child)) {
            hasThunks = true;
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
    this.hasThunks = hasThunks
    this.hooks = hooks
    this.descendantHooks = descendantHooks
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-thunk":43,"./is-vhook":44,"./is-vnode":45,"./is-widget":47,"./version":48}],50:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":48}],51:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":48}],52:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                 diff = diff || {}
                 diff[aKey] = bValue
            } else {
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}

},{"../vnode/is-vhook":44,"is-object":29}],53:[function(require,module,exports){
var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        return
    }

    var apply = patch[index]
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                applyClear = true
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            applyClear = true
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        if (!isWidget(a)) {
            applyClear = true
        }

        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        patch[index] = apply
    }

    if (applyClear) {
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var orderedSet = reorder(aChildren, b.children)
    var bChildren = orderedSet.children

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (orderedSet.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(
            VPatch.ORDER,
            a,
            orderedSet.moves
        ))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b)
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true
        }
    }

    return false
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {
    // O(M) time, O(M) memory
    var bChildIndex = keyIndex(bChildren)
    var bKeys = bChildIndex.keys
    var bFree = bChildIndex.free

    if (bFree.length === bChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(N) time, O(N) memory
    var aChildIndex = keyIndex(aChildren)
    var aKeys = aChildIndex.keys
    var aFree = aChildIndex.free

    if (aFree.length === aChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(MAX(N, M)) memory
    var newChildren = []

    var freeIndex = 0
    var freeCount = bFree.length
    var deletedItems = 0

    // Iterate through a and match a node in b
    // O(N) time,
    for (var i = 0 ; i < aChildren.length; i++) {
        var aItem = aChildren[i]
        var itemIndex

        if (aItem.key) {
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key]
                newChildren.push(bChildren[itemIndex])

            } else {
                // Remove old keyed items
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        } else {
            // Match the item in a with the next free item in b
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++]
                newChildren.push(bChildren[itemIndex])
            } else {
                // There are no free items in b to match with
                // the free items in a, so the extra free nodes
                // are deleted.
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        }
    }

    var lastFreeIndex = freeIndex >= bFree.length ?
        bChildren.length :
        bFree[freeIndex]

    // Iterate through b and append any new keys
    // O(M) time
    for (var j = 0; j < bChildren.length; j++) {
        var newItem = bChildren[j]

        if (newItem.key) {
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newChildren.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // Add any leftover non-keyed items
            newChildren.push(newItem)
        }
    }

    var simulate = newChildren.slice()
    var simulateIndex = 0
    var removes = []
    var inserts = []
    var simulateItem

    for (var k = 0; k < bChildren.length;) {
        var wantedItem = bChildren[k]
        simulateItem = simulate[simulateIndex]

        // remove items
        while (simulateItem === null && simulate.length) {
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // if we need a key in this position...
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    if (bKeys[simulateItem.key] !== k + 1) {
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // if the remove didn't put the wanted item in place, we need to insert it
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({key: wantedItem.key, to: k})
                        }
                        // items are matching, so skip ahead
                        else {
                            simulateIndex++
                        }
                    }
                    else {
                        inserts.push({key: wantedItem.key, to: k})
                    }
                }
                else {
                    inserts.push({key: wantedItem.key, to: k})
                }
                k++
            }
            // a key in simulate has no matching wanted key, remove it
            else if (simulateItem && simulateItem.key) {
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }
        }
        else {
            simulateIndex++
            k++
        }
    }

    // remove all the remaining nodes from simulate
    while(simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    return {
        children: newChildren,
        moves: {
            removes: removes,
            inserts: inserts
        }
    }
}

function remove(arr, index, key) {
    arr.splice(index, 1)

    return {
        from: index,
        key: key
    }
}

function keyIndex(children) {
    var keys = {}
    var free = []
    var length = children.length

    for (var i = 0; i < length; i++) {
        var child = children[i]

        if (child.key) {
            keys[child.key] = i
        } else {
            free.push(i)
        }
    }

    return {
        keys: keys,     // A hash of key name to index
        free: free,     // An array of unkeyed item indices
    }
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"../vnode/handle-thunk":42,"../vnode/is-thunk":43,"../vnode/is-vnode":45,"../vnode/is-vtext":46,"../vnode/is-widget":47,"../vnode/vpatch":50,"./diff-props":52,"x-is-array":30}],54:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _dispatcher = require('../dispatcher');

var ShipActions = {

  increment: function increment(payload) {
    _dispatcher.Dispatcher.dispatch('increment', payload);
  },

  update: function update(payload) {
    _dispatcher.Dispatcher.dispatch('update', payload);
  }

};

exports.ShipActions = ShipActions;

},{"../dispatcher":55}],55:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _delorean = require('delorean');

var _storesShip_store = require('./stores/ship_store');

var Dispatcher = _delorean.Flux.createDispatcher({

  increase: function increase() {
    this.dispatch('increase');
  },

  getStores: function getStores() {
    return {
      shipStore: _storesShip_store.ShipStore
    };
  }

});

exports.Dispatcher = Dispatcher;

},{"./stores/ship_store":58,"delorean":14}],56:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _flightjs = require('flightjs');

var _flightjs2 = _interopRequireDefault(_flightjs);

var _mixinWith_vdom = require('./mixin/with_vdom');

// Flux

var _dispatcher = require('./dispatcher');

var _actionsShip_actions = require('./actions/ship_actions');

// Templates and partials

var _templatesIndexHogan = require('../templates/index.hogan');

var _templatesIndexHogan2 = _interopRequireDefault(_templatesIndexHogan);

var _templates_fieldHogan = require('../templates/_field.hogan');

var _templates_fieldHogan2 = _interopRequireDefault(_templates_fieldHogan);

var _templates_incrementHogan = require('../templates/_increment.hogan');

var _templates_incrementHogan2 = _interopRequireDefault(_templates_incrementHogan);

var documentUI = _flightjs2['default'].component(_mixinWith_vdom.withVDOM, function () {
  this.attributes({
    'incrementByOne': '[data-increment]',
    'inputField': '[type="text"]' });

  this.updateAttributes = function (e) {
    var attr = {};
    attr[e.target.name] = e.target.value;

    _actionsShip_actions.ShipActions.update(attr);
  };

  this.increment = function (e) {
    _actionsShip_actions.ShipActions.increment({
      key: e.target.name,
      direction: e.target.dataset.increment
    });
  };

  this.render = function (ship) {
    var ship = _dispatcher.Dispatcher.getStore('shipStore');
    var partials = {
      field: _templates_fieldHogan2['default'],
      increment: _templates_incrementHogan2['default']
    };

    return _templatesIndexHogan2['default'].render({
      name: ship.name || 'Untitled',
      ship: ship,
      attributes: Object.keys(ship).reduce(function (memo, key) {
        if (!isNaN(ship[key])) {
          memo.push({
            key: key,
            value: ship[key]
          });
        }

        return memo;
      }, [])
    }, partials);
  };

  this.update = function (e) {
    var html = this.render();
    var vTree = this.virtualize(html);

    this.updateUI(vTree);
  };

  this.after('initialize', function () {
    // UI Events
    this.on('click', {
      'incrementByOne': this.increment
    });
    this.on('input', {
      'inputField': this.updateAttributes
    });

    // Document Events
    _dispatcher.Dispatcher.on('change:all', this.update.bind(this));
  });
});

exports.documentUI = documentUI;

},{"../templates/_field.hogan":59,"../templates/_increment.hogan":60,"../templates/index.hogan":61,"./actions/ship_actions":54,"./dispatcher":55,"./mixin/with_vdom":57,"flightjs":16}],57:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _virtualDomH = require('virtual-dom/h');

var _virtualDomH2 = _interopRequireDefault(_virtualDomH);

var _virtualDomDiff = require('virtual-dom/diff');

var _virtualDomDiff2 = _interopRequireDefault(_virtualDomDiff);

var _virtualDomPatch = require('virtual-dom/patch');

var _virtualDomPatch2 = _interopRequireDefault(_virtualDomPatch);

var _virtualDomCreateElement = require('virtual-dom/create-element');

var _virtualDomCreateElement2 = _interopRequireDefault(_virtualDomCreateElement);

var _vdomVirtualize = require('vdom-virtualize');

var _vdomVirtualize2 = _interopRequireDefault(_vdomVirtualize);

window.patch = _virtualDomPatch2['default'];

'use strict';

function withVDOM() {

  this.attributes({
    vTree: undefined
  });

  this.virtualize = _vdomVirtualize2['default'].fromHTML;

  /**
   * Initialize the DOM tree
   */
  this.after('initialize', function () {
    this.attr.vTree = this.virtualize(this.render());
    this.node = (0, _virtualDomCreateElement2['default'])(this.attr.vTree);

    document.body.appendChild(this.node);
  });

  /**
   * This does the actual diffing and updating
   */
  this.updateUI = function (newTree) {
    var patches = (0, _virtualDomDiff2['default'])(this.attr.vTree, newTree);

    this.node = (0, _virtualDomPatch2['default'])(this.node, patches);
    this.attr.vTree = newTree;
  };
}

exports.withVDOM = withVDOM;

},{"vdom-virtualize":20,"virtual-dom/create-element":21,"virtual-dom/diff":22,"virtual-dom/h":23,"virtual-dom/patch":31}],58:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _delorean = require('delorean');

var ShipStore = _delorean.Flux.createStore({

  actions: {
    'increment': 'increaseAttribute',
    'update': 'updateAttributes'
  },

  scheme: {
    name: undefined,
    tonnage: 0,
    ftl: 0,
    thrust: 0,
    reactor: 0
  },

  increaseAttribute: function increaseAttribute(payload) {
    var increment = payload.direction == 'up' ? 1 : -1;
    this.set(payload.key, this.state[payload.key] + increment);
  },

  updateAttributes: function updateAttributes(payload) {
    Object.keys(payload).forEach(function (key) {
      this.set(key, payload[key]);
    }, this);
  }

});

exports.ShipStore = ShipStore;

},{"delorean":14}],59:[function(require,module,exports){
var Hogan = require('hogan.js');
module.exports = new Hogan.Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"field\">");t.b("\n" + i);t.b("  <div class=\"label\">");t.b("\n" + i);t.b("      <label for=\"shipname\">");t.b(t.v(t.f("key",c,p,0)));t.b("</label>");t.b("\n" + i);t.b("  </div>");t.b("\n" + i);t.b("  <div class=\"input\">");t.b("\n" + i);t.b("      <input name=\"");t.b(t.v(t.f("key",c,p,0)));t.b("\"");t.b("\n" + i);t.b("             value=\"");t.b(t.v(t.f("value",c,p,0)));t.b("\"");t.b("\n" + i);t.b("             placeholder=\"Please enter a ");t.b(t.v(t.f("key",c,p,0)));t.b("\"");t.b("\n" + i);t.b("             id=\"ship");t.b(t.v(t.f("key",c,p,0)));t.b("\">");t.b("\n" + i);t.b("  </div>");t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "<div class=\"field\">\n  <div class=\"label\">\n      <label for=\"shipname\">{{ key }}</label>\n  </div>\n  <div class=\"input\">\n      <input name=\"{{ key }}\"\n             value=\"{{ value }}\"\n             placeholder=\"Please enter a {{ key }}\"\n             id=\"ship{{ key }}\">\n  </div>\n</div>\n", Hogan);
},{"hogan.js":18}],60:[function(require,module,exports){
var Hogan = require('hogan.js');
module.exports = new Hogan.Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div class=\"controls\">");t.b("\n" + i);t.b("  <label for=\"");t.b(t.v(t.f("key",c,p,0)));t.b("\">");t.b(t.v(t.f("key",c,p,0)));t.b("</label>");t.b("\n" + i);t.b("  <span class=\"value\">");t.b(t.v(t.f("value",c,p,0)));t.b("</span>");t.b("\n" + i);t.b("  <button class=\"increment\" name=\"");t.b(t.v(t.f("key",c,p,0)));t.b("\" data-increment=\"up\">");t.b("\n" + i);t.b("    &uarr;");t.b("\n" + i);t.b("  </button>");t.b("\n" + i);t.b("  <button class=\"increment\" name=\"");t.b(t.v(t.f("key",c,p,0)));t.b("\" data-increment=\"down\">");t.b("\n" + i);t.b("    &darr;");t.b("\n" + i);t.b("  </button>");t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {}, subs: {  }}, "<div class=\"controls\">\n  <label for=\"{{ key }}\">{{ key }}</label>\n  <span class=\"value\">{{ value }}</span>\n  <button class=\"increment\" name=\"{{ key }}\" data-increment=\"up\">\n    &uarr;\n  </button>\n  <button class=\"increment\" name=\"{{ key }}\" data-increment=\"down\">\n    &darr;\n  </button>\n</div>\n", Hogan);
},{"hogan.js":18}],61:[function(require,module,exports){
var Hogan = require('hogan.js');
module.exports = new Hogan.Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<div data-container>");t.b("\n");t.b("\n" + i);t.b("  <h1>");t.b(t.v(t.f("name",c,p,0)));t.b("</h1>");t.b("\n");t.b("\n" + i);t.b("  <div class=\"field\">");t.b("\n" + i);t.b("    <div class=\"label\">");t.b("\n" + i);t.b("        <label for=\"shipname\">Name</label>");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("    <div class=\"input\">");t.b("\n" + i);t.b("        <input name=\"name\"");t.b("\n" + i);t.b("               value=\"");t.b(t.v(t.d("ship.name",c,p,0)));t.b("\"");t.b("\n" + i);t.b("               placeholder=\"Please enter a name\"");t.b("\n" + i);t.b("               id=\"shipname\">");t.b("\n" + i);t.b("    </div>");t.b("\n" + i);t.b("  </div>");t.b("\n");t.b("\n" + i);if(t.s(t.f("attributes",c,p,1),c,p,0,354,376,"{{ }}")){t.rs(c,p,function(c,p,t){t.b(t.rp("<increment0",c,p,"  "));});c.pop();}t.b("\n" + i);t.b("</div>");t.b("\n");return t.fl(); },partials: {"<increment0":{name:"increment", partials: {}, subs: {  }}}, subs: {  }}, "<div data-container>\n\n  <h1>{{ name }}</h1>\n\n  <div class=\"field\">\n    <div class=\"label\">\n        <label for=\"shipname\">Name</label>\n    </div>\n    <div class=\"input\">\n        <input name=\"name\"\n               value=\"{{ ship.name }}\"\n               placeholder=\"Please enter a name\"\n               id=\"shipname\">\n    </div>\n  </div>\n\n  {{# attributes }}\n  {{> increment }}\n  {{/ attributes }}\n\n</div>\n", Hogan);
},{"hogan.js":18}],62:[function(require,module,exports){
'use strict';

var _document_ui = require('./document_ui');

// initialize Flight components
_document_ui.documentUI.attachTo(document.body);

},{"./document_ui":56}]},{},[62])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1yZXNvbHZlL2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2RlbG9yZWFuL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL21haW4uanMiLCJub2RlX21vZHVsZXMvZGVsb3JlYW4vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9hbGwuanMiLCJub2RlX21vZHVsZXMvZGVsb3JlYW4vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9hc2FwLmpzIiwibm9kZV9tb2R1bGVzL2RlbG9yZWFuL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvY29uZmlnLmpzIiwibm9kZV9tb2R1bGVzL2RlbG9yZWFuL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvcG9seWZpbGwuanMiLCJub2RlX21vZHVsZXMvZGVsb3JlYW4vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9wcm9taXNlLmpzIiwibm9kZV9tb2R1bGVzL2RlbG9yZWFuL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvcmFjZS5qcyIsIm5vZGVfbW9kdWxlcy9kZWxvcmVhbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL3JlamVjdC5qcyIsIm5vZGVfbW9kdWxlcy9kZWxvcmVhbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL3Jlc29sdmUuanMiLCJub2RlX21vZHVsZXMvZGVsb3JlYW4vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS91dGlscy5qcyIsIm5vZGVfbW9kdWxlcy9kZWxvcmVhbi9zcmMvZGVsb3JlYW4uanMiLCJub2RlX21vZHVsZXMvZGVsb3JlYW4vc3JjL3JlcXVpcmVtZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9mbGlnaHRqcy9idWlsZC9mbGlnaHQuanMiLCJub2RlX21vZHVsZXMvaG9nYW4uanMvbGliL2NvbXBpbGVyLmpzIiwibm9kZV9tb2R1bGVzL2hvZ2FuLmpzL2xpYi9ob2dhbi5qcyIsIm5vZGVfbW9kdWxlcy9ob2dhbi5qcy9saWIvdGVtcGxhdGUuanMiLCJub2RlX21vZHVsZXMvdmRvbS12aXJ0dWFsaXplL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL2NyZWF0ZS1lbGVtZW50LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL2RpZmYuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vaC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvYnJvd3Nlci1zcGxpdC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvZXYtc3RvcmUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vbm9kZV9tb2R1bGVzL2V2LXN0b3JlL25vZGVfbW9kdWxlcy9pbmRpdmlkdWFsL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL25vZGVfbW9kdWxlcy9ldi1zdG9yZS9ub2RlX21vZHVsZXMvaW5kaXZpZHVhbC9vbmUtdmVyc2lvbi5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvZ2xvYmFsL2RvY3VtZW50LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL25vZGVfbW9kdWxlcy9pcy1vYmplY3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vbm9kZV9tb2R1bGVzL3gtaXMtYXJyYXkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vcGF0Y2guanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmRvbS9hcHBseS1wcm9wZXJ0aWVzLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vY3JlYXRlLWVsZW1lbnQuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmRvbS9kb20taW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmRvbS9wYXRjaC1vcC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92ZG9tL3BhdGNoLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vdXBkYXRlLXdpZGdldC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92aXJ0dWFsLWh5cGVyc2NyaXB0L2hvb2tzL2V2LWhvb2suanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmlydHVhbC1oeXBlcnNjcmlwdC9ob29rcy9zb2Z0LXNldC1ob29rLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3ZpcnR1YWwtaHlwZXJzY3JpcHQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmlydHVhbC1oeXBlcnNjcmlwdC9wYXJzZS10YWcuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvaGFuZGxlLXRodW5rLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXRodW5rLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXZob29rLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXZub2RlLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXZ0ZXh0LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXdpZGdldC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS92ZXJzaW9uLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL3Zub2RlLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL3ZwYXRjaC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS92dGV4dC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92dHJlZS9kaWZmLXByb3BzLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Z0cmVlL2RpZmYuanMiLCIvVXNlcnMva2VpdGgvV29yay9WaXJ0dWFsRE9NL3ZpcnR1YWwtZG9tLWRlbW8vc3JjL2pzL2FjdGlvbnMvc2hpcF9hY3Rpb25zLmpzIiwiL1VzZXJzL2tlaXRoL1dvcmsvVmlydHVhbERPTS92aXJ0dWFsLWRvbS1kZW1vL3NyYy9qcy9kaXNwYXRjaGVyLmpzIiwiL1VzZXJzL2tlaXRoL1dvcmsvVmlydHVhbERPTS92aXJ0dWFsLWRvbS1kZW1vL3NyYy9qcy9kb2N1bWVudF91aS5qcyIsIi9Vc2Vycy9rZWl0aC9Xb3JrL1ZpcnR1YWxET00vdmlydHVhbC1kb20tZGVtby9zcmMvanMvbWl4aW4vd2l0aF92ZG9tLmpzIiwiL1VzZXJzL2tlaXRoL1dvcmsvVmlydHVhbERPTS92aXJ0dWFsLWRvbS1kZW1vL3NyYy9qcy9zdG9yZXMvc2hpcF9zdG9yZS5qcyIsInNyYy90ZW1wbGF0ZXMvX2ZpZWxkLmhvZ2FuIiwic3JjL3RlbXBsYXRlcy9faW5jcmVtZW50LmhvZ2FuIiwic3JjL3RlbXBsYXRlcy9pbmRleC5ob2dhbiIsIi9Vc2Vycy9rZWl0aC9Xb3JrL1ZpcnR1YWxET00vdmlydHVhbC1kb20tZGVtby9zcmMvanMvYXBwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1NkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZhQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25RQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7OzswQkMzYTJCLGVBQWU7O0FBRTFDLElBQUksV0FBVyxHQUFHOztBQUVoQixXQUFTLEVBQUUsbUJBQVMsT0FBTyxFQUFFO0FBQzNCLGdCQUxLLFVBQVUsQ0FLSixRQUFRLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0dBQzNDOztBQUVELFFBQU0sRUFBRSxnQkFBUyxPQUFPLEVBQUU7QUFDeEIsZ0JBVEssVUFBVSxDQVNKLFFBQVEsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7R0FDeEM7O0NBRUYsQ0FBQzs7UUFFTyxXQUFXLEdBQVgsV0FBVzs7Ozs7Ozs7O3dCQ2RDLFVBQVU7O2dDQUNMLHFCQUFxQjs7QUFFL0MsSUFBSSxVQUFVLEdBQUcsVUFIUixJQUFJLENBR1MsZ0JBQWdCLENBQUM7O0FBRXJDLFVBQVEsRUFBRSxvQkFBVztBQUNuQixRQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0dBQzNCOztBQUVELFdBQVMsRUFBRSxxQkFBVztBQUNwQixXQUFPO0FBQ0wsZUFBUyxvQkFWTixTQUFTLEFBVVE7S0FDckIsQ0FBQztHQUNIOztDQUVGLENBQUMsQ0FBQzs7UUFFTSxVQUFVLEdBQVYsVUFBVTs7Ozs7Ozs7Ozs7d0JDakJBLFVBQVU7Ozs7OEJBQ0osbUJBQW1COzs7OzBCQUdqQixjQUFjOzttQ0FDYix3QkFBd0I7Ozs7bUNBRy9CLDBCQUEwQjs7OztvQ0FDdEIsMkJBQTJCOzs7O3dDQUN2QiwrQkFBK0I7Ozs7QUFFNUQsSUFBSSxVQUFVLEdBQUcsc0JBQU8sU0FBUyxpQkFYeEIsUUFBUSxFQVcyQixZQUFXO0FBQ3JELE1BQUksQ0FBQyxVQUFVLENBQUM7QUFDZCxvQkFBZ0IsRUFBRSxrQkFBa0I7QUFDcEMsZ0JBQVksRUFBRSxlQUFlLEVBQzlCLENBQUMsQ0FBQzs7QUFFSCxNQUFJLENBQUMsZ0JBQWdCLEdBQUcsVUFBUyxDQUFDLEVBQUU7QUFDbEMsUUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFBO0FBQ2IsUUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7O0FBRXJDLHlCQWpCSyxXQUFXLENBaUJKLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztHQUMxQixDQUFDOztBQUVGLE1BQUksQ0FBQyxTQUFTLEdBQUcsVUFBUyxDQUFDLEVBQUU7QUFDM0IseUJBckJLLFdBQVcsQ0FxQkosU0FBUyxDQUFDO0FBQ3BCLFNBQUcsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUk7QUFDbEIsZUFBUyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVM7S0FDdEMsQ0FBQyxDQUFDO0dBQ0osQ0FBQzs7QUFFRixNQUFJLENBQUMsTUFBTSxHQUFHLFVBQVMsSUFBSSxFQUFFO0FBQzNCLFFBQUksSUFBSSxHQUFHLFlBN0JOLFVBQVUsQ0E2Qk8sUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQzVDLFFBQUksUUFBUSxHQUFHO0FBQ2IsV0FBSyxtQ0FBYztBQUNuQixlQUFTLHVDQUFrQjtLQUM1QixDQUFDOztBQUVGLFdBQU8saUNBQVMsTUFBTSxDQUFDO0FBQ25CLFVBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxJQUFJLFVBQVU7QUFDN0IsVUFBSSxFQUFFLElBQUk7QUFDVixnQkFBVSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLFVBQVMsSUFBSSxFQUFFLEdBQUcsRUFBRTtBQUN2RCxZQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFO0FBQ3JCLGNBQUksQ0FBQyxJQUFJLENBQUM7QUFDUixlQUFHLEVBQUUsR0FBRztBQUNSLGlCQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQztXQUNqQixDQUFDLENBQUM7U0FDSjs7QUFFRCxlQUFPLElBQUksQ0FBQztPQUNiLEVBQUUsRUFBRSxDQUFDO0tBQ1QsRUFBRSxRQUFRLENBQUMsQ0FBQztHQUNkLENBQUM7O0FBRUYsTUFBSSxDQUFDLE1BQU0sR0FBRyxVQUFTLENBQUMsRUFBRTtBQUN4QixRQUFJLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDekIsUUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQzs7QUFFbEMsUUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztHQUN0QixDQUFDOztBQUVGLE1BQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFLFlBQVc7O0FBRWxDLFFBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFO0FBQ2Ysc0JBQWdCLEVBQUUsSUFBSSxDQUFDLFNBQVM7S0FDakMsQ0FBQyxDQUFDO0FBQ0gsUUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUU7QUFDZixrQkFBWSxFQUFFLElBQUksQ0FBQyxnQkFBZ0I7S0FDcEMsQ0FBQyxDQUFDOzs7QUFHSCxnQkFwRUssVUFBVSxDQW9FSixFQUFFLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7R0FDckQsQ0FBQyxDQUFDO0NBQ0osQ0FBQyxDQUFDOztRQUVNLFVBQVUsR0FBVixVQUFVOzs7Ozs7Ozs7OzsyQkM1RUwsZUFBZTs7Ozs4QkFDWixrQkFBa0I7Ozs7K0JBQ2pCLG1CQUFtQjs7Ozt1Q0FDWCw0QkFBNEI7Ozs7OEJBRS9CLGlCQUFpQjs7OztBQUV4QyxNQUFNLENBQUMsS0FBSywrQkFBUSxDQUFDOztBQUVyQixZQUFZLENBQUM7O0FBRWIsU0FBUyxRQUFRLEdBQUc7O0FBRWxCLE1BQUksQ0FBQyxVQUFVLENBQUM7QUFDZCxTQUFLLEVBQUUsU0FBUztHQUNqQixDQUFDLENBQUM7O0FBRUgsTUFBSSxDQUFDLFVBQVUsR0FBRyw0QkFBVyxRQUFRLENBQUM7Ozs7O0FBS3RDLE1BQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFLFlBQVc7QUFDbEMsUUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUNqRCxRQUFJLENBQUMsSUFBSSxHQUFHLDBDQUFjLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7O0FBRTNDLFlBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztHQUN0QyxDQUFDLENBQUM7Ozs7O0FBS0gsTUFBSSxDQUFDLFFBQVEsR0FBRyxVQUFTLE9BQU8sRUFBRTtBQUNoQyxRQUFJLE9BQU8sR0FBRyxpQ0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQzs7QUFFN0MsUUFBSSxDQUFDLElBQUksR0FBRyxrQ0FBTSxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3RDLFFBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQztHQUMzQixDQUFDO0NBRUg7O1FBRVEsUUFBUSxHQUFSLFFBQVE7Ozs7Ozs7Ozt3QkN6Q0ksVUFBVTs7QUFFL0IsSUFBSSxTQUFTLEdBQUcsVUFGUCxJQUFJLENBRVEsV0FBVyxDQUFDOztBQUUvQixTQUFPLEVBQUU7QUFDUCxlQUFXLEVBQUUsbUJBQW1CO0FBQ2hDLFlBQVEsRUFBRSxrQkFBa0I7R0FDN0I7O0FBRUQsUUFBTSxFQUFFO0FBQ04sUUFBSSxFQUFFLFNBQVM7QUFDZixXQUFPLEVBQUUsQ0FBQztBQUNWLE9BQUcsRUFBRSxDQUFDO0FBQ04sVUFBTSxFQUFFLENBQUM7QUFDVCxXQUFPLEVBQUUsQ0FBQztHQUNYOztBQUVELG1CQUFpQixFQUFFLDJCQUFTLE9BQU8sRUFBRTtBQUNuQyxRQUFJLFNBQVMsR0FBRyxPQUFPLENBQUMsU0FBUyxJQUFJLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDbkQsUUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0dBQzVEOztBQUVELGtCQUFnQixFQUFFLDBCQUFTLE9BQU8sRUFBRTtBQUNsQyxVQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFTLEdBQUcsRUFBRTtBQUN6QyxVQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztLQUM3QixFQUFFLElBQUksQ0FBQyxDQUFDO0dBQ1Y7O0NBRUYsQ0FBQyxDQUFDOztRQUVNLFNBQVMsR0FBVCxTQUFTOzs7QUM5QmxCO0FBQ0E7O0FDREE7QUFDQTs7QUNEQTtBQUNBOzs7OzJCQ0QyQixlQUFlOzs7QUFHMUMsYUFIUyxVQUFVLENBR1IsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLG51bGwsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoXCIuL3Byb21pc2UvcHJvbWlzZVwiKS5Qcm9taXNlO1xudmFyIHBvbHlmaWxsID0gcmVxdWlyZShcIi4vcHJvbWlzZS9wb2x5ZmlsbFwiKS5wb2x5ZmlsbDtcbmV4cG9ydHMuUHJvbWlzZSA9IFByb21pc2U7XG5leHBvcnRzLnBvbHlmaWxsID0gcG9seWZpbGw7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKiBnbG9iYWwgdG9TdHJpbmcgKi9cblxudmFyIGlzQXJyYXkgPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0FycmF5O1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0Z1bmN0aW9uO1xuXG4vKipcbiAgUmV0dXJucyBhIHByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2hlbiBhbGwgdGhlIGdpdmVuIHByb21pc2VzIGhhdmUgYmVlblxuICBmdWxmaWxsZWQsIG9yIHJlamVjdGVkIGlmIGFueSBvZiB0aGVtIGJlY29tZSByZWplY3RlZC4gVGhlIHJldHVybiBwcm9taXNlXG4gIGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGFycmF5IHRoYXQgZ2l2ZXMgYWxsIHRoZSB2YWx1ZXMgaW4gdGhlIG9yZGVyIHRoZXkgd2VyZVxuICBwYXNzZWQgaW4gdGhlIGBwcm9taXNlc2AgYXJyYXkgYXJndW1lbnQuXG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlMSA9IFJTVlAucmVzb2x2ZSgxKTtcbiAgdmFyIHByb21pc2UyID0gUlNWUC5yZXNvbHZlKDIpO1xuICB2YXIgcHJvbWlzZTMgPSBSU1ZQLnJlc29sdmUoMyk7XG4gIHZhciBwcm9taXNlcyA9IFsgcHJvbWlzZTEsIHByb21pc2UyLCBwcm9taXNlMyBdO1xuXG4gIFJTVlAuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uKGFycmF5KXtcbiAgICAvLyBUaGUgYXJyYXkgaGVyZSB3b3VsZCBiZSBbIDEsIDIsIDMgXTtcbiAgfSk7XG4gIGBgYFxuXG4gIElmIGFueSBvZiB0aGUgYHByb21pc2VzYCBnaXZlbiB0byBgUlNWUC5hbGxgIGFyZSByZWplY3RlZCwgdGhlIGZpcnN0IHByb21pc2VcbiAgdGhhdCBpcyByZWplY3RlZCB3aWxsIGJlIGdpdmVuIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSByZXR1cm5lZCBwcm9taXNlcydzXG4gIHJlamVjdGlvbiBoYW5kbGVyLiBGb3IgZXhhbXBsZTpcblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgdmFyIHByb21pc2UxID0gUlNWUC5yZXNvbHZlKDEpO1xuICB2YXIgcHJvbWlzZTIgPSBSU1ZQLnJlamVjdChuZXcgRXJyb3IoXCIyXCIpKTtcbiAgdmFyIHByb21pc2UzID0gUlNWUC5yZWplY3QobmV3IEVycm9yKFwiM1wiKSk7XG4gIHZhciBwcm9taXNlcyA9IFsgcHJvbWlzZTEsIHByb21pc2UyLCBwcm9taXNlMyBdO1xuXG4gIFJTVlAuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uKGFycmF5KXtcbiAgICAvLyBDb2RlIGhlcmUgbmV2ZXIgcnVucyBiZWNhdXNlIHRoZXJlIGFyZSByZWplY3RlZCBwcm9taXNlcyFcbiAgfSwgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAvLyBlcnJvci5tZXNzYWdlID09PSBcIjJcIlxuICB9KTtcbiAgYGBgXG5cbiAgQG1ldGhvZCBhbGxcbiAgQGZvciBSU1ZQXG4gIEBwYXJhbSB7QXJyYXl9IHByb21pc2VzXG4gIEBwYXJhbSB7U3RyaW5nfSBsYWJlbFxuICBAcmV0dXJuIHtQcm9taXNlfSBwcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdoZW4gYWxsIGBwcm9taXNlc2AgaGF2ZSBiZWVuXG4gIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQgaWYgYW55IG9mIHRoZW0gYmVjb21lIHJlamVjdGVkLlxuKi9cbmZ1bmN0aW9uIGFsbChwcm9taXNlcykge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgUHJvbWlzZSA9IHRoaXM7XG5cbiAgaWYgKCFpc0FycmF5KHByb21pc2VzKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gYWxsLicpO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHZhciByZXN1bHRzID0gW10sIHJlbWFpbmluZyA9IHByb21pc2VzLmxlbmd0aCxcbiAgICBwcm9taXNlO1xuXG4gICAgaWYgKHJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgcmVzb2x2ZShbXSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVzb2x2ZXIoaW5kZXgpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXNvbHZlQWxsKGluZGV4LCB2YWx1ZSk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlc29sdmVBbGwoaW5kZXgsIHZhbHVlKSB7XG4gICAgICByZXN1bHRzW2luZGV4XSA9IHZhbHVlO1xuICAgICAgaWYgKC0tcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgIHJlc29sdmUocmVzdWx0cyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9taXNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgcHJvbWlzZSA9IHByb21pc2VzW2ldO1xuXG4gICAgICBpZiAocHJvbWlzZSAmJiBpc0Z1bmN0aW9uKHByb21pc2UudGhlbikpIHtcbiAgICAgICAgcHJvbWlzZS50aGVuKHJlc29sdmVyKGkpLCByZWplY3QpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzb2x2ZUFsbChpLCBwcm9taXNlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnRzLmFsbCA9IGFsbDsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBicm93c2VyR2xvYmFsID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSA/IHdpbmRvdyA6IHt9O1xudmFyIEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyID0gYnJvd3Nlckdsb2JhbC5NdXRhdGlvbk9ic2VydmVyIHx8IGJyb3dzZXJHbG9iYWwuV2ViS2l0TXV0YXRpb25PYnNlcnZlcjtcbnZhciBsb2NhbCA9ICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykgPyBnbG9iYWwgOiAodGhpcyA9PT0gdW5kZWZpbmVkPyB3aW5kb3c6dGhpcyk7XG5cbi8vIG5vZGVcbmZ1bmN0aW9uIHVzZU5leHRUaWNrKCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhmbHVzaCk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHVzZU11dGF0aW9uT2JzZXJ2ZXIoKSB7XG4gIHZhciBpdGVyYXRpb25zID0gMDtcbiAgdmFyIG9ic2VydmVyID0gbmV3IEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKGZsdXNoKTtcbiAgdmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG4gIG9ic2VydmVyLm9ic2VydmUobm9kZSwgeyBjaGFyYWN0ZXJEYXRhOiB0cnVlIH0pO1xuXG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICBub2RlLmRhdGEgPSAoaXRlcmF0aW9ucyA9ICsraXRlcmF0aW9ucyAlIDIpO1xuICB9O1xufVxuXG5mdW5jdGlvbiB1c2VTZXRUaW1lb3V0KCkge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgbG9jYWwuc2V0VGltZW91dChmbHVzaCwgMSk7XG4gIH07XG59XG5cbnZhciBxdWV1ZSA9IFtdO1xuZnVuY3Rpb24gZmx1c2goKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgdHVwbGUgPSBxdWV1ZVtpXTtcbiAgICB2YXIgY2FsbGJhY2sgPSB0dXBsZVswXSwgYXJnID0gdHVwbGVbMV07XG4gICAgY2FsbGJhY2soYXJnKTtcbiAgfVxuICBxdWV1ZSA9IFtdO1xufVxuXG52YXIgc2NoZWR1bGVGbHVzaDtcblxuLy8gRGVjaWRlIHdoYXQgYXN5bmMgbWV0aG9kIHRvIHVzZSB0byB0cmlnZ2VyaW5nIHByb2Nlc3Npbmcgb2YgcXVldWVkIGNhbGxiYWNrczpcbmlmICh0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYge30udG9TdHJpbmcuY2FsbChwcm9jZXNzKSA9PT0gJ1tvYmplY3QgcHJvY2Vzc10nKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VOZXh0VGljaygpO1xufSBlbHNlIGlmIChCcm93c2VyTXV0YXRpb25PYnNlcnZlcikge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlTXV0YXRpb25PYnNlcnZlcigpO1xufSBlbHNlIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZVNldFRpbWVvdXQoKTtcbn1cblxuZnVuY3Rpb24gYXNhcChjYWxsYmFjaywgYXJnKSB7XG4gIHZhciBsZW5ndGggPSBxdWV1ZS5wdXNoKFtjYWxsYmFjaywgYXJnXSk7XG4gIGlmIChsZW5ndGggPT09IDEpIHtcbiAgICAvLyBJZiBsZW5ndGggaXMgMSwgdGhhdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gc2NoZWR1bGUgYW4gYXN5bmMgZmx1c2guXG4gICAgLy8gSWYgYWRkaXRpb25hbCBjYWxsYmFja3MgYXJlIHF1ZXVlZCBiZWZvcmUgdGhlIHF1ZXVlIGlzIGZsdXNoZWQsIHRoZXlcbiAgICAvLyB3aWxsIGJlIHByb2Nlc3NlZCBieSB0aGlzIGZsdXNoIHRoYXQgd2UgYXJlIHNjaGVkdWxpbmcuXG4gICAgc2NoZWR1bGVGbHVzaCgpO1xuICB9XG59XG5cbmV4cG9ydHMuYXNhcCA9IGFzYXA7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgY29uZmlnID0ge1xuICBpbnN0cnVtZW50OiBmYWxzZVxufTtcblxuZnVuY3Rpb24gY29uZmlndXJlKG5hbWUsIHZhbHVlKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgY29uZmlnW25hbWVdID0gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGNvbmZpZ1tuYW1lXTtcbiAgfVxufVxuXG5leHBvcnRzLmNvbmZpZyA9IGNvbmZpZztcbmV4cG9ydHMuY29uZmlndXJlID0gY29uZmlndXJlOyIsIlwidXNlIHN0cmljdFwiO1xuLypnbG9iYWwgc2VsZiovXG52YXIgUlNWUFByb21pc2UgPSByZXF1aXJlKFwiLi9wcm9taXNlXCIpLlByb21pc2U7XG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLmlzRnVuY3Rpb247XG5cbmZ1bmN0aW9uIHBvbHlmaWxsKCkge1xuICB2YXIgbG9jYWw7XG5cbiAgaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbG9jYWwgPSBnbG9iYWw7XG4gIH0gZWxzZSBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LmRvY3VtZW50KSB7XG4gICAgbG9jYWwgPSB3aW5kb3c7XG4gIH0gZWxzZSB7XG4gICAgbG9jYWwgPSBzZWxmO1xuICB9XG5cbiAgdmFyIGVzNlByb21pc2VTdXBwb3J0ID0gXG4gICAgXCJQcm9taXNlXCIgaW4gbG9jYWwgJiZcbiAgICAvLyBTb21lIG9mIHRoZXNlIG1ldGhvZHMgYXJlIG1pc3NpbmcgZnJvbVxuICAgIC8vIEZpcmVmb3gvQ2hyb21lIGV4cGVyaW1lbnRhbCBpbXBsZW1lbnRhdGlvbnNcbiAgICBcInJlc29sdmVcIiBpbiBsb2NhbC5Qcm9taXNlICYmXG4gICAgXCJyZWplY3RcIiBpbiBsb2NhbC5Qcm9taXNlICYmXG4gICAgXCJhbGxcIiBpbiBsb2NhbC5Qcm9taXNlICYmXG4gICAgXCJyYWNlXCIgaW4gbG9jYWwuUHJvbWlzZSAmJlxuICAgIC8vIE9sZGVyIHZlcnNpb24gb2YgdGhlIHNwZWMgaGFkIGEgcmVzb2x2ZXIgb2JqZWN0XG4gICAgLy8gYXMgdGhlIGFyZyByYXRoZXIgdGhhbiBhIGZ1bmN0aW9uXG4gICAgKGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHJlc29sdmU7XG4gICAgICBuZXcgbG9jYWwuUHJvbWlzZShmdW5jdGlvbihyKSB7IHJlc29sdmUgPSByOyB9KTtcbiAgICAgIHJldHVybiBpc0Z1bmN0aW9uKHJlc29sdmUpO1xuICAgIH0oKSk7XG5cbiAgaWYgKCFlczZQcm9taXNlU3VwcG9ydCkge1xuICAgIGxvY2FsLlByb21pc2UgPSBSU1ZQUHJvbWlzZTtcbiAgfVxufVxuXG5leHBvcnRzLnBvbHlmaWxsID0gcG9seWZpbGw7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgY29uZmlnID0gcmVxdWlyZShcIi4vY29uZmlnXCIpLmNvbmZpZztcbnZhciBjb25maWd1cmUgPSByZXF1aXJlKFwiLi9jb25maWdcIikuY29uZmlndXJlO1xudmFyIG9iamVjdE9yRnVuY3Rpb24gPSByZXF1aXJlKFwiLi91dGlsc1wiKS5vYmplY3RPckZ1bmN0aW9uO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0Z1bmN0aW9uO1xudmFyIG5vdyA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLm5vdztcbnZhciBhbGwgPSByZXF1aXJlKFwiLi9hbGxcIikuYWxsO1xudmFyIHJhY2UgPSByZXF1aXJlKFwiLi9yYWNlXCIpLnJhY2U7XG52YXIgc3RhdGljUmVzb2x2ZSA9IHJlcXVpcmUoXCIuL3Jlc29sdmVcIikucmVzb2x2ZTtcbnZhciBzdGF0aWNSZWplY3QgPSByZXF1aXJlKFwiLi9yZWplY3RcIikucmVqZWN0O1xudmFyIGFzYXAgPSByZXF1aXJlKFwiLi9hc2FwXCIpLmFzYXA7XG5cbnZhciBjb3VudGVyID0gMDtcblxuY29uZmlnLmFzeW5jID0gYXNhcDsgLy8gZGVmYXVsdCBhc3luYyBpcyBhc2FwO1xuXG5mdW5jdGlvbiBQcm9taXNlKHJlc29sdmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihyZXNvbHZlcikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGEgcmVzb2x2ZXIgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IGFyZ3VtZW50IHRvIHRoZSBwcm9taXNlIGNvbnN0cnVjdG9yJyk7XG4gIH1cblxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUHJvbWlzZSkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRmFpbGVkIHRvIGNvbnN0cnVjdCAnUHJvbWlzZSc6IFBsZWFzZSB1c2UgdGhlICduZXcnIG9wZXJhdG9yLCB0aGlzIG9iamVjdCBjb25zdHJ1Y3RvciBjYW5ub3QgYmUgY2FsbGVkIGFzIGEgZnVuY3Rpb24uXCIpO1xuICB9XG5cbiAgdGhpcy5fc3Vic2NyaWJlcnMgPSBbXTtcblxuICBpbnZva2VSZXNvbHZlcihyZXNvbHZlciwgdGhpcyk7XG59XG5cbmZ1bmN0aW9uIGludm9rZVJlc29sdmVyKHJlc29sdmVyLCBwcm9taXNlKSB7XG4gIGZ1bmN0aW9uIHJlc29sdmVQcm9taXNlKHZhbHVlKSB7XG4gICAgcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiByZWplY3RQcm9taXNlKHJlYXNvbikge1xuICAgIHJlamVjdChwcm9taXNlLCByZWFzb24pO1xuICB9XG5cbiAgdHJ5IHtcbiAgICByZXNvbHZlcihyZXNvbHZlUHJvbWlzZSwgcmVqZWN0UHJvbWlzZSk7XG4gIH0gY2F0Y2goZSkge1xuICAgIHJlamVjdFByb21pc2UoZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgcHJvbWlzZSwgY2FsbGJhY2ssIGRldGFpbCkge1xuICB2YXIgaGFzQ2FsbGJhY2sgPSBpc0Z1bmN0aW9uKGNhbGxiYWNrKSxcbiAgICAgIHZhbHVlLCBlcnJvciwgc3VjY2VlZGVkLCBmYWlsZWQ7XG5cbiAgaWYgKGhhc0NhbGxiYWNrKSB7XG4gICAgdHJ5IHtcbiAgICAgIHZhbHVlID0gY2FsbGJhY2soZGV0YWlsKTtcbiAgICAgIHN1Y2NlZWRlZCA9IHRydWU7XG4gICAgfSBjYXRjaChlKSB7XG4gICAgICBmYWlsZWQgPSB0cnVlO1xuICAgICAgZXJyb3IgPSBlO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YWx1ZSA9IGRldGFpbDtcbiAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICB9XG5cbiAgaWYgKGhhbmRsZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlKSkge1xuICAgIHJldHVybjtcbiAgfSBlbHNlIGlmIChoYXNDYWxsYmFjayAmJiBzdWNjZWVkZWQpIHtcbiAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChmYWlsZWQpIHtcbiAgICByZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IEZVTEZJTExFRCkge1xuICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IFJFSkVDVEVEKSB7XG4gICAgcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcbiAgfVxufVxuXG52YXIgUEVORElORyAgID0gdm9pZCAwO1xudmFyIFNFQUxFRCAgICA9IDA7XG52YXIgRlVMRklMTEVEID0gMTtcbnZhciBSRUpFQ1RFRCAgPSAyO1xuXG5mdW5jdGlvbiBzdWJzY3JpYmUocGFyZW50LCBjaGlsZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgdmFyIHN1YnNjcmliZXJzID0gcGFyZW50Ll9zdWJzY3JpYmVycztcbiAgdmFyIGxlbmd0aCA9IHN1YnNjcmliZXJzLmxlbmd0aDtcblxuICBzdWJzY3JpYmVyc1tsZW5ndGhdID0gY2hpbGQ7XG4gIHN1YnNjcmliZXJzW2xlbmd0aCArIEZVTEZJTExFRF0gPSBvbkZ1bGZpbGxtZW50O1xuICBzdWJzY3JpYmVyc1tsZW5ndGggKyBSRUpFQ1RFRF0gID0gb25SZWplY3Rpb247XG59XG5cbmZ1bmN0aW9uIHB1Ymxpc2gocHJvbWlzZSwgc2V0dGxlZCkge1xuICB2YXIgY2hpbGQsIGNhbGxiYWNrLCBzdWJzY3JpYmVycyA9IHByb21pc2UuX3N1YnNjcmliZXJzLCBkZXRhaWwgPSBwcm9taXNlLl9kZXRhaWw7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdWJzY3JpYmVycy5sZW5ndGg7IGkgKz0gMykge1xuICAgIGNoaWxkID0gc3Vic2NyaWJlcnNbaV07XG4gICAgY2FsbGJhY2sgPSBzdWJzY3JpYmVyc1tpICsgc2V0dGxlZF07XG5cbiAgICBpbnZva2VDYWxsYmFjayhzZXR0bGVkLCBjaGlsZCwgY2FsbGJhY2ssIGRldGFpbCk7XG4gIH1cblxuICBwcm9taXNlLl9zdWJzY3JpYmVycyA9IG51bGw7XG59XG5cblByb21pc2UucHJvdG90eXBlID0ge1xuICBjb25zdHJ1Y3RvcjogUHJvbWlzZSxcblxuICBfc3RhdGU6IHVuZGVmaW5lZCxcbiAgX2RldGFpbDogdW5kZWZpbmVkLFxuICBfc3Vic2NyaWJlcnM6IHVuZGVmaW5lZCxcblxuICB0aGVuOiBmdW5jdGlvbihvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICAgIHZhciBwcm9taXNlID0gdGhpcztcblxuICAgIHZhciB0aGVuUHJvbWlzZSA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKGZ1bmN0aW9uKCkge30pO1xuXG4gICAgaWYgKHRoaXMuX3N0YXRlKSB7XG4gICAgICB2YXIgY2FsbGJhY2tzID0gYXJndW1lbnRzO1xuICAgICAgY29uZmlnLmFzeW5jKGZ1bmN0aW9uIGludm9rZVByb21pc2VDYWxsYmFjaygpIHtcbiAgICAgICAgaW52b2tlQ2FsbGJhY2socHJvbWlzZS5fc3RhdGUsIHRoZW5Qcm9taXNlLCBjYWxsYmFja3NbcHJvbWlzZS5fc3RhdGUgLSAxXSwgcHJvbWlzZS5fZGV0YWlsKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdWJzY3JpYmUodGhpcywgdGhlblByb21pc2UsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhlblByb21pc2U7XG4gIH0sXG5cbiAgJ2NhdGNoJzogZnVuY3Rpb24ob25SZWplY3Rpb24pIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0aW9uKTtcbiAgfVxufTtcblxuUHJvbWlzZS5hbGwgPSBhbGw7XG5Qcm9taXNlLnJhY2UgPSByYWNlO1xuUHJvbWlzZS5yZXNvbHZlID0gc3RhdGljUmVzb2x2ZTtcblByb21pc2UucmVqZWN0ID0gc3RhdGljUmVqZWN0O1xuXG5mdW5jdGlvbiBoYW5kbGVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSkge1xuICB2YXIgdGhlbiA9IG51bGwsXG4gIHJlc29sdmVkO1xuXG4gIHRyeSB7XG4gICAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQSBwcm9taXNlcyBjYWxsYmFjayBjYW5ub3QgcmV0dXJuIHRoYXQgc2FtZSBwcm9taXNlLlwiKTtcbiAgICB9XG5cbiAgICBpZiAob2JqZWN0T3JGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICAgIHRoZW4gPSB2YWx1ZS50aGVuO1xuXG4gICAgICBpZiAoaXNGdW5jdGlvbih0aGVuKSkge1xuICAgICAgICB0aGVuLmNhbGwodmFsdWUsIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgIGlmIChyZXNvbHZlZCkgeyByZXR1cm4gdHJ1ZTsgfVxuICAgICAgICAgIHJlc29sdmVkID0gdHJ1ZTtcblxuICAgICAgICAgIGlmICh2YWx1ZSAhPT0gdmFsKSB7XG4gICAgICAgICAgICByZXNvbHZlKHByb21pc2UsIHZhbCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgIGlmIChyZXNvbHZlZCkgeyByZXR1cm4gdHJ1ZTsgfVxuICAgICAgICAgIHJlc29sdmVkID0gdHJ1ZTtcblxuICAgICAgICAgIHJlamVjdChwcm9taXNlLCB2YWwpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaWYgKHJlc29sdmVkKSB7IHJldHVybiB0cnVlOyB9XG4gICAgcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSkge1xuICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICBmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgfSBlbHNlIGlmICghaGFuZGxlVGhlbmFibGUocHJvbWlzZSwgdmFsdWUpKSB7XG4gICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZnVsZmlsbChwcm9taXNlLCB2YWx1ZSkge1xuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHsgcmV0dXJuOyB9XG4gIHByb21pc2UuX3N0YXRlID0gU0VBTEVEO1xuICBwcm9taXNlLl9kZXRhaWwgPSB2YWx1ZTtcblxuICBjb25maWcuYXN5bmMocHVibGlzaEZ1bGZpbGxtZW50LCBwcm9taXNlKTtcbn1cblxuZnVuY3Rpb24gcmVqZWN0KHByb21pc2UsIHJlYXNvbikge1xuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHsgcmV0dXJuOyB9XG4gIHByb21pc2UuX3N0YXRlID0gU0VBTEVEO1xuICBwcm9taXNlLl9kZXRhaWwgPSByZWFzb247XG5cbiAgY29uZmlnLmFzeW5jKHB1Ymxpc2hSZWplY3Rpb24sIHByb21pc2UpO1xufVxuXG5mdW5jdGlvbiBwdWJsaXNoRnVsZmlsbG1lbnQocHJvbWlzZSkge1xuICBwdWJsaXNoKHByb21pc2UsIHByb21pc2UuX3N0YXRlID0gRlVMRklMTEVEKTtcbn1cblxuZnVuY3Rpb24gcHVibGlzaFJlamVjdGlvbihwcm9taXNlKSB7XG4gIHB1Ymxpc2gocHJvbWlzZSwgcHJvbWlzZS5fc3RhdGUgPSBSRUpFQ1RFRCk7XG59XG5cbmV4cG9ydHMuUHJvbWlzZSA9IFByb21pc2U7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKiBnbG9iYWwgdG9TdHJpbmcgKi9cbnZhciBpc0FycmF5ID0gcmVxdWlyZShcIi4vdXRpbHNcIikuaXNBcnJheTtcblxuLyoqXG4gIGBSU1ZQLnJhY2VgIGFsbG93cyB5b3UgdG8gd2F0Y2ggYSBzZXJpZXMgb2YgcHJvbWlzZXMgYW5kIGFjdCBhcyBzb29uIGFzIHRoZVxuICBmaXJzdCBwcm9taXNlIGdpdmVuIHRvIHRoZSBgcHJvbWlzZXNgIGFyZ3VtZW50IGZ1bGZpbGxzIG9yIHJlamVjdHMuXG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlMSA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKFwicHJvbWlzZSAxXCIpO1xuICAgIH0sIDIwMCk7XG4gIH0pO1xuXG4gIHZhciBwcm9taXNlMiA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKFwicHJvbWlzZSAyXCIpO1xuICAgIH0sIDEwMCk7XG4gIH0pO1xuXG4gIFJTVlAucmFjZShbcHJvbWlzZTEsIHByb21pc2UyXSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgIC8vIHJlc3VsdCA9PT0gXCJwcm9taXNlIDJcIiBiZWNhdXNlIGl0IHdhcyByZXNvbHZlZCBiZWZvcmUgcHJvbWlzZTFcbiAgICAvLyB3YXMgcmVzb2x2ZWQuXG4gIH0pO1xuICBgYGBcblxuICBgUlNWUC5yYWNlYCBpcyBkZXRlcm1pbmlzdGljIGluIHRoYXQgb25seSB0aGUgc3RhdGUgb2YgdGhlIGZpcnN0IGNvbXBsZXRlZFxuICBwcm9taXNlIG1hdHRlcnMuIEZvciBleGFtcGxlLCBldmVuIGlmIG90aGVyIHByb21pc2VzIGdpdmVuIHRvIHRoZSBgcHJvbWlzZXNgXG4gIGFycmF5IGFyZ3VtZW50IGFyZSByZXNvbHZlZCwgYnV0IHRoZSBmaXJzdCBjb21wbGV0ZWQgcHJvbWlzZSBoYXMgYmVjb21lXG4gIHJlamVjdGVkIGJlZm9yZSB0aGUgb3RoZXIgcHJvbWlzZXMgYmVjYW1lIGZ1bGZpbGxlZCwgdGhlIHJldHVybmVkIHByb21pc2VcbiAgd2lsbCBiZWNvbWUgcmVqZWN0ZWQ6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZTEgPSBuZXcgUlNWUC5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVzb2x2ZShcInByb21pc2UgMVwiKTtcbiAgICB9LCAyMDApO1xuICB9KTtcblxuICB2YXIgcHJvbWlzZTIgPSBuZXcgUlNWUC5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVqZWN0KG5ldyBFcnJvcihcInByb21pc2UgMlwiKSk7XG4gICAgfSwgMTAwKTtcbiAgfSk7XG5cbiAgUlNWUC5yYWNlKFtwcm9taXNlMSwgcHJvbWlzZTJdKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgLy8gQ29kZSBoZXJlIG5ldmVyIHJ1bnMgYmVjYXVzZSB0aGVyZSBhcmUgcmVqZWN0ZWQgcHJvbWlzZXMhXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09IFwicHJvbWlzZTJcIiBiZWNhdXNlIHByb21pc2UgMiBiZWNhbWUgcmVqZWN0ZWQgYmVmb3JlXG4gICAgLy8gcHJvbWlzZSAxIGJlY2FtZSBmdWxmaWxsZWRcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgcmFjZVxuICBAZm9yIFJTVlBcbiAgQHBhcmFtIHtBcnJheX0gcHJvbWlzZXMgYXJyYXkgb2YgcHJvbWlzZXMgdG8gb2JzZXJ2ZVxuICBAcGFyYW0ge1N0cmluZ30gbGFiZWwgb3B0aW9uYWwgc3RyaW5nIGZvciBkZXNjcmliaW5nIHRoZSBwcm9taXNlIHJldHVybmVkLlxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSB0aGF0IGJlY29tZXMgZnVsZmlsbGVkIHdpdGggdGhlIHZhbHVlIHRoZSBmaXJzdFxuICBjb21wbGV0ZWQgcHJvbWlzZXMgaXMgcmVzb2x2ZWQgd2l0aCBpZiB0aGUgZmlyc3QgY29tcGxldGVkIHByb21pc2Ugd2FzXG4gIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQgd2l0aCB0aGUgcmVhc29uIHRoYXQgdGhlIGZpcnN0IGNvbXBsZXRlZCBwcm9taXNlXG4gIHdhcyByZWplY3RlZCB3aXRoLlxuKi9cbmZ1bmN0aW9uIHJhY2UocHJvbWlzZXMpIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgdmFyIFByb21pc2UgPSB0aGlzO1xuXG4gIGlmICghaXNBcnJheShwcm9taXNlcykpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGFuIGFycmF5IHRvIHJhY2UuJyk7XG4gIH1cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHZhciByZXN1bHRzID0gW10sIHByb21pc2U7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByb21pc2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBwcm9taXNlID0gcHJvbWlzZXNbaV07XG5cbiAgICAgIGlmIChwcm9taXNlICYmIHR5cGVvZiBwcm9taXNlLnRoZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcHJvbWlzZS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNvbHZlKHByb21pc2UpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydHMucmFjZSA9IHJhY2U7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKipcbiAgYFJTVlAucmVqZWN0YCByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIHJlamVjdGVkIHdpdGggdGhlIHBhc3NlZFxuICBgcmVhc29uYC4gYFJTVlAucmVqZWN0YCBpcyBlc3NlbnRpYWxseSBzaG9ydGhhbmQgZm9yIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZSA9IG5ldyBSU1ZQLlByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICByZWplY3QobmV3IEVycm9yKCdXSE9PUFMnKSk7XG4gIH0pO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gQ29kZSBoZXJlIGRvZXNuJ3QgcnVuIGJlY2F1c2UgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQhXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdXSE9PUFMnXG4gIH0pO1xuICBgYGBcblxuICBJbnN0ZWFkIG9mIHdyaXRpbmcgdGhlIGFib3ZlLCB5b3VyIGNvZGUgbm93IHNpbXBseSBiZWNvbWVzIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZSA9IFJTVlAucmVqZWN0KG5ldyBFcnJvcignV0hPT1BTJykpO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gQ29kZSBoZXJlIGRvZXNuJ3QgcnVuIGJlY2F1c2UgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQhXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdXSE9PUFMnXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIHJlamVjdFxuICBAZm9yIFJTVlBcbiAgQHBhcmFtIHtBbnl9IHJlYXNvbiB2YWx1ZSB0aGF0IHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQgd2l0aC5cbiAgQHBhcmFtIHtTdHJpbmd9IGxhYmVsIG9wdGlvbmFsIHN0cmluZyBmb3IgaWRlbnRpZnlpbmcgdGhlIHJldHVybmVkIHByb21pc2UuXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHRoYXQgd2lsbCBiZWNvbWUgcmVqZWN0ZWQgd2l0aCB0aGUgZ2l2ZW5cbiAgYHJlYXNvbmAuXG4qL1xuZnVuY3Rpb24gcmVqZWN0KHJlYXNvbikge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgUHJvbWlzZSA9IHRoaXM7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICByZWplY3QocmVhc29uKTtcbiAgfSk7XG59XG5cbmV4cG9ydHMucmVqZWN0ID0gcmVqZWN0OyIsIlwidXNlIHN0cmljdFwiO1xuZnVuY3Rpb24gcmVzb2x2ZSh2YWx1ZSkge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZS5jb25zdHJ1Y3RvciA9PT0gdGhpcykge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG4gIHZhciBQcm9taXNlID0gdGhpcztcblxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSkge1xuICAgIHJlc29sdmUodmFsdWUpO1xuICB9KTtcbn1cblxuZXhwb3J0cy5yZXNvbHZlID0gcmVzb2x2ZTsiLCJcInVzZSBzdHJpY3RcIjtcbmZ1bmN0aW9uIG9iamVjdE9yRnVuY3Rpb24oeCkge1xuICByZXR1cm4gaXNGdW5jdGlvbih4KSB8fCAodHlwZW9mIHggPT09IFwib2JqZWN0XCIgJiYgeCAhPT0gbnVsbCk7XG59XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oeCkge1xuICByZXR1cm4gdHlwZW9mIHggPT09IFwiZnVuY3Rpb25cIjtcbn1cblxuZnVuY3Rpb24gaXNBcnJheSh4KSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeCkgPT09IFwiW29iamVjdCBBcnJheV1cIjtcbn1cblxuLy8gRGF0ZS5ub3cgaXMgbm90IGF2YWlsYWJsZSBpbiBicm93c2VycyA8IElFOVxuLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvRGF0ZS9ub3cjQ29tcGF0aWJpbGl0eVxudmFyIG5vdyA9IERhdGUubm93IHx8IGZ1bmN0aW9uKCkgeyByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7IH07XG5cblxuZXhwb3J0cy5vYmplY3RPckZ1bmN0aW9uID0gb2JqZWN0T3JGdW5jdGlvbjtcbmV4cG9ydHMuaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuZXhwb3J0cy5ub3cgPSBub3c7IiwiKGZ1bmN0aW9uIChEZUxvcmVhbikge1xuICAndXNlIHN0cmljdCc7XG5cbiAgLy8gVGhlcmUgYXJlIHR3byBtYWluIGNvbmNlcHRzIGluIEZsdXggc3RydWN0dXJlOiAqKkRpc3BhdGNoZXJzKiogYW5kICoqU3RvcmVzKiouXG4gIC8vIEFjdGlvbiBDcmVhdG9ycyBhcmUgc2ltcGx5IGhlbHBlcnMgYnV0IGRvZXNuJ3QgcmVxdWlyZSBhbnkgZnJhbWV3b3JrIGxldmVsXG4gIC8vIGFic3RyYWN0aW9uLlxuXG4gIHZhciBEaXNwYXRjaGVyLCBTdG9yZTtcblxuICAvLyAjIyBQcml2YXRlIEhlbHBlciBGdW5jdGlvbnNcblxuICAvLyBIZWxwZXIgZnVuY3Rpb25zIGFyZSBwcml2YXRlIGZ1bmN0aW9ucyB0byBiZSB1c2VkIGluIGNvZGViYXNlLlxuICAvLyBJdCdzIGJldHRlciB1c2luZyB0d28gdW5kZXJzY29yZSBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBmdW5jdGlvbi5cblxuICAvKiBgX19oYXNPd25gIGZ1bmN0aW9uIGlzIGEgc2hvcnRjdXQgZm9yIGBPYmplY3QjaGFzT3duUHJvcGVydHlgICovXG4gIGZ1bmN0aW9uIF9faGFzT3duKG9iamVjdCwgcHJvcCkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBwcm9wKTtcbiAgfVxuXG4gIC8vIFVzZSBgX19nZW5lcmF0ZUFjdGlvbk5hbWVgIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIGFjdGlvbiBuYW1lcy5cbiAgLy8gRS5nLiBJZiB5b3UgY3JlYXRlIGFuIGFjdGlvbiB3aXRoIG5hbWUgYGhlbGxvYCBpdCB3aWxsIGJlXG4gIC8vIGBhY3Rpb246aGVsbG9gIGZvciB0aGUgRmx1eC5cbiAgZnVuY3Rpb24gX19nZW5lcmF0ZUFjdGlvbk5hbWUobmFtZSkge1xuICAgIHJldHVybiAnYWN0aW9uOicgKyBuYW1lO1xuICB9XG5cbiAgLyogSXQncyB1c2VkIGJ5IHRoZSBzY2hlbWVzIHRvIHNhdmUgdGhlIG9yaWdpbmFsIHZlcnNpb24gKG5vdCBjYWxjdWxhdGVkKVxuICAgICBvZiB0aGUgZGF0YS4gKi9cbiAgZnVuY3Rpb24gX19nZW5lcmF0ZU9yaWdpbmFsTmFtZShuYW1lKSB7XG4gICAgcmV0dXJuICdvcmlnaW5hbDonICsgbmFtZTtcbiAgfVxuXG4gIC8vIGBfX2ZpbmREaXNwYXRjaGVyYCBpcyBhIHByaXZhdGUgZnVuY3Rpb24gZm9yICoqUmVhY3QgY29tcG9uZW50cyoqLlxuICBmdW5jdGlvbiBfX2ZpbmREaXNwYXRjaGVyKHZpZXcpIHtcbiAgICAgLy8gUHJvdmlkZSBhIHVzZWZ1bCBlcnJvciBtZXNzYWdlIGlmIG5vIGRpc3BhdGNoZXIgaXMgZm91bmQgaW4gdGhlIGNoYWluXG4gICAgaWYgKHZpZXcgPT0gbnVsbCkge1xuICAgICAgdGhyb3cgJ05vIGRpc3BhdGNoZXIgZm91bmQuIFRoZSBEZUxvcmVhbkpTIG1peGluIHJlcXVpcmVzIGEgXCJkaXNwYXRjaGVyXCIgcHJvcGVydHkgdG8gYmUgcGFzc2VkIHRvIGEgY29tcG9uZW50LCBvciBvbmUgb2YgaXRcXCdzIGFuY2VzdG9ycy4nO1xuICAgIH1cbiAgICAvKiBgdmlld2Agc2hvdWxkIGJlIGEgY29tcG9uZW50IGluc3RhbmNlLiBJZiBhIGNvbXBvbmVudCBkb24ndCBoYXZlXG4gICAgICAgIGFueSBkaXNwYXRjaGVyLCBpdCB0cmllcyB0byBmaW5kIGEgZGlzcGF0Y2hlciBmcm9tIHRoZSBwYXJlbnRzLiAqL1xuICAgIGlmICghdmlldy5wcm9wcy5kaXNwYXRjaGVyKSB7XG4gICAgICByZXR1cm4gX19maW5kRGlzcGF0Y2hlcih2aWV3Ll9vd25lcik7XG4gICAgfVxuICAgIHJldHVybiB2aWV3LnByb3BzLmRpc3BhdGNoZXI7XG4gIH1cblxuICAvLyBgX19jbG9uZWAgY3JlYXRlcyBhIGRlZXAgY29weSBvZiBhbiBvYmplY3QuXG4gIGZ1bmN0aW9uIF9fY2xvbmUob2JqKSB7XG4gICAgaWYgKG9iaiA9PT0gbnVsbCB8fCB0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JykgeyByZXR1cm4gb2JqOyB9XG4gICAgdmFyIGNvcHkgPSBvYmouY29uc3RydWN0b3IoKTtcbiAgICBmb3IgKHZhciBhdHRyIGluIG9iaikge1xuICAgICAgaWYgKF9faGFzT3duKG9iaiwgYXR0cikpIHtcbiAgICAgICAgY29weVthdHRyXSA9IF9fY2xvbmUob2JqW2F0dHJdKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNvcHk7XG4gIH1cblxuICAvLyBgX19leHRlbmRgIGFkZHMgcHJvcHMgdG8gb2JqXG4gIGZ1bmN0aW9uIF9fZXh0ZW5kKG9iaiwgcHJvcHMpIHtcbiAgICBwcm9wcyA9IF9fY2xvbmUocHJvcHMpO1xuICAgIGZvciAodmFyIHByb3AgaW4gcHJvcHMpIHtcbiAgICAgIGlmIChwcm9wcy5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICBvYmpbcHJvcF0gPSBwcm9wc1twcm9wXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIC8vICMjIERpc3BhdGNoZXJcblxuICAvLyBUaGUgZGlzcGF0Y2hlciBpcyAqKnRoZSBjZW50cmFsIGh1YioqIHRoYXQgKiptYW5hZ2VzIGFsbCBkYXRhIGZsb3cqKiBpblxuICAvLyBhIEZsdXggYXBwbGljYXRpb24uIEl0IGlzIGVzc2VudGlhbGx5IGEgX3JlZ2lzdHJ5IG9mIGNhbGxiYWNrcyBpbnRvIHRoZVxuICAvLyBzdG9yZXNfLiBFYWNoIHN0b3JlIHJlZ2lzdGVycyBpdHNlbGYgYW5kIHByb3ZpZGVzIGEgY2FsbGJhY2suIFdoZW4gdGhlXG4gIC8vIGRpc3BhdGNoZXIgcmVzcG9uZHMgdG8gYW4gYWN0aW9uLCBhbGwgc3RvcmVzIGluIHRoZSBhcHBsaWNhdGlvbiBhcmUgc2VudFxuICAvLyB0aGUgZGF0YSBwYXlsb2FkIHByb3ZpZGVkIGJ5IHRoZSBhY3Rpb24gdmlhIHRoZSBjYWxsYmFja3MgaW4gdGhlIHJlZ2lzdHJ5LlxuICBEaXNwYXRjaGVyID0gKGZ1bmN0aW9uICgpIHtcblxuICAgIC8vICMjIyBEaXNwYXRjaGVyIEhlbHBlcnNcblxuICAgIC8vIFJvbGxiYWNrIGxpc3RlbmVyIGFkZHMgYSBgcm9sbGJhY2tgIGV2ZW50IGxpc3RlbmVyIHRvIHRoZSBidW5jaCBvZlxuICAgIC8vIHN0b3Jlcy5cbiAgICBmdW5jdGlvbiBfX3JvbGxiYWNrTGlzdGVuZXIoc3RvcmVzKSB7XG5cbiAgICAgIGZ1bmN0aW9uIF9fbGlzdGVuZXIoKSB7XG4gICAgICAgIGZvciAodmFyIGkgaW4gc3RvcmVzKSB7XG4gICAgICAgICAgc3RvcmVzW2ldLmxpc3RlbmVyLmVtaXQoJ19fcm9sbGJhY2snKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvKiBJZiBhbnkgb2YgdGhlbSBmaXJlcyBgcm9sbGJhY2tgIGV2ZW50LCBhbGwgb2YgdGhlIHN0b3Jlc1xuICAgICAgICAgd2lsbCBiZSBlbWl0dGVkIHRvIGJlIHJvbGxlZCBiYWNrIHdpdGggYF9fcm9sbGJhY2tgIGV2ZW50LiAqL1xuICAgICAgZm9yICh2YXIgaiBpbiBzdG9yZXMpIHtcbiAgICAgICAgc3RvcmVzW2pdLmxpc3RlbmVyLm9uKCdyb2xsYmFjaycsIF9fbGlzdGVuZXIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vICMjIyBEaXNwYXRjaGVyIFByb3RvdHlwZVxuICAgIGZ1bmN0aW9uIERpc3BhdGNoZXIoc3RvcmVzKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAvLyBgRGVMb3JlYW4uRXZlbnRFbWl0dGVyYCBpcyBgcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyYCBieSBkZWZhdWx0LlxuICAgICAgLy8geW91IGNhbiBjaGFuZ2UgaXQgdXNpbmcgYERlTG9yZWFuLkZsdXguZGVmaW5lKCdFdmVudEVtaXR0ZXInLCBBbm90aGVyRXZlbnRFbWl0dGVyKWBcbiAgICAgIHRoaXMubGlzdGVuZXIgPSBuZXcgRGVMb3JlYW4uRXZlbnRFbWl0dGVyKCk7XG4gICAgICB0aGlzLnN0b3JlcyA9IHN0b3JlcztcblxuICAgICAgLyogU3RvcmVzIHNob3VsZCBiZSBsaXN0ZW5lZCBmb3Igcm9sbGJhY2sgZXZlbnRzLiAqL1xuICAgICAgX19yb2xsYmFja0xpc3RlbmVyKE9iamVjdC5rZXlzKHN0b3JlcykubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgcmV0dXJuIHN0b3Jlc1trZXldO1xuICAgICAgfSkpO1xuICAgIH1cblxuICAgIC8vIGBkaXNwYXRjaGAgbWV0aG9kIGRpc3BhdGNoIHRoZSBldmVudCB3aXRoIGBkYXRhYCAob3IgKipwYXlsb2FkKiopXG4gICAgRGlzcGF0Y2hlci5wcm90b3R5cGUuZGlzcGF0Y2ggPSBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXMsIHN0b3JlcywgZGVmZXJyZWQsIGFyZ3M7XG4gICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgIFxuICAgICAgdGhpcy5saXN0ZW5lci5lbWl0LmFwcGx5KHRoaXMubGlzdGVuZXIsIFsnZGlzcGF0Y2gnXS5jb25jYXQoYXJncykpO1xuICAgICAgXG4gICAgICAvKiBTdG9yZXMgYXJlIGtleS12YWx1ZSBwYWlycy4gQ29sbGVjdCBzdG9yZSBpbnN0YW5jZXMgaW50byBhbiBhcnJheS4gKi9cbiAgICAgIHN0b3JlcyA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzdG9yZXMgPSBbXSwgc3RvcmU7XG4gICAgICAgIGZvciAodmFyIHN0b3JlTmFtZSBpbiBzZWxmLnN0b3Jlcykge1xuICAgICAgICAgIHN0b3JlID0gc2VsZi5zdG9yZXNbc3RvcmVOYW1lXTtcbiAgICAgICAgICAvKiBTdG9yZSB2YWx1ZSBtdXN0IGJlIGFuIF9pbnN0YW5jZSBvZiBTdG9yZV8uICovXG4gICAgICAgICAgaWYgKCFzdG9yZSBpbnN0YW5jZW9mIFN0b3JlKSB7XG4gICAgICAgICAgICB0aHJvdyAnR2l2ZW4gc3RvcmUgaXMgbm90IGEgc3RvcmUgaW5zdGFuY2UnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzdG9yZXMucHVzaChzdG9yZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN0b3JlcztcbiAgICAgIH0oKSk7XG5cbiAgICAgIC8vIFN0b3JlIGluc3RhbmNlcyBzaG91bGQgd2FpdCBmb3IgZmluaXNoLiBTbyB5b3UgY2FuIGtub3cgaWYgYWxsIHRoZVxuICAgICAgLy8gc3RvcmVzIGFyZSBkaXNwYXRjaGVkIHByb3Blcmx5LlxuICAgICAgZGVmZXJyZWQgPSB0aGlzLndhaXRGb3Ioc3RvcmVzLCBhcmdzWzBdKTtcblxuICAgICAgLyogUGF5bG9hZCBzaG91bGQgc2VuZCB0byBhbGwgcmVsYXRlZCBzdG9yZXMuICovXG4gICAgICBmb3IgKHZhciBzdG9yZU5hbWUgaW4gc2VsZi5zdG9yZXMpIHtcbiAgICAgICAgc2VsZi5zdG9yZXNbc3RvcmVOYW1lXS5kaXNwYXRjaEFjdGlvbi5hcHBseShzZWxmLnN0b3Jlc1tzdG9yZU5hbWVdLCBhcmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gYGRpc3BhdGNoYCByZXR1cm5zIGRlZmVycmVkIG9iamVjdCB5b3UgY2FuIGp1c3QgdXNlICoqcHJvbWlzZSoqXG4gICAgICAvLyBmb3IgZGlzcGF0Y2hpbmc6IGBkaXNwYXRjaCguLikudGhlbiguLilgLlxuICAgICAgcmV0dXJuIGRlZmVycmVkO1xuICAgIH07XG5cbiAgICAvLyBgd2FpdEZvcmAgaXMgYWN0dWFsbHkgYSBfc2VtaS1wcml2YXRlXyBtZXRob2QuIEJlY2F1c2UgaXQncyBraW5kIG9mIGludGVybmFsXG4gICAgLy8gYW5kIHlvdSBkb24ndCBuZWVkIHRvIGNhbGwgaXQgZnJvbSBvdXRzaWRlIG1vc3Qgb2YgdGhlIHRpbWVzLiBJdCB0YWtlc1xuICAgIC8vIGFycmF5IG9mIHN0b3JlIGluc3RhbmNlcyAoYFtTdG9yZSwgU3RvcmUsIFN0b3JlLCAuLi5dYCkuIEl0IHdpbGwgY3JlYXRlXG4gICAgLy8gYSBwcm9taXNlIGFuZCByZXR1cm4gaXQuIF9XaGVuZXZlciBzdG9yZSBjaGFuZ2VzLCBpdCByZXNvbHZlcyB0aGUgcHJvbWlzZV8uXG4gICAgRGlzcGF0Y2hlci5wcm90b3R5cGUud2FpdEZvciA9IGZ1bmN0aW9uIChzdG9yZXMsIGFjdGlvbk5hbWUpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcywgcHJvbWlzZXM7XG4gICAgICBwcm9taXNlcyA9IChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBfX3Byb21pc2VzID0gW10sIHByb21pc2U7XG5cbiAgICAgICAgLyogYF9fcHJvbWlzZUdlbmVyYXRvcmAgZ2VuZXJhdGVzIGEgc2ltcGxlIHByb21pc2UgdGhhdCByZXNvbHZlcyBpdHNlbGYgd2hlblxuICAgICAgICAgICAgcmVsYXRlZCBzdG9yZSBpcyBjaGFuZ2VkLiAqL1xuICAgICAgICBmdW5jdGlvbiBfX3Byb21pc2VHZW5lcmF0b3Ioc3RvcmUpIHtcbiAgICAgICAgICAvLyBgRGVMb3JlYW4uUHJvbWlzZWAgaXMgYHJlcXVpcmUoJ2VzNi1wcm9taXNlJykuUHJvbWlzZWAgYnkgZGVmYXVsdC5cbiAgICAgICAgICAvLyB5b3UgY2FuIGNoYW5nZSBpdCB1c2luZyBgRGVMb3JlYW4uRmx1eC5kZWZpbmUoJ1Byb21pc2UnLCBBbm90aGVyUHJvbWlzZSlgXG4gICAgICAgICAgcmV0dXJuIG5ldyBEZUxvcmVhbi5Qcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHN0b3JlLmxpc3RlbmVyLm9uY2UoJ2NoYW5nZScsIHJlc29sdmUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgaSBpbiBzdG9yZXMpIHtcbiAgICAgICAgICAvLyBPbmx5IGdlbmVyYXRlIHByb21pc2VzIGZvciBzdG9yZXMgdGhhdCBhZSBsaXN0ZW5pbmcgZm9yIHRoaXMgYWN0aW9uXG4gICAgICAgICAgaWYgKHN0b3Jlc1tpXS5hY3Rpb25zICYmIHN0b3Jlc1tpXS5hY3Rpb25zW2FjdGlvbk5hbWVdICE9IG51bGwpIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBfX3Byb21pc2VHZW5lcmF0b3Ioc3RvcmVzW2ldKTtcbiAgICAgICAgICAgIF9fcHJvbWlzZXMucHVzaChwcm9taXNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9fcHJvbWlzZXM7XG4gICAgICB9KCkpO1xuICAgICAgLy8gV2hlbiBhbGwgdGhlIHByb21pc2VzIGFyZSByZXNvbHZlZCwgZGlzcGF0Y2hlciBlbWl0cyBgY2hhbmdlOmFsbGAgZXZlbnQuXG4gICAgICByZXR1cm4gRGVMb3JlYW4uUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmxpc3RlbmVyLmVtaXQoJ2NoYW5nZTphbGwnKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBgcmVnaXN0ZXJBY3Rpb25gIG1ldGhvZCBhZGRzIGEgbWV0aG9kIHRvIHRoZSBwcm90b3R5cGUuIFNvIHlvdSBjYW4ganVzdCB1c2VcbiAgICAvLyBgZGlzcGF0Y2hlckluc3RhbmNlLmFjdGlvbk5hbWUoKWAuXG4gICAgRGlzcGF0Y2hlci5wcm90b3R5cGUucmVnaXN0ZXJBY3Rpb24gPSBmdW5jdGlvbiAoYWN0aW9uLCBjYWxsYmFjaykge1xuICAgICAgLyogVGhlIGNhbGxiYWNrIG11c3QgYmUgYSBmdW5jdGlvbi4gKi9cbiAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhpc1thY3Rpb25dID0gY2FsbGJhY2suYmluZCh0aGlzLnN0b3Jlcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyAnQWN0aW9uIGNhbGxiYWNrIHNob3VsZCBiZSBhIGZ1bmN0aW9uLic7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIGByZWdpc3RlcmAgbWV0aG9kIGFkZHMgYW4gZ2xvYmFsIGFjdGlvbiBjYWxsYmFjayB0byB0aGUgZGlzcGF0Y2hlci5cbiAgICBEaXNwYXRjaGVyLnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgLyogVGhlIGNhbGxiYWNrIG11c3QgYmUgYSBmdW5jdGlvbi4gKi9cbiAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhpcy5saXN0ZW5lci5vbignZGlzcGF0Y2gnLCBjYWxsYmFjayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyAnR2xvYmFsIGNhbGxiYWNrIHNob3VsZCBiZSBhIGZ1bmN0aW9uLic7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIGBnZXRTdG9yZWAgcmV0dXJucyB0aGUgc3RvcmUgZnJvbSBzdG9yZXMgaGFzaC5cbiAgICAvLyBZb3UgY2FuIGFsc28gdXNlIGBkaXNwYXRjaGVySW5zdGFuY2Uuc3RvcmVzW3N0b3JlTmFtZV1gIGJ1dFxuICAgIC8vIGl0IGNoZWNrcyBpZiB0aGUgc3RvcmUgcmVhbGx5IGV4aXN0cy5cbiAgICBEaXNwYXRjaGVyLnByb3RvdHlwZS5nZXRTdG9yZSA9IGZ1bmN0aW9uIChzdG9yZU5hbWUpIHtcbiAgICAgIGlmICghdGhpcy5zdG9yZXNbc3RvcmVOYW1lXSkge1xuICAgICAgICB0aHJvdyAnU3RvcmUgJyArIHN0b3JlTmFtZSArICcgZG9lcyBub3QgZXhpc3QuJztcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnN0b3Jlc1tzdG9yZU5hbWVdLmdldFN0YXRlKCk7XG4gICAgfTtcblxuICAgIC8vICMjIyBTaG9ydGN1dHNcblxuICAgIERpc3BhdGNoZXIucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHRoaXMubGlzdGVuZXIub24uYXBwbHkodGhpcy5saXN0ZW5lciwgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgRGlzcGF0Y2hlci5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHRoaXMubGlzdGVuZXIucmVtb3ZlTGlzdGVuZXIuYXBwbHkodGhpcy5saXN0ZW5lciwgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgRGlzcGF0Y2hlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzLmxpc3RlbmVyLmVtaXQuYXBwbHkodGhpcy5saXN0ZW5lciwgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIERpc3BhdGNoZXI7XG4gIH0oKSk7XG5cbiAgLy8gIyMgU3RvcmVcblxuICAvLyBTdG9yZXMgY29udGFpbiB0aGUgYXBwbGljYXRpb24gc3RhdGUgYW5kIGxvZ2ljLiBUaGVpciByb2xlIGlzIHNvbWV3aGF0IHNpbWlsYXJcbiAgLy8gdG8gYSBtb2RlbCBpbiBhIHRyYWRpdGlvbmFsIE1WQywgYnV0IHRoZXkgbWFuYWdlIHRoZSBzdGF0ZSBvZiBtYW55IG9iamVjdHMuXG4gIC8vIFVubGlrZSBNVkMgbW9kZWxzLCB0aGV5IGFyZSBub3QgaW5zdGFuY2VzIG9mIG9uZSBvYmplY3QsIG5vciBhcmUgdGhleSB0aGVcbiAgLy8gc2FtZSBhcyBCYWNrYm9uZSdzIGNvbGxlY3Rpb25zLiBNb3JlIHRoYW4gc2ltcGx5IG1hbmFnaW5nIGEgY29sbGVjdGlvbiBvZlxuICAvLyBPUk0tc3R5bGUgb2JqZWN0cywgc3RvcmVzIG1hbmFnZSB0aGUgYXBwbGljYXRpb24gc3RhdGUgZm9yIGEgcGFydGljdWxhclxuICAvLyBkb21haW4gd2l0aGluIHRoZSBhcHBsaWNhdGlvbi5cbiAgU3RvcmUgPSAoZnVuY3Rpb24gKCkge1xuXG4gICAgLy8gIyMjIFN0b3JlIFByb3RvdHlwZVxuICAgIGZ1bmN0aW9uIFN0b3JlKGFyZ3MpIHtcbiAgICAgIGlmICghdGhpcy5zdGF0ZSkge1xuICAgICAgICB0aGlzLnN0YXRlID0ge307XG4gICAgICB9XG5cbiAgICAgIC8vIGBEZUxvcmVhbi5FdmVudEVtaXR0ZXJgIGlzIGByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXJgIGJ5IGRlZmF1bHQuXG4gICAgICAvLyB5b3UgY2FuIGNoYW5nZSBpdCB1c2luZyBgRGVMb3JlYW4uRmx1eC5kZWZpbmUoJ0V2ZW50RW1pdHRlcicsIEFub3RoZXJFdmVudEVtaXR0ZXIpYFxuICAgICAgdGhpcy5saXN0ZW5lciA9IG5ldyBEZUxvcmVhbi5FdmVudEVtaXR0ZXIoKTtcbiAgICAgIHRoaXMuYmluZEFjdGlvbnMoKTtcbiAgICAgIHRoaXMuYnVpbGRTY2hlbWUoKTtcblxuICAgICAgdGhpcy5pbml0aWFsaXplLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgU3RvcmUucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICB9O1xuXG4gICAgU3RvcmUucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChhcmcpIHtcbiAgICAgIHJldHVybiB0aGlzLnN0YXRlW2FyZ107XG4gICAgfTtcblxuICAgIC8vIGBzZXRgIG1ldGhvZCB1cGRhdGVzIHRoZSBkYXRhIGRlZmluZWQgYXQgdGhlIGBzY2hlbWVgIG9mIHRoZSBzdG9yZS5cbiAgICBTdG9yZS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKGFyZzEsIHZhbHVlKSB7XG4gICAgICB2YXIgY2hhbmdlZFByb3BzID0gW107XG4gICAgICBpZiAodHlwZW9mIGFyZzEgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGZvciAodmFyIGtleU5hbWUgaW4gYXJnMSkge1xuICAgICAgICAgIGNoYW5nZWRQcm9wcy5wdXNoKGtleU5hbWUpO1xuICAgICAgICAgIHRoaXMuc2V0VmFsdWUoa2V5TmFtZSwgYXJnMVtrZXlOYW1lXSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNoYW5nZWRQcm9wcy5wdXNoKGFyZzEpO1xuICAgICAgICB0aGlzLnNldFZhbHVlKGFyZzEsIHZhbHVlKTtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVjYWxjdWxhdGUoY2hhbmdlZFByb3BzKTtcbiAgICAgIHJldHVybiB0aGlzLnN0YXRlW2FyZzFdO1xuICAgIH07XG5cbiAgICAvLyBgc2V0YCBtZXRob2QgdXBkYXRlcyB0aGUgZGF0YSBkZWZpbmVkIGF0IHRoZSBgc2NoZW1lYCBvZiB0aGUgc3RvcmUuXG4gICAgU3RvcmUucHJvdG90eXBlLnNldFZhbHVlID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICAgIHZhciBzY2hlbWUgPSB0aGlzLnNjaGVtZSwgZGVmaW5pdGlvbjtcbiAgICAgIGlmIChzY2hlbWUgJiYgdGhpcy5zY2hlbWVba2V5XSkge1xuICAgICAgICBkZWZpbml0aW9uID0gc2NoZW1lW2tleV07XG5cbiAgICAgICAgLy8gVGhpcyB3aWxsIGFsbG93IHlvdSB0byBkaXJlY3RseSBzZXQgZmFsc3kgdmFsdWVzIGJlZm9yZSBmYWxsaW5nIGJhY2sgdG8gdGhlIGRlZmluaXRpb24gZGVmYXVsdFxuICAgICAgICB0aGlzLnN0YXRlW2tleV0gPSAodHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJykgPyB2YWx1ZSA6IGRlZmluaXRpb24uZGVmYXVsdDtcblxuICAgICAgICBpZiAodHlwZW9mIGRlZmluaXRpb24uY2FsY3VsYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhpcy5zdGF0ZVtfX2dlbmVyYXRlT3JpZ2luYWxOYW1lKGtleSldID0gdmFsdWU7XG4gICAgICAgICAgdGhpcy5zdGF0ZVtrZXldID0gZGVmaW5pdGlvbi5jYWxjdWxhdGUuY2FsbCh0aGlzLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFNjaGVtZSAqKm11c3QqKiBpbmNsdWRlIHRoZSBrZXkgeW91IHdhbnRlZCB0byBzZXQuXG4gICAgICAgIGlmIChjb25zb2xlICE9IG51bGwpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ1NjaGVtZSBtdXN0IGluY2x1ZGUgdGhlIGtleSwgJyArIGtleSArICcsIHlvdSBhcmUgdHJ5aW5nIHRvIHNldC4gJyArIGtleSArICcgd2lsbCBOT1QgYmUgc2V0IG9uIHRoZSBzdG9yZS4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuc3RhdGVba2V5XTtcbiAgICB9O1xuXG4gICAgLy8gUmVtb3ZlcyB0aGUgc2NoZW1lIGZvcm1hdCBhbmQgc3RhbmRhcmRpemVzIGFsbCB0aGUgc2hvcnRjdXRzLlxuICAgIC8vIElmIHlvdSBydW4gYGZvcm1hdFNjaGVtZSh7bmFtZTogJ2pvZSd9KWAgaXQgd2lsbCByZXR1cm4geW91XG4gICAgLy8gYHtuYW1lOiB7ZGVmYXVsdDogJ2pvZSd9fWAuIEFsc28gaWYgeW91IHJ1biBgZm9ybWF0U2NoZW1lKHtmdWxsbmFtZTogZnVuY3Rpb24gKCkge319KWBcbiAgICAvLyBpdCB3aWxsIHJldHVybiBge2Z1bGxuYW1lOiB7Y2FsY3VsYXRlOiBmdW5jdGlvbiAoKSB7fX19YC5cbiAgICBTdG9yZS5wcm90b3R5cGUuZm9ybWF0U2NoZW1lID0gZnVuY3Rpb24gKHNjaGVtZSkge1xuICAgICAgdmFyIGZvcm1hdHRlZFNjaGVtZSA9IHt9LCBkZWZpbml0aW9uLCBkZWZhdWx0VmFsdWUsIGNhbGN1bGF0ZWRWYWx1ZTtcbiAgICAgIGZvciAodmFyIGtleU5hbWUgaW4gc2NoZW1lKSB7XG4gICAgICAgIGRlZmluaXRpb24gPSBzY2hlbWVba2V5TmFtZV07XG4gICAgICAgIGRlZmF1bHRWYWx1ZSA9IG51bGw7XG4gICAgICAgIGNhbGN1bGF0ZWRWYWx1ZSA9IG51bGw7XG5cbiAgICAgICAgZm9ybWF0dGVkU2NoZW1lW2tleU5hbWVdID0ge2RlZmF1bHQ6IG51bGx9O1xuXG4gICAgICAgIC8qIHtrZXk6ICd2YWx1ZSd9IHdpbGwgYmUge2tleToge2RlZmF1bHQ6ICd2YWx1ZSd9fSAqL1xuICAgICAgICBkZWZhdWx0VmFsdWUgPSAoZGVmaW5pdGlvbiAmJiB0eXBlb2YgZGVmaW5pdGlvbiA9PT0gJ29iamVjdCcpID9cbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmluaXRpb24uZGVmYXVsdCA6IGRlZmluaXRpb247XG4gICAgICAgIGZvcm1hdHRlZFNjaGVtZVtrZXlOYW1lXS5kZWZhdWx0ID0gZGVmYXVsdFZhbHVlO1xuXG4gICAgICAgIC8qIHtrZXk6IGZ1bmN0aW9uICgpIHt9fSB3aWxsIGJlIHtrZXk6IHtjYWxjdWxhdGU6IGZ1bmN0aW9uICgpIHt9fX0gKi9cbiAgICAgICAgaWYgKGRlZmluaXRpb24gJiYgdHlwZW9mIGRlZmluaXRpb24uY2FsY3VsYXRlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgY2FsY3VsYXRlZFZhbHVlID0gZGVmaW5pdGlvbi5jYWxjdWxhdGU7XG4gICAgICAgICAgLyogUHV0IGEgZGVwZW5kZW5jeSBhcnJheSBvbiBmb3JtYXR0ZWRTY2hlbWVzIHdpdGggY2FsY3VsYXRlIGRlZmluZWQgKi9cbiAgICAgICAgICBpZiAoZGVmaW5pdGlvbi5kZXBzKSB7XG4gICAgICAgICAgICBmb3JtYXR0ZWRTY2hlbWVba2V5TmFtZV0uZGVwcyA9IGRlZmluaXRpb24uZGVwcztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9ybWF0dGVkU2NoZW1lW2tleU5hbWVdLmRlcHMgPSBbXTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZGVmaW5pdGlvbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGNhbGN1bGF0ZWRWYWx1ZSA9IGRlZmluaXRpb247XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNhbGN1bGF0ZWRWYWx1ZSkge1xuICAgICAgICAgIGZvcm1hdHRlZFNjaGVtZVtrZXlOYW1lXS5jYWxjdWxhdGUgPSBjYWxjdWxhdGVkVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBmb3JtYXR0ZWRTY2hlbWU7XG4gICAgfTtcblxuICAgIC8qIEFwcGx5aW5nIGBzY2hlbWVgIHRvIHRoZSBzdG9yZSBpZiBleGlzdHMuICovXG4gICAgU3RvcmUucHJvdG90eXBlLmJ1aWxkU2NoZW1lID0gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIHNjaGVtZSwgY2FsY3VsYXRlZERhdGEsIGtleU5hbWUsIGRlZmluaXRpb24sIGRlcGVuZGVuY3lNYXAsIGRlcGVuZGVudHMsIGRlcCwgY2hhbmdlZFByb3BzID0gW107XG5cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5zY2hlbWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIC8qIFNjaGVtZSBtdXN0IGJlIGZvcm1hdHRlZCB0byBzdGFuZGFyZGl6ZSB0aGUga2V5cy4gKi9cbiAgICAgICAgc2NoZW1lID0gdGhpcy5zY2hlbWUgPSB0aGlzLmZvcm1hdFNjaGVtZSh0aGlzLnNjaGVtZSk7XG4gICAgICAgIGRlcGVuZGVuY3lNYXAgPSB0aGlzLl9fZGVwZW5kZW5jeU1hcCA9IHt9O1xuXG4gICAgICAgIC8qIFNldCB0aGUgZGVmYXVsdHMgZmlyc3QgKi9cbiAgICAgICAgZm9yIChrZXlOYW1lIGluIHNjaGVtZSkge1xuICAgICAgICAgIGRlZmluaXRpb24gPSBzY2hlbWVba2V5TmFtZV07XG4gICAgICAgICAgdGhpcy5zdGF0ZVtrZXlOYW1lXSA9IF9fY2xvbmUoZGVmaW5pdGlvbi5kZWZhdWx0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qIFNldCB0aGUgY2FsY3VsYXRpb25zICovXG4gICAgICAgIGZvciAoa2V5TmFtZSBpbiBzY2hlbWUpIHtcbiAgICAgICAgICBkZWZpbml0aW9uID0gc2NoZW1lW2tleU5hbWVdO1xuICAgICAgICAgIGlmIChkZWZpbml0aW9uLmNhbGN1bGF0ZSkge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgZGVwZW5kZW5jeSBtYXAgLSB7a2V5TmFtZTogW2FycmF5T2ZLZXlzVGhhdERlcGVuZE9uSXRdfVxuICAgICAgICAgICAgZGVwZW5kZW50cyA9IGRlZmluaXRpb24uZGVwcyB8fCBbXTtcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkZXBlbmRlbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgIGRlcCA9IGRlcGVuZGVudHNbaV07XG4gICAgICAgICAgICAgIGlmIChkZXBlbmRlbmN5TWFwW2RlcF0gPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGRlcGVuZGVuY3lNYXBbZGVwXSA9IFtdO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRlcGVuZGVuY3lNYXBbZGVwXS5wdXNoKGtleU5hbWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnN0YXRlW19fZ2VuZXJhdGVPcmlnaW5hbE5hbWUoa2V5TmFtZSldID0gZGVmaW5pdGlvbi5kZWZhdWx0O1xuICAgICAgICAgICAgdGhpcy5zdGF0ZVtrZXlOYW1lXSA9IGRlZmluaXRpb24uY2FsY3VsYXRlLmNhbGwodGhpcywgZGVmaW5pdGlvbi5kZWZhdWx0KTtcbiAgICAgICAgICAgIGNoYW5nZWRQcm9wcy5wdXNoKGtleU5hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBSZWNhbGN1bGF0ZSBhbnkgcHJvcGVydGllcyBkZXBlbmRlbnQgb24gdGhvc2UgdGhhdCB3ZXJlIGp1c3Qgc2V0XG4gICAgICAgIHRoaXMucmVjYWxjdWxhdGUoY2hhbmdlZFByb3BzKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgU3RvcmUucHJvdG90eXBlLnJlY2FsY3VsYXRlID0gZnVuY3Rpb24gKGNoYW5nZWRQcm9wcykge1xuICAgICAgdmFyIHNjaGVtZSA9IHRoaXMuc2NoZW1lLCBkZXBlbmRlbmN5TWFwID0gdGhpcy5fX2RlcGVuZGVuY3lNYXAsIGRpZFJ1biA9IFtdLCBkZWZpbml0aW9uLCBrZXlOYW1lLCBkZXBlbmRlbnRzLCBkZXA7XG4gICAgICAvLyBPbmx5IGl0ZXJhdGUgb3ZlciB0aGUgcHJvcGVydGllcyB0aGF0IGp1c3QgY2hhbmdlZFxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VkUHJvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZGVwZW5kZW50cyA9IGRlcGVuZGVuY3lNYXBbY2hhbmdlZFByb3BzW2ldXTtcbiAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG5vIHByb3BlcnRpZXMgZGVwZW5kZW50IG9uIHRoaXMgcHJvcGVydHksIGRvIG5vdGhpbmdcbiAgICAgICAgaWYgKGRlcGVuZGVudHMgPT0gbnVsbCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIEl0ZXJhdGUgb3ZlciB0aGUgZGVwZW5kZW5kZW50IHByb3BlcnRpZXNcbiAgICAgICAgZm9yICh2YXIgZCA9IDA7IGQgPCBkZXBlbmRlbnRzLmxlbmd0aDsgZCsrKSB7XG4gICAgICAgICAgZGVwID0gZGVwZW5kZW50c1tkXTtcbiAgICAgICAgICAvLyBEbyBub3RoaW5nIGlmIHRoaXMgdmFsdWUgaGFzIGFscmVhZHkgYmVlbiByZWNhbGN1bGF0ZWQgb24gdGhpcyBjaGFuZ2UgYmF0Y2hcbiAgICAgICAgICBpZiAoZGlkUnVuLmluZGV4T2YoZGVwKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBDYWxjdWxhdGUgdGhpcyB2YWx1ZVxuICAgICAgICAgIGRlZmluaXRpb24gPSBzY2hlbWVbZGVwXTtcbiAgICAgICAgICB0aGlzLnN0YXRlW2RlcF0gPSBkZWZpbml0aW9uLmNhbGN1bGF0ZS5jYWxsKHRoaXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0ZVtfX2dlbmVyYXRlT3JpZ2luYWxOYW1lKGRlcCldIHx8IGRlZmluaXRpb24uZGVmYXVsdCk7XG5cbiAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhpcyBkb2VzIG5vdCBnZXQgY2FsY3VsYXRlZCBhZ2FpbiBpbiB0aGlzIGNoYW5nZSBiYXRjaFxuICAgICAgICAgIGRpZFJ1bi5wdXNoKGRlcCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIFVwZGF0ZSBBbnkgZGVwcyBvbiB0aGUgZGVwc1xuICAgICAgaWYgKGRpZFJ1bi5sZW5ndGggPiAwKSB7XG4gICAgICAgIHRoaXMucmVjYWxjdWxhdGUoZGlkUnVuKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubGlzdGVuZXIuZW1pdCgnY2hhbmdlJyk7XG4gICAgfTtcblxuICAgIFN0b3JlLnByb3RvdHlwZS5nZXRTdGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzLnN0YXRlO1xuICAgIH07XG5cbiAgICBTdG9yZS5wcm90b3R5cGUuY2xlYXJTdGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSB7fTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICBTdG9yZS5wcm90b3R5cGUucmVzZXRTdGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHRoaXMuYnVpbGRTY2hlbWUoKTtcbiAgICAgIHRoaXMubGlzdGVuZXIuZW1pdCgnY2hhbmdlJyk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgLy8gU3RvcmVzIG11c3QgaGF2ZSBhIGBhY3Rpb25zYCBoYXNoIG9mIGBhY3Rpb25OYW1lOiBtZXRob2ROYW1lYFxuICAgIC8vIGBtZXRob2ROYW1lYCBpcyB0aGUgYHRoaXMuc3RvcmVgJ3MgcHJvdG90eXBlIG1ldGhvZC4uXG4gICAgU3RvcmUucHJvdG90eXBlLmJpbmRBY3Rpb25zID0gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGNhbGxiYWNrO1xuXG4gICAgICB0aGlzLmVtaXRDaGFuZ2UgPSB0aGlzLmxpc3RlbmVyLmVtaXQuYmluZCh0aGlzLmxpc3RlbmVyLCAnY2hhbmdlJyk7XG4gICAgICB0aGlzLmVtaXRSb2xsYmFjayA9IHRoaXMubGlzdGVuZXIuZW1pdC5iaW5kKHRoaXMubGlzdGVuZXIsICdyb2xsYmFjaycpO1xuICAgICAgdGhpcy5yb2xsYmFjayA9IHRoaXMubGlzdGVuZXIub24uYmluZCh0aGlzLmxpc3RlbmVyLCAnX19yb2xsYmFjaycpO1xuICAgICAgdGhpcy5lbWl0ID0gdGhpcy5saXN0ZW5lci5lbWl0LmJpbmQodGhpcy5saXN0ZW5lcik7XG5cbiAgICAgIGZvciAodmFyIGFjdGlvbk5hbWUgaW4gdGhpcy5hY3Rpb25zKSB7XG4gICAgICAgIGlmIChfX2hhc093bih0aGlzLmFjdGlvbnMsIGFjdGlvbk5hbWUpKSB7XG4gICAgICAgICAgY2FsbGJhY2sgPSB0aGlzLmFjdGlvbnNbYWN0aW9uTmFtZV07XG4gICAgICAgICAgaWYgKHR5cGVvZiB0aGlzW2NhbGxiYWNrXSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhyb3cgJ0NhbGxiYWNrIFxcJycgKyBjYWxsYmFjayArICdcXCcgZGVmaW5lZCBmb3IgYWN0aW9uIFxcJycgKyBhY3Rpb25OYW1lICsgJ1xcJyBzaG91bGQgYmUgYSBtZXRob2QgZGVmaW5lZCBvbiB0aGUgc3RvcmUhJztcbiAgICAgICAgICB9XG4gICAgICAgICAgLyogQW5kIGBhY3Rpb25OYW1lYCBzaG91bGQgYmUgYSBuYW1lIGdlbmVyYXRlZCBieSBgX19nZW5lcmF0ZUFjdGlvbk5hbWVgICovXG4gICAgICAgICAgdGhpcy5saXN0ZW5lci5vbihfX2dlbmVyYXRlQWN0aW9uTmFtZShhY3Rpb25OYW1lKSwgdGhpc1tjYWxsYmFja10uYmluZCh0aGlzKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gYGRpc3BhdGNoQWN0aW9uYCBjYWxsZWQgZnJvbSBhIGRpc3BhdGNoZXIuIFlvdSBjYW4gYWxzbyBjYWxsIGFueXdoZXJlIGJ1dFxuICAgIC8vIHlvdSBwcm9iYWJseSB3b24ndCBuZWVkIHRvIGRvLiBJdCBzaW1wbHkgKiplbWl0cyBhbiBldmVudCB3aXRoIGEgcGF5bG9hZCoqLlxuICAgIFN0b3JlLnByb3RvdHlwZS5kaXNwYXRjaEFjdGlvbiA9IGZ1bmN0aW9uIChhY3Rpb25OYW1lLCBkYXRhKSB7XG4gICAgICB0aGlzLmxpc3RlbmVyLmVtaXQoX19nZW5lcmF0ZUFjdGlvbk5hbWUoYWN0aW9uTmFtZSksIGRhdGEpO1xuICAgIH07XG5cbiAgICAvLyAjIyMgU2hvcnRjdXRzXG5cbiAgICAvLyBgbGlzdGVuQ2hhbmdlc2AgaXMgYSBzaG9ydGN1dCBmb3IgYE9iamVjdC5vYnNlcnZlYCB1c2FnZS4gWW91IGNhbiBqdXN0IHVzZVxuICAgIC8vIGBPYmplY3Qub2JzZXJ2ZShvYmplY3QsIGZ1bmN0aW9uICgpIHsgLi4uIH0pYCBidXQgZXZlcnl0aW1lIHlvdSB1c2UgaXQgeW91XG4gICAgLy8gcmVwZWF0IHlvdXJzZWxmLiBEZUxvcmVhbiBoYXMgYSBzaG9ydGN1dCBkb2luZyB0aGlzIHByb3Blcmx5LlxuICAgIFN0b3JlLnByb3RvdHlwZS5saXN0ZW5DaGFuZ2VzID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLCBvYnNlcnZlcjtcbiAgICAgIGlmICghT2JqZWN0Lm9ic2VydmUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignU3RvcmUjbGlzdGVuQ2hhbmdlcyBtZXRob2QgdXNlcyBPYmplY3Qub2JzZXJ2ZSwgeW91IHNob3VsZCBmaXJlIGNoYW5nZXMgbWFudWFsbHkuJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgb2JzZXJ2ZXIgPSBBcnJheS5pc0FycmF5KG9iamVjdCkgPyBBcnJheS5vYnNlcnZlIDogT2JqZWN0Lm9ic2VydmU7XG5cbiAgICAgIG9ic2VydmVyKG9iamVjdCwgZnVuY3Rpb24gKGNoYW5nZXMpIHtcbiAgICAgICAgc2VsZi5saXN0ZW5lci5lbWl0KCdjaGFuZ2UnLCBjaGFuZ2VzKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBgb25DaGFuZ2VgIHNpbXBseSBsaXN0ZW5zIGNoYW5nZXMgYW5kIGNhbGxzIGEgY2FsbGJhY2suIFNob3J0Y3V0IGZvclxuICAgIC8vIGEgYG9uKCdjaGFuZ2UnKWAgY29tbWFuZC5cbiAgICBTdG9yZS5wcm90b3R5cGUub25DaGFuZ2UgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIHRoaXMubGlzdGVuZXIub24oJ2NoYW5nZScsIGNhbGxiYWNrKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIFN0b3JlO1xuICB9KCkpO1xuXG4gIC8vICMjIyBGbHV4IFdyYXBwZXJcbiAgRGVMb3JlYW4uRmx1eCA9IHtcblxuICAgIC8vIGBjcmVhdGVTdG9yZWAgZ2VuZXJhdGVzIGEgc3RvcmUgYmFzZWQgb24gdGhlIGRlZmluaXRpb25cbiAgICBjcmVhdGVTdG9yZTogZnVuY3Rpb24gKGRlZmluaXRpb24pIHtcbiAgICAgIC8qIHN0b3JlIHBhcmFtZXRlciBtdXN0IGJlIGFuIGBvYmplY3RgICovXG4gICAgICBpZiAodHlwZW9mIGRlZmluaXRpb24gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHRocm93ICdTdG9yZXMgc2hvdWxkIGJlIGRlZmluZWQgYnkgcGFzc2luZyB0aGUgZGVmaW5pdGlvbiB0byB0aGUgY29uc3RydWN0b3InO1xuICAgICAgfVxuXG4gICAgICAvLyBleHRlbmRzIHRoZSBzdG9yZSB3aXRoIHRoZSBkZWZpbml0aW9uIGF0dHJpYnV0ZXNcbiAgICAgIHZhciBDaGlsZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFN0b3JlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7IH07XG4gICAgICB2YXIgU3Vycm9nYXRlID0gZnVuY3Rpb24gKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gQ2hpbGQ7IH07XG4gICAgICBTdXJyb2dhdGUucHJvdG90eXBlID0gU3RvcmUucHJvdG90eXBlO1xuICAgICAgQ2hpbGQucHJvdG90eXBlID0gbmV3IFN1cnJvZ2F0ZSgpO1xuXG4gICAgICBfX2V4dGVuZChDaGlsZC5wcm90b3R5cGUsIGRlZmluaXRpb24pO1xuXG4gICAgICByZXR1cm4gbmV3IENoaWxkKCk7XG4gICAgfSxcblxuICAgIC8vIGBjcmVhdGVEaXNwYXRjaGVyYCBnZW5lcmF0ZXMgYSBkaXNwYXRjaGVyIHdpdGggYWN0aW9ucyB0byBkaXNwYXRjaC5cbiAgICAvKiBgYWN0aW9uc1RvRGlzcGF0Y2hgIHNob3VsZCBiZSBhbiBvYmplY3QuICovXG4gICAgY3JlYXRlRGlzcGF0Y2hlcjogZnVuY3Rpb24gKGFjdGlvbnNUb0Rpc3BhdGNoKSB7XG4gICAgICB2YXIgYWN0aW9uc09mU3RvcmVzLCBkaXNwYXRjaGVyLCBjYWxsYmFjaywgdHJpZ2dlcnMsIHRyaWdnZXJNZXRob2Q7XG5cbiAgICAgIC8vIElmIGl0IGhhcyBgZ2V0U3RvcmVzYCBtZXRob2QgaXQgc2hvdWxkIGJlIGdldCBhbmQgcGFzcyB0byB0aGUgYERpc3BhdGNoZXJgXG4gICAgICBpZiAodHlwZW9mIGFjdGlvbnNUb0Rpc3BhdGNoLmdldFN0b3JlcyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBhY3Rpb25zT2ZTdG9yZXMgPSBhY3Rpb25zVG9EaXNwYXRjaC5nZXRTdG9yZXMoKTtcbiAgICAgIH1cblxuICAgICAgLyogSWYgdGhlcmUgYXJlIG5vIHN0b3JlcyBkZWZpbmVkLCBpdCdzIGFuIGVtcHR5IG9iamVjdC4gKi9cbiAgICAgIGRpc3BhdGNoZXIgPSBuZXcgRGlzcGF0Y2hlcihhY3Rpb25zT2ZTdG9yZXMgfHwge30pO1xuXG4gICAgICAvKiBOb3cgY2FsbCBgcmVnaXN0ZXJBY3Rpb25gIG1ldGhvZCBmb3IgZXZlcnkgYWN0aW9uLiAqL1xuICAgICAgZm9yICh2YXIgYWN0aW9uTmFtZSBpbiBhY3Rpb25zVG9EaXNwYXRjaCkge1xuICAgICAgICBpZiAoX19oYXNPd24oYWN0aW9uc1RvRGlzcGF0Y2gsIGFjdGlvbk5hbWUpKSB7XG4gICAgICAgICAgLyogYGdldFN0b3Jlc2AgJiBgdmlld1RyaWdnZXJzYCBhcmUgc3BlY2lhbCBwcm9wZXJ0aWVzLCBpdCdzIG5vdCBhbiBhY3Rpb24uIEFsc28gYW4gZXh0cmEgY2hlY2sgdG8gbWFrZSBzdXJlIHdlJ3JlIGJpbmRpbmcgdG8gYSBmdW5jdGlvbiAqL1xuICAgICAgICAgIGlmIChhY3Rpb25OYW1lICE9PSAnZ2V0U3RvcmVzJyAmJiBhY3Rpb25OYW1lICE9PSAndmlld1RyaWdnZXJzJyAmJiB0eXBlb2YgYWN0aW9uc1RvRGlzcGF0Y2hbYWN0aW9uTmFtZV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gYWN0aW9uc1RvRGlzcGF0Y2hbYWN0aW9uTmFtZV07XG4gICAgICAgICAgICBkaXNwYXRjaGVyLnJlZ2lzdGVyQWN0aW9uKGFjdGlvbk5hbWUsIGNhbGxiYWNrLmJpbmQoZGlzcGF0Y2hlcikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvKiBCaW5kIHRyaWdnZXJzICovXG4gICAgICB0cmlnZ2VycyA9IGFjdGlvbnNUb0Rpc3BhdGNoLnZpZXdUcmlnZ2VycztcbiAgICAgIGZvciAodmFyIHRyaWdnZXJOYW1lIGluIHRyaWdnZXJzKSB7XG4gICAgICAgIHRyaWdnZXJNZXRob2QgPSB0cmlnZ2Vyc1t0cmlnZ2VyTmFtZV07XG4gICAgICAgIGlmICh0eXBlb2YgZGlzcGF0Y2hlclt0cmlnZ2VyTWV0aG9kXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGRpc3BhdGNoZXIub24odHJpZ2dlck5hbWUsIGRpc3BhdGNoZXJbdHJpZ2dlck1ldGhvZF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChjb25zb2xlICE9IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybih0cmlnZ2VyTWV0aG9kICsgJyBzaG91bGQgYmUgYSBtZXRob2QgZGVmaW5lZCBvbiB5b3VyIGRpc3BhdGNoZXIuIFRoZSAnICsgdHJpZ2dlck5hbWUgKyAnIHRyaWdnZXIgd2lsbCBub3QgYmUgYm91bmQgdG8gYW55IG1ldGhvZC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRpc3BhdGNoZXI7XG4gICAgfSxcbiAgICAvLyAjIyMgYERlTG9yZWFuLkZsdXguZGVmaW5lYFxuICAgIC8vIEl0J3MgYSBrZXkgdG8gX2hhY2tfIERlTG9yZWFuIGVhc2lseS4gWW91IGNhbiBqdXN0IGluamVjdCBzb21ldGhpbmdcbiAgICAvLyB5b3Ugd2FudCB0byBkZWZpbmUuXG4gICAgZGVmaW5lOiBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgRGVMb3JlYW5ba2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfTtcblxuICAvLyBTdG9yZSBhbmQgRGlzcGF0Y2hlciBhcmUgdGhlIG9ubHkgYmFzZSBjbGFzc2VzIG9mIERlTG9yZWFuLlxuICBEZUxvcmVhbi5EaXNwYXRjaGVyID0gRGlzcGF0Y2hlcjtcbiAgRGVMb3JlYW4uU3RvcmUgPSBTdG9yZTtcblxuICAvLyAjIyBCdWlsdC1pbiBSZWFjdCBNaXhpblxuICBEZUxvcmVhbi5GbHV4Lm1peGlucyA9IHtcbiAgICAvLyBJdCBzaG91bGQgYmUgaW5zZXJ0ZWQgdG8gdGhlIFJlYWN0IGNvbXBvbmVudHMgd2hpY2hcbiAgICAvLyB1c2VkIGluIEZsdXguXG4gICAgLy8gU2ltcGx5IGBtaXhpbjogW0ZsdXgubWl4aW5zLnN0b3JlTGlzdGVuZXJdYCB3aWxsIHdvcmsuXG4gICAgc3RvcmVMaXN0ZW5lcjoge1xuXG4gICAgICB0cmlnZ2VyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuX19kaXNwYXRjaGVyLmVtaXQuYXBwbHkodGhpcy5fX2Rpc3BhdGNoZXIsIGFyZ3VtZW50cyk7XG4gICAgICB9LFxuXG4gICAgICAvLyBBZnRlciB0aGUgY29tcG9uZW50IG1vdW50ZWQsIGxpc3RlbiBjaGFuZ2VzIG9mIHRoZSByZWxhdGVkIHN0b3Jlc1xuICAgICAgY29tcG9uZW50RGlkTW91bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLCBzdG9yZSwgc3RvcmVOYW1lO1xuXG4gICAgICAgIC8qIGBfX2NoYW5nZUhhbmRsZXJgIGlzIGEgKipsaXN0ZW5lciBnZW5lcmF0b3IqKiB0byBwYXNzIHRvIHRoZSBgb25DaGFuZ2VgIGZ1bmN0aW9uLiAqL1xuICAgICAgICBmdW5jdGlvbiBfX2NoYW5nZUhhbmRsZXIoc3RvcmUsIHN0b3JlTmFtZSkge1xuICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgc3RhdGUsIGFyZ3M7XG4gICAgICAgICAgICAvKiBJZiB0aGUgY29tcG9uZW50IGlzIG1vdW50ZWQsIGNoYW5nZSBzdGF0ZS4gKi9cbiAgICAgICAgICAgIGlmIChzZWxmLmlzTW91bnRlZCgpKSB7XG4gICAgICAgICAgICAgIHNlbGYuc2V0U3RhdGUoc2VsZi5nZXRTdG9yZVN0YXRlcygpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFdoZW4gc29tZXRoaW5nIGNoYW5nZXMgaXQgY2FsbHMgdGhlIGNvbXBvbmVudHMgYHN0b3JlRGlkQ2hhbmdlZGAgbWV0aG9kIGlmIGV4aXN0cy5cbiAgICAgICAgICAgIGlmIChzZWxmLnN0b3JlRGlkQ2hhbmdlKSB7XG4gICAgICAgICAgICAgIGFyZ3MgPSBbc3RvcmVOYW1lXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKSk7XG4gICAgICAgICAgICAgIHNlbGYuc3RvcmVEaWRDaGFuZ2UuYXBwbHkoc2VsZiwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbWVtYmVyIHRoZSBjaGFuZ2UgaGFuZGxlcnMgc28gdGhleSBjYW4gYmUgcmVtb3ZlZCBsYXRlclxuICAgICAgICB0aGlzLl9fY2hhbmdlSGFuZGxlcnMgPSB7fTtcblxuICAgICAgICAvKiBHZW5lcmF0ZSBhbmQgYmluZCB0aGUgY2hhbmdlIGhhbmRsZXJzIHRvIHRoZSBzdG9yZXMuICovXG4gICAgICAgIGZvciAoc3RvcmVOYW1lIGluIHRoaXMuX193YXRjaFN0b3Jlcykge1xuICAgICAgICAgIGlmIChfX2hhc093bih0aGlzLnN0b3Jlcywgc3RvcmVOYW1lKSkge1xuICAgICAgICAgICAgc3RvcmUgPSB0aGlzLnN0b3Jlc1tzdG9yZU5hbWVdO1xuICAgICAgICAgICAgdGhpcy5fX2NoYW5nZUhhbmRsZXJzW3N0b3JlTmFtZV0gPSBfX2NoYW5nZUhhbmRsZXIoc3RvcmUsIHN0b3JlTmFtZSk7XG4gICAgICAgICAgICBzdG9yZS5vbkNoYW5nZSh0aGlzLl9fY2hhbmdlSGFuZGxlcnNbc3RvcmVOYW1lXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvLyBXaGVuIGEgY29tcG9uZW50IHVubW91bnRlZCwgaXQgc2hvdWxkIHN0b3AgbGlzdGVuaW5nLlxuICAgICAgY29tcG9uZW50V2lsbFVubW91bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZm9yICh2YXIgc3RvcmVOYW1lIGluIHRoaXMuX19jaGFuZ2VIYW5kbGVycykge1xuICAgICAgICAgIGlmIChfX2hhc093bih0aGlzLnN0b3Jlcywgc3RvcmVOYW1lKSkge1xuICAgICAgICAgICAgdmFyIHN0b3JlID0gdGhpcy5zdG9yZXNbc3RvcmVOYW1lXTtcbiAgICAgICAgICAgIHN0b3JlLmxpc3RlbmVyLnJlbW92ZUxpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLl9fY2hhbmdlSGFuZGxlcnNbc3RvcmVOYW1lXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLCBzdGF0ZSwgc3RvcmVOYW1lO1xuXG4gICAgICAgIC8qIFRoZSBkaXNwYXRjaGVyIHNob3VsZCBiZSBlYXN5IHRvIGFjY2VzcyBhbmQgaXQgc2hvdWxkIHVzZSBgX19maW5kRGlzcGF0Y2hlcmBcbiAgICAgICAgICAgbWV0aG9kIHRvIGZpbmQgdGhlIHBhcmVudCBkaXNwYXRjaGVycy4gKi9cbiAgICAgICAgdGhpcy5fX2Rpc3BhdGNoZXIgPSBfX2ZpbmREaXNwYXRjaGVyKHRoaXMpO1xuXG4gICAgICAgIC8vIElmIGBzdG9yZXNEaWRDaGFuZ2VgIG1ldGhvZCBwcmVzZW50cywgaXQnbGwgYmUgY2FsbGVkIGFmdGVyIGFsbCB0aGUgc3RvcmVzXG4gICAgICAgIC8vIHdlcmUgY2hhbmdlZC5cbiAgICAgICAgaWYgKHRoaXMuc3RvcmVzRGlkQ2hhbmdlKSB7XG4gICAgICAgICAgdGhpcy5fX2Rpc3BhdGNoZXIub24oJ2NoYW5nZTphbGwnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLnN0b3Jlc0RpZENoYW5nZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2luY2UgYGRpc3BhdGNoZXIuc3RvcmVzYCBpcyBoYXJkZXIgdG8gd3JpdGUsIHRoZXJlJ3MgYSBzaG9ydGN1dCBmb3IgaXQuXG4gICAgICAgIC8vIFlvdSBjYW4gdXNlIGB0aGlzLnN0b3Jlc2AgZnJvbSB0aGUgUmVhY3QgY29tcG9uZW50LlxuICAgICAgICB0aGlzLnN0b3JlcyA9IHRoaXMuX19kaXNwYXRjaGVyLnN0b3JlcztcblxuICAgICAgICB0aGlzLl9fd2F0Y2hTdG9yZXMgPSB7fTtcbiAgICAgICAgaWYgKHRoaXMud2F0Y2hTdG9yZXMgIT0gbnVsbCkge1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy53YXRjaFN0b3Jlcy5sZW5ndGg7ICBpKyspIHtcbiAgICAgICAgICAgIHN0b3JlTmFtZSA9IHRoaXMud2F0Y2hTdG9yZXNbaV07XG4gICAgICAgICAgICB0aGlzLl9fd2F0Y2hTdG9yZXNbc3RvcmVOYW1lXSA9IHRoaXMuc3RvcmVzW3N0b3JlTmFtZV07XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuX193YXRjaFN0b3JlcyA9IHRoaXMuc3RvcmVzO1xuICAgICAgICAgIGlmIChjb25zb2xlICE9IG51bGwgJiYgT2JqZWN0LmtleXMgIT0gbnVsbCAmJiBPYmplY3Qua2V5cyh0aGlzLnN0b3JlcykubGVuZ3RoID4gNCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdZb3VyIGNvbXBvbmVudCBpcyB3YXRjaGluZyBjaGFuZ2VzIG9uIGFsbCBzdG9yZXMsIHlvdSBtYXkgd2FudCB0byBkZWZpbmUgYSBcIndhdGNoU3RvcmVzXCIgcHJvcGVydHkgaW4gb3JkZXIgdG8gb25seSB3YXRjaCBzdG9yZXMgcmVsZXZhbnQgdG8gdGhpcyBjb21wb25lbnQuJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0U3RvcmVTdGF0ZXMoKTtcbiAgICAgIH0sXG5cbiAgICAgIGdldFN0b3JlU3RhdGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzdGF0ZSA9IHtzdG9yZXM6IHt9fSwgc3RvcmU7XG5cbiAgICAgICAgLyogU2V0IGBzdGF0ZS5zdG9yZXNgIGZvciBhbGwgcHJlc2VudCBzdG9yZXMgd2l0aCBhIGBzZXRTdGF0ZWAgbWV0aG9kIGRlZmluZWQuICovXG4gICAgICAgIGZvciAodmFyIHN0b3JlTmFtZSBpbiB0aGlzLl9fd2F0Y2hTdG9yZXMpIHtcbiAgICAgICAgICBpZiAoX19oYXNPd24odGhpcy5zdG9yZXMsIHN0b3JlTmFtZSkpIHtcbiAgICAgICAgICAgIHN0YXRlLnN0b3Jlc1tzdG9yZU5hbWVdID0gdGhpcy5fX3dhdGNoU3RvcmVzW3N0b3JlTmFtZV0uZ2V0U3RhdGUoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN0YXRlO1xuICAgICAgfSxcblxuICAgICAgLy8gYGdldFN0b3JlYCBpcyBhIHNob3J0Y3V0IHRvIGdldCB0aGUgc3RvcmUgZnJvbSB0aGUgc3RhdGUuXG4gICAgICBnZXRTdG9yZTogZnVuY3Rpb24gKHN0b3JlTmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5zdGF0ZS5zdG9yZXNbc3RvcmVOYW1lXTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLy8gIyMgRGVMb3JlYW4gQVBJXG4gIC8vIERlTG9yZWFuIGNhbiBiZSB1c2VkIGluICoqQ29tbW9uSlMqKiBwcm9qZWN0cy5cbiAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcblxuICAgIHZhciByZXF1aXJlbWVudHMgPSByZXF1aXJlKCcuL3JlcXVpcmVtZW50cycpO1xuICAgIGZvciAodmFyIHJlcXVpcmVtZW50IGluIHJlcXVpcmVtZW50cykge1xuICAgICAgRGVMb3JlYW4uRmx1eC5kZWZpbmUocmVxdWlyZW1lbnQsIHJlcXVpcmVtZW50c1tyZXF1aXJlbWVudF0pO1xuICAgIH1cbiAgICBtb2R1bGUuZXhwb3J0cyA9IERlTG9yZWFuO1xuXG4gIC8vIEl0IGNhbiBiZSBhbHNvIHVzZWQgaW4gKipBTUQqKiBwcm9qZWN0cywgdG9vLlxuICAvLyBBbmQgaWYgdGhlcmUgaXMgbm8gbW9kdWxlIHN5c3RlbSBpbml0aWFsaXplZCwganVzdCBwYXNzIHRoZSBEZUxvcmVhblxuICAvLyB0byB0aGUgYHdpbmRvd2AuXG4gIH0gZWxzZSB7XG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgZGVmaW5lKFsnLi9yZXF1aXJlbWVudHMuanMnXSwgZnVuY3Rpb24gKHJlcXVpcmVtZW50cykge1xuICAgICAgICAvLyBJbXBvcnQgTW9kdWxlcyBpbiByZXF1aXJlLmpzIHBhdHRlcm5cbiAgICAgICAgZm9yICh2YXIgcmVxdWlyZW1lbnQgaW4gcmVxdWlyZW1lbnRzKSB7XG4gICAgICAgICAgRGVMb3JlYW4uRmx1eC5kZWZpbmUocmVxdWlyZW1lbnQsIHJlcXVpcmVtZW50c1tyZXF1aXJlbWVudF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIERlTG9yZWFuO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdpbmRvdy5EZUxvcmVhbiA9IERlTG9yZWFuO1xuICAgIH1cbiAgfVxuXG59KSh7fSk7XG4iLCIvLyAjIyBEZXBlbmRlbmN5IGluamVjdGlvbiBmaWxlLlxuXG4vLyBZb3UgY2FuIGNoYW5nZSBkZXBlbmRlbmNpZXMgdXNpbmcgYERlTG9yZWFuLkZsdXguZGVmaW5lYC4gVGhlcmUgYXJlXG4vLyB0d28gZGVwZW5kZW5jaWVzIG5vdzogYEV2ZW50RW1pdHRlcmAgYW5kIGBQcm9taXNlYFxudmFyIHJlcXVpcmVtZW50cztcblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlbWVudHMgPSB7XG4gICAgLy8gRGVMb3JlYW4gdXNlcyAqKk5vZGUuanMgbmF0aXZlIEV2ZW50RW1pdHRlcioqIGZvciBldmVudCBlbWl0dGlvblxuICAgIEV2ZW50RW1pdHRlcjogcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICAgIC8vIGFuZCAqKmVzNi1wcm9taXNlKiogZm9yIERlZmVycmVkIG9iamVjdCBtYW5hZ2VtZW50LlxuICAgIFByb21pc2U6IHJlcXVpcmUoJ2VzNi1wcm9taXNlJykuUHJvbWlzZVxuICB9O1xufSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgZGVmaW5lKGZ1bmN0aW9uIChyZXF1aXJlLCBleHBvcnRzLCBtb2R1bGUpIHtcbiAgICB2YXIgZXZlbnRzID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgICAgIHByb21pc2UgPSByZXF1aXJlKCdlczYtcHJvbWlzZScpO1xuXG4gICAgLy8gUmV0dXJuIHRoZSBtb2R1bGUgdmFsdWUgLSBodHRwOi8vcmVxdWlyZWpzLm9yZy9kb2NzL2FwaS5odG1sI2Nqc21vZHVsZVxuICAgIC8vIFVzaW5nIHNpbXBsaWZpZWQgd3JhcHBlclxuICAgIHJldHVybiB7XG4gICAgICAvLyBEZUxvcmVhbiB1c2VzICoqTm9kZS5qcyBuYXRpdmUgRXZlbnRFbWl0dGVyKiogZm9yIGV2ZW50IGVtaXR0aW9uXG4gICAgICBFdmVudEVtaXR0ZXI6IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcixcbiAgICAgIC8vIGFuZCAqKmVzNi1wcm9taXNlKiogZm9yIERlZmVycmVkIG9iamVjdCBtYW5hZ2VtZW50LlxuICAgICAgUHJvbWlzZTogcmVxdWlyZSgnZXM2LXByb21pc2UnKS5Qcm9taXNlXG4gICAgfTtcbiAgfSk7XG59IGVsc2Uge1xuICB3aW5kb3cuRGVMb3JlYW4gPSBEZUxvcmVhbjtcbn1cblxuLy8gSXQncyBiZXR0ZXIgeW91IGRvbid0IGNoYW5nZSB0aGVtIGlmIHlvdSByZWFsbHkgbmVlZCB0by5cblxuLy8gVGhpcyBsaWJyYXJ5IG5lZWRzIHRvIHdvcmsgZm9yIEJyb3dzZXJpZnkgYW5kIGFsc28gc3RhbmRhbG9uZS5cbi8vIElmIERlTG9yZWFuIGlzIGRlZmluZWQsIGl0IG1lYW5zIGl0J3MgY2FsbGVkIGZyb20gdGhlIGJyb3dzZXIsIG5vdFxuLy8gdGhlIGJyb3dzZXJpZnkuXG5cbmlmICh0eXBlb2YgRGVMb3JlYW4gIT09ICd1bmRlZmluZWQnKSB7XG4gIGZvciAodmFyIHJlcXVpcmVtZW50IGluIHJlcXVpcmVtZW50cykge1xuICAgIERlTG9yZWFuLkZsdXguZGVmaW5lKHJlcXVpcmVtZW50LCByZXF1aXJlbWVudHNbcmVxdWlyZW1lbnRdKTtcbiAgfVxufVxuIiwiLyohIEZsaWdodCB2MS41LjAgfCAoYykgVHdpdHRlciwgSW5jLiB8IE1JVCBMaWNlbnNlICovXG4oZnVuY3Rpb24gd2VicGFja1VuaXZlcnNhbE1vZHVsZURlZmluaXRpb24ocm9vdCwgZmFjdG9yeSkge1xuXHRpZih0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcpXG5cdFx0bW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCk7XG5cdGVsc2UgaWYodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKVxuXHRcdGRlZmluZShmYWN0b3J5KTtcblx0ZWxzZSBpZih0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpXG5cdFx0ZXhwb3J0c1tcImZsaWdodFwiXSA9IGZhY3RvcnkoKTtcblx0ZWxzZVxuXHRcdHJvb3RbXCJmbGlnaHRcIl0gPSBmYWN0b3J5KCk7XG59KSh0aGlzLCBmdW5jdGlvbigpIHtcbnJldHVybiAvKioqKioqLyAoZnVuY3Rpb24obW9kdWxlcykgeyAvLyB3ZWJwYWNrQm9vdHN0cmFwXG4vKioqKioqLyBcdC8vIFRoZSBtb2R1bGUgY2FjaGVcbi8qKioqKiovIFx0dmFyIGluc3RhbGxlZE1vZHVsZXMgPSB7fTtcbi8qKioqKiovXG4vKioqKioqLyBcdC8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG4vKioqKioqLyBcdGZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcbi8qKioqKiovXG4vKioqKioqLyBcdFx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG4vKioqKioqLyBcdFx0aWYoaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0pXG4vKioqKioqLyBcdFx0XHRyZXR1cm4gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0uZXhwb3J0cztcbi8qKioqKiovXG4vKioqKioqLyBcdFx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcbi8qKioqKiovIFx0XHR2YXIgbW9kdWxlID0gaW5zdGFsbGVkTW9kdWxlc1ttb2R1bGVJZF0gPSB7XG4vKioqKioqLyBcdFx0XHRleHBvcnRzOiB7fSxcbi8qKioqKiovIFx0XHRcdGlkOiBtb2R1bGVJZCxcbi8qKioqKiovIFx0XHRcdGxvYWRlZDogZmFsc2Vcbi8qKioqKiovIFx0XHR9O1xuLyoqKioqKi9cbi8qKioqKiovIFx0XHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cbi8qKioqKiovIFx0XHRtb2R1bGVzW21vZHVsZUlkXS5jYWxsKG1vZHVsZS5leHBvcnRzLCBtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcbi8qKioqKiovXG4vKioqKioqLyBcdFx0Ly8gRmxhZyB0aGUgbW9kdWxlIGFzIGxvYWRlZFxuLyoqKioqKi8gXHRcdG1vZHVsZS5sb2FkZWQgPSB0cnVlO1xuLyoqKioqKi9cbi8qKioqKiovIFx0XHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuLyoqKioqKi8gXHRcdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbi8qKioqKiovIFx0fVxuLyoqKioqKi9cbi8qKioqKiovXG4vKioqKioqLyBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlcyBvYmplY3QgKF9fd2VicGFja19tb2R1bGVzX18pXG4vKioqKioqLyBcdF9fd2VicGFja19yZXF1aXJlX18ubSA9IG1vZHVsZXM7XG4vKioqKioqL1xuLyoqKioqKi8gXHQvLyBleHBvc2UgdGhlIG1vZHVsZSBjYWNoZVxuLyoqKioqKi8gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmMgPSBpbnN0YWxsZWRNb2R1bGVzO1xuLyoqKioqKi9cbi8qKioqKiovIFx0Ly8gX193ZWJwYWNrX3B1YmxpY19wYXRoX19cbi8qKioqKiovIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5wID0gXCJcIjtcbi8qKioqKiovXG4vKioqKioqLyBcdC8vIExvYWQgZW50cnkgbW9kdWxlIGFuZCByZXR1cm4gZXhwb3J0c1xuLyoqKioqKi8gXHRyZXR1cm4gX193ZWJwYWNrX3JlcXVpcmVfXygwKTtcbi8qKioqKiovIH0pXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLyoqKioqKi8gKFtcbi8qIDAgKi9cbi8qKiovIGZ1bmN0aW9uKG1vZHVsZSwgZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXykge1xuXG52YXIgX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXywgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX187LyogQ29weXJpZ2h0IDIwMTMgVHdpdHRlciwgSW5jLiBMaWNlbnNlZCB1bmRlciBUaGUgTUlUIExpY2Vuc2UuIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVQgKi9cblxuIShfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fID0gW1xuICAgIF9fd2VicGFja19yZXF1aXJlX18oMSksXG4gICAgX193ZWJwYWNrX3JlcXVpcmVfXygyKSxcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDMpLFxuICAgIF9fd2VicGFja19yZXF1aXJlX18oNCksXG4gICAgX193ZWJwYWNrX3JlcXVpcmVfXyg1KSxcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDYpLFxuICAgIF9fd2VicGFja19yZXF1aXJlX18oNylcbiAgXSwgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18gPSBmdW5jdGlvbihhZHZpY2UsIGNvbXBvbmVudCwgY29tcG9zZSwgZGVidWcsIGxvZ2dlciwgcmVnaXN0cnksIHV0aWxzKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFkdmljZTogYWR2aWNlLFxuICAgICAgY29tcG9uZW50OiBjb21wb25lbnQsXG4gICAgICBjb21wb3NlOiBjb21wb3NlLFxuICAgICAgZGVidWc6IGRlYnVnLFxuICAgICAgbG9nZ2VyOiBsb2dnZXIsXG4gICAgICByZWdpc3RyeTogcmVnaXN0cnksXG4gICAgICB1dGlsczogdXRpbHNcbiAgICB9O1xuXG4gIH0uYXBwbHkoZXhwb3J0cywgX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXyksIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fICE9PSB1bmRlZmluZWQgJiYgKG1vZHVsZS5leHBvcnRzID0gX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18pKTtcblxuXG4vKioqLyB9LFxuLyogMSAqL1xuLyoqKi8gZnVuY3Rpb24obW9kdWxlLCBleHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKSB7XG5cbnZhciBfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXzsvKiBDb3B5cmlnaHQgMjAxMyBUd2l0dGVyLCBJbmMuIExpY2Vuc2VkIHVuZGVyIFRoZSBNSVQgTGljZW5zZS4gaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL01JVCAqL1xuXG4hKF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18gPSBbXG4gICAgX193ZWJwYWNrX3JlcXVpcmVfXyg3KVxuICBdLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyA9IGZ1bmN0aW9uKHV0aWxzKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGFkdmljZSA9IHtcblxuICAgICAgYXJvdW5kOiBmdW5jdGlvbihiYXNlLCB3cmFwcGVkKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBjb21wb3NlZEFyb3VuZCgpIHtcbiAgICAgICAgICAvLyB1bnBhY2tpbmcgYXJndW1lbnRzIGJ5IGhhbmQgYmVuY2htYXJrZWQgZmFzdGVyXG4gICAgICAgICAgdmFyIGkgPSAwLCBsID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IG5ldyBBcnJheShsICsgMSk7XG4gICAgICAgICAgYXJnc1swXSA9IGJhc2UuYmluZCh0aGlzKTtcbiAgICAgICAgICBmb3IgKDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpICsgMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB3cmFwcGVkLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9O1xuICAgICAgfSxcblxuICAgICAgYmVmb3JlOiBmdW5jdGlvbihiYXNlLCBiZWZvcmUpIHtcbiAgICAgICAgdmFyIGJlZm9yZUZuID0gKHR5cGVvZiBiZWZvcmUgPT0gJ2Z1bmN0aW9uJykgPyBiZWZvcmUgOiBiZWZvcmUub2JqW2JlZm9yZS5mbk5hbWVdO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gY29tcG9zZWRCZWZvcmUoKSB7XG4gICAgICAgICAgYmVmb3JlRm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICByZXR1cm4gYmFzZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgICAgfSxcblxuICAgICAgYWZ0ZXI6IGZ1bmN0aW9uKGJhc2UsIGFmdGVyKSB7XG4gICAgICAgIHZhciBhZnRlckZuID0gKHR5cGVvZiBhZnRlciA9PSAnZnVuY3Rpb24nKSA/IGFmdGVyIDogYWZ0ZXIub2JqW2FmdGVyLmZuTmFtZV07XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBjb21wb3NlZEFmdGVyKCkge1xuICAgICAgICAgIHZhciByZXMgPSAoYmFzZS51bmJvdW5kIHx8IGJhc2UpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgYWZ0ZXJGbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgIHJldHVybiByZXM7XG4gICAgICAgIH07XG4gICAgICB9LFxuXG4gICAgICAvLyBhIG1peGluIHRoYXQgYWxsb3dzIG90aGVyIG1peGlucyB0byBhdWdtZW50IGV4aXN0aW5nIGZ1bmN0aW9ucyBieSBhZGRpbmcgYWRkaXRpb25hbFxuICAgICAgLy8gY29kZSBiZWZvcmUsIGFmdGVyIG9yIGFyb3VuZC5cbiAgICAgIHdpdGhBZHZpY2U6IGZ1bmN0aW9uKCkge1xuICAgICAgICBbJ2JlZm9yZScsICdhZnRlcicsICdhcm91bmQnXS5mb3JFYWNoKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgICB0aGlzW21dID0gZnVuY3Rpb24obWV0aG9kLCBmbikge1xuICAgICAgICAgICAgdmFyIG1ldGhvZHMgPSBtZXRob2QudHJpbSgpLnNwbGl0KCcgJyk7XG5cbiAgICAgICAgICAgIG1ldGhvZHMuZm9yRWFjaChmdW5jdGlvbihpKSB7XG4gICAgICAgICAgICAgIHV0aWxzLm11dGF0ZVByb3BlcnR5KHRoaXMsIGksIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpc1tpXSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICB0aGlzW2ldID0gYWR2aWNlW21dKHRoaXNbaV0sIGZuKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgdGhpc1tpXSA9IGZuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzW2ldO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0sIHRoaXMpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gYWR2aWNlO1xuICB9LmFwcGx5KGV4cG9ydHMsIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18pLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyAhPT0gdW5kZWZpbmVkICYmIChtb2R1bGUuZXhwb3J0cyA9IF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fKSk7XG5cblxuLyoqKi8gfSxcbi8qIDIgKi9cbi8qKiovIGZ1bmN0aW9uKG1vZHVsZSwgZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXykge1xuXG52YXIgX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXywgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX187LyogQ29weXJpZ2h0IDIwMTMgVHdpdHRlciwgSW5jLiBMaWNlbnNlZCB1bmRlciBUaGUgTUlUIExpY2Vuc2UuIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVQgKi9cblxuIShfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fID0gW1xuICAgIF9fd2VicGFja19yZXF1aXJlX18oMSksXG4gICAgX193ZWJwYWNrX3JlcXVpcmVfXyg3KSxcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDMpLFxuICAgIF9fd2VicGFja19yZXF1aXJlX18oOCksXG4gICAgX193ZWJwYWNrX3JlcXVpcmVfXyg2KSxcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDUpLFxuICAgIF9fd2VicGFja19yZXF1aXJlX18oNClcbiAgXSwgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18gPSBmdW5jdGlvbihhZHZpY2UsIHV0aWxzLCBjb21wb3NlLCB3aXRoQmFzZSwgcmVnaXN0cnksIHdpdGhMb2dnaW5nLCBkZWJ1Zykge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBmdW5jdGlvbk5hbWVSZWdFeCA9IC9mdW5jdGlvbiAoLio/KVxccz9cXCgvO1xuICAgIHZhciBpZ25vcmVkTWl4aW4gPSB7XG4gICAgICB3aXRoQmFzZTogdHJ1ZSxcbiAgICAgIHdpdGhMb2dnaW5nOiB0cnVlXG4gICAgfTtcblxuICAgIC8vIHRlYXJkb3duIGZvciBhbGwgaW5zdGFuY2VzIG9mIHRoaXMgY29uc3RydWN0b3JcbiAgICBmdW5jdGlvbiB0ZWFyZG93bkFsbCgpIHtcbiAgICAgIHZhciBjb21wb25lbnRJbmZvID0gcmVnaXN0cnkuZmluZENvbXBvbmVudEluZm8odGhpcyk7XG5cbiAgICAgIGNvbXBvbmVudEluZm8gJiYgT2JqZWN0LmtleXMoY29tcG9uZW50SW5mby5pbnN0YW5jZXMpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICB2YXIgaW5mbyA9IGNvbXBvbmVudEluZm8uaW5zdGFuY2VzW2tdO1xuICAgICAgICAvLyBJdCdzIHBvc3NpYmxlIHRoYXQgYSBwcmV2aW91cyB0ZWFyZG93biBjYXVzZWQgYW5vdGhlciBjb21wb25lbnQgdG8gdGVhcmRvd24sXG4gICAgICAgIC8vIHNvIHdlIGNhbid0IGFzc3VtZSB0aGF0IHRoZSBpbnN0YW5jZXMgb2JqZWN0IGlzIGFzIGl0IHdhcy5cbiAgICAgICAgaWYgKGluZm8gJiYgaW5mby5pbnN0YW5jZSkge1xuICAgICAgICAgIGluZm8uaW5zdGFuY2UudGVhcmRvd24oKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXR0YWNoVG8oc2VsZWN0b3IvKiwgb3B0aW9ucyBhcmdzICovKSB7XG4gICAgICAvLyB1bnBhY2tpbmcgYXJndW1lbnRzIGJ5IGhhbmQgYmVuY2htYXJrZWQgZmFzdGVyXG4gICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICB2YXIgYXJncyA9IG5ldyBBcnJheShsIC0gMSk7XG4gICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGw7IGkrKykge1xuICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFzZWxlY3Rvcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbXBvbmVudCBuZWVkcyB0byBiZSBhdHRhY2hUb1xcJ2QgYSBqUXVlcnkgb2JqZWN0LCBuYXRpdmUgbm9kZSBvciBzZWxlY3RvciBzdHJpbmcnKTtcbiAgICAgIH1cblxuICAgICAgdmFyIG9wdGlvbnMgPSB1dGlscy5tZXJnZS5hcHBseSh1dGlscywgYXJncyk7XG4gICAgICB2YXIgY29tcG9uZW50SW5mbyA9IHJlZ2lzdHJ5LmZpbmRDb21wb25lbnRJbmZvKHRoaXMpO1xuXG4gICAgICAkKHNlbGVjdG9yKS5lYWNoKGZ1bmN0aW9uKGksIG5vZGUpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudEluZm8gJiYgY29tcG9uZW50SW5mby5pc0F0dGFjaGVkVG8obm9kZSkpIHtcbiAgICAgICAgICAvLyBhbHJlYWR5IGF0dGFjaGVkXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgKG5ldyB0aGlzKS5pbml0aWFsaXplKG5vZGUsIG9wdGlvbnMpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcmV0dHlQcmludE1peGlucygpIHtcbiAgICAgIC8vY291bGQgYmUgY2FsbGVkIGZyb20gY29uc3RydWN0b3Igb3IgY29uc3RydWN0b3IucHJvdG90eXBlXG4gICAgICB2YXIgbWl4ZWRJbiA9IHRoaXMubWl4ZWRJbiB8fCB0aGlzLnByb3RvdHlwZS5taXhlZEluIHx8IFtdO1xuICAgICAgcmV0dXJuIG1peGVkSW4ubWFwKGZ1bmN0aW9uKG1peGluKSB7XG4gICAgICAgIGlmIChtaXhpbi5uYW1lID09IG51bGwpIHtcbiAgICAgICAgICAvLyBmdW5jdGlvbiBuYW1lIHByb3BlcnR5IG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBicm93c2VyLCB1c2UgcmVnZXhcbiAgICAgICAgICB2YXIgbSA9IG1peGluLnRvU3RyaW5nKCkubWF0Y2goZnVuY3Rpb25OYW1lUmVnRXgpO1xuICAgICAgICAgIHJldHVybiAobSAmJiBtWzFdKSA/IG1bMV0gOiAnJztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKCFpZ25vcmVkTWl4aW5bbWl4aW4ubmFtZV0gPyBtaXhpbi5uYW1lIDogJycpO1xuICAgICAgfSkuZmlsdGVyKEJvb2xlYW4pLmpvaW4oJywgJyk7XG4gICAgfTtcblxuXG4gICAgLy8gZGVmaW5lIHRoZSBjb25zdHJ1Y3RvciBmb3IgYSBjdXN0b20gY29tcG9uZW50IHR5cGVcbiAgICAvLyB0YWtlcyBhbiB1bmxpbWl0ZWQgbnVtYmVyIG9mIG1peGluIGZ1bmN0aW9ucyBhcyBhcmd1bWVudHNcbiAgICAvLyB0eXBpY2FsIGFwaSBjYWxsIHdpdGggMyBtaXhpbnM6IGRlZmluZSh0aW1lbGluZSwgd2l0aFR3ZWV0Q2FwYWJpbGl0eSwgd2l0aFNjcm9sbENhcGFiaWxpdHkpO1xuICAgIGZ1bmN0aW9uIGRlZmluZSgvKm1peGlucyovKSB7XG4gICAgICAvLyB1bnBhY2tpbmcgYXJndW1lbnRzIGJ5IGhhbmQgYmVuY2htYXJrZWQgZmFzdGVyXG4gICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICB2YXIgbWl4aW5zID0gbmV3IEFycmF5KGwpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgbWl4aW5zW2ldID0gYXJndW1lbnRzW2ldO1xuICAgICAgfVxuXG4gICAgICB2YXIgQ29tcG9uZW50ID0gZnVuY3Rpb24oKSB7fTtcblxuICAgICAgQ29tcG9uZW50LnRvU3RyaW5nID0gQ29tcG9uZW50LnByb3RvdHlwZS50b1N0cmluZyA9IHByZXR0eVByaW50TWl4aW5zO1xuICAgICAgaWYgKGRlYnVnLmVuYWJsZWQpIHtcbiAgICAgICAgQ29tcG9uZW50LmRlc2NyaWJlID0gQ29tcG9uZW50LnByb3RvdHlwZS5kZXNjcmliZSA9IENvbXBvbmVudC50b1N0cmluZygpO1xuICAgICAgfVxuXG4gICAgICAvLyAnb3B0aW9ucycgaXMgb3B0aW9uYWwgaGFzaCB0byBiZSBtZXJnZWQgd2l0aCAnZGVmYXVsdHMnIGluIHRoZSBjb21wb25lbnQgZGVmaW5pdGlvblxuICAgICAgQ29tcG9uZW50LmF0dGFjaFRvID0gYXR0YWNoVG87XG4gICAgICAvLyBlbmFibGVzIGV4dGVuc2lvbiBvZiBleGlzdGluZyBcImJhc2VcIiBDb21wb25lbnRzXG4gICAgICBDb21wb25lbnQubWl4aW4gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG5ld0NvbXBvbmVudCA9IGRlZmluZSgpOyAvL1RPRE86IGZpeCBwcmV0dHkgcHJpbnRcbiAgICAgICAgdmFyIG5ld1Byb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQ29tcG9uZW50LnByb3RvdHlwZSk7XG4gICAgICAgIG5ld1Byb3RvdHlwZS5taXhlZEluID0gW10uY29uY2F0KENvbXBvbmVudC5wcm90b3R5cGUubWl4ZWRJbik7XG4gICAgICAgIG5ld1Byb3RvdHlwZS5kZWZhdWx0cyA9IHV0aWxzLm1lcmdlKENvbXBvbmVudC5wcm90b3R5cGUuZGVmYXVsdHMpO1xuICAgICAgICBuZXdQcm90b3R5cGUuYXR0ckRlZiA9IENvbXBvbmVudC5wcm90b3R5cGUuYXR0ckRlZjtcbiAgICAgICAgY29tcG9zZS5taXhpbihuZXdQcm90b3R5cGUsIGFyZ3VtZW50cyk7XG4gICAgICAgIG5ld0NvbXBvbmVudC5wcm90b3R5cGUgPSBuZXdQcm90b3R5cGU7XG4gICAgICAgIG5ld0NvbXBvbmVudC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBuZXdDb21wb25lbnQ7XG4gICAgICAgIHJldHVybiBuZXdDb21wb25lbnQ7XG4gICAgICB9O1xuICAgICAgQ29tcG9uZW50LnRlYXJkb3duQWxsID0gdGVhcmRvd25BbGw7XG5cbiAgICAgIC8vIHByZXBlbmQgY29tbW9uIG1peGlucyB0byBzdXBwbGllZCBsaXN0LCB0aGVuIG1peGluIGFsbCBmbGF2b3JzXG4gICAgICBpZiAoZGVidWcuZW5hYmxlZCkge1xuICAgICAgICBtaXhpbnMudW5zaGlmdCh3aXRoTG9nZ2luZyk7XG4gICAgICB9XG4gICAgICBtaXhpbnMudW5zaGlmdCh3aXRoQmFzZSwgYWR2aWNlLndpdGhBZHZpY2UsIHJlZ2lzdHJ5LndpdGhSZWdpc3RyYXRpb24pO1xuICAgICAgY29tcG9zZS5taXhpbihDb21wb25lbnQucHJvdG90eXBlLCBtaXhpbnMpO1xuXG4gICAgICByZXR1cm4gQ29tcG9uZW50O1xuICAgIH1cblxuICAgIGRlZmluZS50ZWFyZG93bkFsbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmVnaXN0cnkuY29tcG9uZW50cy5zbGljZSgpLmZvckVhY2goZnVuY3Rpb24oYykge1xuICAgICAgICBjLmNvbXBvbmVudC50ZWFyZG93bkFsbCgpO1xuICAgICAgfSk7XG4gICAgICByZWdpc3RyeS5yZXNldCgpO1xuICAgIH07XG5cbiAgICByZXR1cm4gZGVmaW5lO1xuICB9LmFwcGx5KGV4cG9ydHMsIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18pLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyAhPT0gdW5kZWZpbmVkICYmIChtb2R1bGUuZXhwb3J0cyA9IF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fKSk7XG5cblxuLyoqKi8gfSxcbi8qIDMgKi9cbi8qKiovIGZ1bmN0aW9uKG1vZHVsZSwgZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXykge1xuXG52YXIgX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXywgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX187LyogQ29weXJpZ2h0IDIwMTMgVHdpdHRlciwgSW5jLiBMaWNlbnNlZCB1bmRlciBUaGUgTUlUIExpY2Vuc2UuIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVQgKi9cblxuIShfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fID0gW1xuICAgIF9fd2VicGFja19yZXF1aXJlX18oNylcbiAgXSwgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18gPSBmdW5jdGlvbih1dGlscykge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBkb250TG9jayA9IFsnbWl4ZWRJbicsICdhdHRyRGVmJ107XG5cbiAgICBmdW5jdGlvbiBzZXRXcml0YWJpbGl0eShvYmosIHdyaXRhYmxlKSB7XG4gICAgICBPYmplY3Qua2V5cyhvYmopLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICBpZiAoZG9udExvY2suaW5kZXhPZihrZXkpIDwgMCkge1xuICAgICAgICAgIHV0aWxzLnByb3BlcnR5V3JpdGFiaWxpdHkob2JqLCBrZXksIHdyaXRhYmxlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWl4aW4oYmFzZSwgbWl4aW5zKSB7XG4gICAgICBiYXNlLm1peGVkSW4gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYmFzZSwgJ21peGVkSW4nKSA/IGJhc2UubWl4ZWRJbiA6IFtdO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1peGlucy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoYmFzZS5taXhlZEluLmluZGV4T2YobWl4aW5zW2ldKSA9PSAtMSkge1xuICAgICAgICAgIHNldFdyaXRhYmlsaXR5KGJhc2UsIGZhbHNlKTtcbiAgICAgICAgICBtaXhpbnNbaV0uY2FsbChiYXNlKTtcbiAgICAgICAgICBiYXNlLm1peGVkSW4ucHVzaChtaXhpbnNbaV0pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHNldFdyaXRhYmlsaXR5KGJhc2UsIHRydWUpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBtaXhpbjogbWl4aW5cbiAgICB9O1xuXG4gIH0uYXBwbHkoZXhwb3J0cywgX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXyksIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fICE9PSB1bmRlZmluZWQgJiYgKG1vZHVsZS5leHBvcnRzID0gX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18pKTtcblxuXG4vKioqLyB9LFxuLyogNCAqL1xuLyoqKi8gZnVuY3Rpb24obW9kdWxlLCBleHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKSB7XG5cbnZhciBfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXzsvKiBDb3B5cmlnaHQgMjAxMyBUd2l0dGVyLCBJbmMuIExpY2Vuc2VkIHVuZGVyIFRoZSBNSVQgTGljZW5zZS4gaHR0cDovL29wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL01JVCAqL1xuXG4hKF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18gPSBbX193ZWJwYWNrX3JlcXVpcmVfXyg2KV0sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fID0gZnVuY3Rpb24ocmVnaXN0cnkpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBTZWFyY2ggb2JqZWN0IG1vZGVsXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBmdW5jdGlvbiB0cmF2ZXJzZSh1dGlsLCBzZWFyY2hUZXJtLCBvcHRpb25zKSB7XG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgIHZhciBvYmogPSBvcHRpb25zLm9iaiB8fCB3aW5kb3c7XG4gICAgICB2YXIgcGF0aCA9IG9wdGlvbnMucGF0aCB8fCAoKG9iaiA9PSB3aW5kb3cpID8gJ3dpbmRvdycgOiAnJyk7XG4gICAgICB2YXIgcHJvcHMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgICAgcHJvcHMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICAgIGlmICgodGVzdHNbdXRpbF0gfHwgdXRpbCkoc2VhcmNoVGVybSwgb2JqLCBwcm9wKSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKFtwYXRoLCAnLicsIHByb3BdLmpvaW4oJycpLCAnLT4nLCBbJygnLCB0eXBlb2Ygb2JqW3Byb3BdLCAnKSddLmpvaW4oJycpLCBvYmpbcHJvcF0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqW3Byb3BdKSA9PSAnW29iamVjdCBPYmplY3RdJyAmJiAob2JqW3Byb3BdICE9IG9iaikgJiYgcGF0aC5zcGxpdCgnLicpLmluZGV4T2YocHJvcCkgPT0gLTEpIHtcbiAgICAgICAgICB0cmF2ZXJzZSh1dGlsLCBzZWFyY2hUZXJtLCB7b2JqOiBvYmpbcHJvcF0sIHBhdGg6IFtwYXRoLHByb3BdLmpvaW4oJy4nKX0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZWFyY2godXRpbCwgZXhwZWN0ZWQsIHNlYXJjaFRlcm0sIG9wdGlvbnMpIHtcbiAgICAgIGlmICghZXhwZWN0ZWQgfHwgdHlwZW9mIHNlYXJjaFRlcm0gPT0gZXhwZWN0ZWQpIHtcbiAgICAgICAgdHJhdmVyc2UodXRpbCwgc2VhcmNoVGVybSwgb3B0aW9ucyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKFtzZWFyY2hUZXJtLCAnbXVzdCBiZScsIGV4cGVjdGVkXS5qb2luKCcgJykpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciB0ZXN0cyA9IHtcbiAgICAgICduYW1lJzogZnVuY3Rpb24oc2VhcmNoVGVybSwgb2JqLCBwcm9wKSB7cmV0dXJuIHNlYXJjaFRlcm0gPT0gcHJvcDt9LFxuICAgICAgJ25hbWVDb250YWlucyc6IGZ1bmN0aW9uKHNlYXJjaFRlcm0sIG9iaiwgcHJvcCkge3JldHVybiBwcm9wLmluZGV4T2Yoc2VhcmNoVGVybSkgPiAtMTt9LFxuICAgICAgJ3R5cGUnOiBmdW5jdGlvbihzZWFyY2hUZXJtLCBvYmosIHByb3ApIHtyZXR1cm4gb2JqW3Byb3BdIGluc3RhbmNlb2Ygc2VhcmNoVGVybTt9LFxuICAgICAgJ3ZhbHVlJzogZnVuY3Rpb24oc2VhcmNoVGVybSwgb2JqLCBwcm9wKSB7cmV0dXJuIG9ialtwcm9wXSA9PT0gc2VhcmNoVGVybTt9LFxuICAgICAgJ3ZhbHVlQ29lcmNlZCc6IGZ1bmN0aW9uKHNlYXJjaFRlcm0sIG9iaiwgcHJvcCkge3JldHVybiBvYmpbcHJvcF0gPT0gc2VhcmNoVGVybTt9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGJ5TmFtZShzZWFyY2hUZXJtLCBvcHRpb25zKSB7c2VhcmNoKCduYW1lJywgJ3N0cmluZycsIHNlYXJjaFRlcm0sIG9wdGlvbnMpO31cbiAgICBmdW5jdGlvbiBieU5hbWVDb250YWlucyhzZWFyY2hUZXJtLCBvcHRpb25zKSB7c2VhcmNoKCduYW1lQ29udGFpbnMnLCAnc3RyaW5nJywgc2VhcmNoVGVybSwgb3B0aW9ucyk7fVxuICAgIGZ1bmN0aW9uIGJ5VHlwZShzZWFyY2hUZXJtLCBvcHRpb25zKSB7c2VhcmNoKCd0eXBlJywgJ2Z1bmN0aW9uJywgc2VhcmNoVGVybSwgb3B0aW9ucyk7fVxuICAgIGZ1bmN0aW9uIGJ5VmFsdWUoc2VhcmNoVGVybSwgb3B0aW9ucykge3NlYXJjaCgndmFsdWUnLCBudWxsLCBzZWFyY2hUZXJtLCBvcHRpb25zKTt9XG4gICAgZnVuY3Rpb24gYnlWYWx1ZUNvZXJjZWQoc2VhcmNoVGVybSwgb3B0aW9ucykge3NlYXJjaCgndmFsdWVDb2VyY2VkJywgbnVsbCwgc2VhcmNoVGVybSwgb3B0aW9ucyk7fVxuICAgIGZ1bmN0aW9uIGN1c3RvbShmbiwgb3B0aW9ucykge3RyYXZlcnNlKGZuLCBudWxsLCBvcHRpb25zKTt9XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBFdmVudCBsb2dnaW5nXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICB2YXIgQUxMID0gJ2FsbCc7IC8vbm8gZmlsdGVyXG5cbiAgICAvL2xvZyBub3RoaW5nIGJ5IGRlZmF1bHRcbiAgICB2YXIgbG9nRmlsdGVyID0ge1xuICAgICAgZXZlbnROYW1lczogW10sXG4gICAgICBhY3Rpb25zOiBbXVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZpbHRlckV2ZW50TG9nc0J5QWN0aW9uKC8qYWN0aW9ucyovKSB7XG4gICAgICB2YXIgYWN0aW9ucyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgICAgbG9nRmlsdGVyLmV2ZW50TmFtZXMubGVuZ3RoIHx8IChsb2dGaWx0ZXIuZXZlbnROYW1lcyA9IEFMTCk7XG4gICAgICBsb2dGaWx0ZXIuYWN0aW9ucyA9IGFjdGlvbnMubGVuZ3RoID8gYWN0aW9ucyA6IEFMTDtcbiAgICAgIHNhdmVMb2dGaWx0ZXIoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmaWx0ZXJFdmVudExvZ3NCeU5hbWUoLypldmVudE5hbWVzKi8pIHtcbiAgICAgIHZhciBldmVudE5hbWVzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgICBsb2dGaWx0ZXIuYWN0aW9ucy5sZW5ndGggfHwgKGxvZ0ZpbHRlci5hY3Rpb25zID0gQUxMKTtcbiAgICAgIGxvZ0ZpbHRlci5ldmVudE5hbWVzID0gZXZlbnROYW1lcy5sZW5ndGggPyBldmVudE5hbWVzIDogQUxMO1xuICAgICAgc2F2ZUxvZ0ZpbHRlcigpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGhpZGVBbGxFdmVudExvZ3MoKSB7XG4gICAgICBsb2dGaWx0ZXIuYWN0aW9ucyA9IFtdO1xuICAgICAgbG9nRmlsdGVyLmV2ZW50TmFtZXMgPSBbXTtcbiAgICAgIHNhdmVMb2dGaWx0ZXIoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzaG93QWxsRXZlbnRMb2dzKCkge1xuICAgICAgbG9nRmlsdGVyLmFjdGlvbnMgPSBBTEw7XG4gICAgICBsb2dGaWx0ZXIuZXZlbnROYW1lcyA9IEFMTDtcbiAgICAgIHNhdmVMb2dGaWx0ZXIoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzYXZlTG9nRmlsdGVyKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKHdpbmRvdy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbG9nRmlsdGVyX2V2ZW50TmFtZXMnLCBsb2dGaWx0ZXIuZXZlbnROYW1lcyk7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2xvZ0ZpbHRlcl9hY3Rpb25zJywgbG9nRmlsdGVyLmFjdGlvbnMpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChpZ25vcmVkKSB7fTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXRyaWV2ZUxvZ0ZpbHRlcigpIHtcbiAgICAgIHZhciBldmVudE5hbWVzLCBhY3Rpb25zO1xuICAgICAgdHJ5IHtcbiAgICAgICAgZXZlbnROYW1lcyA9ICh3aW5kb3cubG9jYWxTdG9yYWdlICYmIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdsb2dGaWx0ZXJfZXZlbnROYW1lcycpKTtcbiAgICAgICAgYWN0aW9ucyA9ICh3aW5kb3cubG9jYWxTdG9yYWdlICYmIGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdsb2dGaWx0ZXJfYWN0aW9ucycpKTtcbiAgICAgIH0gY2F0Y2ggKGlnbm9yZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZXZlbnROYW1lcyAmJiAobG9nRmlsdGVyLmV2ZW50TmFtZXMgPSBldmVudE5hbWVzKTtcbiAgICAgIGFjdGlvbnMgJiYgKGxvZ0ZpbHRlci5hY3Rpb25zID0gYWN0aW9ucyk7XG5cbiAgICAgIC8vIHJlY29uc3RpdHV0ZSBhcnJheXMgaW4gcGxhY2VcbiAgICAgIE9iamVjdC5rZXlzKGxvZ0ZpbHRlcikuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgIHZhciB0aGlzUHJvcCA9IGxvZ0ZpbHRlcltrXTtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzUHJvcCA9PSAnc3RyaW5nJyAmJiB0aGlzUHJvcCAhPT0gQUxMKSB7XG4gICAgICAgICAgbG9nRmlsdGVyW2tdID0gdGhpc1Byb3AgPyB0aGlzUHJvcC5zcGxpdCgnLCcpIDogW107XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB7XG5cbiAgICAgIGVuYWJsZTogZnVuY3Rpb24oZW5hYmxlKSB7XG4gICAgICAgIHRoaXMuZW5hYmxlZCA9ICEhZW5hYmxlO1xuXG4gICAgICAgIGlmIChlbmFibGUgJiYgd2luZG93LmNvbnNvbGUpIHtcbiAgICAgICAgICBjb25zb2xlLmluZm8oJ0Jvb3RpbmcgaW4gREVCVUcgbW9kZScpO1xuICAgICAgICAgIGNvbnNvbGUuaW5mbygnWW91IGNhbiBjb25maWd1cmUgZXZlbnQgbG9nZ2luZyB3aXRoIERFQlVHLmV2ZW50cy5sb2dBbGwoKS9sb2dOb25lKCkvbG9nQnlOYW1lKCkvbG9nQnlBY3Rpb24oKScpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0cmlldmVMb2dGaWx0ZXIoKTtcblxuICAgICAgICB3aW5kb3cuREVCVUcgPSB0aGlzO1xuICAgICAgfSxcblxuICAgICAgd2FybjogZnVuY3Rpb24gKG1lc3NhZ2UpIHtcbiAgICAgICAgaWYgKCF3aW5kb3cuY29uc29sZSkgeyByZXR1cm47IH1cbiAgICAgICAgdmFyIGZuID0gKGNvbnNvbGUud2FybiB8fCBjb25zb2xlLmxvZyk7XG4gICAgICAgIGZuLmNhbGwoY29uc29sZSwgdGhpcy50b1N0cmluZygpICsgJzogJyArIG1lc3NhZ2UpO1xuICAgICAgfSxcblxuICAgICAgcmVnaXN0cnk6IHJlZ2lzdHJ5LFxuXG4gICAgICBmaW5kOiB7XG4gICAgICAgIGJ5TmFtZTogYnlOYW1lLFxuICAgICAgICBieU5hbWVDb250YWluczogYnlOYW1lQ29udGFpbnMsXG4gICAgICAgIGJ5VHlwZTogYnlUeXBlLFxuICAgICAgICBieVZhbHVlOiBieVZhbHVlLFxuICAgICAgICBieVZhbHVlQ29lcmNlZDogYnlWYWx1ZUNvZXJjZWQsXG4gICAgICAgIGN1c3RvbTogY3VzdG9tXG4gICAgICB9LFxuXG4gICAgICBldmVudHM6IHtcbiAgICAgICAgbG9nRmlsdGVyOiBsb2dGaWx0ZXIsXG5cbiAgICAgICAgLy8gQWNjZXB0cyBhbnkgbnVtYmVyIG9mIGFjdGlvbiBhcmdzXG4gICAgICAgIC8vIGUuZy4gREVCVUcuZXZlbnRzLmxvZ0J5QWN0aW9uKFwib25cIiwgXCJvZmZcIilcbiAgICAgICAgbG9nQnlBY3Rpb246IGZpbHRlckV2ZW50TG9nc0J5QWN0aW9uLFxuXG4gICAgICAgIC8vIEFjY2VwdHMgYW55IG51bWJlciBvZiBldmVudCBuYW1lIGFyZ3MgKGluYy4gcmVnZXggb3Igd2lsZGNhcmRzKVxuICAgICAgICAvLyBlLmcuIERFQlVHLmV2ZW50cy5sb2dCeU5hbWUoL3VpLiovLCBcIipUaHJlYWQqXCIpO1xuICAgICAgICBsb2dCeU5hbWU6IGZpbHRlckV2ZW50TG9nc0J5TmFtZSxcblxuICAgICAgICBsb2dBbGw6IHNob3dBbGxFdmVudExvZ3MsXG4gICAgICAgIGxvZ05vbmU6IGhpZGVBbGxFdmVudExvZ3NcbiAgICAgIH1cbiAgICB9O1xuICB9LmFwcGx5KGV4cG9ydHMsIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18pLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyAhPT0gdW5kZWZpbmVkICYmIChtb2R1bGUuZXhwb3J0cyA9IF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fKSk7XG5cblxuLyoqKi8gfSxcbi8qIDUgKi9cbi8qKiovIGZ1bmN0aW9uKG1vZHVsZSwgZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXykge1xuXG52YXIgX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXywgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX187LyogQ29weXJpZ2h0IDIwMTMgVHdpdHRlciwgSW5jLiBMaWNlbnNlZCB1bmRlciBUaGUgTUlUIExpY2Vuc2UuIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVQgKi9cblxuIShfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fID0gW1xuICAgIF9fd2VicGFja19yZXF1aXJlX18oNylcbiAgXSwgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18gPSBmdW5jdGlvbih1dGlscykge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBhY3Rpb25TeW1ib2xzID0ge1xuICAgICAgb246ICc8LScsXG4gICAgICB0cmlnZ2VyOiAnLT4nLFxuICAgICAgb2ZmOiAneCAnXG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGVsZW1Ub1N0cmluZyhlbGVtKSB7XG4gICAgICB2YXIgdGFnU3RyID0gZWxlbS50YWdOYW1lID8gZWxlbS50YWdOYW1lLnRvTG93ZXJDYXNlKCkgOiBlbGVtLnRvU3RyaW5nKCk7XG4gICAgICB2YXIgY2xhc3NTdHIgPSBlbGVtLmNsYXNzTmFtZSA/ICcuJyArIChlbGVtLmNsYXNzTmFtZSkgOiAnJztcbiAgICAgIHZhciByZXN1bHQgPSB0YWdTdHIgKyBjbGFzc1N0cjtcbiAgICAgIHJldHVybiBlbGVtLnRhZ05hbWUgPyBbJ1xcJycsICdcXCcnXS5qb2luKHJlc3VsdCkgOiByZXN1bHQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9nKGFjdGlvbiwgY29tcG9uZW50LCBldmVudEFyZ3MpIHtcbiAgICAgIGlmICghd2luZG93LkRFQlVHIHx8ICF3aW5kb3cuREVCVUcuZW5hYmxlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB2YXIgbmFtZSwgZXZlbnRUeXBlLCBlbGVtLCBmbiwgcGF5bG9hZCwgbG9nRmlsdGVyLCB0b1JlZ0V4cCwgYWN0aW9uTG9nZ2FibGUsIG5hbWVMb2dnYWJsZSwgaW5mbztcblxuICAgICAgaWYgKHR5cGVvZiBldmVudEFyZ3NbZXZlbnRBcmdzLmxlbmd0aCAtIDFdID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZm4gPSBldmVudEFyZ3MucG9wKCk7XG4gICAgICAgIGZuID0gZm4udW5ib3VuZCB8fCBmbjsgLy8gdXNlIHVuYm91bmQgdmVyc2lvbiBpZiBhbnkgKGJldHRlciBpbmZvKVxuICAgICAgfVxuXG4gICAgICBpZiAoZXZlbnRBcmdzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGVsZW0gPSBjb21wb25lbnQuJG5vZGVbMF07XG4gICAgICAgIGV2ZW50VHlwZSA9IGV2ZW50QXJnc1swXTtcbiAgICAgIH0gZWxzZSBpZiAoKGV2ZW50QXJncy5sZW5ndGggPT0gMikgJiYgdHlwZW9mIGV2ZW50QXJnc1sxXSA9PSAnb2JqZWN0JyAmJiAhZXZlbnRBcmdzWzFdLnR5cGUpIHtcbiAgICAgICAgLy8yIGFyZ3MsIGZpcnN0IGFyZyBpcyBub3QgZWxlbVxuICAgICAgICBlbGVtID0gY29tcG9uZW50LiRub2RlWzBdO1xuICAgICAgICBldmVudFR5cGUgPSBldmVudEFyZ3NbMF07XG4gICAgICAgIGlmIChhY3Rpb24gPT0gXCJ0cmlnZ2VyXCIpIHtcbiAgICAgICAgICBwYXlsb2FkID0gZXZlbnRBcmdzWzFdO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLzIrIGFyZ3MsIGZpcnN0IGFyZyBpcyBlbGVtXG4gICAgICAgIGVsZW0gPSBldmVudEFyZ3NbMF07XG4gICAgICAgIGV2ZW50VHlwZSA9IGV2ZW50QXJnc1sxXTtcbiAgICAgICAgaWYgKGFjdGlvbiA9PSBcInRyaWdnZXJcIikge1xuICAgICAgICAgIHBheWxvYWQgPSBldmVudEFyZ3NbMl07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbmFtZSA9IHR5cGVvZiBldmVudFR5cGUgPT0gJ29iamVjdCcgPyBldmVudFR5cGUudHlwZSA6IGV2ZW50VHlwZTtcblxuICAgICAgbG9nRmlsdGVyID0gREVCVUcuZXZlbnRzLmxvZ0ZpbHRlcjtcblxuICAgICAgLy8gbm8gcmVnZXggZm9yIHlvdSwgYWN0aW9ucy4uLlxuICAgICAgYWN0aW9uTG9nZ2FibGUgPSBsb2dGaWx0ZXIuYWN0aW9ucyA9PSAnYWxsJyB8fCAobG9nRmlsdGVyLmFjdGlvbnMuaW5kZXhPZihhY3Rpb24pID4gLTEpO1xuICAgICAgLy8gZXZlbnQgbmFtZSBmaWx0ZXIgYWxsb3cgd2lsZGNhcmRzIG9yIHJlZ2V4Li4uXG4gICAgICB0b1JlZ0V4cCA9IGZ1bmN0aW9uKGV4cHIpIHtcbiAgICAgICAgcmV0dXJuIGV4cHIudGVzdCA/IGV4cHIgOiBuZXcgUmVnRXhwKCdeJyArIGV4cHIucmVwbGFjZSgvXFwqL2csICcuKicpICsgJyQnKTtcbiAgICAgIH07XG4gICAgICBuYW1lTG9nZ2FibGUgPVxuICAgICAgICBsb2dGaWx0ZXIuZXZlbnROYW1lcyA9PSAnYWxsJyB8fFxuICAgICAgICBsb2dGaWx0ZXIuZXZlbnROYW1lcy5zb21lKGZ1bmN0aW9uKGUpIHtyZXR1cm4gdG9SZWdFeHAoZSkudGVzdChuYW1lKTt9KTtcblxuICAgICAgaWYgKGFjdGlvbkxvZ2dhYmxlICYmIG5hbWVMb2dnYWJsZSkge1xuICAgICAgICBpbmZvID0gW2FjdGlvblN5bWJvbHNbYWN0aW9uXSwgYWN0aW9uLCAnWycgKyBuYW1lICsgJ10nXTtcbiAgICAgICAgcGF5bG9hZCAmJiBpbmZvLnB1c2gocGF5bG9hZCk7XG4gICAgICAgIGluZm8ucHVzaChlbGVtVG9TdHJpbmcoZWxlbSkpO1xuICAgICAgICBpbmZvLnB1c2goY29tcG9uZW50LmNvbnN0cnVjdG9yLmRlc2NyaWJlLnNwbGl0KCcgJykuc2xpY2UoMCwzKS5qb2luKCcgJykpO1xuICAgICAgICBjb25zb2xlLmdyb3VwQ29sbGFwc2VkICYmIGFjdGlvbiA9PSAndHJpZ2dlcicgJiYgY29uc29sZS5ncm91cENvbGxhcHNlZChhY3Rpb24sIG5hbWUpO1xuICAgICAgICAvLyBJRTkgZG9lc24ndCBkZWZpbmUgYGFwcGx5YCBmb3IgY29uc29sZSBtZXRob2RzLCBidXQgdGhpcyB3b3JrcyBldmVyeXdoZXJlOlxuICAgICAgICBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuY2FsbChjb25zb2xlLmluZm8sIGNvbnNvbGUsIGluZm8pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHdpdGhMb2dnaW5nKCkge1xuICAgICAgdGhpcy5iZWZvcmUoJ3RyaWdnZXInLCBmdW5jdGlvbigpIHtcbiAgICAgICAgbG9nKCd0cmlnZ2VyJywgdGhpcywgdXRpbHMudG9BcnJheShhcmd1bWVudHMpKTtcbiAgICAgIH0pO1xuICAgICAgaWYgKGNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQpIHtcbiAgICAgICAgdGhpcy5hZnRlcigndHJpZ2dlcicsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNvbnNvbGUuZ3JvdXBFbmQoKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICB0aGlzLmJlZm9yZSgnb24nLCBmdW5jdGlvbigpIHtcbiAgICAgICAgbG9nKCdvbicsIHRoaXMsIHV0aWxzLnRvQXJyYXkoYXJndW1lbnRzKSk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMuYmVmb3JlKCdvZmYnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgbG9nKCdvZmYnLCB0aGlzLCB1dGlscy50b0FycmF5KGFyZ3VtZW50cykpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHdpdGhMb2dnaW5nO1xuICB9LmFwcGx5KGV4cG9ydHMsIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18pLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyAhPT0gdW5kZWZpbmVkICYmIChtb2R1bGUuZXhwb3J0cyA9IF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fKSk7XG5cblxuLyoqKi8gfSxcbi8qIDYgKi9cbi8qKiovIGZ1bmN0aW9uKG1vZHVsZSwgZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXykge1xuXG52YXIgX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXywgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX187LyogQ29weXJpZ2h0IDIwMTMgVHdpdHRlciwgSW5jLiBMaWNlbnNlZCB1bmRlciBUaGUgTUlUIExpY2Vuc2UuIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVQgKi9cblxuIShfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fID0gW10sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fID0gZnVuY3Rpb24oKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgZnVuY3Rpb24gcGFyc2VFdmVudEFyZ3MoaW5zdGFuY2UsIGFyZ3MpIHtcbiAgICAgIHZhciBlbGVtZW50LCB0eXBlLCBjYWxsYmFjaztcbiAgICAgIHZhciBlbmQgPSBhcmdzLmxlbmd0aDtcblxuICAgICAgaWYgKHR5cGVvZiBhcmdzW2VuZCAtIDFdID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZW5kIC09IDE7XG4gICAgICAgIGNhbGxiYWNrID0gYXJnc1tlbmRdO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIGFyZ3NbZW5kIC0gMV0gPT0gJ29iamVjdCcpIHtcbiAgICAgICAgZW5kIC09IDE7XG4gICAgICB9XG5cbiAgICAgIGlmIChlbmQgPT0gMikge1xuICAgICAgICBlbGVtZW50ID0gYXJnc1swXTtcbiAgICAgICAgdHlwZSA9IGFyZ3NbMV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbGVtZW50ID0gaW5zdGFuY2Uubm9kZTtcbiAgICAgICAgdHlwZSA9IGFyZ3NbMF07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVsZW1lbnQ6IGVsZW1lbnQsXG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIGNhbGxiYWNrOiBjYWxsYmFja1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYXRjaEV2ZW50KGEsIGIpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIChhLmVsZW1lbnQgPT0gYi5lbGVtZW50KSAmJlxuICAgICAgICAoYS50eXBlID09IGIudHlwZSkgJiZcbiAgICAgICAgKGIuY2FsbGJhY2sgPT0gbnVsbCB8fCAoYS5jYWxsYmFjayA9PSBiLmNhbGxiYWNrKSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gUmVnaXN0cnkoKSB7XG5cbiAgICAgIHZhciByZWdpc3RyeSA9IHRoaXM7XG5cbiAgICAgICh0aGlzLnJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuY29tcG9uZW50cyA9IFtdO1xuICAgICAgICB0aGlzLmFsbEluc3RhbmNlcyA9IHt9O1xuICAgICAgICB0aGlzLmV2ZW50cyA9IFtdO1xuICAgICAgfSkuY2FsbCh0aGlzKTtcblxuICAgICAgZnVuY3Rpb24gQ29tcG9uZW50SW5mbyhjb21wb25lbnQpIHtcbiAgICAgICAgdGhpcy5jb21wb25lbnQgPSBjb21wb25lbnQ7XG4gICAgICAgIHRoaXMuYXR0YWNoZWRUbyA9IFtdO1xuICAgICAgICB0aGlzLmluc3RhbmNlcyA9IHt9O1xuXG4gICAgICAgIHRoaXMuYWRkSW5zdGFuY2UgPSBmdW5jdGlvbihpbnN0YW5jZSkge1xuICAgICAgICAgIHZhciBpbnN0YW5jZUluZm8gPSBuZXcgSW5zdGFuY2VJbmZvKGluc3RhbmNlKTtcbiAgICAgICAgICB0aGlzLmluc3RhbmNlc1tpbnN0YW5jZS5pZGVudGl0eV0gPSBpbnN0YW5jZUluZm87XG4gICAgICAgICAgdGhpcy5hdHRhY2hlZFRvLnB1c2goaW5zdGFuY2Uubm9kZSk7XG5cbiAgICAgICAgICByZXR1cm4gaW5zdGFuY2VJbmZvO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMucmVtb3ZlSW5zdGFuY2UgPSBmdW5jdGlvbihpbnN0YW5jZSkge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmluc3RhbmNlc1tpbnN0YW5jZS5pZGVudGl0eV07XG4gICAgICAgICAgdmFyIGluZGV4T2ZOb2RlID0gdGhpcy5hdHRhY2hlZFRvLmluZGV4T2YoaW5zdGFuY2Uubm9kZSk7XG4gICAgICAgICAgKGluZGV4T2ZOb2RlID4gLTEpICYmIHRoaXMuYXR0YWNoZWRUby5zcGxpY2UoaW5kZXhPZk5vZGUsIDEpO1xuXG4gICAgICAgICAgaWYgKCFPYmplY3Qua2V5cyh0aGlzLmluc3RhbmNlcykubGVuZ3RoKSB7XG4gICAgICAgICAgICAvL2lmIEkgaG9sZCBubyBtb3JlIGluc3RhbmNlcyByZW1vdmUgbWUgZnJvbSByZWdpc3RyeVxuICAgICAgICAgICAgcmVnaXN0cnkucmVtb3ZlQ29tcG9uZW50SW5mbyh0aGlzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5pc0F0dGFjaGVkVG8gPSBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuYXR0YWNoZWRUby5pbmRleE9mKG5vZGUpID4gLTE7XG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIEluc3RhbmNlSW5mbyhpbnN0YW5jZSkge1xuICAgICAgICB0aGlzLmluc3RhbmNlID0gaW5zdGFuY2U7XG4gICAgICAgIHRoaXMuZXZlbnRzID0gW107XG5cbiAgICAgICAgdGhpcy5hZGRCaW5kID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICB0aGlzLmV2ZW50cy5wdXNoKGV2ZW50KTtcbiAgICAgICAgICByZWdpc3RyeS5ldmVudHMucHVzaChldmVudCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5yZW1vdmVCaW5kID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMCwgZTsgZSA9IHRoaXMuZXZlbnRzW2ldOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChtYXRjaEV2ZW50KGUsIGV2ZW50KSkge1xuICAgICAgICAgICAgICB0aGlzLmV2ZW50cy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICB0aGlzLmFkZEluc3RhbmNlID0gZnVuY3Rpb24oaW5zdGFuY2UpIHtcbiAgICAgICAgdmFyIGNvbXBvbmVudCA9IHRoaXMuZmluZENvbXBvbmVudEluZm8oaW5zdGFuY2UpO1xuXG4gICAgICAgIGlmICghY29tcG9uZW50KSB7XG4gICAgICAgICAgY29tcG9uZW50ID0gbmV3IENvbXBvbmVudEluZm8oaW5zdGFuY2UuY29uc3RydWN0b3IpO1xuICAgICAgICAgIHRoaXMuY29tcG9uZW50cy5wdXNoKGNvbXBvbmVudCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaW5zdCA9IGNvbXBvbmVudC5hZGRJbnN0YW5jZShpbnN0YW5jZSk7XG5cbiAgICAgICAgdGhpcy5hbGxJbnN0YW5jZXNbaW5zdGFuY2UuaWRlbnRpdHldID0gaW5zdDtcblxuICAgICAgICByZXR1cm4gY29tcG9uZW50O1xuICAgICAgfTtcblxuICAgICAgdGhpcy5yZW1vdmVJbnN0YW5jZSA9IGZ1bmN0aW9uKGluc3RhbmNlKSB7XG4gICAgICAgIC8vcmVtb3ZlIGZyb20gY29tcG9uZW50IGluZm9cbiAgICAgICAgdmFyIGNvbXBvbmVudEluZm8gPSB0aGlzLmZpbmRDb21wb25lbnRJbmZvKGluc3RhbmNlKTtcbiAgICAgICAgY29tcG9uZW50SW5mbyAmJiBjb21wb25lbnRJbmZvLnJlbW92ZUluc3RhbmNlKGluc3RhbmNlKTtcblxuICAgICAgICAvL3JlbW92ZSBmcm9tIHJlZ2lzdHJ5XG4gICAgICAgIGRlbGV0ZSB0aGlzLmFsbEluc3RhbmNlc1tpbnN0YW5jZS5pZGVudGl0eV07XG4gICAgICB9O1xuXG4gICAgICB0aGlzLnJlbW92ZUNvbXBvbmVudEluZm8gPSBmdW5jdGlvbihjb21wb25lbnRJbmZvKSB7XG4gICAgICAgIHZhciBpbmRleCA9IHRoaXMuY29tcG9uZW50cy5pbmRleE9mKGNvbXBvbmVudEluZm8pO1xuICAgICAgICAoaW5kZXggPiAtMSkgJiYgdGhpcy5jb21wb25lbnRzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLmZpbmRDb21wb25lbnRJbmZvID0gZnVuY3Rpb24od2hpY2gpIHtcbiAgICAgICAgdmFyIGNvbXBvbmVudCA9IHdoaWNoLmF0dGFjaFRvID8gd2hpY2ggOiB3aGljaC5jb25zdHJ1Y3RvcjtcblxuICAgICAgICBmb3IgKHZhciBpID0gMCwgYzsgYyA9IHRoaXMuY29tcG9uZW50c1tpXTsgaSsrKSB7XG4gICAgICAgICAgaWYgKGMuY29tcG9uZW50ID09PSBjb21wb25lbnQpIHtcbiAgICAgICAgICAgIHJldHVybiBjO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfTtcblxuICAgICAgdGhpcy5maW5kSW5zdGFuY2VJbmZvID0gZnVuY3Rpb24oaW5zdGFuY2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYWxsSW5zdGFuY2VzW2luc3RhbmNlLmlkZW50aXR5XSB8fCBudWxsO1xuICAgICAgfTtcblxuICAgICAgdGhpcy5nZXRCb3VuZEV2ZW50TmFtZXMgPSBmdW5jdGlvbihpbnN0YW5jZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5maW5kSW5zdGFuY2VJbmZvKGluc3RhbmNlKS5ldmVudHMubWFwKGZ1bmN0aW9uKGV2KSB7XG4gICAgICAgICAgcmV0dXJuIGV2LnR5cGU7XG4gICAgICAgIH0pO1xuICAgICAgfTtcblxuICAgICAgdGhpcy5maW5kSW5zdGFuY2VJbmZvQnlOb2RlID0gZnVuY3Rpb24obm9kZSkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICAgIE9iamVjdC5rZXlzKHRoaXMuYWxsSW5zdGFuY2VzKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgICB2YXIgdGhpc0luc3RhbmNlSW5mbyA9IHRoaXMuYWxsSW5zdGFuY2VzW2tdO1xuICAgICAgICAgIGlmICh0aGlzSW5zdGFuY2VJbmZvLmluc3RhbmNlLm5vZGUgPT09IG5vZGUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHRoaXNJbnN0YW5jZUluZm8pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLm9uID0gZnVuY3Rpb24oY29tcG9uZW50T24pIHtcbiAgICAgICAgdmFyIGluc3RhbmNlID0gcmVnaXN0cnkuZmluZEluc3RhbmNlSW5mbyh0aGlzKSwgYm91bmRDYWxsYmFjaztcblxuICAgICAgICAvLyB1bnBhY2tpbmcgYXJndW1lbnRzIGJ5IGhhbmQgYmVuY2htYXJrZWQgZmFzdGVyXG4gICAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aCwgaSA9IDE7XG4gICAgICAgIHZhciBvdGhlckFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuICAgICAgICBmb3IgKDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgIG90aGVyQXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5zdGFuY2UpIHtcbiAgICAgICAgICBib3VuZENhbGxiYWNrID0gY29tcG9uZW50T24uYXBwbHkobnVsbCwgb3RoZXJBcmdzKTtcbiAgICAgICAgICBpZiAoYm91bmRDYWxsYmFjaykge1xuICAgICAgICAgICAgb3RoZXJBcmdzW290aGVyQXJncy5sZW5ndGggLSAxXSA9IGJvdW5kQ2FsbGJhY2s7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBldmVudCA9IHBhcnNlRXZlbnRBcmdzKHRoaXMsIG90aGVyQXJncyk7XG4gICAgICAgICAgaW5zdGFuY2UuYWRkQmluZChldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHRoaXMub2ZmID0gZnVuY3Rpb24oLyplbCwgdHlwZSwgY2FsbGJhY2sqLykge1xuICAgICAgICB2YXIgZXZlbnQgPSBwYXJzZUV2ZW50QXJncyh0aGlzLCBhcmd1bWVudHMpLFxuICAgICAgICAgICAgaW5zdGFuY2UgPSByZWdpc3RyeS5maW5kSW5zdGFuY2VJbmZvKHRoaXMpO1xuXG4gICAgICAgIGlmIChpbnN0YW5jZSkge1xuICAgICAgICAgIGluc3RhbmNlLnJlbW92ZUJpbmQoZXZlbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9yZW1vdmUgZnJvbSBnbG9iYWwgZXZlbnQgcmVnaXN0cnlcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGU7IGUgPSByZWdpc3RyeS5ldmVudHNbaV07IGkrKykge1xuICAgICAgICAgIGlmIChtYXRjaEV2ZW50KGUsIGV2ZW50KSkge1xuICAgICAgICAgICAgcmVnaXN0cnkuZXZlbnRzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIGRlYnVnIHRvb2xzIG1heSB3YW50IHRvIGFkZCBhZHZpY2UgdG8gdHJpZ2dlclxuICAgICAgcmVnaXN0cnkudHJpZ2dlciA9IGZ1bmN0aW9uKCkge307XG5cbiAgICAgIHRoaXMudGVhcmRvd24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVnaXN0cnkucmVtb3ZlSW5zdGFuY2UodGhpcyk7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLndpdGhSZWdpc3RyYXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5hZnRlcignaW5pdGlhbGl6ZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJlZ2lzdHJ5LmFkZEluc3RhbmNlKHRoaXMpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmFyb3VuZCgnb24nLCByZWdpc3RyeS5vbik7XG4gICAgICAgIHRoaXMuYWZ0ZXIoJ29mZicsIHJlZ2lzdHJ5Lm9mZik7XG4gICAgICAgIC8vZGVidWcgdG9vbHMgbWF5IHdhbnQgdG8gYWRkIGFkdmljZSB0byB0cmlnZ2VyXG4gICAgICAgIHdpbmRvdy5ERUJVRyAmJiAoZmFsc2UpLmVuYWJsZWQgJiYgdGhpcy5hZnRlcigndHJpZ2dlcicsIHJlZ2lzdHJ5LnRyaWdnZXIpO1xuICAgICAgICB0aGlzLmFmdGVyKCd0ZWFyZG93bicsIHtvYmo6IHJlZ2lzdHJ5LCBmbk5hbWU6ICd0ZWFyZG93bid9KTtcbiAgICAgIH07XG5cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFJlZ2lzdHJ5O1xuICB9LmFwcGx5KGV4cG9ydHMsIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18pLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyAhPT0gdW5kZWZpbmVkICYmIChtb2R1bGUuZXhwb3J0cyA9IF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fKSk7XG5cblxuLyoqKi8gfSxcbi8qIDcgKi9cbi8qKiovIGZ1bmN0aW9uKG1vZHVsZSwgZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXykge1xuXG52YXIgX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXywgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX187LyogQ29weXJpZ2h0IDIwMTMgVHdpdHRlciwgSW5jLiBMaWNlbnNlZCB1bmRlciBUaGUgTUlUIExpY2Vuc2UuIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVQgKi9cblxuIShfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fID0gW19fd2VicGFja19yZXF1aXJlX18oNCldLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyA9IGZ1bmN0aW9uKGRlYnVnKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIERFRkFVTFRfSU5URVJWQUwgPSAxMDA7XG5cbiAgICBmdW5jdGlvbiBjYW5Xcml0ZVByb3RlY3QoKSB7XG4gICAgICB2YXIgd3JpdGVQcm90ZWN0U3VwcG9ydGVkID0gZGVidWcuZW5hYmxlZCAmJiAhT2JqZWN0LnByb3BlcnR5SXNFbnVtZXJhYmxlKCdnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3InKTtcbiAgICAgIGlmICh3cml0ZVByb3RlY3RTdXBwb3J0ZWQpIHtcbiAgICAgICAgLy9JRTggZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIGlzIGJ1aWx0LWluIGJ1dCB0aHJvd3MgZXhlcHRpb24gb24gbm9uIERPTSBvYmplY3RzXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihPYmplY3QsICdrZXlzJyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gd3JpdGVQcm90ZWN0U3VwcG9ydGVkO1xuICAgIH1cblxuICAgIHZhciB1dGlscyA9IHtcblxuICAgICAgaXNEb21PYmo6IGZ1bmN0aW9uKG9iaikge1xuICAgICAgICByZXR1cm4gISEob2JqLm5vZGVUeXBlIHx8IChvYmogPT09IHdpbmRvdykpO1xuICAgICAgfSxcblxuICAgICAgdG9BcnJheTogZnVuY3Rpb24ob2JqLCBmcm9tKSB7XG4gICAgICAgIGZyb20gPSBmcm9tIHx8IDA7XG4gICAgICAgIHZhciBsZW4gPSBvYmoubGVuZ3RoLCBhcnIgPSBuZXcgQXJyYXkobGVuIC0gZnJvbSk7XG4gICAgICAgIGZvciAodmFyIGkgPSBmcm9tOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICBhcnJbaSAtIGZyb21dID0gb2JqW2ldO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhcnI7XG4gICAgICB9LFxuXG4gICAgICAvLyByZXR1cm5zIG5ldyBvYmplY3QgcmVwcmVzZW50aW5nIG11bHRpcGxlIG9iamVjdHMgbWVyZ2VkIHRvZ2V0aGVyXG4gICAgICAvLyBvcHRpb25hbCBmaW5hbCBhcmd1bWVudCBpcyBib29sZWFuIHdoaWNoIHNwZWNpZmllcyBpZiBtZXJnZSBpcyByZWN1cnNpdmVcbiAgICAgIC8vIG9yaWdpbmFsIG9iamVjdHMgYXJlIHVubW9kaWZpZWRcbiAgICAgIC8vXG4gICAgICAvLyB1c2FnZTpcbiAgICAgIC8vICAgdmFyIGJhc2UgPSB7YToyLCBiOjZ9O1xuICAgICAgLy8gICB2YXIgZXh0cmEgPSB7YjozLCBjOjR9O1xuICAgICAgLy8gICBtZXJnZShiYXNlLCBleHRyYSk7IC8ve2E6MiwgYjozLCBjOjR9XG4gICAgICAvLyAgIGJhc2U7IC8ve2E6MiwgYjo2fVxuICAgICAgLy9cbiAgICAgIC8vICAgdmFyIGJhc2UgPSB7YToyLCBiOjZ9O1xuICAgICAgLy8gICB2YXIgZXh0cmEgPSB7YjozLCBjOjR9O1xuICAgICAgLy8gICB2YXIgZXh0cmFFeHRyYSA9IHthOjQsIGQ6OX07XG4gICAgICAvLyAgIG1lcmdlKGJhc2UsIGV4dHJhLCBleHRyYUV4dHJhKTsgLy97YTo0LCBiOjMsIGM6NC4gZDogOX1cbiAgICAgIC8vICAgYmFzZTsgLy97YToyLCBiOjZ9XG4gICAgICAvL1xuICAgICAgLy8gICB2YXIgYmFzZSA9IHthOjIsIGI6e2JiOjQsIGNjOjV9fTtcbiAgICAgIC8vICAgdmFyIGV4dHJhID0ge2E6NCwgYjp7Y2M6NywgZGQ6MX19O1xuICAgICAgLy8gICBtZXJnZShiYXNlLCBleHRyYSwgdHJ1ZSk7IC8ve2E6NCwgYjp7YmI6NCwgY2M6NywgZGQ6MX19XG4gICAgICAvLyAgIGJhc2U7IC8ve2E6MiwgYjp7YmI6NCwgY2M6NX19O1xuXG4gICAgICBtZXJnZTogZnVuY3Rpb24oLypvYmoxLCBvYmoyLC4uLi5kZWVwQ29weSovKSB7XG4gICAgICAgIC8vIHVucGFja2luZyBhcmd1bWVudHMgYnkgaGFuZCBiZW5jaG1hcmtlZCBmYXN0ZXJcbiAgICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoLFxuICAgICAgICAgICAgYXJncyA9IG5ldyBBcnJheShsICsgMSk7XG5cbiAgICAgICAgaWYgKGwgPT09IDApIHtcbiAgICAgICAgICByZXR1cm4ge307XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgIGFyZ3NbaSArIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9zdGFydCB3aXRoIGVtcHR5IG9iamVjdCBzbyBhIGNvcHkgaXMgY3JlYXRlZFxuICAgICAgICBhcmdzWzBdID0ge307XG5cbiAgICAgICAgaWYgKGFyZ3NbYXJncy5sZW5ndGggLSAxXSA9PT0gdHJ1ZSkge1xuICAgICAgICAgIC8vanF1ZXJ5IGV4dGVuZCByZXF1aXJlcyBkZWVwIGNvcHkgYXMgZmlyc3QgYXJnXG4gICAgICAgICAgYXJncy5wb3AoKTtcbiAgICAgICAgICBhcmdzLnVuc2hpZnQodHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gJC5leHRlbmQuYXBwbHkodW5kZWZpbmVkLCBhcmdzKTtcbiAgICAgIH0sXG5cbiAgICAgIC8vIHVwZGF0ZXMgYmFzZSBpbiBwbGFjZSBieSBjb3B5aW5nIHByb3BlcnRpZXMgb2YgZXh0cmEgdG8gaXRcbiAgICAgIC8vIG9wdGlvbmFsbHkgY2xvYmJlciBwcm90ZWN0ZWRcbiAgICAgIC8vIHVzYWdlOlxuICAgICAgLy8gICB2YXIgYmFzZSA9IHthOjIsIGI6Nn07XG4gICAgICAvLyAgIHZhciBleHRyYSA9IHtjOjR9O1xuICAgICAgLy8gICBwdXNoKGJhc2UsIGV4dHJhKTsgLy97YToyLCBiOjYsIGM6NH1cbiAgICAgIC8vICAgYmFzZTsgLy97YToyLCBiOjYsIGM6NH1cbiAgICAgIC8vXG4gICAgICAvLyAgIHZhciBiYXNlID0ge2E6MiwgYjo2fTtcbiAgICAgIC8vICAgdmFyIGV4dHJhID0ge2I6IDQgYzo0fTtcbiAgICAgIC8vICAgcHVzaChiYXNlLCBleHRyYSwgdHJ1ZSk7IC8vRXJyb3IgKFwidXRpbHMucHVzaCBhdHRlbXB0ZWQgdG8gb3ZlcndyaXRlICdiJyB3aGlsZSBydW5uaW5nIGluIHByb3RlY3RlZCBtb2RlXCIpXG4gICAgICAvLyAgIGJhc2U7IC8ve2E6MiwgYjo2fVxuICAgICAgLy9cbiAgICAgIC8vIG9iamVjdHMgd2l0aCB0aGUgc2FtZSBrZXkgd2lsbCBtZXJnZSByZWN1cnNpdmVseSB3aGVuIHByb3RlY3QgaXMgZmFsc2VcbiAgICAgIC8vIGVnOlxuICAgICAgLy8gdmFyIGJhc2UgPSB7YToxNiwgYjp7YmI6NCwgY2M6MTB9fTtcbiAgICAgIC8vIHZhciBleHRyYSA9IHtiOntjYzoyNSwgZGQ6MTl9LCBjOjV9O1xuICAgICAgLy8gcHVzaChiYXNlLCBleHRyYSk7IC8ve2E6MTYsIHtiYjo0LCBjYzoyNSwgZGQ6MTl9LCBjOjV9XG4gICAgICAvL1xuICAgICAgcHVzaDogZnVuY3Rpb24oYmFzZSwgZXh0cmEsIHByb3RlY3QpIHtcbiAgICAgICAgaWYgKGJhc2UpIHtcbiAgICAgICAgICBPYmplY3Qua2V5cyhleHRyYSB8fCB7fSkuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICAgIGlmIChiYXNlW2tleV0gJiYgcHJvdGVjdCkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3V0aWxzLnB1c2ggYXR0ZW1wdGVkIHRvIG92ZXJ3cml0ZSBcIicgKyBrZXkgKyAnXCIgd2hpbGUgcnVubmluZyBpbiBwcm90ZWN0ZWQgbW9kZScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZW9mIGJhc2Vba2V5XSA9PSAnb2JqZWN0JyAmJiB0eXBlb2YgZXh0cmFba2V5XSA9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAvLyByZWN1cnNlXG4gICAgICAgICAgICAgIHRoaXMucHVzaChiYXNlW2tleV0sIGV4dHJhW2tleV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gbm8gcHJvdGVjdCwgc28gZXh0cmEgd2luc1xuICAgICAgICAgICAgICBiYXNlW2tleV0gPSBleHRyYVtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJhc2U7XG4gICAgICB9LFxuXG4gICAgICAvLyBJZiBvYmoua2V5IHBvaW50cyB0byBhbiBlbnVtZXJhYmxlIHByb3BlcnR5LCByZXR1cm4gaXRzIHZhbHVlXG4gICAgICAvLyBJZiBvYmoua2V5IHBvaW50cyB0byBhIG5vbi1lbnVtZXJhYmxlIHByb3BlcnR5LCByZXR1cm4gdW5kZWZpbmVkXG4gICAgICBnZXRFbnVtZXJhYmxlUHJvcGVydHk6IGZ1bmN0aW9uKG9iaiwga2V5KSB7XG4gICAgICAgIHJldHVybiBvYmoucHJvcGVydHlJc0VudW1lcmFibGUoa2V5KSA/IG9ialtrZXldIDogdW5kZWZpbmVkO1xuICAgICAgfSxcblxuICAgICAgLy8gYnVpbGQgYSBmdW5jdGlvbiBmcm9tIG90aGVyIGZ1bmN0aW9uKHMpXG4gICAgICAvLyB1dGlscy5jb21wb3NlKGEsYixjKSAtPiBhKGIoYygpKSk7XG4gICAgICAvLyBpbXBsZW1lbnRhdGlvbiBsaWZ0ZWQgZnJvbSB1bmRlcnNjb3JlLmpzIChjKSAyMDA5LTIwMTIgSmVyZW15IEFzaGtlbmFzXG4gICAgICBjb21wb3NlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGZ1bmNzID0gYXJndW1lbnRzO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcblxuICAgICAgICAgIGZvciAodmFyIGkgPSBmdW5jcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgYXJncyA9IFtmdW5jc1tpXS5hcHBseSh0aGlzLCBhcmdzKV07XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIGFyZ3NbMF07XG4gICAgICAgIH07XG4gICAgICB9LFxuXG4gICAgICAvLyBDYW4gb25seSB1bmlxdWUgYXJyYXlzIG9mIGhvbW9nZW5lb3VzIHByaW1pdGl2ZXMsIGUuZy4gYW4gYXJyYXkgb2Ygb25seSBzdHJpbmdzLCBhbiBhcnJheSBvZiBvbmx5IGJvb2xlYW5zLCBvciBhbiBhcnJheSBvZiBvbmx5IG51bWVyaWNzXG4gICAgICB1bmlxdWVBcnJheTogZnVuY3Rpb24oYXJyYXkpIHtcbiAgICAgICAgdmFyIHUgPSB7fSwgYSA9IFtdO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gYXJyYXkubGVuZ3RoOyBpIDwgbDsgKytpKSB7XG4gICAgICAgICAgaWYgKHUuaGFzT3duUHJvcGVydHkoYXJyYXlbaV0pKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhLnB1c2goYXJyYXlbaV0pO1xuICAgICAgICAgIHVbYXJyYXlbaV1dID0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhO1xuICAgICAgfSxcblxuICAgICAgZGVib3VuY2U6IGZ1bmN0aW9uKGZ1bmMsIHdhaXQsIGltbWVkaWF0ZSkge1xuICAgICAgICBpZiAodHlwZW9mIHdhaXQgIT0gJ251bWJlcicpIHtcbiAgICAgICAgICB3YWl0ID0gREVGQVVMVF9JTlRFUlZBTDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB0aW1lb3V0LCByZXN1bHQ7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBjb250ZXh0ID0gdGhpcywgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgICAgICB2YXIgbGF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICAgICAgaWYgKCFpbW1lZGlhdGUpIHtcbiAgICAgICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICAgIHZhciBjYWxsTm93ID0gaW1tZWRpYXRlICYmICF0aW1lb3V0O1xuXG4gICAgICAgICAgdGltZW91dCAmJiBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQpO1xuXG4gICAgICAgICAgaWYgKGNhbGxOb3cpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfTtcbiAgICAgIH0sXG5cbiAgICAgIHRocm90dGxlOiBmdW5jdGlvbihmdW5jLCB3YWl0KSB7XG4gICAgICAgIGlmICh0eXBlb2Ygd2FpdCAhPSAnbnVtYmVyJykge1xuICAgICAgICAgIHdhaXQgPSBERUZBVUxUX0lOVEVSVkFMO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNvbnRleHQsIGFyZ3MsIHRpbWVvdXQsIHRocm90dGxpbmcsIG1vcmUsIHJlc3VsdDtcbiAgICAgICAgdmFyIHdoZW5Eb25lID0gdGhpcy5kZWJvdW5jZShmdW5jdGlvbigpIHtcbiAgICAgICAgICBtb3JlID0gdGhyb3R0bGluZyA9IGZhbHNlO1xuICAgICAgICB9LCB3YWl0KTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY29udGV4dCA9IHRoaXM7IGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICAgICAgdmFyIGxhdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgICAgIGlmIChtb3JlKSB7XG4gICAgICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGVuRG9uZSgpO1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICBpZiAoIXRpbWVvdXQpIHtcbiAgICAgICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAodGhyb3R0bGluZykge1xuICAgICAgICAgICAgbW9yZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm90dGxpbmcgPSB0cnVlO1xuICAgICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB3aGVuRG9uZSgpO1xuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH07XG4gICAgICB9LFxuXG4gICAgICBjb3VudFRoZW46IGZ1bmN0aW9uKG51bSwgYmFzZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKCEtLW51bSkgeyByZXR1cm4gYmFzZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpOyB9XG4gICAgICAgIH07XG4gICAgICB9LFxuXG4gICAgICBkZWxlZ2F0ZTogZnVuY3Rpb24ocnVsZXMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGUsIGRhdGEpIHtcbiAgICAgICAgICB2YXIgdGFyZ2V0ID0gJChlLnRhcmdldCksIHBhcmVudDtcblxuICAgICAgICAgIE9iamVjdC5rZXlzKHJ1bGVzKS5mb3JFYWNoKGZ1bmN0aW9uKHNlbGVjdG9yKSB7XG4gICAgICAgICAgICBpZiAoIWUuaXNQcm9wYWdhdGlvblN0b3BwZWQoKSAmJiAocGFyZW50ID0gdGFyZ2V0LmNsb3Nlc3Qoc2VsZWN0b3IpKS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgZGF0YSA9IGRhdGEgfHwge307XG4gICAgICAgICAgICAgIGUuY3VycmVudFRhcmdldCA9IGRhdGEuZWwgPSBwYXJlbnRbMF07XG4gICAgICAgICAgICAgIHJldHVybiBydWxlc1tzZWxlY3Rvcl0uYXBwbHkodGhpcywgW2UsIGRhdGFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgfTtcbiAgICAgIH0sXG5cbiAgICAgIC8vIGVuc3VyZXMgdGhhdCBhIGZ1bmN0aW9uIHdpbGwgb25seSBiZSBjYWxsZWQgb25jZS5cbiAgICAgIC8vIHVzYWdlOlxuICAgICAgLy8gd2lsbCBvbmx5IGNyZWF0ZSB0aGUgYXBwbGljYXRpb24gb25jZVxuICAgICAgLy8gICB2YXIgaW5pdGlhbGl6ZSA9IHV0aWxzLm9uY2UoY3JlYXRlQXBwbGljYXRpb24pXG4gICAgICAvLyAgICAgaW5pdGlhbGl6ZSgpO1xuICAgICAgLy8gICAgIGluaXRpYWxpemUoKTtcbiAgICAgIC8vXG4gICAgICAvLyB3aWxsIG9ubHkgZGVsZXRlIGEgcmVjb3JkIG9uY2VcbiAgICAgIC8vICAgdmFyIG15SGFubGRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vICAgICAkLmFqYXgoe3R5cGU6ICdERUxFVEUnLCB1cmw6ICdzb21ldXJsLmNvbScsIGRhdGE6IHtpZDogMX19KTtcbiAgICAgIC8vICAgfTtcbiAgICAgIC8vICAgdGhpcy5vbignY2xpY2snLCB1dGlscy5vbmNlKG15SGFuZGxlcikpO1xuICAgICAgLy9cbiAgICAgIG9uY2U6IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICAgICAgdmFyIHJhbiwgcmVzdWx0O1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAocmFuKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJhbiA9IHRydWU7XG4gICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfTtcbiAgICAgIH0sXG5cbiAgICAgIHByb3BlcnR5V3JpdGFiaWxpdHk6IGZ1bmN0aW9uKG9iaiwgcHJvcCwgd3JpdGFibGUpIHtcbiAgICAgICAgaWYgKGNhbldyaXRlUHJvdGVjdCgpICYmIG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIHByb3AsIHsgd3JpdGFibGU6IHdyaXRhYmxlIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvLyBQcm9wZXJ0eSBsb2NraW5nL3VubG9ja2luZ1xuICAgICAgbXV0YXRlUHJvcGVydHk6IGZ1bmN0aW9uKG9iaiwgcHJvcCwgb3ApIHtcbiAgICAgICAgdmFyIHdyaXRhYmxlO1xuXG4gICAgICAgIGlmICghY2FuV3JpdGVQcm90ZWN0KCkgfHwgIW9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgIG9wLmNhbGwob2JqKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB3cml0YWJsZSA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBwcm9wKS53cml0YWJsZTtcblxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBwcm9wLCB7IHdyaXRhYmxlOiB0cnVlIH0pO1xuICAgICAgICBvcC5jYWxsKG9iaik7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIHByb3AsIHsgd3JpdGFibGU6IHdyaXRhYmxlIH0pO1xuXG4gICAgICB9XG5cbiAgICB9O1xuXG4gICAgcmV0dXJuIHV0aWxzO1xuICB9LmFwcGx5KGV4cG9ydHMsIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18pLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyAhPT0gdW5kZWZpbmVkICYmIChtb2R1bGUuZXhwb3J0cyA9IF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fKSk7XG5cblxuLyoqKi8gfSxcbi8qIDggKi9cbi8qKiovIGZ1bmN0aW9uKG1vZHVsZSwgZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXykge1xuXG52YXIgX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXywgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX187LyogQ29weXJpZ2h0IDIwMTMgVHdpdHRlciwgSW5jLiBMaWNlbnNlZCB1bmRlciBUaGUgTUlUIExpY2Vuc2UuIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVQgKi9cblxuIShfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fID0gW1xuICAgIF9fd2VicGFja19yZXF1aXJlX18oNyksXG4gICAgX193ZWJwYWNrX3JlcXVpcmVfXyg2KSxcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDQpXG4gIF0sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fID0gZnVuY3Rpb24odXRpbHMsIHJlZ2lzdHJ5LCBkZWJ1Zykge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIC8vIGNvbW1vbiBtaXhpbiBhbGxvY2F0ZXMgYmFzaWMgZnVuY3Rpb25hbGl0eSAtIHVzZWQgYnkgYWxsIGNvbXBvbmVudCBwcm90b3R5cGVzXG4gICAgLy8gY2FsbGJhY2sgY29udGV4dCBpcyBib3VuZCB0byBjb21wb25lbnRcbiAgICB2YXIgY29tcG9uZW50SWQgPSAwO1xuXG4gICAgZnVuY3Rpb24gdGVhcmRvd25JbnN0YW5jZShpbnN0YW5jZUluZm8pIHtcbiAgICAgIGluc3RhbmNlSW5mby5ldmVudHMuc2xpY2UoKS5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIHZhciBhcmdzID0gW2V2ZW50LnR5cGVdO1xuXG4gICAgICAgIGV2ZW50LmVsZW1lbnQgJiYgYXJncy51bnNoaWZ0KGV2ZW50LmVsZW1lbnQpO1xuICAgICAgICAodHlwZW9mIGV2ZW50LmNhbGxiYWNrID09ICdmdW5jdGlvbicpICYmIGFyZ3MucHVzaChldmVudC5jYWxsYmFjayk7XG5cbiAgICAgICAgdGhpcy5vZmYuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICB9LCBpbnN0YW5jZUluZm8uaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNoZWNrU2VyaWFsaXphYmxlKHR5cGUsIGRhdGEpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZShkYXRhLCAnKicpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBkZWJ1Zy53YXJuLmNhbGwodGhpcywgW1xuICAgICAgICAgICdFdmVudCBcIicsIHR5cGUsICdcIiB3YXMgdHJpZ2dlcmVkIHdpdGggbm9uLXNlcmlhbGl6YWJsZSBkYXRhLiAnLFxuICAgICAgICAgICdGbGlnaHQgcmVjb21tZW5kcyB5b3UgYXZvaWQgcGFzc2luZyBub24tc2VyaWFsaXphYmxlIGRhdGEgaW4gZXZlbnRzLidcbiAgICAgICAgXS5qb2luKCcnKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gd2FybkFib3V0UmVmZXJlbmNlVHlwZShrZXkpIHtcbiAgICAgIGRlYnVnLndhcm4uY2FsbCh0aGlzLCBbXG4gICAgICAgICdBdHRyaWJ1dGUgXCInLCBrZXksICdcIiBkZWZhdWx0cyB0byBhbiBhcnJheSBvciBvYmplY3QuICcsXG4gICAgICAgICdFbmNsb3NlIHRoaXMgaW4gYSBmdW5jdGlvbiB0byBhdm9pZCBzaGFyaW5nIGJldHdlZW4gY29tcG9uZW50IGluc3RhbmNlcy4nXG4gICAgICBdLmpvaW4oJycpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbml0QXR0cmlidXRlcyhhdHRycykge1xuICAgICAgdmFyIGRlZmluZWRLZXlzID0gW10sIGluY29taW5nS2V5cztcblxuICAgICAgdGhpcy5hdHRyID0gbmV3IHRoaXMuYXR0ckRlZjtcblxuICAgICAgaWYgKGRlYnVnLmVuYWJsZWQgJiYgd2luZG93LmNvbnNvbGUpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMuYXR0ckRlZi5wcm90b3R5cGUpIHtcbiAgICAgICAgICBkZWZpbmVkS2V5cy5wdXNoKGtleSk7XG4gICAgICAgIH1cbiAgICAgICAgaW5jb21pbmdLZXlzID0gT2JqZWN0LmtleXMoYXR0cnMpO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSBpbmNvbWluZ0tleXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICBpZiAoZGVmaW5lZEtleXMuaW5kZXhPZihpbmNvbWluZ0tleXNbaV0pID09IC0xKSB7XG4gICAgICAgICAgICBkZWJ1Zy53YXJuLmNhbGwodGhpcywgJ1Bhc3NlZCB1bnVzZWQgYXR0cmlidXRlIFwiJyArIGluY29taW5nS2V5c1tpXSArICdcIi4nKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5hdHRyRGVmLnByb3RvdHlwZSkge1xuICAgICAgICBpZiAodHlwZW9mIGF0dHJzW2tleV0gPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBpZiAodGhpcy5hdHRyW2tleV0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignUmVxdWlyZWQgYXR0cmlidXRlIFwiJyArIGtleSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1wiIG5vdCBzcGVjaWZpZWQgaW4gYXR0YWNoVG8gZm9yIGNvbXBvbmVudCBcIicgKyB0aGlzLnRvU3RyaW5nKCkgKyAnXCIuJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFdhcm4gYWJvdXQgcmVmZXJlbmNlIHR5cGVzIGluIGF0dHJpYnV0ZXNcbiAgICAgICAgICBpZiAoZGVidWcuZW5hYmxlZCAmJiB0eXBlb2YgdGhpcy5hdHRyW2tleV0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB3YXJuQWJvdXRSZWZlcmVuY2VUeXBlLmNhbGwodGhpcywga2V5KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5hdHRyW2tleV0gPSBhdHRyc1trZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmF0dHJba2V5XSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhpcy5hdHRyW2tleV0gPSB0aGlzLmF0dHJba2V5XS5jYWxsKHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbml0RGVwcmVjYXRlZEF0dHJpYnV0ZXMoYXR0cnMpIHtcbiAgICAgIC8vIG1lcmdlIGRlZmF1bHRzIHdpdGggc3VwcGxpZWQgb3B0aW9uc1xuICAgICAgLy8gcHV0IG9wdGlvbnMgaW4gYXR0ci5fX3Byb3RvX18gdG8gYXZvaWQgbWVyZ2Ugb3ZlcmhlYWRcbiAgICAgIHZhciBhdHRyID0gT2JqZWN0LmNyZWF0ZShhdHRycyk7XG5cbiAgICAgIGZvciAodmFyIGtleSBpbiB0aGlzLmRlZmF1bHRzKSB7XG4gICAgICAgIGlmICghYXR0cnMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgIGF0dHJba2V5XSA9IHRoaXMuZGVmYXVsdHNba2V5XTtcbiAgICAgICAgICAvLyBXYXJuIGFib3V0IHJlZmVyZW5jZSB0eXBlcyBpbiBkZWZhdWx0QXR0cnNcbiAgICAgICAgICBpZiAoZGVidWcuZW5hYmxlZCAmJiB0eXBlb2YgdGhpcy5kZWZhdWx0c1trZXldID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgd2FybkFib3V0UmVmZXJlbmNlVHlwZS5jYWxsKHRoaXMsIGtleSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMuYXR0ciA9IGF0dHI7XG5cbiAgICAgIE9iamVjdC5rZXlzKHRoaXMuZGVmYXVsdHMgfHwge30pLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIGlmICh0aGlzLmRlZmF1bHRzW2tleV0gPT09IG51bGwgJiYgdGhpcy5hdHRyW2tleV0gPT09IG51bGwpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlcXVpcmVkIGF0dHJpYnV0ZSBcIicgKyBrZXkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnXCIgbm90IHNwZWNpZmllZCBpbiBhdHRhY2hUbyBmb3IgY29tcG9uZW50IFwiJyArIHRoaXMudG9TdHJpbmcoKSArICdcIi4nKTtcbiAgICAgICAgfVxuICAgICAgfSwgdGhpcyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcHJveHlFdmVudFRvKHRhcmdldEV2ZW50KSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24oZSwgZGF0YSkge1xuICAgICAgICAkKGUudGFyZ2V0KS50cmlnZ2VyKHRhcmdldEV2ZW50LCBkYXRhKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gd2l0aEJhc2UoKSB7XG5cbiAgICAgIC8vIGRlbGVnYXRlIHRyaWdnZXIsIGJpbmQgYW5kIHVuYmluZCB0byBhbiBlbGVtZW50XG4gICAgICAvLyBpZiAkZWxlbWVudCBub3Qgc3VwcGxpZWQsIHVzZSBjb21wb25lbnQncyBub2RlXG4gICAgICAvLyBvdGhlciBhcmd1bWVudHMgYXJlIHBhc3NlZCBvblxuICAgICAgLy8gZXZlbnQgY2FuIGJlIGVpdGhlciBhIHN0cmluZyBzcGVjaWZ5aW5nIHRoZSB0eXBlXG4gICAgICAvLyBvZiB0aGUgZXZlbnQsIG9yIGEgaGFzaCBzcGVjaWZ5aW5nIGJvdGggdGhlIHR5cGVcbiAgICAgIC8vIGFuZCBhIGRlZmF1bHQgZnVuY3Rpb24gdG8gYmUgY2FsbGVkLlxuICAgICAgdGhpcy50cmlnZ2VyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciAkZWxlbWVudCwgdHlwZSwgZGF0YSwgZXZlbnQsIGRlZmF1bHRGbjtcbiAgICAgICAgdmFyIGxhc3RJbmRleCA9IGFyZ3VtZW50cy5sZW5ndGggLSAxLCBsYXN0QXJnID0gYXJndW1lbnRzW2xhc3RJbmRleF07XG5cbiAgICAgICAgaWYgKHR5cGVvZiBsYXN0QXJnICE9ICdzdHJpbmcnICYmICEobGFzdEFyZyAmJiBsYXN0QXJnLmRlZmF1bHRCZWhhdmlvcikpIHtcbiAgICAgICAgICBsYXN0SW5kZXgtLTtcbiAgICAgICAgICBkYXRhID0gbGFzdEFyZztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsYXN0SW5kZXggPT0gMSkge1xuICAgICAgICAgICRlbGVtZW50ID0gJChhcmd1bWVudHNbMF0pO1xuICAgICAgICAgIGV2ZW50ID0gYXJndW1lbnRzWzFdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICRlbGVtZW50ID0gdGhpcy4kbm9kZTtcbiAgICAgICAgICBldmVudCA9IGFyZ3VtZW50c1swXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudC5kZWZhdWx0QmVoYXZpb3IpIHtcbiAgICAgICAgICBkZWZhdWx0Rm4gPSBldmVudC5kZWZhdWx0QmVoYXZpb3I7XG4gICAgICAgICAgZXZlbnQgPSAkLkV2ZW50KGV2ZW50LnR5cGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdHlwZSA9IGV2ZW50LnR5cGUgfHwgZXZlbnQ7XG5cbiAgICAgICAgaWYgKGRlYnVnLmVuYWJsZWQgJiYgd2luZG93LnBvc3RNZXNzYWdlKSB7XG4gICAgICAgICAgY2hlY2tTZXJpYWxpemFibGUuY2FsbCh0aGlzLCB0eXBlLCBkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5hdHRyLmV2ZW50RGF0YSA9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIGRhdGEgPSAkLmV4dGVuZCh0cnVlLCB7fSwgdGhpcy5hdHRyLmV2ZW50RGF0YSwgZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICAkZWxlbWVudC50cmlnZ2VyKChldmVudCB8fCB0eXBlKSwgZGF0YSk7XG5cbiAgICAgICAgaWYgKGRlZmF1bHRGbiAmJiAhZXZlbnQuaXNEZWZhdWx0UHJldmVudGVkKCkpIHtcbiAgICAgICAgICAodGhpc1tkZWZhdWx0Rm5dIHx8IGRlZmF1bHRGbikuY2FsbCh0aGlzLCBldmVudCwgZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gJGVsZW1lbnQ7XG4gICAgICB9O1xuXG5cbiAgICAgIHRoaXMub24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyICRlbGVtZW50LCB0eXBlLCBjYWxsYmFjaywgb3JpZ2luYWxDYjtcbiAgICAgICAgdmFyIGxhc3RJbmRleCA9IGFyZ3VtZW50cy5sZW5ndGggLSAxLCBvcmlnaW4gPSBhcmd1bWVudHNbbGFzdEluZGV4XTtcblxuICAgICAgICBpZiAodHlwZW9mIG9yaWdpbiA9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIC8vZGVsZWdhdGUgY2FsbGJhY2tcbiAgICAgICAgICBvcmlnaW5hbENiID0gdXRpbHMuZGVsZWdhdGUoXG4gICAgICAgICAgICB0aGlzLnJlc29sdmVEZWxlZ2F0ZVJ1bGVzKG9yaWdpbilcbiAgICAgICAgICApO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBvcmlnaW4gPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBvcmlnaW5hbENiID0gcHJveHlFdmVudFRvKG9yaWdpbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb3JpZ2luYWxDYiA9IG9yaWdpbjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsYXN0SW5kZXggPT0gMikge1xuICAgICAgICAgICRlbGVtZW50ID0gJChhcmd1bWVudHNbMF0pO1xuICAgICAgICAgIHR5cGUgPSBhcmd1bWVudHNbMV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgJGVsZW1lbnQgPSB0aGlzLiRub2RlO1xuICAgICAgICAgIHR5cGUgPSBhcmd1bWVudHNbMF07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIG9yaWdpbmFsQ2IgIT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2Ygb3JpZ2luYWxDYiAhPSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIGJpbmQgdG8gXCInICsgdHlwZSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICdcIiBiZWNhdXNlIHRoZSBnaXZlbiBjYWxsYmFjayBpcyBub3QgYSBmdW5jdGlvbiBvciBhbiBvYmplY3QnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhbGxiYWNrID0gb3JpZ2luYWxDYi5iaW5kKHRoaXMpO1xuICAgICAgICBjYWxsYmFjay50YXJnZXQgPSBvcmlnaW5hbENiO1xuICAgICAgICBjYWxsYmFjay5jb250ZXh0ID0gdGhpcztcblxuICAgICAgICAkZWxlbWVudC5vbih0eXBlLCBjYWxsYmFjayk7XG5cbiAgICAgICAgLy8gc3RvcmUgZXZlcnkgYm91bmQgdmVyc2lvbiBvZiB0aGUgY2FsbGJhY2tcbiAgICAgICAgb3JpZ2luYWxDYi5ib3VuZCB8fCAob3JpZ2luYWxDYi5ib3VuZCA9IFtdKTtcbiAgICAgICAgb3JpZ2luYWxDYi5ib3VuZC5wdXNoKGNhbGxiYWNrKTtcblxuICAgICAgICByZXR1cm4gY2FsbGJhY2s7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLm9mZiA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgJGVsZW1lbnQsIHR5cGUsIGNhbGxiYWNrO1xuICAgICAgICB2YXIgbGFzdEluZGV4ID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBhcmd1bWVudHNbbGFzdEluZGV4XSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgY2FsbGJhY2sgPSBhcmd1bWVudHNbbGFzdEluZGV4XTtcbiAgICAgICAgICBsYXN0SW5kZXggLT0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsYXN0SW5kZXggPT0gMSkge1xuICAgICAgICAgICRlbGVtZW50ID0gJChhcmd1bWVudHNbMF0pO1xuICAgICAgICAgIHR5cGUgPSBhcmd1bWVudHNbMV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgJGVsZW1lbnQgPSB0aGlzLiRub2RlO1xuICAgICAgICAgIHR5cGUgPSBhcmd1bWVudHNbMF07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAvL3RoaXMgY2FsbGJhY2sgbWF5IGJlIHRoZSBvcmlnaW5hbCBmdW5jdGlvbiBvciBhIGJvdW5kIHZlcnNpb25cbiAgICAgICAgICB2YXIgYm91bmRGdW5jdGlvbnMgPSBjYWxsYmFjay50YXJnZXQgPyBjYWxsYmFjay50YXJnZXQuYm91bmQgOiBjYWxsYmFjay5ib3VuZCB8fCBbXTtcbiAgICAgICAgICAvL3NldCBjYWxsYmFjayB0byB2ZXJzaW9uIGJvdW5kIGFnYWluc3QgdGhpcyBpbnN0YW5jZVxuICAgICAgICAgIGJvdW5kRnVuY3Rpb25zICYmIGJvdW5kRnVuY3Rpb25zLnNvbWUoZnVuY3Rpb24oZm4sIGksIGFycikge1xuICAgICAgICAgICAgaWYgKGZuLmNvbnRleHQgJiYgKHRoaXMuaWRlbnRpdHkgPT0gZm4uY29udGV4dC5pZGVudGl0eSkpIHtcbiAgICAgICAgICAgICAgYXJyLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgY2FsbGJhY2sgPSBmbjtcbiAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgICAgJGVsZW1lbnQub2ZmKHR5cGUsIGNhbGxiYWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBMb29wIHRocm91Z2ggdGhlIGV2ZW50cyBvZiBgdGhpc2AgaW5zdGFuY2VcbiAgICAgICAgICAvLyBhbmQgdW5iaW5kIHVzaW5nIHRoZSBjYWxsYmFja1xuICAgICAgICAgIHJlZ2lzdHJ5LmZpbmRJbnN0YW5jZUluZm8odGhpcykuZXZlbnRzLmZvckVhY2goZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgICBpZiAodHlwZSA9PSBldmVudC50eXBlKSB7XG4gICAgICAgICAgICAgICRlbGVtZW50Lm9mZih0eXBlLCBldmVudC5jYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gJGVsZW1lbnQ7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLnJlc29sdmVEZWxlZ2F0ZVJ1bGVzID0gZnVuY3Rpb24ocnVsZUluZm8pIHtcbiAgICAgICAgdmFyIHJ1bGVzID0ge307XG5cbiAgICAgICAgT2JqZWN0LmtleXMocnVsZUluZm8pLmZvckVhY2goZnVuY3Rpb24ocikge1xuICAgICAgICAgIGlmICghKHIgaW4gdGhpcy5hdHRyKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb21wb25lbnQgXCInICsgdGhpcy50b1N0cmluZygpICsgJ1wiIHdhbnRzIHRvIGxpc3RlbiBvbiBcIicgKyByICsgJ1wiIGJ1dCBubyBzdWNoIGF0dHJpYnV0ZSB3YXMgZGVmaW5lZC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcnVsZXNbdGhpcy5hdHRyW3JdXSA9ICh0eXBlb2YgcnVsZUluZm9bcl0gPT0gJ3N0cmluZycpID8gcHJveHlFdmVudFRvKHJ1bGVJbmZvW3JdKSA6IHJ1bGVJbmZvW3JdO1xuICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICByZXR1cm4gcnVsZXM7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLnNlbGVjdCA9IGZ1bmN0aW9uKGF0dHJpYnV0ZUtleSkge1xuICAgICAgICByZXR1cm4gdGhpcy4kbm9kZS5maW5kKHRoaXMuYXR0clthdHRyaWJ1dGVLZXldKTtcbiAgICAgIH07XG5cbiAgICAgIC8vIE5ldy1zdHlsZSBhdHRyaWJ1dGVzXG5cbiAgICAgIHRoaXMuYXR0cmlidXRlcyA9IGZ1bmN0aW9uKGF0dHJzKSB7XG5cbiAgICAgICAgdmFyIEF0dHJpYnV0ZXMgPSBmdW5jdGlvbigpIHt9O1xuXG4gICAgICAgIGlmICh0aGlzLmF0dHJEZWYpIHtcbiAgICAgICAgICBBdHRyaWJ1dGVzLnByb3RvdHlwZSA9IG5ldyB0aGlzLmF0dHJEZWY7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBuYW1lIGluIGF0dHJzKSB7XG4gICAgICAgICAgQXR0cmlidXRlcy5wcm90b3R5cGVbbmFtZV0gPSBhdHRyc1tuYW1lXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYXR0ckRlZiA9IEF0dHJpYnV0ZXM7XG4gICAgICB9O1xuXG4gICAgICAvLyBEZXByZWNhdGVkIGF0dHJpYnV0ZXNcblxuICAgICAgdGhpcy5kZWZhdWx0QXR0cnMgPSBmdW5jdGlvbihkZWZhdWx0cykge1xuICAgICAgICB1dGlscy5wdXNoKHRoaXMuZGVmYXVsdHMsIGRlZmF1bHRzLCB0cnVlKSB8fCAodGhpcy5kZWZhdWx0cyA9IGRlZmF1bHRzKTtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uKG5vZGUsIGF0dHJzKSB7XG4gICAgICAgIGF0dHJzID0gYXR0cnMgfHwge307XG4gICAgICAgIHRoaXMuaWRlbnRpdHkgfHwgKHRoaXMuaWRlbnRpdHkgPSBjb21wb25lbnRJZCsrKTtcblxuICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbXBvbmVudCBuZWVkcyBhIG5vZGUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLmpxdWVyeSkge1xuICAgICAgICAgIHRoaXMubm9kZSA9IG5vZGVbMF07XG4gICAgICAgICAgdGhpcy4kbm9kZSA9IG5vZGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5ub2RlID0gbm9kZTtcbiAgICAgICAgICB0aGlzLiRub2RlID0gJChub2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmF0dHJEZWYpIHtcbiAgICAgICAgICBpbml0QXR0cmlidXRlcy5jYWxsKHRoaXMsIGF0dHJzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpbml0RGVwcmVjYXRlZEF0dHJpYnV0ZXMuY2FsbCh0aGlzLCBhdHRycyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH07XG5cbiAgICAgIHRoaXMudGVhcmRvd24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGVhcmRvd25JbnN0YW5jZShyZWdpc3RyeS5maW5kSW5zdGFuY2VJbmZvKHRoaXMpKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHdpdGhCYXNlO1xuICB9LmFwcGx5KGV4cG9ydHMsIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18pLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyAhPT0gdW5kZWZpbmVkICYmIChtb2R1bGUuZXhwb3J0cyA9IF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fKSk7XG5cblxuLyoqKi8gfVxuLyoqKioqKi8gXSlcbn0pO1xuIiwiLypcbiAqICBDb3B5cmlnaHQgMjAxMSBUd2l0dGVyLCBJbmMuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqICB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiAgWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqICBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiAgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqICBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4oZnVuY3Rpb24gKEhvZ2FuKSB7XG4gIC8vIFNldHVwIHJlZ2V4ICBhc3NpZ25tZW50c1xuICAvLyByZW1vdmUgd2hpdGVzcGFjZSBhY2NvcmRpbmcgdG8gTXVzdGFjaGUgc3BlY1xuICB2YXIgcklzV2hpdGVzcGFjZSA9IC9cXFMvLFxuICAgICAgclF1b3QgPSAvXFxcIi9nLFxuICAgICAgck5ld2xpbmUgPSAgL1xcbi9nLFxuICAgICAgckNyID0gL1xcci9nLFxuICAgICAgclNsYXNoID0gL1xcXFwvZyxcbiAgICAgIHJMaW5lU2VwID0gL1xcdTIwMjgvLFxuICAgICAgclBhcmFncmFwaFNlcCA9IC9cXHUyMDI5LztcblxuICBIb2dhbi50YWdzID0ge1xuICAgICcjJzogMSwgJ14nOiAyLCAnPCc6IDMsICckJzogNCxcbiAgICAnLyc6IDUsICchJzogNiwgJz4nOiA3LCAnPSc6IDgsICdfdic6IDksXG4gICAgJ3snOiAxMCwgJyYnOiAxMSwgJ190JzogMTJcbiAgfTtcblxuICBIb2dhbi5zY2FuID0gZnVuY3Rpb24gc2Nhbih0ZXh0LCBkZWxpbWl0ZXJzKSB7XG4gICAgdmFyIGxlbiA9IHRleHQubGVuZ3RoLFxuICAgICAgICBJTl9URVhUID0gMCxcbiAgICAgICAgSU5fVEFHX1RZUEUgPSAxLFxuICAgICAgICBJTl9UQUcgPSAyLFxuICAgICAgICBzdGF0ZSA9IElOX1RFWFQsXG4gICAgICAgIHRhZ1R5cGUgPSBudWxsLFxuICAgICAgICB0YWcgPSBudWxsLFxuICAgICAgICBidWYgPSAnJyxcbiAgICAgICAgdG9rZW5zID0gW10sXG4gICAgICAgIHNlZW5UYWcgPSBmYWxzZSxcbiAgICAgICAgaSA9IDAsXG4gICAgICAgIGxpbmVTdGFydCA9IDAsXG4gICAgICAgIG90YWcgPSAne3snLFxuICAgICAgICBjdGFnID0gJ319JztcblxuICAgIGZ1bmN0aW9uIGFkZEJ1ZigpIHtcbiAgICAgIGlmIChidWYubGVuZ3RoID4gMCkge1xuICAgICAgICB0b2tlbnMucHVzaCh7dGFnOiAnX3QnLCB0ZXh0OiBuZXcgU3RyaW5nKGJ1Zil9KTtcbiAgICAgICAgYnVmID0gJyc7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGluZUlzV2hpdGVzcGFjZSgpIHtcbiAgICAgIHZhciBpc0FsbFdoaXRlc3BhY2UgPSB0cnVlO1xuICAgICAgZm9yICh2YXIgaiA9IGxpbmVTdGFydDsgaiA8IHRva2Vucy5sZW5ndGg7IGorKykge1xuICAgICAgICBpc0FsbFdoaXRlc3BhY2UgPVxuICAgICAgICAgIChIb2dhbi50YWdzW3Rva2Vuc1tqXS50YWddIDwgSG9nYW4udGFnc1snX3YnXSkgfHxcbiAgICAgICAgICAodG9rZW5zW2pdLnRhZyA9PSAnX3QnICYmIHRva2Vuc1tqXS50ZXh0Lm1hdGNoKHJJc1doaXRlc3BhY2UpID09PSBudWxsKTtcbiAgICAgICAgaWYgKCFpc0FsbFdoaXRlc3BhY2UpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGlzQWxsV2hpdGVzcGFjZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmaWx0ZXJMaW5lKGhhdmVTZWVuVGFnLCBub05ld0xpbmUpIHtcbiAgICAgIGFkZEJ1ZigpO1xuXG4gICAgICBpZiAoaGF2ZVNlZW5UYWcgJiYgbGluZUlzV2hpdGVzcGFjZSgpKSB7XG4gICAgICAgIGZvciAodmFyIGogPSBsaW5lU3RhcnQsIG5leHQ7IGogPCB0b2tlbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBpZiAodG9rZW5zW2pdLnRleHQpIHtcbiAgICAgICAgICAgIGlmICgobmV4dCA9IHRva2Vuc1tqKzFdKSAmJiBuZXh0LnRhZyA9PSAnPicpIHtcbiAgICAgICAgICAgICAgLy8gc2V0IGluZGVudCB0byB0b2tlbiB2YWx1ZVxuICAgICAgICAgICAgICBuZXh0LmluZGVudCA9IHRva2Vuc1tqXS50ZXh0LnRvU3RyaW5nKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRva2Vucy5zcGxpY2UoaiwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCFub05ld0xpbmUpIHtcbiAgICAgICAgdG9rZW5zLnB1c2goe3RhZzonXFxuJ30pO1xuICAgICAgfVxuXG4gICAgICBzZWVuVGFnID0gZmFsc2U7XG4gICAgICBsaW5lU3RhcnQgPSB0b2tlbnMubGVuZ3RoO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNoYW5nZURlbGltaXRlcnModGV4dCwgaW5kZXgpIHtcbiAgICAgIHZhciBjbG9zZSA9ICc9JyArIGN0YWcsXG4gICAgICAgICAgY2xvc2VJbmRleCA9IHRleHQuaW5kZXhPZihjbG9zZSwgaW5kZXgpLFxuICAgICAgICAgIGRlbGltaXRlcnMgPSB0cmltKFxuICAgICAgICAgICAgdGV4dC5zdWJzdHJpbmcodGV4dC5pbmRleE9mKCc9JywgaW5kZXgpICsgMSwgY2xvc2VJbmRleClcbiAgICAgICAgICApLnNwbGl0KCcgJyk7XG5cbiAgICAgIG90YWcgPSBkZWxpbWl0ZXJzWzBdO1xuICAgICAgY3RhZyA9IGRlbGltaXRlcnNbZGVsaW1pdGVycy5sZW5ndGggLSAxXTtcblxuICAgICAgcmV0dXJuIGNsb3NlSW5kZXggKyBjbG9zZS5sZW5ndGggLSAxO1xuICAgIH1cblxuICAgIGlmIChkZWxpbWl0ZXJzKSB7XG4gICAgICBkZWxpbWl0ZXJzID0gZGVsaW1pdGVycy5zcGxpdCgnICcpO1xuICAgICAgb3RhZyA9IGRlbGltaXRlcnNbMF07XG4gICAgICBjdGFnID0gZGVsaW1pdGVyc1sxXTtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGlmIChzdGF0ZSA9PSBJTl9URVhUKSB7XG4gICAgICAgIGlmICh0YWdDaGFuZ2Uob3RhZywgdGV4dCwgaSkpIHtcbiAgICAgICAgICAtLWk7XG4gICAgICAgICAgYWRkQnVmKCk7XG4gICAgICAgICAgc3RhdGUgPSBJTl9UQUdfVFlQRTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAodGV4dC5jaGFyQXQoaSkgPT0gJ1xcbicpIHtcbiAgICAgICAgICAgIGZpbHRlckxpbmUoc2VlblRhZyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJ1ZiArPSB0ZXh0LmNoYXJBdChpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoc3RhdGUgPT0gSU5fVEFHX1RZUEUpIHtcbiAgICAgICAgaSArPSBvdGFnLmxlbmd0aCAtIDE7XG4gICAgICAgIHRhZyA9IEhvZ2FuLnRhZ3NbdGV4dC5jaGFyQXQoaSArIDEpXTtcbiAgICAgICAgdGFnVHlwZSA9IHRhZyA/IHRleHQuY2hhckF0KGkgKyAxKSA6ICdfdic7XG4gICAgICAgIGlmICh0YWdUeXBlID09ICc9Jykge1xuICAgICAgICAgIGkgPSBjaGFuZ2VEZWxpbWl0ZXJzKHRleHQsIGkpO1xuICAgICAgICAgIHN0YXRlID0gSU5fVEVYVDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAodGFnKSB7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgfVxuICAgICAgICAgIHN0YXRlID0gSU5fVEFHO1xuICAgICAgICB9XG4gICAgICAgIHNlZW5UYWcgPSBpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRhZ0NoYW5nZShjdGFnLCB0ZXh0LCBpKSkge1xuICAgICAgICAgIHRva2Vucy5wdXNoKHt0YWc6IHRhZ1R5cGUsIG46IHRyaW0oYnVmKSwgb3RhZzogb3RhZywgY3RhZzogY3RhZyxcbiAgICAgICAgICAgICAgICAgICAgICAgaTogKHRhZ1R5cGUgPT0gJy8nKSA/IHNlZW5UYWcgLSBvdGFnLmxlbmd0aCA6IGkgKyBjdGFnLmxlbmd0aH0pO1xuICAgICAgICAgIGJ1ZiA9ICcnO1xuICAgICAgICAgIGkgKz0gY3RhZy5sZW5ndGggLSAxO1xuICAgICAgICAgIHN0YXRlID0gSU5fVEVYVDtcbiAgICAgICAgICBpZiAodGFnVHlwZSA9PSAneycpIHtcbiAgICAgICAgICAgIGlmIChjdGFnID09ICd9fScpIHtcbiAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY2xlYW5UcmlwbGVTdGFjaGUodG9rZW5zW3Rva2Vucy5sZW5ndGggLSAxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJ1ZiArPSB0ZXh0LmNoYXJBdChpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGZpbHRlckxpbmUoc2VlblRhZywgdHJ1ZSk7XG5cbiAgICByZXR1cm4gdG9rZW5zO1xuICB9XG5cbiAgZnVuY3Rpb24gY2xlYW5UcmlwbGVTdGFjaGUodG9rZW4pIHtcbiAgICBpZiAodG9rZW4ubi5zdWJzdHIodG9rZW4ubi5sZW5ndGggLSAxKSA9PT0gJ30nKSB7XG4gICAgICB0b2tlbi5uID0gdG9rZW4ubi5zdWJzdHJpbmcoMCwgdG9rZW4ubi5sZW5ndGggLSAxKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB0cmltKHMpIHtcbiAgICBpZiAocy50cmltKSB7XG4gICAgICByZXR1cm4gcy50cmltKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHMucmVwbGFjZSgvXlxccyp8XFxzKiQvZywgJycpO1xuICB9XG5cbiAgZnVuY3Rpb24gdGFnQ2hhbmdlKHRhZywgdGV4dCwgaW5kZXgpIHtcbiAgICBpZiAodGV4dC5jaGFyQXQoaW5kZXgpICE9IHRhZy5jaGFyQXQoMCkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMSwgbCA9IHRhZy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIGlmICh0ZXh0LmNoYXJBdChpbmRleCArIGkpICE9IHRhZy5jaGFyQXQoaSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gdGhlIHRhZ3MgYWxsb3dlZCBpbnNpZGUgc3VwZXIgdGVtcGxhdGVzXG4gIHZhciBhbGxvd2VkSW5TdXBlciA9IHsnX3QnOiB0cnVlLCAnXFxuJzogdHJ1ZSwgJyQnOiB0cnVlLCAnLyc6IHRydWV9O1xuXG4gIGZ1bmN0aW9uIGJ1aWxkVHJlZSh0b2tlbnMsIGtpbmQsIHN0YWNrLCBjdXN0b21UYWdzKSB7XG4gICAgdmFyIGluc3RydWN0aW9ucyA9IFtdLFxuICAgICAgICBvcGVuZXIgPSBudWxsLFxuICAgICAgICB0YWlsID0gbnVsbCxcbiAgICAgICAgdG9rZW4gPSBudWxsO1xuXG4gICAgdGFpbCA9IHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdO1xuXG4gICAgd2hpbGUgKHRva2Vucy5sZW5ndGggPiAwKSB7XG4gICAgICB0b2tlbiA9IHRva2Vucy5zaGlmdCgpO1xuXG4gICAgICBpZiAodGFpbCAmJiB0YWlsLnRhZyA9PSAnPCcgJiYgISh0b2tlbi50YWcgaW4gYWxsb3dlZEluU3VwZXIpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBjb250ZW50IGluIDwgc3VwZXIgdGFnLicpO1xuICAgICAgfVxuXG4gICAgICBpZiAoSG9nYW4udGFnc1t0b2tlbi50YWddIDw9IEhvZ2FuLnRhZ3NbJyQnXSB8fCBpc09wZW5lcih0b2tlbiwgY3VzdG9tVGFncykpIHtcbiAgICAgICAgc3RhY2sucHVzaCh0b2tlbik7XG4gICAgICAgIHRva2VuLm5vZGVzID0gYnVpbGRUcmVlKHRva2VucywgdG9rZW4udGFnLCBzdGFjaywgY3VzdG9tVGFncyk7XG4gICAgICB9IGVsc2UgaWYgKHRva2VuLnRhZyA9PSAnLycpIHtcbiAgICAgICAgaWYgKHN0YWNrLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2xvc2luZyB0YWcgd2l0aG91dCBvcGVuZXI6IC8nICsgdG9rZW4ubik7XG4gICAgICAgIH1cbiAgICAgICAgb3BlbmVyID0gc3RhY2sucG9wKCk7XG4gICAgICAgIGlmICh0b2tlbi5uICE9IG9wZW5lci5uICYmICFpc0Nsb3Nlcih0b2tlbi5uLCBvcGVuZXIubiwgY3VzdG9tVGFncykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05lc3RpbmcgZXJyb3I6ICcgKyBvcGVuZXIubiArICcgdnMuICcgKyB0b2tlbi5uKTtcbiAgICAgICAgfVxuICAgICAgICBvcGVuZXIuZW5kID0gdG9rZW4uaTtcbiAgICAgICAgcmV0dXJuIGluc3RydWN0aW9ucztcbiAgICAgIH0gZWxzZSBpZiAodG9rZW4udGFnID09ICdcXG4nKSB7XG4gICAgICAgIHRva2VuLmxhc3QgPSAodG9rZW5zLmxlbmd0aCA9PSAwKSB8fCAodG9rZW5zWzBdLnRhZyA9PSAnXFxuJyk7XG4gICAgICB9XG5cbiAgICAgIGluc3RydWN0aW9ucy5wdXNoKHRva2VuKTtcbiAgICB9XG5cbiAgICBpZiAoc3RhY2subGVuZ3RoID4gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdtaXNzaW5nIGNsb3NpbmcgdGFnOiAnICsgc3RhY2sucG9wKCkubik7XG4gICAgfVxuXG4gICAgcmV0dXJuIGluc3RydWN0aW9ucztcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzT3BlbmVyKHRva2VuLCB0YWdzKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0YWdzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgaWYgKHRhZ3NbaV0ubyA9PSB0b2tlbi5uKSB7XG4gICAgICAgIHRva2VuLnRhZyA9ICcjJztcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaXNDbG9zZXIoY2xvc2UsIG9wZW4sIHRhZ3MpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRhZ3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBpZiAodGFnc1tpXS5jID09IGNsb3NlICYmIHRhZ3NbaV0ubyA9PSBvcGVuKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHN0cmluZ2lmeVN1YnN0aXR1dGlvbnMob2JqKSB7XG4gICAgdmFyIGl0ZW1zID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgaXRlbXMucHVzaCgnXCInICsgZXNjKGtleSkgKyAnXCI6IGZ1bmN0aW9uKGMscCx0LGkpIHsnICsgb2JqW2tleV0gKyAnfScpO1xuICAgIH1cbiAgICByZXR1cm4gXCJ7IFwiICsgaXRlbXMuam9pbihcIixcIikgKyBcIiB9XCI7XG4gIH1cblxuICBmdW5jdGlvbiBzdHJpbmdpZnlQYXJ0aWFscyhjb2RlT2JqKSB7XG4gICAgdmFyIHBhcnRpYWxzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIGNvZGVPYmoucGFydGlhbHMpIHtcbiAgICAgIHBhcnRpYWxzLnB1c2goJ1wiJyArIGVzYyhrZXkpICsgJ1wiOntuYW1lOlwiJyArIGVzYyhjb2RlT2JqLnBhcnRpYWxzW2tleV0ubmFtZSkgKyAnXCIsICcgKyBzdHJpbmdpZnlQYXJ0aWFscyhjb2RlT2JqLnBhcnRpYWxzW2tleV0pICsgXCJ9XCIpO1xuICAgIH1cbiAgICByZXR1cm4gXCJwYXJ0aWFsczoge1wiICsgcGFydGlhbHMuam9pbihcIixcIikgKyBcIn0sIHN1YnM6IFwiICsgc3RyaW5naWZ5U3Vic3RpdHV0aW9ucyhjb2RlT2JqLnN1YnMpO1xuICB9XG5cbiAgSG9nYW4uc3RyaW5naWZ5ID0gZnVuY3Rpb24oY29kZU9iaiwgdGV4dCwgb3B0aW9ucykge1xuICAgIHJldHVybiBcIntjb2RlOiBmdW5jdGlvbiAoYyxwLGkpIHsgXCIgKyBIb2dhbi53cmFwTWFpbihjb2RlT2JqLmNvZGUpICsgXCIgfSxcIiArIHN0cmluZ2lmeVBhcnRpYWxzKGNvZGVPYmopICsgIFwifVwiO1xuICB9XG5cbiAgdmFyIHNlcmlhbE5vID0gMDtcbiAgSG9nYW4uZ2VuZXJhdGUgPSBmdW5jdGlvbih0cmVlLCB0ZXh0LCBvcHRpb25zKSB7XG4gICAgc2VyaWFsTm8gPSAwO1xuICAgIHZhciBjb250ZXh0ID0geyBjb2RlOiAnJywgc3Viczoge30sIHBhcnRpYWxzOiB7fSB9O1xuICAgIEhvZ2FuLndhbGsodHJlZSwgY29udGV4dCk7XG5cbiAgICBpZiAob3B0aW9ucy5hc1N0cmluZykge1xuICAgICAgcmV0dXJuIHRoaXMuc3RyaW5naWZ5KGNvbnRleHQsIHRleHQsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLm1ha2VUZW1wbGF0ZShjb250ZXh0LCB0ZXh0LCBvcHRpb25zKTtcbiAgfVxuXG4gIEhvZ2FuLndyYXBNYWluID0gZnVuY3Rpb24oY29kZSkge1xuICAgIHJldHVybiAndmFyIHQ9dGhpczt0LmIoaT1pfHxcIlwiKTsnICsgY29kZSArICdyZXR1cm4gdC5mbCgpOyc7XG4gIH1cblxuICBIb2dhbi50ZW1wbGF0ZSA9IEhvZ2FuLlRlbXBsYXRlO1xuXG4gIEhvZ2FuLm1ha2VUZW1wbGF0ZSA9IGZ1bmN0aW9uKGNvZGVPYmosIHRleHQsIG9wdGlvbnMpIHtcbiAgICB2YXIgdGVtcGxhdGUgPSB0aGlzLm1ha2VQYXJ0aWFscyhjb2RlT2JqKTtcbiAgICB0ZW1wbGF0ZS5jb2RlID0gbmV3IEZ1bmN0aW9uKCdjJywgJ3AnLCAnaScsIHRoaXMud3JhcE1haW4oY29kZU9iai5jb2RlKSk7XG4gICAgcmV0dXJuIG5ldyB0aGlzLnRlbXBsYXRlKHRlbXBsYXRlLCB0ZXh0LCB0aGlzLCBvcHRpb25zKTtcbiAgfVxuXG4gIEhvZ2FuLm1ha2VQYXJ0aWFscyA9IGZ1bmN0aW9uKGNvZGVPYmopIHtcbiAgICB2YXIga2V5LCB0ZW1wbGF0ZSA9IHtzdWJzOiB7fSwgcGFydGlhbHM6IGNvZGVPYmoucGFydGlhbHMsIG5hbWU6IGNvZGVPYmoubmFtZX07XG4gICAgZm9yIChrZXkgaW4gdGVtcGxhdGUucGFydGlhbHMpIHtcbiAgICAgIHRlbXBsYXRlLnBhcnRpYWxzW2tleV0gPSB0aGlzLm1ha2VQYXJ0aWFscyh0ZW1wbGF0ZS5wYXJ0aWFsc1trZXldKTtcbiAgICB9XG4gICAgZm9yIChrZXkgaW4gY29kZU9iai5zdWJzKSB7XG4gICAgICB0ZW1wbGF0ZS5zdWJzW2tleV0gPSBuZXcgRnVuY3Rpb24oJ2MnLCAncCcsICd0JywgJ2knLCBjb2RlT2JqLnN1YnNba2V5XSk7XG4gICAgfVxuICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVzYyhzKSB7XG4gICAgcmV0dXJuIHMucmVwbGFjZShyU2xhc2gsICdcXFxcXFxcXCcpXG4gICAgICAgICAgICAucmVwbGFjZShyUXVvdCwgJ1xcXFxcXFwiJylcbiAgICAgICAgICAgIC5yZXBsYWNlKHJOZXdsaW5lLCAnXFxcXG4nKVxuICAgICAgICAgICAgLnJlcGxhY2UockNyLCAnXFxcXHInKVxuICAgICAgICAgICAgLnJlcGxhY2UockxpbmVTZXAsICdcXFxcdTIwMjgnKVxuICAgICAgICAgICAgLnJlcGxhY2UoclBhcmFncmFwaFNlcCwgJ1xcXFx1MjAyOScpO1xuICB9XG5cbiAgZnVuY3Rpb24gY2hvb3NlTWV0aG9kKHMpIHtcbiAgICByZXR1cm4gKH5zLmluZGV4T2YoJy4nKSkgPyAnZCcgOiAnZic7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVQYXJ0aWFsKG5vZGUsIGNvbnRleHQpIHtcbiAgICB2YXIgcHJlZml4ID0gXCI8XCIgKyAoY29udGV4dC5wcmVmaXggfHwgXCJcIik7XG4gICAgdmFyIHN5bSA9IHByZWZpeCArIG5vZGUubiArIHNlcmlhbE5vKys7XG4gICAgY29udGV4dC5wYXJ0aWFsc1tzeW1dID0ge25hbWU6IG5vZGUubiwgcGFydGlhbHM6IHt9fTtcbiAgICBjb250ZXh0LmNvZGUgKz0gJ3QuYih0LnJwKFwiJyArICBlc2Moc3ltKSArICdcIixjLHAsXCInICsgKG5vZGUuaW5kZW50IHx8ICcnKSArICdcIikpOyc7XG4gICAgcmV0dXJuIHN5bTtcbiAgfVxuXG4gIEhvZ2FuLmNvZGVnZW4gPSB7XG4gICAgJyMnOiBmdW5jdGlvbihub2RlLCBjb250ZXh0KSB7XG4gICAgICBjb250ZXh0LmNvZGUgKz0gJ2lmKHQucyh0LicgKyBjaG9vc2VNZXRob2Qobm9kZS5uKSArICcoXCInICsgZXNjKG5vZGUubikgKyAnXCIsYyxwLDEpLCcgK1xuICAgICAgICAgICAgICAgICAgICAgICdjLHAsMCwnICsgbm9kZS5pICsgJywnICsgbm9kZS5lbmQgKyAnLFwiJyArIG5vZGUub3RhZyArIFwiIFwiICsgbm9kZS5jdGFnICsgJ1wiKSl7JyArXG4gICAgICAgICAgICAgICAgICAgICAgJ3QucnMoYyxwLCcgKyAnZnVuY3Rpb24oYyxwLHQpeyc7XG4gICAgICBIb2dhbi53YWxrKG5vZGUubm9kZXMsIGNvbnRleHQpO1xuICAgICAgY29udGV4dC5jb2RlICs9ICd9KTtjLnBvcCgpO30nO1xuICAgIH0sXG5cbiAgICAnXic6IGZ1bmN0aW9uKG5vZGUsIGNvbnRleHQpIHtcbiAgICAgIGNvbnRleHQuY29kZSArPSAnaWYoIXQucyh0LicgKyBjaG9vc2VNZXRob2Qobm9kZS5uKSArICcoXCInICsgZXNjKG5vZGUubikgKyAnXCIsYyxwLDEpLGMscCwxLDAsMCxcIlwiKSl7JztcbiAgICAgIEhvZ2FuLndhbGsobm9kZS5ub2RlcywgY29udGV4dCk7XG4gICAgICBjb250ZXh0LmNvZGUgKz0gJ307JztcbiAgICB9LFxuXG4gICAgJz4nOiBjcmVhdGVQYXJ0aWFsLFxuICAgICc8JzogZnVuY3Rpb24obm9kZSwgY29udGV4dCkge1xuICAgICAgdmFyIGN0eCA9IHtwYXJ0aWFsczoge30sIGNvZGU6ICcnLCBzdWJzOiB7fSwgaW5QYXJ0aWFsOiB0cnVlfTtcbiAgICAgIEhvZ2FuLndhbGsobm9kZS5ub2RlcywgY3R4KTtcbiAgICAgIHZhciB0ZW1wbGF0ZSA9IGNvbnRleHQucGFydGlhbHNbY3JlYXRlUGFydGlhbChub2RlLCBjb250ZXh0KV07XG4gICAgICB0ZW1wbGF0ZS5zdWJzID0gY3R4LnN1YnM7XG4gICAgICB0ZW1wbGF0ZS5wYXJ0aWFscyA9IGN0eC5wYXJ0aWFscztcbiAgICB9LFxuXG4gICAgJyQnOiBmdW5jdGlvbihub2RlLCBjb250ZXh0KSB7XG4gICAgICB2YXIgY3R4ID0ge3N1YnM6IHt9LCBjb2RlOiAnJywgcGFydGlhbHM6IGNvbnRleHQucGFydGlhbHMsIHByZWZpeDogbm9kZS5ufTtcbiAgICAgIEhvZ2FuLndhbGsobm9kZS5ub2RlcywgY3R4KTtcbiAgICAgIGNvbnRleHQuc3Vic1tub2RlLm5dID0gY3R4LmNvZGU7XG4gICAgICBpZiAoIWNvbnRleHQuaW5QYXJ0aWFsKSB7XG4gICAgICAgIGNvbnRleHQuY29kZSArPSAndC5zdWIoXCInICsgZXNjKG5vZGUubikgKyAnXCIsYyxwLGkpOyc7XG4gICAgICB9XG4gICAgfSxcblxuICAgICdcXG4nOiBmdW5jdGlvbihub2RlLCBjb250ZXh0KSB7XG4gICAgICBjb250ZXh0LmNvZGUgKz0gd3JpdGUoJ1wiXFxcXG5cIicgKyAobm9kZS5sYXN0ID8gJycgOiAnICsgaScpKTtcbiAgICB9LFxuXG4gICAgJ192JzogZnVuY3Rpb24obm9kZSwgY29udGV4dCkge1xuICAgICAgY29udGV4dC5jb2RlICs9ICd0LmIodC52KHQuJyArIGNob29zZU1ldGhvZChub2RlLm4pICsgJyhcIicgKyBlc2Mobm9kZS5uKSArICdcIixjLHAsMCkpKTsnO1xuICAgIH0sXG5cbiAgICAnX3QnOiBmdW5jdGlvbihub2RlLCBjb250ZXh0KSB7XG4gICAgICBjb250ZXh0LmNvZGUgKz0gd3JpdGUoJ1wiJyArIGVzYyhub2RlLnRleHQpICsgJ1wiJyk7XG4gICAgfSxcblxuICAgICd7JzogdHJpcGxlU3RhY2hlLFxuXG4gICAgJyYnOiB0cmlwbGVTdGFjaGVcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyaXBsZVN0YWNoZShub2RlLCBjb250ZXh0KSB7XG4gICAgY29udGV4dC5jb2RlICs9ICd0LmIodC50KHQuJyArIGNob29zZU1ldGhvZChub2RlLm4pICsgJyhcIicgKyBlc2Mobm9kZS5uKSArICdcIixjLHAsMCkpKTsnO1xuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGUocykge1xuICAgIHJldHVybiAndC5iKCcgKyBzICsgJyk7JztcbiAgfVxuXG4gIEhvZ2FuLndhbGsgPSBmdW5jdGlvbihub2RlbGlzdCwgY29udGV4dCkge1xuICAgIHZhciBmdW5jO1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gbm9kZWxpc3QubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBmdW5jID0gSG9nYW4uY29kZWdlbltub2RlbGlzdFtpXS50YWddO1xuICAgICAgZnVuYyAmJiBmdW5jKG5vZGVsaXN0W2ldLCBjb250ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbnRleHQ7XG4gIH1cblxuICBIb2dhbi5wYXJzZSA9IGZ1bmN0aW9uKHRva2VucywgdGV4dCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHJldHVybiBidWlsZFRyZWUodG9rZW5zLCAnJywgW10sIG9wdGlvbnMuc2VjdGlvblRhZ3MgfHwgW10pO1xuICB9XG5cbiAgSG9nYW4uY2FjaGUgPSB7fTtcblxuICBIb2dhbi5jYWNoZUtleSA9IGZ1bmN0aW9uKHRleHQsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gW3RleHQsICEhb3B0aW9ucy5hc1N0cmluZywgISFvcHRpb25zLmRpc2FibGVMYW1iZGEsIG9wdGlvbnMuZGVsaW1pdGVycywgISFvcHRpb25zLm1vZGVsR2V0XS5qb2luKCd8fCcpO1xuICB9XG5cbiAgSG9nYW4uY29tcGlsZSA9IGZ1bmN0aW9uKHRleHQsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB2YXIga2V5ID0gSG9nYW4uY2FjaGVLZXkodGV4dCwgb3B0aW9ucyk7XG4gICAgdmFyIHRlbXBsYXRlID0gdGhpcy5jYWNoZVtrZXldO1xuXG4gICAgaWYgKHRlbXBsYXRlKSB7XG4gICAgICB2YXIgcGFydGlhbHMgPSB0ZW1wbGF0ZS5wYXJ0aWFscztcbiAgICAgIGZvciAodmFyIG5hbWUgaW4gcGFydGlhbHMpIHtcbiAgICAgICAgZGVsZXRlIHBhcnRpYWxzW25hbWVdLmluc3RhbmNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRlbXBsYXRlO1xuICAgIH1cblxuICAgIHRlbXBsYXRlID0gdGhpcy5nZW5lcmF0ZSh0aGlzLnBhcnNlKHRoaXMuc2Nhbih0ZXh0LCBvcHRpb25zLmRlbGltaXRlcnMpLCB0ZXh0LCBvcHRpb25zKSwgdGV4dCwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY2FjaGVba2V5XSA9IHRlbXBsYXRlO1xuICB9XG59KSh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcgPyBleHBvcnRzIDogSG9nYW4pO1xuIiwiLypcbiAqICBDb3B5cmlnaHQgMjAxMSBUd2l0dGVyLCBJbmMuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqICB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiAgWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqICBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiAgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqICBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4vLyBUaGlzIGZpbGUgaXMgZm9yIHVzZSB3aXRoIE5vZGUuanMuIFNlZSBkaXN0LyBmb3IgYnJvd3NlciBmaWxlcy5cblxudmFyIEhvZ2FuID0gcmVxdWlyZSgnLi9jb21waWxlcicpO1xuSG9nYW4uVGVtcGxhdGUgPSByZXF1aXJlKCcuL3RlbXBsYXRlJykuVGVtcGxhdGU7XG5Ib2dhbi50ZW1wbGF0ZSA9IEhvZ2FuLlRlbXBsYXRlO1xubW9kdWxlLmV4cG9ydHMgPSBIb2dhbjtcbiIsIi8qXG4gKiAgQ29weXJpZ2h0IDIwMTEgVHdpdHRlciwgSW5jLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiAgeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiAgVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqICBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqICBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiAgbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxudmFyIEhvZ2FuID0ge307XG5cbihmdW5jdGlvbiAoSG9nYW4pIHtcbiAgSG9nYW4uVGVtcGxhdGUgPSBmdW5jdGlvbiAoY29kZU9iaiwgdGV4dCwgY29tcGlsZXIsIG9wdGlvbnMpIHtcbiAgICBjb2RlT2JqID0gY29kZU9iaiB8fCB7fTtcbiAgICB0aGlzLnIgPSBjb2RlT2JqLmNvZGUgfHwgdGhpcy5yO1xuICAgIHRoaXMuYyA9IGNvbXBpbGVyO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdGhpcy50ZXh0ID0gdGV4dCB8fCAnJztcbiAgICB0aGlzLnBhcnRpYWxzID0gY29kZU9iai5wYXJ0aWFscyB8fCB7fTtcbiAgICB0aGlzLnN1YnMgPSBjb2RlT2JqLnN1YnMgfHwge307XG4gICAgdGhpcy5idWYgPSAnJztcbiAgfVxuXG4gIEhvZ2FuLlRlbXBsYXRlLnByb3RvdHlwZSA9IHtcbiAgICAvLyByZW5kZXI6IHJlcGxhY2VkIGJ5IGdlbmVyYXRlZCBjb2RlLlxuICAgIHI6IGZ1bmN0aW9uIChjb250ZXh0LCBwYXJ0aWFscywgaW5kZW50KSB7IHJldHVybiAnJzsgfSxcblxuICAgIC8vIHZhcmlhYmxlIGVzY2FwaW5nXG4gICAgdjogaG9nYW5Fc2NhcGUsXG5cbiAgICAvLyB0cmlwbGUgc3RhY2hlXG4gICAgdDogY29lcmNlVG9TdHJpbmcsXG5cbiAgICByZW5kZXI6IGZ1bmN0aW9uIHJlbmRlcihjb250ZXh0LCBwYXJ0aWFscywgaW5kZW50KSB7XG4gICAgICByZXR1cm4gdGhpcy5yaShbY29udGV4dF0sIHBhcnRpYWxzIHx8IHt9LCBpbmRlbnQpO1xuICAgIH0sXG5cbiAgICAvLyByZW5kZXIgaW50ZXJuYWwgLS0gYSBob29rIGZvciBvdmVycmlkZXMgdGhhdCBjYXRjaGVzIHBhcnRpYWxzIHRvb1xuICAgIHJpOiBmdW5jdGlvbiAoY29udGV4dCwgcGFydGlhbHMsIGluZGVudCkge1xuICAgICAgcmV0dXJuIHRoaXMucihjb250ZXh0LCBwYXJ0aWFscywgaW5kZW50KTtcbiAgICB9LFxuXG4gICAgLy8gZW5zdXJlUGFydGlhbFxuICAgIGVwOiBmdW5jdGlvbihzeW1ib2wsIHBhcnRpYWxzKSB7XG4gICAgICB2YXIgcGFydGlhbCA9IHRoaXMucGFydGlhbHNbc3ltYm9sXTtcblxuICAgICAgLy8gY2hlY2sgdG8gc2VlIHRoYXQgaWYgd2UndmUgaW5zdGFudGlhdGVkIHRoaXMgcGFydGlhbCBiZWZvcmVcbiAgICAgIHZhciB0ZW1wbGF0ZSA9IHBhcnRpYWxzW3BhcnRpYWwubmFtZV07XG4gICAgICBpZiAocGFydGlhbC5pbnN0YW5jZSAmJiBwYXJ0aWFsLmJhc2UgPT0gdGVtcGxhdGUpIHtcbiAgICAgICAgcmV0dXJuIHBhcnRpYWwuaW5zdGFuY2U7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgdGVtcGxhdGUgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCF0aGlzLmMpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBjb21waWxlciBhdmFpbGFibGUuXCIpO1xuICAgICAgICB9XG4gICAgICAgIHRlbXBsYXRlID0gdGhpcy5jLmNvbXBpbGUodGVtcGxhdGUsIHRoaXMub3B0aW9ucyk7XG4gICAgICB9XG5cbiAgICAgIGlmICghdGVtcGxhdGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIC8vIFdlIHVzZSB0aGlzIHRvIGNoZWNrIHdoZXRoZXIgdGhlIHBhcnRpYWxzIGRpY3Rpb25hcnkgaGFzIGNoYW5nZWRcbiAgICAgIHRoaXMucGFydGlhbHNbc3ltYm9sXS5iYXNlID0gdGVtcGxhdGU7XG5cbiAgICAgIGlmIChwYXJ0aWFsLnN1YnMpIHtcbiAgICAgICAgLy8gTWFrZSBzdXJlIHdlIGNvbnNpZGVyIHBhcmVudCB0ZW1wbGF0ZSBub3dcbiAgICAgICAgaWYgKCFwYXJ0aWFscy5zdGFja1RleHQpIHBhcnRpYWxzLnN0YWNrVGV4dCA9IHt9O1xuICAgICAgICBmb3IgKGtleSBpbiBwYXJ0aWFsLnN1YnMpIHtcbiAgICAgICAgICBpZiAoIXBhcnRpYWxzLnN0YWNrVGV4dFtrZXldKSB7XG4gICAgICAgICAgICBwYXJ0aWFscy5zdGFja1RleHRba2V5XSA9ICh0aGlzLmFjdGl2ZVN1YiAhPT0gdW5kZWZpbmVkICYmIHBhcnRpYWxzLnN0YWNrVGV4dFt0aGlzLmFjdGl2ZVN1Yl0pID8gcGFydGlhbHMuc3RhY2tUZXh0W3RoaXMuYWN0aXZlU3ViXSA6IHRoaXMudGV4dDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGVtcGxhdGUgPSBjcmVhdGVTcGVjaWFsaXplZFBhcnRpYWwodGVtcGxhdGUsIHBhcnRpYWwuc3VicywgcGFydGlhbC5wYXJ0aWFscyxcbiAgICAgICAgICB0aGlzLnN0YWNrU3VicywgdGhpcy5zdGFja1BhcnRpYWxzLCBwYXJ0aWFscy5zdGFja1RleHQpO1xuICAgICAgfVxuICAgICAgdGhpcy5wYXJ0aWFsc1tzeW1ib2xdLmluc3RhbmNlID0gdGVtcGxhdGU7XG5cbiAgICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgICB9LFxuXG4gICAgLy8gdHJpZXMgdG8gZmluZCBhIHBhcnRpYWwgaW4gdGhlIGN1cnJlbnQgc2NvcGUgYW5kIHJlbmRlciBpdFxuICAgIHJwOiBmdW5jdGlvbihzeW1ib2wsIGNvbnRleHQsIHBhcnRpYWxzLCBpbmRlbnQpIHtcbiAgICAgIHZhciBwYXJ0aWFsID0gdGhpcy5lcChzeW1ib2wsIHBhcnRpYWxzKTtcbiAgICAgIGlmICghcGFydGlhbCkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwYXJ0aWFsLnJpKGNvbnRleHQsIHBhcnRpYWxzLCBpbmRlbnQpO1xuICAgIH0sXG5cbiAgICAvLyByZW5kZXIgYSBzZWN0aW9uXG4gICAgcnM6IGZ1bmN0aW9uKGNvbnRleHQsIHBhcnRpYWxzLCBzZWN0aW9uKSB7XG4gICAgICB2YXIgdGFpbCA9IGNvbnRleHRbY29udGV4dC5sZW5ndGggLSAxXTtcblxuICAgICAgaWYgKCFpc0FycmF5KHRhaWwpKSB7XG4gICAgICAgIHNlY3Rpb24oY29udGV4dCwgcGFydGlhbHMsIHRoaXMpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGFpbC5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb250ZXh0LnB1c2godGFpbFtpXSk7XG4gICAgICAgIHNlY3Rpb24oY29udGV4dCwgcGFydGlhbHMsIHRoaXMpO1xuICAgICAgICBjb250ZXh0LnBvcCgpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvLyBtYXliZSBzdGFydCBhIHNlY3Rpb25cbiAgICBzOiBmdW5jdGlvbih2YWwsIGN0eCwgcGFydGlhbHMsIGludmVydGVkLCBzdGFydCwgZW5kLCB0YWdzKSB7XG4gICAgICB2YXIgcGFzcztcblxuICAgICAgaWYgKGlzQXJyYXkodmFsKSAmJiB2YWwubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiB2YWwgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB2YWwgPSB0aGlzLm1zKHZhbCwgY3R4LCBwYXJ0aWFscywgaW52ZXJ0ZWQsIHN0YXJ0LCBlbmQsIHRhZ3MpO1xuICAgICAgfVxuXG4gICAgICBwYXNzID0gISF2YWw7XG5cbiAgICAgIGlmICghaW52ZXJ0ZWQgJiYgcGFzcyAmJiBjdHgpIHtcbiAgICAgICAgY3R4LnB1c2goKHR5cGVvZiB2YWwgPT0gJ29iamVjdCcpID8gdmFsIDogY3R4W2N0eC5sZW5ndGggLSAxXSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwYXNzO1xuICAgIH0sXG5cbiAgICAvLyBmaW5kIHZhbHVlcyB3aXRoIGRvdHRlZCBuYW1lc1xuICAgIGQ6IGZ1bmN0aW9uKGtleSwgY3R4LCBwYXJ0aWFscywgcmV0dXJuRm91bmQpIHtcbiAgICAgIHZhciBmb3VuZCxcbiAgICAgICAgICBuYW1lcyA9IGtleS5zcGxpdCgnLicpLFxuICAgICAgICAgIHZhbCA9IHRoaXMuZihuYW1lc1swXSwgY3R4LCBwYXJ0aWFscywgcmV0dXJuRm91bmQpLFxuICAgICAgICAgIGRvTW9kZWxHZXQgPSB0aGlzLm9wdGlvbnMubW9kZWxHZXQsXG4gICAgICAgICAgY3ggPSBudWxsO1xuXG4gICAgICBpZiAoa2V5ID09PSAnLicgJiYgaXNBcnJheShjdHhbY3R4Lmxlbmd0aCAtIDJdKSkge1xuICAgICAgICB2YWwgPSBjdHhbY3R4Lmxlbmd0aCAtIDFdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBuYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGZvdW5kID0gZmluZEluU2NvcGUobmFtZXNbaV0sIHZhbCwgZG9Nb2RlbEdldCk7XG4gICAgICAgICAgaWYgKGZvdW5kICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGN4ID0gdmFsO1xuICAgICAgICAgICAgdmFsID0gZm91bmQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhbCA9ICcnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocmV0dXJuRm91bmQgJiYgIXZhbCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGlmICghcmV0dXJuRm91bmQgJiYgdHlwZW9mIHZhbCA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGN0eC5wdXNoKGN4KTtcbiAgICAgICAgdmFsID0gdGhpcy5tdih2YWwsIGN0eCwgcGFydGlhbHMpO1xuICAgICAgICBjdHgucG9wKCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB2YWw7XG4gICAgfSxcblxuICAgIC8vIGZpbmQgdmFsdWVzIHdpdGggbm9ybWFsIG5hbWVzXG4gICAgZjogZnVuY3Rpb24oa2V5LCBjdHgsIHBhcnRpYWxzLCByZXR1cm5Gb3VuZCkge1xuICAgICAgdmFyIHZhbCA9IGZhbHNlLFxuICAgICAgICAgIHYgPSBudWxsLFxuICAgICAgICAgIGZvdW5kID0gZmFsc2UsXG4gICAgICAgICAgZG9Nb2RlbEdldCA9IHRoaXMub3B0aW9ucy5tb2RlbEdldDtcblxuICAgICAgZm9yICh2YXIgaSA9IGN0eC5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICB2ID0gY3R4W2ldO1xuICAgICAgICB2YWwgPSBmaW5kSW5TY29wZShrZXksIHYsIGRvTW9kZWxHZXQpO1xuICAgICAgICBpZiAodmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCFmb3VuZCkge1xuICAgICAgICByZXR1cm4gKHJldHVybkZvdW5kKSA/IGZhbHNlIDogXCJcIjtcbiAgICAgIH1cblxuICAgICAgaWYgKCFyZXR1cm5Gb3VuZCAmJiB0eXBlb2YgdmFsID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdmFsID0gdGhpcy5tdih2YWwsIGN0eCwgcGFydGlhbHMpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdmFsO1xuICAgIH0sXG5cbiAgICAvLyBoaWdoZXIgb3JkZXIgdGVtcGxhdGVzXG4gICAgbHM6IGZ1bmN0aW9uKGZ1bmMsIGN4LCBwYXJ0aWFscywgdGV4dCwgdGFncykge1xuICAgICAgdmFyIG9sZFRhZ3MgPSB0aGlzLm9wdGlvbnMuZGVsaW1pdGVycztcblxuICAgICAgdGhpcy5vcHRpb25zLmRlbGltaXRlcnMgPSB0YWdzO1xuICAgICAgdGhpcy5iKHRoaXMuY3QoY29lcmNlVG9TdHJpbmcoZnVuYy5jYWxsKGN4LCB0ZXh0KSksIGN4LCBwYXJ0aWFscykpO1xuICAgICAgdGhpcy5vcHRpb25zLmRlbGltaXRlcnMgPSBvbGRUYWdzO1xuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcblxuICAgIC8vIGNvbXBpbGUgdGV4dFxuICAgIGN0OiBmdW5jdGlvbih0ZXh0LCBjeCwgcGFydGlhbHMpIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZGlzYWJsZUxhbWJkYSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0xhbWJkYSBmZWF0dXJlcyBkaXNhYmxlZC4nKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmMuY29tcGlsZSh0ZXh0LCB0aGlzLm9wdGlvbnMpLnJlbmRlcihjeCwgcGFydGlhbHMpO1xuICAgIH0sXG5cbiAgICAvLyB0ZW1wbGF0ZSByZXN1bHQgYnVmZmVyaW5nXG4gICAgYjogZnVuY3Rpb24ocykgeyB0aGlzLmJ1ZiArPSBzOyB9LFxuXG4gICAgZmw6IGZ1bmN0aW9uKCkgeyB2YXIgciA9IHRoaXMuYnVmOyB0aGlzLmJ1ZiA9ICcnOyByZXR1cm4gcjsgfSxcblxuICAgIC8vIG1ldGhvZCByZXBsYWNlIHNlY3Rpb25cbiAgICBtczogZnVuY3Rpb24oZnVuYywgY3R4LCBwYXJ0aWFscywgaW52ZXJ0ZWQsIHN0YXJ0LCBlbmQsIHRhZ3MpIHtcbiAgICAgIHZhciB0ZXh0U291cmNlLFxuICAgICAgICAgIGN4ID0gY3R4W2N0eC5sZW5ndGggLSAxXSxcbiAgICAgICAgICByZXN1bHQgPSBmdW5jLmNhbGwoY3gpO1xuXG4gICAgICBpZiAodHlwZW9mIHJlc3VsdCA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGlmIChpbnZlcnRlZCkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRleHRTb3VyY2UgPSAodGhpcy5hY3RpdmVTdWIgJiYgdGhpcy5zdWJzVGV4dCAmJiB0aGlzLnN1YnNUZXh0W3RoaXMuYWN0aXZlU3ViXSkgPyB0aGlzLnN1YnNUZXh0W3RoaXMuYWN0aXZlU3ViXSA6IHRoaXMudGV4dDtcbiAgICAgICAgICByZXR1cm4gdGhpcy5scyhyZXN1bHQsIGN4LCBwYXJ0aWFscywgdGV4dFNvdXJjZS5zdWJzdHJpbmcoc3RhcnQsIGVuZCksIHRhZ3MpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIC8vIG1ldGhvZCByZXBsYWNlIHZhcmlhYmxlXG4gICAgbXY6IGZ1bmN0aW9uKGZ1bmMsIGN0eCwgcGFydGlhbHMpIHtcbiAgICAgIHZhciBjeCA9IGN0eFtjdHgubGVuZ3RoIC0gMV07XG4gICAgICB2YXIgcmVzdWx0ID0gZnVuYy5jYWxsKGN4KTtcblxuICAgICAgaWYgKHR5cGVvZiByZXN1bHQgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm4gdGhpcy5jdChjb2VyY2VUb1N0cmluZyhyZXN1bHQuY2FsbChjeCkpLCBjeCwgcGFydGlhbHMpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICBzdWI6IGZ1bmN0aW9uKG5hbWUsIGNvbnRleHQsIHBhcnRpYWxzLCBpbmRlbnQpIHtcbiAgICAgIHZhciBmID0gdGhpcy5zdWJzW25hbWVdO1xuICAgICAgaWYgKGYpIHtcbiAgICAgICAgdGhpcy5hY3RpdmVTdWIgPSBuYW1lO1xuICAgICAgICBmKGNvbnRleHQsIHBhcnRpYWxzLCB0aGlzLCBpbmRlbnQpO1xuICAgICAgICB0aGlzLmFjdGl2ZVN1YiA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICB9O1xuXG4gIC8vRmluZCBhIGtleSBpbiBhbiBvYmplY3RcbiAgZnVuY3Rpb24gZmluZEluU2NvcGUoa2V5LCBzY29wZSwgZG9Nb2RlbEdldCkge1xuICAgIHZhciB2YWw7XG5cbiAgICBpZiAoc2NvcGUgJiYgdHlwZW9mIHNjb3BlID09ICdvYmplY3QnKSB7XG5cbiAgICAgIGlmIChzY29wZVtrZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdmFsID0gc2NvcGVba2V5XTtcblxuICAgICAgLy8gdHJ5IGxvb2t1cCB3aXRoIGdldCBmb3IgYmFja2JvbmUgb3Igc2ltaWxhciBtb2RlbCBkYXRhXG4gICAgICB9IGVsc2UgaWYgKGRvTW9kZWxHZXQgJiYgc2NvcGUuZ2V0ICYmIHR5cGVvZiBzY29wZS5nZXQgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB2YWwgPSBzY29wZS5nZXQoa2V5KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdmFsO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlU3BlY2lhbGl6ZWRQYXJ0aWFsKGluc3RhbmNlLCBzdWJzLCBwYXJ0aWFscywgc3RhY2tTdWJzLCBzdGFja1BhcnRpYWxzLCBzdGFja1RleHQpIHtcbiAgICBmdW5jdGlvbiBQYXJ0aWFsVGVtcGxhdGUoKSB7fTtcbiAgICBQYXJ0aWFsVGVtcGxhdGUucHJvdG90eXBlID0gaW5zdGFuY2U7XG4gICAgZnVuY3Rpb24gU3Vic3RpdHV0aW9ucygpIHt9O1xuICAgIFN1YnN0aXR1dGlvbnMucHJvdG90eXBlID0gaW5zdGFuY2Uuc3VicztcbiAgICB2YXIga2V5O1xuICAgIHZhciBwYXJ0aWFsID0gbmV3IFBhcnRpYWxUZW1wbGF0ZSgpO1xuICAgIHBhcnRpYWwuc3VicyA9IG5ldyBTdWJzdGl0dXRpb25zKCk7XG4gICAgcGFydGlhbC5zdWJzVGV4dCA9IHt9OyAgLy9oZWhlLiBzdWJzdGV4dC5cbiAgICBwYXJ0aWFsLmJ1ZiA9ICcnO1xuXG4gICAgc3RhY2tTdWJzID0gc3RhY2tTdWJzIHx8IHt9O1xuICAgIHBhcnRpYWwuc3RhY2tTdWJzID0gc3RhY2tTdWJzO1xuICAgIHBhcnRpYWwuc3Vic1RleHQgPSBzdGFja1RleHQ7XG4gICAgZm9yIChrZXkgaW4gc3Vicykge1xuICAgICAgaWYgKCFzdGFja1N1YnNba2V5XSkgc3RhY2tTdWJzW2tleV0gPSBzdWJzW2tleV07XG4gICAgfVxuICAgIGZvciAoa2V5IGluIHN0YWNrU3Vicykge1xuICAgICAgcGFydGlhbC5zdWJzW2tleV0gPSBzdGFja1N1YnNba2V5XTtcbiAgICB9XG5cbiAgICBzdGFja1BhcnRpYWxzID0gc3RhY2tQYXJ0aWFscyB8fCB7fTtcbiAgICBwYXJ0aWFsLnN0YWNrUGFydGlhbHMgPSBzdGFja1BhcnRpYWxzO1xuICAgIGZvciAoa2V5IGluIHBhcnRpYWxzKSB7XG4gICAgICBpZiAoIXN0YWNrUGFydGlhbHNba2V5XSkgc3RhY2tQYXJ0aWFsc1trZXldID0gcGFydGlhbHNba2V5XTtcbiAgICB9XG4gICAgZm9yIChrZXkgaW4gc3RhY2tQYXJ0aWFscykge1xuICAgICAgcGFydGlhbC5wYXJ0aWFsc1trZXldID0gc3RhY2tQYXJ0aWFsc1trZXldO1xuICAgIH1cblxuICAgIHJldHVybiBwYXJ0aWFsO1xuICB9XG5cbiAgdmFyIHJBbXAgPSAvJi9nLFxuICAgICAgckx0ID0gLzwvZyxcbiAgICAgIHJHdCA9IC8+L2csXG4gICAgICByQXBvcyA9IC9cXCcvZyxcbiAgICAgIHJRdW90ID0gL1xcXCIvZyxcbiAgICAgIGhDaGFycyA9IC9bJjw+XFxcIlxcJ10vO1xuXG4gIGZ1bmN0aW9uIGNvZXJjZVRvU3RyaW5nKHZhbCkge1xuICAgIHJldHVybiBTdHJpbmcoKHZhbCA9PT0gbnVsbCB8fCB2YWwgPT09IHVuZGVmaW5lZCkgPyAnJyA6IHZhbCk7XG4gIH1cblxuICBmdW5jdGlvbiBob2dhbkVzY2FwZShzdHIpIHtcbiAgICBzdHIgPSBjb2VyY2VUb1N0cmluZyhzdHIpO1xuICAgIHJldHVybiBoQ2hhcnMudGVzdChzdHIpID9cbiAgICAgIHN0clxuICAgICAgICAucmVwbGFjZShyQW1wLCAnJmFtcDsnKVxuICAgICAgICAucmVwbGFjZShyTHQsICcmbHQ7JylcbiAgICAgICAgLnJlcGxhY2Uockd0LCAnJmd0OycpXG4gICAgICAgIC5yZXBsYWNlKHJBcG9zLCAnJiMzOTsnKVxuICAgICAgICAucmVwbGFjZShyUXVvdCwgJyZxdW90OycpIDpcbiAgICAgIHN0cjtcbiAgfVxuXG4gIHZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbihhKSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfTtcblxufSkodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnID8gZXhwb3J0cyA6IEhvZ2FuKTtcbiIsIi8qIVxyXG4qIHZkb20tdmlydHVhbGl6ZVxyXG4qIENvcHlyaWdodCAyMDE0IGJ5IE1hcmNlbCBLbGVociA8bWtsZWhyQGdteC5uZXQ+XHJcbipcclxuKiAoTUlUIExJQ0VOU0UpXHJcbiogUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weVxyXG4qIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcclxuKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXHJcbiogdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbFxyXG4qIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xyXG4qIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XHJcbipcclxuKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxyXG4qIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxyXG4qXHJcbiogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxyXG4qIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxyXG4qIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxyXG4qIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcclxuKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxyXG4qIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU5cclxuKiBUSEUgU09GVFdBUkUuXHJcbiovXHJcbnZhciBWTm9kZSA9IHJlcXVpcmUoXCJ2aXJ0dWFsLWRvbS92bm9kZS92bm9kZVwiKVxyXG4gICwgVlRleHQgPSByZXF1aXJlKFwidmlydHVhbC1kb20vdm5vZGUvdnRleHRcIilcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlVk5vZGVcclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZVZOb2RlKGRvbU5vZGUsIGtleSkge1xyXG4gIGtleSA9IGtleSB8fCBudWxsIC8vIFhYWDogTGVhdmUgb3V0IGBrZXlgIGZvciBub3cuLi4gbWVyZWx5IHVzZWQgZm9yIChyZS0pb3JkZXJpbmdcclxuXHJcbiAgaWYoZG9tTm9kZS5ub2RlVHlwZSA9PSAxKSByZXR1cm4gY3JlYXRlRnJvbUVsZW1lbnQoZG9tTm9kZSwga2V5KVxyXG4gIGlmKGRvbU5vZGUubm9kZVR5cGUgPT0gMykgcmV0dXJuIGNyZWF0ZUZyb21UZXh0Tm9kZShkb21Ob2RlLCBrZXkpXHJcbiAgcmV0dXJuXHJcbn1cclxuXHJcbmNyZWF0ZVZOb2RlLmZyb21IVE1MID0gZnVuY3Rpb24oaHRtbCwga2V5KSB7XHJcbiAgdmFyIGRvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTsgLy8gY3JlYXRlIGNvbnRhaW5lclxyXG4gIGRvbU5vZGUuaW5uZXJIVE1MID0gaHRtbDsgLy8gYnJvd3NlciBwYXJzZXMgSFRNTCBpbnRvIERPTSB0cmVlXHJcbiAgZG9tTm9kZSA9IGRvbU5vZGUuY2hpbGRyZW5bMF0gfHwgZG9tTm9kZTsgLy8gc2VsZWN0IGZpcnN0IG5vZGUgaW4gdHJlZVxyXG4gIHJldHVybiBjcmVhdGVWTm9kZShkb21Ob2RlLCBrZXkpO1xyXG59O1xyXG5cclxuZnVuY3Rpb24gY3JlYXRlRnJvbVRleHROb2RlKHROb2RlKSB7XHJcbiAgcmV0dXJuIG5ldyBWVGV4dCh0Tm9kZS5ub2RlVmFsdWUpXHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiBjcmVhdGVGcm9tRWxlbWVudChlbCkge1xyXG4gIHZhciB0YWdOYW1lID0gZWwudGFnTmFtZVxyXG4gICwgbmFtZXNwYWNlID0gZWwubmFtZXNwYWNlVVJJID09ICdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hodG1sJz8gbnVsbCA6IGVsLm5hbWVzcGFjZVVSSVxyXG4gICwgcHJvcGVydGllcyA9IGdldEVsZW1lbnRQcm9wZXJ0aWVzKGVsKVxyXG4gICwgY2hpbGRyZW4gPSBbXVxyXG5cclxuICBmb3IgKHZhciBpID0gMDsgaSA8IGVsLmNoaWxkTm9kZXMubGVuZ3RoOyBpKyspIHtcclxuICAgIGNoaWxkcmVuLnB1c2goY3JlYXRlVk5vZGUoZWwuY2hpbGROb2Rlc1tpXS8qLCBpKi8pKVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIG5ldyBWTm9kZSh0YWdOYW1lLCBwcm9wZXJ0aWVzLCBjaGlsZHJlbiwgbnVsbCwgbmFtZXNwYWNlKVxyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gZ2V0RWxlbWVudFByb3BlcnRpZXMoZWwpIHtcclxuICB2YXIgb2JqID0ge31cclxuXHJcbiAgcHJvcHMuZm9yRWFjaChmdW5jdGlvbihwcm9wTmFtZSkge1xyXG4gICAgaWYoIWVsW3Byb3BOYW1lXSkgcmV0dXJuXHJcblxyXG4gICAgLy8gU3BlY2lhbCBjYXNlOiBzdHlsZVxyXG4gICAgLy8gLnN0eWxlIGlzIGEgRE9NU3R5bGVEZWNsYXJhdGlvbiwgdGh1cyB3ZSBuZWVkIHRvIGl0ZXJhdGUgb3ZlciBhbGxcclxuICAgIC8vIHJ1bGVzIHRvIGNyZWF0ZSBhIGhhc2ggb2YgYXBwbGllZCBjc3MgcHJvcGVydGllcy5cclxuICAgIC8vXHJcbiAgICAvLyBZb3UgY2FuIGRpcmVjdGx5IHNldCBhIHNwZWNpZmljIC5zdHlsZVtwcm9wXSA9IHZhbHVlIHNvIHBhdGNoaW5nIHdpdGggdmRvbVxyXG4gICAgLy8gaXMgcG9zc2libGUuXHJcbiAgICBpZihcInN0eWxlXCIgPT0gcHJvcE5hbWUpIHtcclxuICAgICAgdmFyIGNzcyA9IHt9XHJcbiAgICAgICAgLCBzdHlsZVByb3BcclxuICAgICAgZm9yKHZhciBpPTA7IGk8ZWwuc3R5bGUubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBzdHlsZVByb3AgPSBlbC5zdHlsZVtpXVxyXG4gICAgICAgIGNzc1tzdHlsZVByb3BdID0gZWwuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZShzdHlsZVByb3ApIC8vIFhYWDogYWRkIHN1cHBvcnQgZm9yIFwiIWltcG9ydGFudFwiIHZpYSBnZXRQcm9wZXJ0eVByaW9yaXR5KCkhXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIG9ialtwcm9wTmFtZV0gPSBjc3NcclxuICAgICAgcmV0dXJuXHJcbiAgICB9XHJcblxyXG4gICAgLy8gU3BlY2lhbCBjYXNlOiBkYXRhc2V0XHJcbiAgICAvLyB3ZSBjYW4gaXRlcmF0ZSBvdmVyIC5kYXRhc2V0IHdpdGggYSBzaW1wbGUgZm9yLi5pbiBsb29wLlxyXG4gICAgLy8gVGhlIGFsbC10aW1lIGZvbyB3aXRoIGRhdGEtKiBhdHRyaWJzIGlzIHRoZSBkYXNoLXNuYWtlIHRvIGNhbWVsQ2FzZVxyXG4gICAgLy8gY29udmVyc2lvbi5cclxuICAgIC8vIEhvd2V2ZXIsIEknbSBub3Qgc3VyZSBpZiB0aGlzIGlzIGNvbXBhdGlibGUgd2l0aCBoKClcclxuICAgIC8vXHJcbiAgICAvLyAuZGF0YXNldCBwcm9wZXJ0aWVzIGFyZSBkaXJlY3RseSBhY2Nlc3NpYmxlIGFzIHRyYW5zcGFyZW50IGdldHRlcnMvc2V0dGVycywgc29cclxuICAgIC8vIHBhdGNoaW5nIHdpdGggdmRvbSBpcyBwb3NzaWJsZS5cclxuICAgIGlmKFwiZGF0YXNldFwiID09IHByb3BOYW1lKSB7XHJcbiAgICAgIHZhciBkYXRhID0ge31cclxuICAgICAgZm9yKHZhciBwIGluIGVsLmRhdGFzZXQpIHtcclxuICAgICAgICBkYXRhW3BdID0gZWwuZGF0YXNldFtwXVxyXG4gICAgICB9XHJcblxyXG4gICAgICBvYmpbcHJvcE5hbWVdID0gZGF0YVxyXG4gICAgICByZXR1cm5cclxuICAgIH1cclxuXHJcbiAgICAvLyBTcGVjaWFsIGNhc2U6IGF0dHJpYnV0ZXNcclxuICAgIC8vIHNvbWUgcHJvcGVydGllcyBhcmUgb25seSBhY2Nlc3NpYmxlIHZpYSAuYXR0cmlidXRlcywgc29cclxuICAgIC8vIHRoYXQncyB3aGF0IHdlJ2QgZG8sIGlmIHZkb20tY3JlYXRlLWVsZW1lbnQgY291bGQgaGFuZGxlIHRoaXMuXHJcbiAgICBpZihcImF0dHJpYnV0ZXNcIiA9PSBwcm9wTmFtZSkgcmV0dXJuXHJcbiAgICBpZihcInRhYkluZGV4XCIgPT0gcHJvcE5hbWUgJiYgZWwudGFiSW5kZXggPT09IC0xKSByZXR1cm5cclxuXHJcblxyXG4gICAgLy8gZGVmYXVsdDoganVzdCBjb3B5IHRoZSBwcm9wZXJ0eVxyXG4gICAgb2JqW3Byb3BOYW1lXSA9IGVsW3Byb3BOYW1lXVxyXG4gICAgcmV0dXJuXHJcbiAgfSlcclxuXHJcbiAgcmV0dXJuIG9ialxyXG59XHJcblxyXG4vKipcclxuICogRE9NTm9kZSBwcm9wZXJ0eSB3aGl0ZSBsaXN0XHJcbiAqIFRha2VuIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL1JheW5vcy9yZWFjdC9ibG9iL2RvbS1wcm9wZXJ0eS1jb25maWcvc3JjL2Jyb3dzZXIvdWkvZG9tL0RlZmF1bHRET01Qcm9wZXJ0eUNvbmZpZy5qc1xyXG4gKi9cclxudmFyIHByb3BzID1cclxuXHJcbm1vZHVsZS5leHBvcnRzLnByb3BlcnRpZXMgPSBbXHJcbiBcImFjY2VwdFwiXHJcbixcImFjY2Vzc0tleVwiXHJcbixcImFjdGlvblwiXHJcbixcImFsdFwiXHJcbixcImFzeW5jXCJcclxuLFwiYXV0b0NvbXBsZXRlXCJcclxuLFwiYXV0b1BsYXlcIlxyXG4sXCJjZWxsUGFkZGluZ1wiXHJcbixcImNlbGxTcGFjaW5nXCJcclxuLFwiY2hlY2tlZFwiXHJcbixcImNsYXNzTmFtZVwiXHJcbixcImNvbFNwYW5cIlxyXG4sXCJjb250ZW50XCJcclxuLFwiY29udGVudEVkaXRhYmxlXCJcclxuLFwiY29udHJvbHNcIlxyXG4sXCJjcm9zc09yaWdpblwiXHJcbixcImRhdGFcIlxyXG4sXCJkYXRhc2V0XCJcclxuLFwiZGVmZXJcIlxyXG4sXCJkaXJcIlxyXG4sXCJkb3dubG9hZFwiXHJcbixcImRyYWdnYWJsZVwiXHJcbixcImVuY1R5cGVcIlxyXG4sXCJmb3JtTm9WYWxpZGF0ZVwiXHJcbixcImhyZWZcIlxyXG4sXCJocmVmTGFuZ1wiXHJcbixcImh0bWxGb3JcIlxyXG4sXCJodHRwRXF1aXZcIlxyXG4sXCJpY29uXCJcclxuLFwiaWRcIlxyXG4sXCJsYWJlbFwiXHJcbixcImxhbmdcIlxyXG4sXCJsaXN0XCJcclxuLFwibG9vcFwiXHJcbixcIm1heFwiXHJcbixcIm1lZGlhR3JvdXBcIlxyXG4sXCJtZXRob2RcIlxyXG4sXCJtaW5cIlxyXG4sXCJtdWx0aXBsZVwiXHJcbixcIm11dGVkXCJcclxuLFwibmFtZVwiXHJcbixcIm5vVmFsaWRhdGVcIlxyXG4sXCJwYXR0ZXJuXCJcclxuLFwicGxhY2Vob2xkZXJcIlxyXG4sXCJwb3N0ZXJcIlxyXG4sXCJwcmVsb2FkXCJcclxuLFwicmFkaW9Hcm91cFwiXHJcbixcInJlYWRPbmx5XCJcclxuLFwicmVsXCJcclxuLFwicmVxdWlyZWRcIlxyXG4sXCJyb3dTcGFuXCJcclxuLFwic2FuZGJveFwiXHJcbixcInNjb3BlXCJcclxuLFwic2Nyb2xsTGVmdFwiXHJcbixcInNjcm9sbGluZ1wiXHJcbixcInNjcm9sbFRvcFwiXHJcbixcInNlbGVjdGVkXCJcclxuLFwic3BhblwiXHJcbixcInNwZWxsQ2hlY2tcIlxyXG4sXCJzcmNcIlxyXG4sXCJzcmNEb2NcIlxyXG4sXCJzcmNTZXRcIlxyXG4sXCJzdGFydFwiXHJcbixcInN0ZXBcIlxyXG4sXCJzdHlsZVwiXHJcbixcInRhYkluZGV4XCJcclxuLFwidGFyZ2V0XCJcclxuLFwidGl0bGVcIlxyXG4sXCJ0eXBlXCJcclxuLFwidmFsdWVcIlxyXG5cclxuLy8gTm9uLXN0YW5kYXJkIFByb3BlcnRpZXNcclxuLFwiYXV0b0NhcGl0YWxpemVcIlxyXG4sXCJhdXRvQ29ycmVjdFwiXHJcbixcInByb3BlcnR5XCJcclxuXHJcbiwgXCJhdHRyaWJ1dGVzXCJcclxuXVxyXG5cclxudmFyIGF0dHJzID1cclxubW9kdWxlLmV4cG9ydHMuYXR0cnMgPSBbXHJcbiBcImFsbG93RnVsbFNjcmVlblwiXHJcbixcImFsbG93VHJhbnNwYXJlbmN5XCJcclxuLFwiY2hhclNldFwiXHJcbixcImNvbHNcIlxyXG4sXCJjb250ZXh0TWVudVwiXHJcbixcImRhdGVUaW1lXCJcclxuLFwiZGlzYWJsZWRcIlxyXG4sXCJmb3JtXCJcclxuLFwiZnJhbWVCb3JkZXJcIlxyXG4sXCJoZWlnaHRcIlxyXG4sXCJoaWRkZW5cIlxyXG4sXCJtYXhMZW5ndGhcIlxyXG4sXCJyb2xlXCJcclxuLFwicm93c1wiXHJcbixcInNlYW1sZXNzXCJcclxuLFwic2l6ZVwiXHJcbixcIndpZHRoXCJcclxuLFwid21vZGVcIlxyXG5cclxuLy8gU1ZHIFByb3BlcnRpZXNcclxuLFwiY3hcIlxyXG4sXCJjeVwiXHJcbixcImRcIlxyXG4sXCJkeFwiXHJcbixcImR5XCJcclxuLFwiZmlsbFwiXHJcbixcImZ4XCJcclxuLFwiZnlcIlxyXG4sXCJncmFkaWVudFRyYW5zZm9ybVwiXHJcbixcImdyYWRpZW50VW5pdHNcIlxyXG4sXCJvZmZzZXRcIlxyXG4sXCJwb2ludHNcIlxyXG4sXCJyXCJcclxuLFwicnhcIlxyXG4sXCJyeVwiXHJcbixcInNwcmVhZE1ldGhvZFwiXHJcbixcInN0b3BDb2xvclwiXHJcbixcInN0b3BPcGFjaXR5XCJcclxuLFwic3Ryb2tlXCJcclxuLFwic3Ryb2tlTGluZWNhcFwiXHJcbixcInN0cm9rZVdpZHRoXCJcclxuLFwidGV4dEFuY2hvclwiXHJcbixcInRyYW5zZm9ybVwiXHJcbixcInZlcnNpb25cIlxyXG4sXCJ2aWV3Qm94XCJcclxuLFwieDFcIlxyXG4sXCJ4MlwiXHJcbixcInhcIlxyXG4sXCJ5MVwiXHJcbixcInkyXCJcclxuLFwieVwiXHJcbl1cclxuIiwidmFyIGNyZWF0ZUVsZW1lbnQgPSByZXF1aXJlKFwiLi92ZG9tL2NyZWF0ZS1lbGVtZW50LmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlRWxlbWVudFxuIiwidmFyIGRpZmYgPSByZXF1aXJlKFwiLi92dHJlZS9kaWZmLmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZGlmZlxuIiwidmFyIGggPSByZXF1aXJlKFwiLi92aXJ0dWFsLWh5cGVyc2NyaXB0L2luZGV4LmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gaFxuIiwiLyohXG4gKiBDcm9zcy1Ccm93c2VyIFNwbGl0IDEuMS4xXG4gKiBDb3B5cmlnaHQgMjAwNy0yMDEyIFN0ZXZlbiBMZXZpdGhhbiA8c3RldmVubGV2aXRoYW4uY29tPlxuICogQXZhaWxhYmxlIHVuZGVyIHRoZSBNSVQgTGljZW5zZVxuICogRUNNQVNjcmlwdCBjb21wbGlhbnQsIHVuaWZvcm0gY3Jvc3MtYnJvd3NlciBzcGxpdCBtZXRob2RcbiAqL1xuXG4vKipcbiAqIFNwbGl0cyBhIHN0cmluZyBpbnRvIGFuIGFycmF5IG9mIHN0cmluZ3MgdXNpbmcgYSByZWdleCBvciBzdHJpbmcgc2VwYXJhdG9yLiBNYXRjaGVzIG9mIHRoZVxuICogc2VwYXJhdG9yIGFyZSBub3QgaW5jbHVkZWQgaW4gdGhlIHJlc3VsdCBhcnJheS4gSG93ZXZlciwgaWYgYHNlcGFyYXRvcmAgaXMgYSByZWdleCB0aGF0IGNvbnRhaW5zXG4gKiBjYXB0dXJpbmcgZ3JvdXBzLCBiYWNrcmVmZXJlbmNlcyBhcmUgc3BsaWNlZCBpbnRvIHRoZSByZXN1bHQgZWFjaCB0aW1lIGBzZXBhcmF0b3JgIGlzIG1hdGNoZWQuXG4gKiBGaXhlcyBicm93c2VyIGJ1Z3MgY29tcGFyZWQgdG8gdGhlIG5hdGl2ZSBgU3RyaW5nLnByb3RvdHlwZS5zcGxpdGAgYW5kIGNhbiBiZSB1c2VkIHJlbGlhYmx5XG4gKiBjcm9zcy1icm93c2VyLlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gc3BsaXQuXG4gKiBAcGFyYW0ge1JlZ0V4cHxTdHJpbmd9IHNlcGFyYXRvciBSZWdleCBvciBzdHJpbmcgdG8gdXNlIGZvciBzZXBhcmF0aW5nIHRoZSBzdHJpbmcuXG4gKiBAcGFyYW0ge051bWJlcn0gW2xpbWl0XSBNYXhpbXVtIG51bWJlciBvZiBpdGVtcyB0byBpbmNsdWRlIGluIHRoZSByZXN1bHQgYXJyYXkuXG4gKiBAcmV0dXJucyB7QXJyYXl9IEFycmF5IG9mIHN1YnN0cmluZ3MuXG4gKiBAZXhhbXBsZVxuICpcbiAqIC8vIEJhc2ljIHVzZVxuICogc3BsaXQoJ2EgYiBjIGQnLCAnICcpO1xuICogLy8gLT4gWydhJywgJ2InLCAnYycsICdkJ11cbiAqXG4gKiAvLyBXaXRoIGxpbWl0XG4gKiBzcGxpdCgnYSBiIGMgZCcsICcgJywgMik7XG4gKiAvLyAtPiBbJ2EnLCAnYiddXG4gKlxuICogLy8gQmFja3JlZmVyZW5jZXMgaW4gcmVzdWx0IGFycmF5XG4gKiBzcGxpdCgnLi53b3JkMSB3b3JkMi4uJywgLyhbYS16XSspKFxcZCspL2kpO1xuICogLy8gLT4gWycuLicsICd3b3JkJywgJzEnLCAnICcsICd3b3JkJywgJzInLCAnLi4nXVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiBzcGxpdCh1bmRlZikge1xuXG4gIHZhciBuYXRpdmVTcGxpdCA9IFN0cmluZy5wcm90b3R5cGUuc3BsaXQsXG4gICAgY29tcGxpYW50RXhlY05wY2cgPSAvKCk/Py8uZXhlYyhcIlwiKVsxXSA9PT0gdW5kZWYsXG4gICAgLy8gTlBDRzogbm9ucGFydGljaXBhdGluZyBjYXB0dXJpbmcgZ3JvdXBcbiAgICBzZWxmO1xuXG4gIHNlbGYgPSBmdW5jdGlvbihzdHIsIHNlcGFyYXRvciwgbGltaXQpIHtcbiAgICAvLyBJZiBgc2VwYXJhdG9yYCBpcyBub3QgYSByZWdleCwgdXNlIGBuYXRpdmVTcGxpdGBcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHNlcGFyYXRvcikgIT09IFwiW29iamVjdCBSZWdFeHBdXCIpIHtcbiAgICAgIHJldHVybiBuYXRpdmVTcGxpdC5jYWxsKHN0ciwgc2VwYXJhdG9yLCBsaW1pdCk7XG4gICAgfVxuICAgIHZhciBvdXRwdXQgPSBbXSxcbiAgICAgIGZsYWdzID0gKHNlcGFyYXRvci5pZ25vcmVDYXNlID8gXCJpXCIgOiBcIlwiKSArIChzZXBhcmF0b3IubXVsdGlsaW5lID8gXCJtXCIgOiBcIlwiKSArIChzZXBhcmF0b3IuZXh0ZW5kZWQgPyBcInhcIiA6IFwiXCIpICsgLy8gUHJvcG9zZWQgZm9yIEVTNlxuICAgICAgKHNlcGFyYXRvci5zdGlja3kgPyBcInlcIiA6IFwiXCIpLFxuICAgICAgLy8gRmlyZWZveCAzK1xuICAgICAgbGFzdExhc3RJbmRleCA9IDAsXG4gICAgICAvLyBNYWtlIGBnbG9iYWxgIGFuZCBhdm9pZCBgbGFzdEluZGV4YCBpc3N1ZXMgYnkgd29ya2luZyB3aXRoIGEgY29weVxuICAgICAgc2VwYXJhdG9yID0gbmV3IFJlZ0V4cChzZXBhcmF0b3Iuc291cmNlLCBmbGFncyArIFwiZ1wiKSxcbiAgICAgIHNlcGFyYXRvcjIsIG1hdGNoLCBsYXN0SW5kZXgsIGxhc3RMZW5ndGg7XG4gICAgc3RyICs9IFwiXCI7IC8vIFR5cGUtY29udmVydFxuICAgIGlmICghY29tcGxpYW50RXhlY05wY2cpIHtcbiAgICAgIC8vIERvZXNuJ3QgbmVlZCBmbGFncyBneSwgYnV0IHRoZXkgZG9uJ3QgaHVydFxuICAgICAgc2VwYXJhdG9yMiA9IG5ldyBSZWdFeHAoXCJeXCIgKyBzZXBhcmF0b3Iuc291cmNlICsgXCIkKD8hXFxcXHMpXCIsIGZsYWdzKTtcbiAgICB9XG4gICAgLyogVmFsdWVzIGZvciBgbGltaXRgLCBwZXIgdGhlIHNwZWM6XG4gICAgICogSWYgdW5kZWZpbmVkOiA0Mjk0OTY3Mjk1IC8vIE1hdGgucG93KDIsIDMyKSAtIDFcbiAgICAgKiBJZiAwLCBJbmZpbml0eSwgb3IgTmFOOiAwXG4gICAgICogSWYgcG9zaXRpdmUgbnVtYmVyOiBsaW1pdCA9IE1hdGguZmxvb3IobGltaXQpOyBpZiAobGltaXQgPiA0Mjk0OTY3Mjk1KSBsaW1pdCAtPSA0Mjk0OTY3Mjk2O1xuICAgICAqIElmIG5lZ2F0aXZlIG51bWJlcjogNDI5NDk2NzI5NiAtIE1hdGguZmxvb3IoTWF0aC5hYnMobGltaXQpKVxuICAgICAqIElmIG90aGVyOiBUeXBlLWNvbnZlcnQsIHRoZW4gdXNlIHRoZSBhYm92ZSBydWxlc1xuICAgICAqL1xuICAgIGxpbWl0ID0gbGltaXQgPT09IHVuZGVmID8gLTEgPj4+IDAgOiAvLyBNYXRoLnBvdygyLCAzMikgLSAxXG4gICAgbGltaXQgPj4+IDA7IC8vIFRvVWludDMyKGxpbWl0KVxuICAgIHdoaWxlIChtYXRjaCA9IHNlcGFyYXRvci5leGVjKHN0cikpIHtcbiAgICAgIC8vIGBzZXBhcmF0b3IubGFzdEluZGV4YCBpcyBub3QgcmVsaWFibGUgY3Jvc3MtYnJvd3NlclxuICAgICAgbGFzdEluZGV4ID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGg7XG4gICAgICBpZiAobGFzdEluZGV4ID4gbGFzdExhc3RJbmRleCkge1xuICAgICAgICBvdXRwdXQucHVzaChzdHIuc2xpY2UobGFzdExhc3RJbmRleCwgbWF0Y2guaW5kZXgpKTtcbiAgICAgICAgLy8gRml4IGJyb3dzZXJzIHdob3NlIGBleGVjYCBtZXRob2RzIGRvbid0IGNvbnNpc3RlbnRseSByZXR1cm4gYHVuZGVmaW5lZGAgZm9yXG4gICAgICAgIC8vIG5vbnBhcnRpY2lwYXRpbmcgY2FwdHVyaW5nIGdyb3Vwc1xuICAgICAgICBpZiAoIWNvbXBsaWFudEV4ZWNOcGNnICYmIG1hdGNoLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBtYXRjaFswXS5yZXBsYWNlKHNlcGFyYXRvcjIsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoIC0gMjsgaSsrKSB7XG4gICAgICAgICAgICAgIGlmIChhcmd1bWVudHNbaV0gPT09IHVuZGVmKSB7XG4gICAgICAgICAgICAgICAgbWF0Y2hbaV0gPSB1bmRlZjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaC5sZW5ndGggPiAxICYmIG1hdGNoLmluZGV4IDwgc3RyLmxlbmd0aCkge1xuICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KG91dHB1dCwgbWF0Y2guc2xpY2UoMSkpO1xuICAgICAgICB9XG4gICAgICAgIGxhc3RMZW5ndGggPSBtYXRjaFswXS5sZW5ndGg7XG4gICAgICAgIGxhc3RMYXN0SW5kZXggPSBsYXN0SW5kZXg7XG4gICAgICAgIGlmIChvdXRwdXQubGVuZ3RoID49IGxpbWl0KSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzZXBhcmF0b3IubGFzdEluZGV4ID09PSBtYXRjaC5pbmRleCkge1xuICAgICAgICBzZXBhcmF0b3IubGFzdEluZGV4Kys7IC8vIEF2b2lkIGFuIGluZmluaXRlIGxvb3BcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGxhc3RMYXN0SW5kZXggPT09IHN0ci5sZW5ndGgpIHtcbiAgICAgIGlmIChsYXN0TGVuZ3RoIHx8ICFzZXBhcmF0b3IudGVzdChcIlwiKSkge1xuICAgICAgICBvdXRwdXQucHVzaChcIlwiKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0LnB1c2goc3RyLnNsaWNlKGxhc3RMYXN0SW5kZXgpKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dC5sZW5ndGggPiBsaW1pdCA/IG91dHB1dC5zbGljZSgwLCBsaW1pdCkgOiBvdXRwdXQ7XG4gIH07XG5cbiAgcmV0dXJuIHNlbGY7XG59KSgpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgT25lVmVyc2lvbkNvbnN0cmFpbnQgPSByZXF1aXJlKCdpbmRpdmlkdWFsL29uZS12ZXJzaW9uJyk7XG5cbnZhciBNWV9WRVJTSU9OID0gJzcnO1xuT25lVmVyc2lvbkNvbnN0cmFpbnQoJ2V2LXN0b3JlJywgTVlfVkVSU0lPTik7XG5cbnZhciBoYXNoS2V5ID0gJ19fRVZfU1RPUkVfS0VZQCcgKyBNWV9WRVJTSU9OO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV2U3RvcmU7XG5cbmZ1bmN0aW9uIEV2U3RvcmUoZWxlbSkge1xuICAgIHZhciBoYXNoID0gZWxlbVtoYXNoS2V5XTtcblxuICAgIGlmICghaGFzaCkge1xuICAgICAgICBoYXNoID0gZWxlbVtoYXNoS2V5XSA9IHt9O1xuICAgIH1cblxuICAgIHJldHVybiBoYXNoO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKmdsb2JhbCB3aW5kb3csIGdsb2JhbCovXG5cbnZhciByb290ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgP1xuICAgIHdpbmRvdyA6IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID9cbiAgICBnbG9iYWwgOiB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBJbmRpdmlkdWFsO1xuXG5mdW5jdGlvbiBJbmRpdmlkdWFsKGtleSwgdmFsdWUpIHtcbiAgICBpZiAoa2V5IGluIHJvb3QpIHtcbiAgICAgICAgcmV0dXJuIHJvb3Rba2V5XTtcbiAgICB9XG5cbiAgICByb290W2tleV0gPSB2YWx1ZTtcblxuICAgIHJldHVybiB2YWx1ZTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIEluZGl2aWR1YWwgPSByZXF1aXJlKCcuL2luZGV4LmpzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gT25lVmVyc2lvbjtcblxuZnVuY3Rpb24gT25lVmVyc2lvbihtb2R1bGVOYW1lLCB2ZXJzaW9uLCBkZWZhdWx0VmFsdWUpIHtcbiAgICB2YXIga2V5ID0gJ19fSU5ESVZJRFVBTF9PTkVfVkVSU0lPTl8nICsgbW9kdWxlTmFtZTtcbiAgICB2YXIgZW5mb3JjZUtleSA9IGtleSArICdfRU5GT1JDRV9TSU5HTEVUT04nO1xuXG4gICAgdmFyIHZlcnNpb25WYWx1ZSA9IEluZGl2aWR1YWwoZW5mb3JjZUtleSwgdmVyc2lvbik7XG5cbiAgICBpZiAodmVyc2lvblZhbHVlICE9PSB2ZXJzaW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuIG9ubHkgaGF2ZSBvbmUgY29weSBvZiAnICtcbiAgICAgICAgICAgIG1vZHVsZU5hbWUgKyAnLlxcbicgK1xuICAgICAgICAgICAgJ1lvdSBhbHJlYWR5IGhhdmUgdmVyc2lvbiAnICsgdmVyc2lvblZhbHVlICtcbiAgICAgICAgICAgICcgaW5zdGFsbGVkLlxcbicgK1xuICAgICAgICAgICAgJ1RoaXMgbWVhbnMgeW91IGNhbm5vdCBpbnN0YWxsIHZlcnNpb24gJyArIHZlcnNpb24pO1xuICAgIH1cblxuICAgIHJldHVybiBJbmRpdmlkdWFsKGtleSwgZGVmYXVsdFZhbHVlKTtcbn1cbiIsInZhciB0b3BMZXZlbCA9IHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnID8gZ2xvYmFsIDpcbiAgICB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHt9XG52YXIgbWluRG9jID0gcmVxdWlyZSgnbWluLWRvY3VtZW50Jyk7XG5cbmlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBkb2N1bWVudDtcbn0gZWxzZSB7XG4gICAgdmFyIGRvY2N5ID0gdG9wTGV2ZWxbJ19fR0xPQkFMX0RPQ1VNRU5UX0NBQ0hFQDQnXTtcblxuICAgIGlmICghZG9jY3kpIHtcbiAgICAgICAgZG9jY3kgPSB0b3BMZXZlbFsnX19HTE9CQUxfRE9DVU1FTlRfQ0FDSEVANCddID0gbWluRG9jO1xuICAgIH1cblxuICAgIG1vZHVsZS5leHBvcnRzID0gZG9jY3k7XG59XG4iLCJcInVzZSBzdHJpY3RcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc09iamVjdCh4KSB7XG5cdHJldHVybiB0eXBlb2YgeCA9PT0gXCJvYmplY3RcIiAmJiB4ICE9PSBudWxsO1xufTtcbiIsInZhciBuYXRpdmVJc0FycmF5ID0gQXJyYXkuaXNBcnJheVxudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5hdGl2ZUlzQXJyYXkgfHwgaXNBcnJheVxuXG5mdW5jdGlvbiBpc0FycmF5KG9iaikge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKG9iaikgPT09IFwiW29iamVjdCBBcnJheV1cIlxufVxuIiwidmFyIHBhdGNoID0gcmVxdWlyZShcIi4vdmRvbS9wYXRjaC5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhdGNoXG4iLCJ2YXIgaXNPYmplY3QgPSByZXF1aXJlKFwiaXMtb2JqZWN0XCIpXG52YXIgaXNIb29rID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZob29rLmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gYXBwbHlQcm9wZXJ0aWVzXG5cbmZ1bmN0aW9uIGFwcGx5UHJvcGVydGllcyhub2RlLCBwcm9wcywgcHJldmlvdXMpIHtcbiAgICBmb3IgKHZhciBwcm9wTmFtZSBpbiBwcm9wcykge1xuICAgICAgICB2YXIgcHJvcFZhbHVlID0gcHJvcHNbcHJvcE5hbWVdXG5cbiAgICAgICAgaWYgKHByb3BWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZW1vdmVQcm9wZXJ0eShub2RlLCBwcm9wTmFtZSwgcHJvcFZhbHVlLCBwcmV2aW91cyk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNIb29rKHByb3BWYWx1ZSkpIHtcbiAgICAgICAgICAgIHJlbW92ZVByb3BlcnR5KG5vZGUsIHByb3BOYW1lLCBwcm9wVmFsdWUsIHByZXZpb3VzKVxuICAgICAgICAgICAgaWYgKHByb3BWYWx1ZS5ob29rKSB7XG4gICAgICAgICAgICAgICAgcHJvcFZhbHVlLmhvb2sobm9kZSxcbiAgICAgICAgICAgICAgICAgICAgcHJvcE5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHByZXZpb3VzID8gcHJldmlvdXNbcHJvcE5hbWVdIDogdW5kZWZpbmVkKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGlzT2JqZWN0KHByb3BWYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBwYXRjaE9iamVjdChub2RlLCBwcm9wcywgcHJldmlvdXMsIHByb3BOYW1lLCBwcm9wVmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBub2RlW3Byb3BOYW1lXSA9IHByb3BWYWx1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmVQcm9wZXJ0eShub2RlLCBwcm9wTmFtZSwgcHJvcFZhbHVlLCBwcmV2aW91cykge1xuICAgIGlmIChwcmV2aW91cykge1xuICAgICAgICB2YXIgcHJldmlvdXNWYWx1ZSA9IHByZXZpb3VzW3Byb3BOYW1lXVxuXG4gICAgICAgIGlmICghaXNIb29rKHByZXZpb3VzVmFsdWUpKSB7XG4gICAgICAgICAgICBpZiAocHJvcE5hbWUgPT09IFwiYXR0cmlidXRlc1wiKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgYXR0ck5hbWUgaW4gcHJldmlvdXNWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyTmFtZSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BOYW1lID09PSBcInN0eWxlXCIpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpIGluIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5zdHlsZVtpXSA9IFwiXCJcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBwcmV2aW91c1ZhbHVlID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgICAgbm9kZVtwcm9wTmFtZV0gPSBcIlwiXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGVbcHJvcE5hbWVdID0gbnVsbFxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHByZXZpb3VzVmFsdWUudW5ob29rKSB7XG4gICAgICAgICAgICBwcmV2aW91c1ZhbHVlLnVuaG9vayhub2RlLCBwcm9wTmFtZSwgcHJvcFZhbHVlKVxuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBwYXRjaE9iamVjdChub2RlLCBwcm9wcywgcHJldmlvdXMsIHByb3BOYW1lLCBwcm9wVmFsdWUpIHtcbiAgICB2YXIgcHJldmlvdXNWYWx1ZSA9IHByZXZpb3VzID8gcHJldmlvdXNbcHJvcE5hbWVdIDogdW5kZWZpbmVkXG5cbiAgICAvLyBTZXQgYXR0cmlidXRlc1xuICAgIGlmIChwcm9wTmFtZSA9PT0gXCJhdHRyaWJ1dGVzXCIpIHtcbiAgICAgICAgZm9yICh2YXIgYXR0ck5hbWUgaW4gcHJvcFZhbHVlKSB7XG4gICAgICAgICAgICB2YXIgYXR0clZhbHVlID0gcHJvcFZhbHVlW2F0dHJOYW1lXVxuXG4gICAgICAgICAgICBpZiAoYXR0clZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShhdHRyTmFtZSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoYXR0ck5hbWUsIGF0dHJWYWx1ZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmKHByZXZpb3VzVmFsdWUgJiYgaXNPYmplY3QocHJldmlvdXNWYWx1ZSkgJiZcbiAgICAgICAgZ2V0UHJvdG90eXBlKHByZXZpb3VzVmFsdWUpICE9PSBnZXRQcm90b3R5cGUocHJvcFZhbHVlKSkge1xuICAgICAgICBub2RlW3Byb3BOYW1lXSA9IHByb3BWYWx1ZVxuICAgICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoIWlzT2JqZWN0KG5vZGVbcHJvcE5hbWVdKSkge1xuICAgICAgICBub2RlW3Byb3BOYW1lXSA9IHt9XG4gICAgfVxuXG4gICAgdmFyIHJlcGxhY2VyID0gcHJvcE5hbWUgPT09IFwic3R5bGVcIiA/IFwiXCIgOiB1bmRlZmluZWRcblxuICAgIGZvciAodmFyIGsgaW4gcHJvcFZhbHVlKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IHByb3BWYWx1ZVtrXVxuICAgICAgICBub2RlW3Byb3BOYW1lXVtrXSA9ICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSA/IHJlcGxhY2VyIDogdmFsdWVcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldFByb3RvdHlwZSh2YWx1ZSkge1xuICAgIGlmIChPYmplY3QuZ2V0UHJvdG90eXBlT2YpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSlcbiAgICB9IGVsc2UgaWYgKHZhbHVlLl9fcHJvdG9fXykge1xuICAgICAgICByZXR1cm4gdmFsdWUuX19wcm90b19fXG4gICAgfSBlbHNlIGlmICh2YWx1ZS5jb25zdHJ1Y3Rvcikge1xuICAgICAgICByZXR1cm4gdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlXG4gICAgfVxufVxuIiwidmFyIGRvY3VtZW50ID0gcmVxdWlyZShcImdsb2JhbC9kb2N1bWVudFwiKVxuXG52YXIgYXBwbHlQcm9wZXJ0aWVzID0gcmVxdWlyZShcIi4vYXBwbHktcHJvcGVydGllc1wiKVxuXG52YXIgaXNWTm9kZSA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12bm9kZS5qc1wiKVxudmFyIGlzVlRleHQgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdnRleHQuanNcIilcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy13aWRnZXQuanNcIilcbnZhciBoYW5kbGVUaHVuayA9IHJlcXVpcmUoXCIuLi92bm9kZS9oYW5kbGUtdGh1bmsuanNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVFbGVtZW50XG5cbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnQodm5vZGUsIG9wdHMpIHtcbiAgICB2YXIgZG9jID0gb3B0cyA/IG9wdHMuZG9jdW1lbnQgfHwgZG9jdW1lbnQgOiBkb2N1bWVudFxuICAgIHZhciB3YXJuID0gb3B0cyA/IG9wdHMud2FybiA6IG51bGxcblxuICAgIHZub2RlID0gaGFuZGxlVGh1bmsodm5vZGUpLmFcblxuICAgIGlmIChpc1dpZGdldCh2bm9kZSkpIHtcbiAgICAgICAgcmV0dXJuIHZub2RlLmluaXQoKVxuICAgIH0gZWxzZSBpZiAoaXNWVGV4dCh2bm9kZSkpIHtcbiAgICAgICAgcmV0dXJuIGRvYy5jcmVhdGVUZXh0Tm9kZSh2bm9kZS50ZXh0KVxuICAgIH0gZWxzZSBpZiAoIWlzVk5vZGUodm5vZGUpKSB7XG4gICAgICAgIGlmICh3YXJuKSB7XG4gICAgICAgICAgICB3YXJuKFwiSXRlbSBpcyBub3QgYSB2YWxpZCB2aXJ0dWFsIGRvbSBub2RlXCIsIHZub2RlKVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuXG4gICAgdmFyIG5vZGUgPSAodm5vZGUubmFtZXNwYWNlID09PSBudWxsKSA/XG4gICAgICAgIGRvYy5jcmVhdGVFbGVtZW50KHZub2RlLnRhZ05hbWUpIDpcbiAgICAgICAgZG9jLmNyZWF0ZUVsZW1lbnROUyh2bm9kZS5uYW1lc3BhY2UsIHZub2RlLnRhZ05hbWUpXG5cbiAgICB2YXIgcHJvcHMgPSB2bm9kZS5wcm9wZXJ0aWVzXG4gICAgYXBwbHlQcm9wZXJ0aWVzKG5vZGUsIHByb3BzKVxuXG4gICAgdmFyIGNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW5cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGNoaWxkTm9kZSA9IGNyZWF0ZUVsZW1lbnQoY2hpbGRyZW5baV0sIG9wdHMpXG4gICAgICAgIGlmIChjaGlsZE5vZGUpIHtcbiAgICAgICAgICAgIG5vZGUuYXBwZW5kQ2hpbGQoY2hpbGROb2RlKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGVcbn1cbiIsIi8vIE1hcHMgYSB2aXJ0dWFsIERPTSB0cmVlIG9udG8gYSByZWFsIERPTSB0cmVlIGluIGFuIGVmZmljaWVudCBtYW5uZXIuXG4vLyBXZSBkb24ndCB3YW50IHRvIHJlYWQgYWxsIG9mIHRoZSBET00gbm9kZXMgaW4gdGhlIHRyZWUgc28gd2UgdXNlXG4vLyB0aGUgaW4tb3JkZXIgdHJlZSBpbmRleGluZyB0byBlbGltaW5hdGUgcmVjdXJzaW9uIGRvd24gY2VydGFpbiBicmFuY2hlcy5cbi8vIFdlIG9ubHkgcmVjdXJzZSBpbnRvIGEgRE9NIG5vZGUgaWYgd2Uga25vdyB0aGF0IGl0IGNvbnRhaW5zIGEgY2hpbGQgb2Zcbi8vIGludGVyZXN0LlxuXG52YXIgbm9DaGlsZCA9IHt9XG5cbm1vZHVsZS5leHBvcnRzID0gZG9tSW5kZXhcblxuZnVuY3Rpb24gZG9tSW5kZXgocm9vdE5vZGUsIHRyZWUsIGluZGljZXMsIG5vZGVzKSB7XG4gICAgaWYgKCFpbmRpY2VzIHx8IGluZGljZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiB7fVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGluZGljZXMuc29ydChhc2NlbmRpbmcpXG4gICAgICAgIHJldHVybiByZWN1cnNlKHJvb3ROb2RlLCB0cmVlLCBpbmRpY2VzLCBub2RlcywgMClcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlY3Vyc2Uocm9vdE5vZGUsIHRyZWUsIGluZGljZXMsIG5vZGVzLCByb290SW5kZXgpIHtcbiAgICBub2RlcyA9IG5vZGVzIHx8IHt9XG5cblxuICAgIGlmIChyb290Tm9kZSkge1xuICAgICAgICBpZiAoaW5kZXhJblJhbmdlKGluZGljZXMsIHJvb3RJbmRleCwgcm9vdEluZGV4KSkge1xuICAgICAgICAgICAgbm9kZXNbcm9vdEluZGV4XSA9IHJvb3ROb2RlXG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdkNoaWxkcmVuID0gdHJlZS5jaGlsZHJlblxuXG4gICAgICAgIGlmICh2Q2hpbGRyZW4pIHtcblxuICAgICAgICAgICAgdmFyIGNoaWxkTm9kZXMgPSByb290Tm9kZS5jaGlsZE5vZGVzXG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdHJlZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHJvb3RJbmRleCArPSAxXG5cbiAgICAgICAgICAgICAgICB2YXIgdkNoaWxkID0gdkNoaWxkcmVuW2ldIHx8IG5vQ2hpbGRcbiAgICAgICAgICAgICAgICB2YXIgbmV4dEluZGV4ID0gcm9vdEluZGV4ICsgKHZDaGlsZC5jb3VudCB8fCAwKVxuXG4gICAgICAgICAgICAgICAgLy8gc2tpcCByZWN1cnNpb24gZG93biB0aGUgdHJlZSBpZiB0aGVyZSBhcmUgbm8gbm9kZXMgZG93biBoZXJlXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4SW5SYW5nZShpbmRpY2VzLCByb290SW5kZXgsIG5leHRJbmRleCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVjdXJzZShjaGlsZE5vZGVzW2ldLCB2Q2hpbGQsIGluZGljZXMsIG5vZGVzLCByb290SW5kZXgpXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcm9vdEluZGV4ID0gbmV4dEluZGV4XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZXNcbn1cblxuLy8gQmluYXJ5IHNlYXJjaCBmb3IgYW4gaW5kZXggaW4gdGhlIGludGVydmFsIFtsZWZ0LCByaWdodF1cbmZ1bmN0aW9uIGluZGV4SW5SYW5nZShpbmRpY2VzLCBsZWZ0LCByaWdodCkge1xuICAgIGlmIChpbmRpY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG5cbiAgICB2YXIgbWluSW5kZXggPSAwXG4gICAgdmFyIG1heEluZGV4ID0gaW5kaWNlcy5sZW5ndGggLSAxXG4gICAgdmFyIGN1cnJlbnRJbmRleFxuICAgIHZhciBjdXJyZW50SXRlbVxuXG4gICAgd2hpbGUgKG1pbkluZGV4IDw9IG1heEluZGV4KSB7XG4gICAgICAgIGN1cnJlbnRJbmRleCA9ICgobWF4SW5kZXggKyBtaW5JbmRleCkgLyAyKSA+PiAwXG4gICAgICAgIGN1cnJlbnRJdGVtID0gaW5kaWNlc1tjdXJyZW50SW5kZXhdXG5cbiAgICAgICAgaWYgKG1pbkluZGV4ID09PSBtYXhJbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnRJdGVtID49IGxlZnQgJiYgY3VycmVudEl0ZW0gPD0gcmlnaHRcbiAgICAgICAgfSBlbHNlIGlmIChjdXJyZW50SXRlbSA8IGxlZnQpIHtcbiAgICAgICAgICAgIG1pbkluZGV4ID0gY3VycmVudEluZGV4ICsgMVxuICAgICAgICB9IGVsc2UgIGlmIChjdXJyZW50SXRlbSA+IHJpZ2h0KSB7XG4gICAgICAgICAgICBtYXhJbmRleCA9IGN1cnJlbnRJbmRleCAtIDFcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGFzY2VuZGluZyhhLCBiKSB7XG4gICAgcmV0dXJuIGEgPiBiID8gMSA6IC0xXG59XG4iLCJ2YXIgYXBwbHlQcm9wZXJ0aWVzID0gcmVxdWlyZShcIi4vYXBwbHktcHJvcGVydGllc1wiKVxuXG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtd2lkZ2V0LmpzXCIpXG52YXIgVlBhdGNoID0gcmVxdWlyZShcIi4uL3Zub2RlL3ZwYXRjaC5qc1wiKVxuXG52YXIgcmVuZGVyID0gcmVxdWlyZShcIi4vY3JlYXRlLWVsZW1lbnRcIilcbnZhciB1cGRhdGVXaWRnZXQgPSByZXF1aXJlKFwiLi91cGRhdGUtd2lkZ2V0XCIpXG5cbm1vZHVsZS5leHBvcnRzID0gYXBwbHlQYXRjaFxuXG5mdW5jdGlvbiBhcHBseVBhdGNoKHZwYXRjaCwgZG9tTm9kZSwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciB0eXBlID0gdnBhdGNoLnR5cGVcbiAgICB2YXIgdk5vZGUgPSB2cGF0Y2gudk5vZGVcbiAgICB2YXIgcGF0Y2ggPSB2cGF0Y2gucGF0Y2hcblxuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlIFZQYXRjaC5SRU1PVkU6XG4gICAgICAgICAgICByZXR1cm4gcmVtb3ZlTm9kZShkb21Ob2RlLCB2Tm9kZSlcbiAgICAgICAgY2FzZSBWUGF0Y2guSU5TRVJUOlxuICAgICAgICAgICAgcmV0dXJuIGluc2VydE5vZGUoZG9tTm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpXG4gICAgICAgIGNhc2UgVlBhdGNoLlZURVhUOlxuICAgICAgICAgICAgcmV0dXJuIHN0cmluZ1BhdGNoKGRvbU5vZGUsIHZOb2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucylcbiAgICAgICAgY2FzZSBWUGF0Y2guV0lER0VUOlxuICAgICAgICAgICAgcmV0dXJuIHdpZGdldFBhdGNoKGRvbU5vZGUsIHZOb2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucylcbiAgICAgICAgY2FzZSBWUGF0Y2guVk5PREU6XG4gICAgICAgICAgICByZXR1cm4gdk5vZGVQYXRjaChkb21Ob2RlLCB2Tm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpXG4gICAgICAgIGNhc2UgVlBhdGNoLk9SREVSOlxuICAgICAgICAgICAgcmVvcmRlckNoaWxkcmVuKGRvbU5vZGUsIHBhdGNoKVxuICAgICAgICAgICAgcmV0dXJuIGRvbU5vZGVcbiAgICAgICAgY2FzZSBWUGF0Y2guUFJPUFM6XG4gICAgICAgICAgICBhcHBseVByb3BlcnRpZXMoZG9tTm9kZSwgcGF0Y2gsIHZOb2RlLnByb3BlcnRpZXMpXG4gICAgICAgICAgICByZXR1cm4gZG9tTm9kZVxuICAgICAgICBjYXNlIFZQYXRjaC5USFVOSzpcbiAgICAgICAgICAgIHJldHVybiByZXBsYWNlUm9vdChkb21Ob2RlLFxuICAgICAgICAgICAgICAgIHJlbmRlck9wdGlvbnMucGF0Y2goZG9tTm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpKVxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIGRvbU5vZGVcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZU5vZGUoZG9tTm9kZSwgdk5vZGUpIHtcbiAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZVxuXG4gICAgaWYgKHBhcmVudE5vZGUpIHtcbiAgICAgICAgcGFyZW50Tm9kZS5yZW1vdmVDaGlsZChkb21Ob2RlKVxuICAgIH1cblxuICAgIGRlc3Ryb3lXaWRnZXQoZG9tTm9kZSwgdk5vZGUpO1xuXG4gICAgcmV0dXJuIG51bGxcbn1cblxuZnVuY3Rpb24gaW5zZXJ0Tm9kZShwYXJlbnROb2RlLCB2Tm9kZSwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciBuZXdOb2RlID0gcmVuZGVyKHZOb2RlLCByZW5kZXJPcHRpb25zKVxuXG4gICAgaWYgKHBhcmVudE5vZGUpIHtcbiAgICAgICAgcGFyZW50Tm9kZS5hcHBlbmRDaGlsZChuZXdOb2RlKVxuICAgIH1cblxuICAgIHJldHVybiBwYXJlbnROb2RlXG59XG5cbmZ1bmN0aW9uIHN0cmluZ1BhdGNoKGRvbU5vZGUsIGxlZnRWTm9kZSwgdlRleHQsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgbmV3Tm9kZVxuXG4gICAgaWYgKGRvbU5vZGUubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgZG9tTm9kZS5yZXBsYWNlRGF0YSgwLCBkb21Ob2RlLmxlbmd0aCwgdlRleHQudGV4dClcbiAgICAgICAgbmV3Tm9kZSA9IGRvbU5vZGVcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZVxuICAgICAgICBuZXdOb2RlID0gcmVuZGVyKHZUZXh0LCByZW5kZXJPcHRpb25zKVxuXG4gICAgICAgIGlmIChwYXJlbnROb2RlICYmIG5ld05vZGUgIT09IGRvbU5vZGUpIHtcbiAgICAgICAgICAgIHBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld05vZGUsIGRvbU5vZGUpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Tm9kZVxufVxuXG5mdW5jdGlvbiB3aWRnZXRQYXRjaChkb21Ob2RlLCBsZWZ0Vk5vZGUsIHdpZGdldCwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciB1cGRhdGluZyA9IHVwZGF0ZVdpZGdldChsZWZ0Vk5vZGUsIHdpZGdldClcbiAgICB2YXIgbmV3Tm9kZVxuXG4gICAgaWYgKHVwZGF0aW5nKSB7XG4gICAgICAgIG5ld05vZGUgPSB3aWRnZXQudXBkYXRlKGxlZnRWTm9kZSwgZG9tTm9kZSkgfHwgZG9tTm9kZVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld05vZGUgPSByZW5kZXIod2lkZ2V0LCByZW5kZXJPcHRpb25zKVxuICAgIH1cblxuICAgIHZhciBwYXJlbnROb2RlID0gZG9tTm9kZS5wYXJlbnROb2RlXG5cbiAgICBpZiAocGFyZW50Tm9kZSAmJiBuZXdOb2RlICE9PSBkb21Ob2RlKSB7XG4gICAgICAgIHBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld05vZGUsIGRvbU5vZGUpXG4gICAgfVxuXG4gICAgaWYgKCF1cGRhdGluZykge1xuICAgICAgICBkZXN0cm95V2lkZ2V0KGRvbU5vZGUsIGxlZnRWTm9kZSlcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Tm9kZVxufVxuXG5mdW5jdGlvbiB2Tm9kZVBhdGNoKGRvbU5vZGUsIGxlZnRWTm9kZSwgdk5vZGUsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZVxuICAgIHZhciBuZXdOb2RlID0gcmVuZGVyKHZOb2RlLCByZW5kZXJPcHRpb25zKVxuXG4gICAgaWYgKHBhcmVudE5vZGUgJiYgbmV3Tm9kZSAhPT0gZG9tTm9kZSkge1xuICAgICAgICBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdOb2RlLCBkb21Ob2RlKVxuICAgIH1cblxuICAgIHJldHVybiBuZXdOb2RlXG59XG5cbmZ1bmN0aW9uIGRlc3Ryb3lXaWRnZXQoZG9tTm9kZSwgdykge1xuICAgIGlmICh0eXBlb2Ygdy5kZXN0cm95ID09PSBcImZ1bmN0aW9uXCIgJiYgaXNXaWRnZXQodykpIHtcbiAgICAgICAgdy5kZXN0cm95KGRvbU5vZGUpXG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW9yZGVyQ2hpbGRyZW4oZG9tTm9kZSwgbW92ZXMpIHtcbiAgICB2YXIgY2hpbGROb2RlcyA9IGRvbU5vZGUuY2hpbGROb2Rlc1xuICAgIHZhciBrZXlNYXAgPSB7fVxuICAgIHZhciBub2RlXG4gICAgdmFyIHJlbW92ZVxuICAgIHZhciBpbnNlcnRcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbW92ZXMucmVtb3Zlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICByZW1vdmUgPSBtb3Zlcy5yZW1vdmVzW2ldXG4gICAgICAgIG5vZGUgPSBjaGlsZE5vZGVzW3JlbW92ZS5mcm9tXVxuICAgICAgICBpZiAocmVtb3ZlLmtleSkge1xuICAgICAgICAgICAga2V5TWFwW3JlbW92ZS5rZXldID0gbm9kZVxuICAgICAgICB9XG4gICAgICAgIGRvbU5vZGUucmVtb3ZlQ2hpbGQobm9kZSlcbiAgICB9XG5cbiAgICB2YXIgbGVuZ3RoID0gY2hpbGROb2Rlcy5sZW5ndGhcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IG1vdmVzLmluc2VydHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaW5zZXJ0ID0gbW92ZXMuaW5zZXJ0c1tqXVxuICAgICAgICBub2RlID0ga2V5TWFwW2luc2VydC5rZXldXG4gICAgICAgIC8vIHRoaXMgaXMgdGhlIHdlaXJkZXN0IGJ1ZyBpJ3ZlIGV2ZXIgc2VlbiBpbiB3ZWJraXRcbiAgICAgICAgZG9tTm9kZS5pbnNlcnRCZWZvcmUobm9kZSwgaW5zZXJ0LnRvID49IGxlbmd0aCsrID8gbnVsbCA6IGNoaWxkTm9kZXNbaW5zZXJ0LnRvXSlcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VSb290KG9sZFJvb3QsIG5ld1Jvb3QpIHtcbiAgICBpZiAob2xkUm9vdCAmJiBuZXdSb290ICYmIG9sZFJvb3QgIT09IG5ld1Jvb3QgJiYgb2xkUm9vdC5wYXJlbnROb2RlKSB7XG4gICAgICAgIG9sZFJvb3QucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobmV3Um9vdCwgb2xkUm9vdClcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Um9vdDtcbn1cbiIsInZhciBkb2N1bWVudCA9IHJlcXVpcmUoXCJnbG9iYWwvZG9jdW1lbnRcIilcbnZhciBpc0FycmF5ID0gcmVxdWlyZShcIngtaXMtYXJyYXlcIilcblxudmFyIGRvbUluZGV4ID0gcmVxdWlyZShcIi4vZG9tLWluZGV4XCIpXG52YXIgcGF0Y2hPcCA9IHJlcXVpcmUoXCIuL3BhdGNoLW9wXCIpXG5tb2R1bGUuZXhwb3J0cyA9IHBhdGNoXG5cbmZ1bmN0aW9uIHBhdGNoKHJvb3ROb2RlLCBwYXRjaGVzKSB7XG4gICAgcmV0dXJuIHBhdGNoUmVjdXJzaXZlKHJvb3ROb2RlLCBwYXRjaGVzKVxufVxuXG5mdW5jdGlvbiBwYXRjaFJlY3Vyc2l2ZShyb290Tm9kZSwgcGF0Y2hlcywgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciBpbmRpY2VzID0gcGF0Y2hJbmRpY2VzKHBhdGNoZXMpXG5cbiAgICBpZiAoaW5kaWNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHJvb3ROb2RlXG4gICAgfVxuXG4gICAgdmFyIGluZGV4ID0gZG9tSW5kZXgocm9vdE5vZGUsIHBhdGNoZXMuYSwgaW5kaWNlcylcbiAgICB2YXIgb3duZXJEb2N1bWVudCA9IHJvb3ROb2RlLm93bmVyRG9jdW1lbnRcblxuICAgIGlmICghcmVuZGVyT3B0aW9ucykge1xuICAgICAgICByZW5kZXJPcHRpb25zID0geyBwYXRjaDogcGF0Y2hSZWN1cnNpdmUgfVxuICAgICAgICBpZiAob3duZXJEb2N1bWVudCAhPT0gZG9jdW1lbnQpIHtcbiAgICAgICAgICAgIHJlbmRlck9wdGlvbnMuZG9jdW1lbnQgPSBvd25lckRvY3VtZW50XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGluZGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG5vZGVJbmRleCA9IGluZGljZXNbaV1cbiAgICAgICAgcm9vdE5vZGUgPSBhcHBseVBhdGNoKHJvb3ROb2RlLFxuICAgICAgICAgICAgaW5kZXhbbm9kZUluZGV4XSxcbiAgICAgICAgICAgIHBhdGNoZXNbbm9kZUluZGV4XSxcbiAgICAgICAgICAgIHJlbmRlck9wdGlvbnMpXG4gICAgfVxuXG4gICAgcmV0dXJuIHJvb3ROb2RlXG59XG5cbmZ1bmN0aW9uIGFwcGx5UGF0Y2gocm9vdE5vZGUsIGRvbU5vZGUsIHBhdGNoTGlzdCwgcmVuZGVyT3B0aW9ucykge1xuICAgIGlmICghZG9tTm9kZSkge1xuICAgICAgICByZXR1cm4gcm9vdE5vZGVcbiAgICB9XG5cbiAgICB2YXIgbmV3Tm9kZVxuXG4gICAgaWYgKGlzQXJyYXkocGF0Y2hMaXN0KSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBhdGNoTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbmV3Tm9kZSA9IHBhdGNoT3AocGF0Y2hMaXN0W2ldLCBkb21Ob2RlLCByZW5kZXJPcHRpb25zKVxuXG4gICAgICAgICAgICBpZiAoZG9tTm9kZSA9PT0gcm9vdE5vZGUpIHtcbiAgICAgICAgICAgICAgICByb290Tm9kZSA9IG5ld05vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld05vZGUgPSBwYXRjaE9wKHBhdGNoTGlzdCwgZG9tTm9kZSwgcmVuZGVyT3B0aW9ucylcblxuICAgICAgICBpZiAoZG9tTm9kZSA9PT0gcm9vdE5vZGUpIHtcbiAgICAgICAgICAgIHJvb3ROb2RlID0gbmV3Tm9kZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJvb3ROb2RlXG59XG5cbmZ1bmN0aW9uIHBhdGNoSW5kaWNlcyhwYXRjaGVzKSB7XG4gICAgdmFyIGluZGljZXMgPSBbXVxuXG4gICAgZm9yICh2YXIga2V5IGluIHBhdGNoZXMpIHtcbiAgICAgICAgaWYgKGtleSAhPT0gXCJhXCIpIHtcbiAgICAgICAgICAgIGluZGljZXMucHVzaChOdW1iZXIoa2V5KSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBpbmRpY2VzXG59XG4iLCJ2YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtd2lkZ2V0LmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gdXBkYXRlV2lkZ2V0XG5cbmZ1bmN0aW9uIHVwZGF0ZVdpZGdldChhLCBiKSB7XG4gICAgaWYgKGlzV2lkZ2V0KGEpICYmIGlzV2lkZ2V0KGIpKSB7XG4gICAgICAgIGlmIChcIm5hbWVcIiBpbiBhICYmIFwibmFtZVwiIGluIGIpIHtcbiAgICAgICAgICAgIHJldHVybiBhLmlkID09PSBiLmlkXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gYS5pbml0ID09PSBiLmluaXRcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgRXZTdG9yZSA9IHJlcXVpcmUoJ2V2LXN0b3JlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gRXZIb29rO1xuXG5mdW5jdGlvbiBFdkhvb2sodmFsdWUpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRXZIb29rKSkge1xuICAgICAgICByZXR1cm4gbmV3IEV2SG9vayh2YWx1ZSk7XG4gICAgfVxuXG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xufVxuXG5Fdkhvb2sucHJvdG90eXBlLmhvb2sgPSBmdW5jdGlvbiAobm9kZSwgcHJvcGVydHlOYW1lKSB7XG4gICAgdmFyIGVzID0gRXZTdG9yZShub2RlKTtcbiAgICB2YXIgcHJvcE5hbWUgPSBwcm9wZXJ0eU5hbWUuc3Vic3RyKDMpO1xuXG4gICAgZXNbcHJvcE5hbWVdID0gdGhpcy52YWx1ZTtcbn07XG5cbkV2SG9vay5wcm90b3R5cGUudW5ob29rID0gZnVuY3Rpb24obm9kZSwgcHJvcGVydHlOYW1lKSB7XG4gICAgdmFyIGVzID0gRXZTdG9yZShub2RlKTtcbiAgICB2YXIgcHJvcE5hbWUgPSBwcm9wZXJ0eU5hbWUuc3Vic3RyKDMpO1xuXG4gICAgZXNbcHJvcE5hbWVdID0gdW5kZWZpbmVkO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBTb2Z0U2V0SG9vaztcblxuZnVuY3Rpb24gU29mdFNldEhvb2sodmFsdWUpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgU29mdFNldEhvb2spKSB7XG4gICAgICAgIHJldHVybiBuZXcgU29mdFNldEhvb2sodmFsdWUpO1xuICAgIH1cblxuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbn1cblxuU29mdFNldEhvb2sucHJvdG90eXBlLmhvb2sgPSBmdW5jdGlvbiAobm9kZSwgcHJvcGVydHlOYW1lKSB7XG4gICAgaWYgKG5vZGVbcHJvcGVydHlOYW1lXSAhPT0gdGhpcy52YWx1ZSkge1xuICAgICAgICBub2RlW3Byb3BlcnR5TmFtZV0gPSB0aGlzLnZhbHVlO1xuICAgIH1cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBpc0FycmF5ID0gcmVxdWlyZSgneC1pcy1hcnJheScpO1xuXG52YXIgVk5vZGUgPSByZXF1aXJlKCcuLi92bm9kZS92bm9kZS5qcycpO1xudmFyIFZUZXh0ID0gcmVxdWlyZSgnLi4vdm5vZGUvdnRleHQuanMnKTtcbnZhciBpc1ZOb2RlID0gcmVxdWlyZSgnLi4vdm5vZGUvaXMtdm5vZGUnKTtcbnZhciBpc1ZUZXh0ID0gcmVxdWlyZSgnLi4vdm5vZGUvaXMtdnRleHQnKTtcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoJy4uL3Zub2RlL2lzLXdpZGdldCcpO1xudmFyIGlzSG9vayA9IHJlcXVpcmUoJy4uL3Zub2RlL2lzLXZob29rJyk7XG52YXIgaXNWVGh1bmsgPSByZXF1aXJlKCcuLi92bm9kZS9pcy10aHVuaycpO1xuXG52YXIgcGFyc2VUYWcgPSByZXF1aXJlKCcuL3BhcnNlLXRhZy5qcycpO1xudmFyIHNvZnRTZXRIb29rID0gcmVxdWlyZSgnLi9ob29rcy9zb2Z0LXNldC1ob29rLmpzJyk7XG52YXIgZXZIb29rID0gcmVxdWlyZSgnLi9ob29rcy9ldi1ob29rLmpzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gaDtcblxuZnVuY3Rpb24gaCh0YWdOYW1lLCBwcm9wZXJ0aWVzLCBjaGlsZHJlbikge1xuICAgIHZhciBjaGlsZE5vZGVzID0gW107XG4gICAgdmFyIHRhZywgcHJvcHMsIGtleSwgbmFtZXNwYWNlO1xuXG4gICAgaWYgKCFjaGlsZHJlbiAmJiBpc0NoaWxkcmVuKHByb3BlcnRpZXMpKSB7XG4gICAgICAgIGNoaWxkcmVuID0gcHJvcGVydGllcztcbiAgICAgICAgcHJvcHMgPSB7fTtcbiAgICB9XG5cbiAgICBwcm9wcyA9IHByb3BzIHx8IHByb3BlcnRpZXMgfHwge307XG4gICAgdGFnID0gcGFyc2VUYWcodGFnTmFtZSwgcHJvcHMpO1xuXG4gICAgLy8gc3VwcG9ydCBrZXlzXG4gICAgaWYgKHByb3BzLmhhc093blByb3BlcnR5KCdrZXknKSkge1xuICAgICAgICBrZXkgPSBwcm9wcy5rZXk7XG4gICAgICAgIHByb3BzLmtleSA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICAvLyBzdXBwb3J0IG5hbWVzcGFjZVxuICAgIGlmIChwcm9wcy5oYXNPd25Qcm9wZXJ0eSgnbmFtZXNwYWNlJykpIHtcbiAgICAgICAgbmFtZXNwYWNlID0gcHJvcHMubmFtZXNwYWNlO1xuICAgICAgICBwcm9wcy5uYW1lc3BhY2UgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLy8gZml4IGN1cnNvciBidWdcbiAgICBpZiAodGFnID09PSAnSU5QVVQnICYmXG4gICAgICAgICFuYW1lc3BhY2UgJiZcbiAgICAgICAgcHJvcHMuaGFzT3duUHJvcGVydHkoJ3ZhbHVlJykgJiZcbiAgICAgICAgcHJvcHMudmFsdWUgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAhaXNIb29rKHByb3BzLnZhbHVlKVxuICAgICkge1xuICAgICAgICBwcm9wcy52YWx1ZSA9IHNvZnRTZXRIb29rKHByb3BzLnZhbHVlKTtcbiAgICB9XG5cbiAgICB0cmFuc2Zvcm1Qcm9wZXJ0aWVzKHByb3BzKTtcblxuICAgIGlmIChjaGlsZHJlbiAhPT0gdW5kZWZpbmVkICYmIGNoaWxkcmVuICE9PSBudWxsKSB7XG4gICAgICAgIGFkZENoaWxkKGNoaWxkcmVuLCBjaGlsZE5vZGVzLCB0YWcsIHByb3BzKTtcbiAgICB9XG5cblxuICAgIHJldHVybiBuZXcgVk5vZGUodGFnLCBwcm9wcywgY2hpbGROb2Rlcywga2V5LCBuYW1lc3BhY2UpO1xufVxuXG5mdW5jdGlvbiBhZGRDaGlsZChjLCBjaGlsZE5vZGVzLCB0YWcsIHByb3BzKSB7XG4gICAgaWYgKHR5cGVvZiBjID09PSAnc3RyaW5nJykge1xuICAgICAgICBjaGlsZE5vZGVzLnB1c2gobmV3IFZUZXh0KGMpKTtcbiAgICB9IGVsc2UgaWYgKGlzQ2hpbGQoYykpIHtcbiAgICAgICAgY2hpbGROb2Rlcy5wdXNoKGMpO1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShjKSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFkZENoaWxkKGNbaV0sIGNoaWxkTm9kZXMsIHRhZywgcHJvcHMpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChjID09PSBudWxsIHx8IGMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm47XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgVW5leHBlY3RlZFZpcnR1YWxFbGVtZW50KHtcbiAgICAgICAgICAgIGZvcmVpZ25PYmplY3Q6IGMsXG4gICAgICAgICAgICBwYXJlbnRWbm9kZToge1xuICAgICAgICAgICAgICAgIHRhZ05hbWU6IHRhZyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiBwcm9wc1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybVByb3BlcnRpZXMocHJvcHMpIHtcbiAgICBmb3IgKHZhciBwcm9wTmFtZSBpbiBwcm9wcykge1xuICAgICAgICBpZiAocHJvcHMuaGFzT3duUHJvcGVydHkocHJvcE5hbWUpKSB7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBwcm9wc1twcm9wTmFtZV07XG5cbiAgICAgICAgICAgIGlmIChpc0hvb2sodmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwcm9wTmFtZS5zdWJzdHIoMCwgMykgPT09ICdldi0nKSB7XG4gICAgICAgICAgICAgICAgLy8gYWRkIGV2LWZvbyBzdXBwb3J0XG4gICAgICAgICAgICAgICAgcHJvcHNbcHJvcE5hbWVdID0gZXZIb29rKHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaXNDaGlsZCh4KSB7XG4gICAgcmV0dXJuIGlzVk5vZGUoeCkgfHwgaXNWVGV4dCh4KSB8fCBpc1dpZGdldCh4KSB8fCBpc1ZUaHVuayh4KTtcbn1cblxuZnVuY3Rpb24gaXNDaGlsZHJlbih4KSB7XG4gICAgcmV0dXJuIHR5cGVvZiB4ID09PSAnc3RyaW5nJyB8fCBpc0FycmF5KHgpIHx8IGlzQ2hpbGQoeCk7XG59XG5cbmZ1bmN0aW9uIFVuZXhwZWN0ZWRWaXJ0dWFsRWxlbWVudChkYXRhKSB7XG4gICAgdmFyIGVyciA9IG5ldyBFcnJvcigpO1xuXG4gICAgZXJyLnR5cGUgPSAndmlydHVhbC1oeXBlcnNjcmlwdC51bmV4cGVjdGVkLnZpcnR1YWwtZWxlbWVudCc7XG4gICAgZXJyLm1lc3NhZ2UgPSAnVW5leHBlY3RlZCB2aXJ0dWFsIGNoaWxkIHBhc3NlZCB0byBoKCkuXFxuJyArXG4gICAgICAgICdFeHBlY3RlZCBhIFZOb2RlIC8gVnRodW5rIC8gVldpZGdldCAvIHN0cmluZyBidXQ6XFxuJyArXG4gICAgICAgICdnb3Q6XFxuJyArXG4gICAgICAgIGVycm9yU3RyaW5nKGRhdGEuZm9yZWlnbk9iamVjdCkgK1xuICAgICAgICAnLlxcbicgK1xuICAgICAgICAnVGhlIHBhcmVudCB2bm9kZSBpczpcXG4nICtcbiAgICAgICAgZXJyb3JTdHJpbmcoZGF0YS5wYXJlbnRWbm9kZSlcbiAgICAgICAgJ1xcbicgK1xuICAgICAgICAnU3VnZ2VzdGVkIGZpeDogY2hhbmdlIHlvdXIgYGgoLi4uLCBbIC4uLiBdKWAgY2FsbHNpdGUuJztcbiAgICBlcnIuZm9yZWlnbk9iamVjdCA9IGRhdGEuZm9yZWlnbk9iamVjdDtcbiAgICBlcnIucGFyZW50Vm5vZGUgPSBkYXRhLnBhcmVudFZub2RlO1xuXG4gICAgcmV0dXJuIGVycjtcbn1cblxuZnVuY3Rpb24gZXJyb3JTdHJpbmcob2JqKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG9iaiwgbnVsbCwgJyAgICAnKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBTdHJpbmcob2JqKTtcbiAgICB9XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzcGxpdCA9IHJlcXVpcmUoJ2Jyb3dzZXItc3BsaXQnKTtcblxudmFyIGNsYXNzSWRTcGxpdCA9IC8oW1xcLiNdP1thLXpBLVowLTlfOi1dKykvO1xudmFyIG5vdENsYXNzSWQgPSAvXlxcLnwjLztcblxubW9kdWxlLmV4cG9ydHMgPSBwYXJzZVRhZztcblxuZnVuY3Rpb24gcGFyc2VUYWcodGFnLCBwcm9wcykge1xuICAgIGlmICghdGFnKSB7XG4gICAgICAgIHJldHVybiAnRElWJztcbiAgICB9XG5cbiAgICB2YXIgbm9JZCA9ICEocHJvcHMuaGFzT3duUHJvcGVydHkoJ2lkJykpO1xuXG4gICAgdmFyIHRhZ1BhcnRzID0gc3BsaXQodGFnLCBjbGFzc0lkU3BsaXQpO1xuICAgIHZhciB0YWdOYW1lID0gbnVsbDtcblxuICAgIGlmIChub3RDbGFzc0lkLnRlc3QodGFnUGFydHNbMV0pKSB7XG4gICAgICAgIHRhZ05hbWUgPSAnRElWJztcbiAgICB9XG5cbiAgICB2YXIgY2xhc3NlcywgcGFydCwgdHlwZSwgaTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCB0YWdQYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBwYXJ0ID0gdGFnUGFydHNbaV07XG5cbiAgICAgICAgaWYgKCFwYXJ0KSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHR5cGUgPSBwYXJ0LmNoYXJBdCgwKTtcblxuICAgICAgICBpZiAoIXRhZ05hbWUpIHtcbiAgICAgICAgICAgIHRhZ05hbWUgPSBwYXJ0O1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICcuJykge1xuICAgICAgICAgICAgY2xhc3NlcyA9IGNsYXNzZXMgfHwgW107XG4gICAgICAgICAgICBjbGFzc2VzLnB1c2gocGFydC5zdWJzdHJpbmcoMSwgcGFydC5sZW5ndGgpKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnIycgJiYgbm9JZCkge1xuICAgICAgICAgICAgcHJvcHMuaWQgPSBwYXJ0LnN1YnN0cmluZygxLCBwYXJ0Lmxlbmd0aCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY2xhc3Nlcykge1xuICAgICAgICBpZiAocHJvcHMuY2xhc3NOYW1lKSB7XG4gICAgICAgICAgICBjbGFzc2VzLnB1c2gocHJvcHMuY2xhc3NOYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb3BzLmNsYXNzTmFtZSA9IGNsYXNzZXMuam9pbignICcpO1xuICAgIH1cblxuICAgIHJldHVybiBwcm9wcy5uYW1lc3BhY2UgPyB0YWdOYW1lIDogdGFnTmFtZS50b1VwcGVyQ2FzZSgpO1xufVxuIiwidmFyIGlzVk5vZGUgPSByZXF1aXJlKFwiLi9pcy12bm9kZVwiKVxudmFyIGlzVlRleHQgPSByZXF1aXJlKFwiLi9pcy12dGV4dFwiKVxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4vaXMtd2lkZ2V0XCIpXG52YXIgaXNUaHVuayA9IHJlcXVpcmUoXCIuL2lzLXRodW5rXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlVGh1bmtcblxuZnVuY3Rpb24gaGFuZGxlVGh1bmsoYSwgYikge1xuICAgIHZhciByZW5kZXJlZEEgPSBhXG4gICAgdmFyIHJlbmRlcmVkQiA9IGJcblxuICAgIGlmIChpc1RodW5rKGIpKSB7XG4gICAgICAgIHJlbmRlcmVkQiA9IHJlbmRlclRodW5rKGIsIGEpXG4gICAgfVxuXG4gICAgaWYgKGlzVGh1bmsoYSkpIHtcbiAgICAgICAgcmVuZGVyZWRBID0gcmVuZGVyVGh1bmsoYSwgbnVsbClcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBhOiByZW5kZXJlZEEsXG4gICAgICAgIGI6IHJlbmRlcmVkQlxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVuZGVyVGh1bmsodGh1bmssIHByZXZpb3VzKSB7XG4gICAgdmFyIHJlbmRlcmVkVGh1bmsgPSB0aHVuay52bm9kZVxuXG4gICAgaWYgKCFyZW5kZXJlZFRodW5rKSB7XG4gICAgICAgIHJlbmRlcmVkVGh1bmsgPSB0aHVuay52bm9kZSA9IHRodW5rLnJlbmRlcihwcmV2aW91cylcbiAgICB9XG5cbiAgICBpZiAoIShpc1ZOb2RlKHJlbmRlcmVkVGh1bmspIHx8XG4gICAgICAgICAgICBpc1ZUZXh0KHJlbmRlcmVkVGh1bmspIHx8XG4gICAgICAgICAgICBpc1dpZGdldChyZW5kZXJlZFRodW5rKSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwidGh1bmsgZGlkIG5vdCByZXR1cm4gYSB2YWxpZCBub2RlXCIpO1xuICAgIH1cblxuICAgIHJldHVybiByZW5kZXJlZFRodW5rXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzVGh1bmtcclxuXHJcbmZ1bmN0aW9uIGlzVGh1bmsodCkge1xyXG4gICAgcmV0dXJuIHQgJiYgdC50eXBlID09PSBcIlRodW5rXCJcclxufVxyXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzSG9va1xuXG5mdW5jdGlvbiBpc0hvb2soaG9vaykge1xuICAgIHJldHVybiBob29rICYmXG4gICAgICAodHlwZW9mIGhvb2suaG9vayA9PT0gXCJmdW5jdGlvblwiICYmICFob29rLmhhc093blByb3BlcnR5KFwiaG9va1wiKSB8fFxuICAgICAgIHR5cGVvZiBob29rLnVuaG9vayA9PT0gXCJmdW5jdGlvblwiICYmICFob29rLmhhc093blByb3BlcnR5KFwidW5ob29rXCIpKVxufVxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gaXNWaXJ0dWFsTm9kZVxuXG5mdW5jdGlvbiBpc1ZpcnR1YWxOb2RlKHgpIHtcbiAgICByZXR1cm4geCAmJiB4LnR5cGUgPT09IFwiVmlydHVhbE5vZGVcIiAmJiB4LnZlcnNpb24gPT09IHZlcnNpb25cbn1cbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzVmlydHVhbFRleHRcblxuZnVuY3Rpb24gaXNWaXJ0dWFsVGV4dCh4KSB7XG4gICAgcmV0dXJuIHggJiYgeC50eXBlID09PSBcIlZpcnR1YWxUZXh0XCIgJiYgeC52ZXJzaW9uID09PSB2ZXJzaW9uXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzV2lkZ2V0XG5cbmZ1bmN0aW9uIGlzV2lkZ2V0KHcpIHtcbiAgICByZXR1cm4gdyAmJiB3LnR5cGUgPT09IFwiV2lkZ2V0XCJcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gXCIyXCJcbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxudmFyIGlzVk5vZGUgPSByZXF1aXJlKFwiLi9pcy12bm9kZVwiKVxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4vaXMtd2lkZ2V0XCIpXG52YXIgaXNUaHVuayA9IHJlcXVpcmUoXCIuL2lzLXRodW5rXCIpXG52YXIgaXNWSG9vayA9IHJlcXVpcmUoXCIuL2lzLXZob29rXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gVmlydHVhbE5vZGVcblxudmFyIG5vUHJvcGVydGllcyA9IHt9XG52YXIgbm9DaGlsZHJlbiA9IFtdXG5cbmZ1bmN0aW9uIFZpcnR1YWxOb2RlKHRhZ05hbWUsIHByb3BlcnRpZXMsIGNoaWxkcmVuLCBrZXksIG5hbWVzcGFjZSkge1xuICAgIHRoaXMudGFnTmFtZSA9IHRhZ05hbWVcbiAgICB0aGlzLnByb3BlcnRpZXMgPSBwcm9wZXJ0aWVzIHx8IG5vUHJvcGVydGllc1xuICAgIHRoaXMuY2hpbGRyZW4gPSBjaGlsZHJlbiB8fCBub0NoaWxkcmVuXG4gICAgdGhpcy5rZXkgPSBrZXkgIT0gbnVsbCA/IFN0cmluZyhrZXkpIDogdW5kZWZpbmVkXG4gICAgdGhpcy5uYW1lc3BhY2UgPSAodHlwZW9mIG5hbWVzcGFjZSA9PT0gXCJzdHJpbmdcIikgPyBuYW1lc3BhY2UgOiBudWxsXG5cbiAgICB2YXIgY291bnQgPSAoY2hpbGRyZW4gJiYgY2hpbGRyZW4ubGVuZ3RoKSB8fCAwXG4gICAgdmFyIGRlc2NlbmRhbnRzID0gMFxuICAgIHZhciBoYXNXaWRnZXRzID0gZmFsc2VcbiAgICB2YXIgaGFzVGh1bmtzID0gZmFsc2VcbiAgICB2YXIgZGVzY2VuZGFudEhvb2tzID0gZmFsc2VcbiAgICB2YXIgaG9va3NcblxuICAgIGZvciAodmFyIHByb3BOYW1lIGluIHByb3BlcnRpZXMpIHtcbiAgICAgICAgaWYgKHByb3BlcnRpZXMuaGFzT3duUHJvcGVydHkocHJvcE5hbWUpKSB7XG4gICAgICAgICAgICB2YXIgcHJvcGVydHkgPSBwcm9wZXJ0aWVzW3Byb3BOYW1lXVxuICAgICAgICAgICAgaWYgKGlzVkhvb2socHJvcGVydHkpICYmIHByb3BlcnR5LnVuaG9vaykge1xuICAgICAgICAgICAgICAgIGlmICghaG9va3MpIHtcbiAgICAgICAgICAgICAgICAgICAgaG9va3MgPSB7fVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGhvb2tzW3Byb3BOYW1lXSA9IHByb3BlcnR5XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5baV1cbiAgICAgICAgaWYgKGlzVk5vZGUoY2hpbGQpKSB7XG4gICAgICAgICAgICBkZXNjZW5kYW50cyArPSBjaGlsZC5jb3VudCB8fCAwXG5cbiAgICAgICAgICAgIGlmICghaGFzV2lkZ2V0cyAmJiBjaGlsZC5oYXNXaWRnZXRzKSB7XG4gICAgICAgICAgICAgICAgaGFzV2lkZ2V0cyA9IHRydWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFoYXNUaHVua3MgJiYgY2hpbGQuaGFzVGh1bmtzKSB7XG4gICAgICAgICAgICAgICAgaGFzVGh1bmtzID0gdHJ1ZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWRlc2NlbmRhbnRIb29rcyAmJiAoY2hpbGQuaG9va3MgfHwgY2hpbGQuZGVzY2VuZGFudEhvb2tzKSkge1xuICAgICAgICAgICAgICAgIGRlc2NlbmRhbnRIb29rcyA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICghaGFzV2lkZ2V0cyAmJiBpc1dpZGdldChjaGlsZCkpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2hpbGQuZGVzdHJveSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAgICAgaGFzV2lkZ2V0cyA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICghaGFzVGh1bmtzICYmIGlzVGh1bmsoY2hpbGQpKSB7XG4gICAgICAgICAgICBoYXNUaHVua3MgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5jb3VudCA9IGNvdW50ICsgZGVzY2VuZGFudHNcbiAgICB0aGlzLmhhc1dpZGdldHMgPSBoYXNXaWRnZXRzXG4gICAgdGhpcy5oYXNUaHVua3MgPSBoYXNUaHVua3NcbiAgICB0aGlzLmhvb2tzID0gaG9va3NcbiAgICB0aGlzLmRlc2NlbmRhbnRIb29rcyA9IGRlc2NlbmRhbnRIb29rc1xufVxuXG5WaXJ0dWFsTm9kZS5wcm90b3R5cGUudmVyc2lvbiA9IHZlcnNpb25cblZpcnR1YWxOb2RlLnByb3RvdHlwZS50eXBlID0gXCJWaXJ0dWFsTm9kZVwiXG4iLCJ2YXIgdmVyc2lvbiA9IHJlcXVpcmUoXCIuL3ZlcnNpb25cIilcblxuVmlydHVhbFBhdGNoLk5PTkUgPSAwXG5WaXJ0dWFsUGF0Y2guVlRFWFQgPSAxXG5WaXJ0dWFsUGF0Y2guVk5PREUgPSAyXG5WaXJ0dWFsUGF0Y2guV0lER0VUID0gM1xuVmlydHVhbFBhdGNoLlBST1BTID0gNFxuVmlydHVhbFBhdGNoLk9SREVSID0gNVxuVmlydHVhbFBhdGNoLklOU0VSVCA9IDZcblZpcnR1YWxQYXRjaC5SRU1PVkUgPSA3XG5WaXJ0dWFsUGF0Y2guVEhVTksgPSA4XG5cbm1vZHVsZS5leHBvcnRzID0gVmlydHVhbFBhdGNoXG5cbmZ1bmN0aW9uIFZpcnR1YWxQYXRjaCh0eXBlLCB2Tm9kZSwgcGF0Y2gpIHtcbiAgICB0aGlzLnR5cGUgPSBOdW1iZXIodHlwZSlcbiAgICB0aGlzLnZOb2RlID0gdk5vZGVcbiAgICB0aGlzLnBhdGNoID0gcGF0Y2hcbn1cblxuVmlydHVhbFBhdGNoLnByb3RvdHlwZS52ZXJzaW9uID0gdmVyc2lvblxuVmlydHVhbFBhdGNoLnByb3RvdHlwZS50eXBlID0gXCJWaXJ0dWFsUGF0Y2hcIlxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gVmlydHVhbFRleHRcblxuZnVuY3Rpb24gVmlydHVhbFRleHQodGV4dCkge1xuICAgIHRoaXMudGV4dCA9IFN0cmluZyh0ZXh0KVxufVxuXG5WaXJ0dWFsVGV4dC5wcm90b3R5cGUudmVyc2lvbiA9IHZlcnNpb25cblZpcnR1YWxUZXh0LnByb3RvdHlwZS50eXBlID0gXCJWaXJ0dWFsVGV4dFwiXG4iLCJ2YXIgaXNPYmplY3QgPSByZXF1aXJlKFwiaXMtb2JqZWN0XCIpXG52YXIgaXNIb29rID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZob29rXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZGlmZlByb3BzXG5cbmZ1bmN0aW9uIGRpZmZQcm9wcyhhLCBiKSB7XG4gICAgdmFyIGRpZmZcblxuICAgIGZvciAodmFyIGFLZXkgaW4gYSkge1xuICAgICAgICBpZiAoIShhS2V5IGluIGIpKSB7XG4gICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgZGlmZlthS2V5XSA9IHVuZGVmaW5lZFxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGFWYWx1ZSA9IGFbYUtleV1cbiAgICAgICAgdmFyIGJWYWx1ZSA9IGJbYUtleV1cblxuICAgICAgICBpZiAoYVZhbHVlID09PSBiVmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH0gZWxzZSBpZiAoaXNPYmplY3QoYVZhbHVlKSAmJiBpc09iamVjdChiVmFsdWUpKSB7XG4gICAgICAgICAgICBpZiAoZ2V0UHJvdG90eXBlKGJWYWx1ZSkgIT09IGdldFByb3RvdHlwZShhVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgICAgICBkaWZmW2FLZXldID0gYlZhbHVlXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzSG9vayhiVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICAgICAgIGRpZmZbYUtleV0gPSBiVmFsdWVcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIG9iamVjdERpZmYgPSBkaWZmUHJvcHMoYVZhbHVlLCBiVmFsdWUpXG4gICAgICAgICAgICAgICAgaWYgKG9iamVjdERpZmYpIHtcbiAgICAgICAgICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgICAgICAgICAgZGlmZlthS2V5XSA9IG9iamVjdERpZmZcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgZGlmZlthS2V5XSA9IGJWYWx1ZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgYktleSBpbiBiKSB7XG4gICAgICAgIGlmICghKGJLZXkgaW4gYSkpIHtcbiAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICBkaWZmW2JLZXldID0gYltiS2V5XVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGRpZmZcbn1cblxuZnVuY3Rpb24gZ2V0UHJvdG90eXBlKHZhbHVlKSB7XG4gIGlmIChPYmplY3QuZ2V0UHJvdG90eXBlT2YpIHtcbiAgICByZXR1cm4gT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKVxuICB9IGVsc2UgaWYgKHZhbHVlLl9fcHJvdG9fXykge1xuICAgIHJldHVybiB2YWx1ZS5fX3Byb3RvX19cbiAgfSBlbHNlIGlmICh2YWx1ZS5jb25zdHJ1Y3Rvcikge1xuICAgIHJldHVybiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGVcbiAgfVxufVxuIiwidmFyIGlzQXJyYXkgPSByZXF1aXJlKFwieC1pcy1hcnJheVwiKVxuXG52YXIgVlBhdGNoID0gcmVxdWlyZShcIi4uL3Zub2RlL3ZwYXRjaFwiKVxudmFyIGlzVk5vZGUgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdm5vZGVcIilcbnZhciBpc1ZUZXh0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZ0ZXh0XCIpXG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtd2lkZ2V0XCIpXG52YXIgaXNUaHVuayA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy10aHVua1wiKVxudmFyIGhhbmRsZVRodW5rID0gcmVxdWlyZShcIi4uL3Zub2RlL2hhbmRsZS10aHVua1wiKVxuXG52YXIgZGlmZlByb3BzID0gcmVxdWlyZShcIi4vZGlmZi1wcm9wc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRpZmZcblxuZnVuY3Rpb24gZGlmZihhLCBiKSB7XG4gICAgdmFyIHBhdGNoID0geyBhOiBhIH1cbiAgICB3YWxrKGEsIGIsIHBhdGNoLCAwKVxuICAgIHJldHVybiBwYXRjaFxufVxuXG5mdW5jdGlvbiB3YWxrKGEsIGIsIHBhdGNoLCBpbmRleCkge1xuICAgIGlmIChhID09PSBiKSB7XG4gICAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHZhciBhcHBseSA9IHBhdGNoW2luZGV4XVxuICAgIHZhciBhcHBseUNsZWFyID0gZmFsc2VcblxuICAgIGlmIChpc1RodW5rKGEpIHx8IGlzVGh1bmsoYikpIHtcbiAgICAgICAgdGh1bmtzKGEsIGIsIHBhdGNoLCBpbmRleClcbiAgICB9IGVsc2UgaWYgKGIgPT0gbnVsbCkge1xuXG4gICAgICAgIC8vIElmIGEgaXMgYSB3aWRnZXQgd2Ugd2lsbCBhZGQgYSByZW1vdmUgcGF0Y2ggZm9yIGl0XG4gICAgICAgIC8vIE90aGVyd2lzZSBhbnkgY2hpbGQgd2lkZ2V0cy9ob29rcyBtdXN0IGJlIGRlc3Ryb3llZC5cbiAgICAgICAgLy8gVGhpcyBwcmV2ZW50cyBhZGRpbmcgdHdvIHJlbW92ZSBwYXRjaGVzIGZvciBhIHdpZGdldC5cbiAgICAgICAgaWYgKCFpc1dpZGdldChhKSkge1xuICAgICAgICAgICAgY2xlYXJTdGF0ZShhLCBwYXRjaCwgaW5kZXgpXG4gICAgICAgICAgICBhcHBseSA9IHBhdGNoW2luZGV4XVxuICAgICAgICB9XG5cbiAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChWUGF0Y2guUkVNT1ZFLCBhLCBiKSlcbiAgICB9IGVsc2UgaWYgKGlzVk5vZGUoYikpIHtcbiAgICAgICAgaWYgKGlzVk5vZGUoYSkpIHtcbiAgICAgICAgICAgIGlmIChhLnRhZ05hbWUgPT09IGIudGFnTmFtZSAmJlxuICAgICAgICAgICAgICAgIGEubmFtZXNwYWNlID09PSBiLm5hbWVzcGFjZSAmJlxuICAgICAgICAgICAgICAgIGEua2V5ID09PSBiLmtleSkge1xuICAgICAgICAgICAgICAgIHZhciBwcm9wc1BhdGNoID0gZGlmZlByb3BzKGEucHJvcGVydGllcywgYi5wcm9wZXJ0aWVzKVxuICAgICAgICAgICAgICAgIGlmIChwcm9wc1BhdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXcgVlBhdGNoKFZQYXRjaC5QUk9QUywgYSwgcHJvcHNQYXRjaCkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGFwcGx5ID0gZGlmZkNoaWxkcmVuKGEsIGIsIHBhdGNoLCBhcHBseSwgaW5kZXgpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZOT0RFLCBhLCBiKSlcbiAgICAgICAgICAgICAgICBhcHBseUNsZWFyID0gdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChWUGF0Y2guVk5PREUsIGEsIGIpKVxuICAgICAgICAgICAgYXBwbHlDbGVhciA9IHRydWVcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNWVGV4dChiKSkge1xuICAgICAgICBpZiAoIWlzVlRleHQoYSkpIHtcbiAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZURVhULCBhLCBiKSlcbiAgICAgICAgICAgIGFwcGx5Q2xlYXIgPSB0cnVlXG4gICAgICAgIH0gZWxzZSBpZiAoYS50ZXh0ICE9PSBiLnRleHQpIHtcbiAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZURVhULCBhLCBiKSlcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNXaWRnZXQoYikpIHtcbiAgICAgICAgaWYgKCFpc1dpZGdldChhKSkge1xuICAgICAgICAgICAgYXBwbHlDbGVhciA9IHRydWVcbiAgICAgICAgfVxuXG4gICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLldJREdFVCwgYSwgYikpXG4gICAgfVxuXG4gICAgaWYgKGFwcGx5KSB7XG4gICAgICAgIHBhdGNoW2luZGV4XSA9IGFwcGx5XG4gICAgfVxuXG4gICAgaWYgKGFwcGx5Q2xlYXIpIHtcbiAgICAgICAgY2xlYXJTdGF0ZShhLCBwYXRjaCwgaW5kZXgpXG4gICAgfVxufVxuXG5mdW5jdGlvbiBkaWZmQ2hpbGRyZW4oYSwgYiwgcGF0Y2gsIGFwcGx5LCBpbmRleCkge1xuICAgIHZhciBhQ2hpbGRyZW4gPSBhLmNoaWxkcmVuXG4gICAgdmFyIG9yZGVyZWRTZXQgPSByZW9yZGVyKGFDaGlsZHJlbiwgYi5jaGlsZHJlbilcbiAgICB2YXIgYkNoaWxkcmVuID0gb3JkZXJlZFNldC5jaGlsZHJlblxuXG4gICAgdmFyIGFMZW4gPSBhQ2hpbGRyZW4ubGVuZ3RoXG4gICAgdmFyIGJMZW4gPSBiQ2hpbGRyZW4ubGVuZ3RoXG4gICAgdmFyIGxlbiA9IGFMZW4gPiBiTGVuID8gYUxlbiA6IGJMZW5cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgdmFyIGxlZnROb2RlID0gYUNoaWxkcmVuW2ldXG4gICAgICAgIHZhciByaWdodE5vZGUgPSBiQ2hpbGRyZW5baV1cbiAgICAgICAgaW5kZXggKz0gMVxuXG4gICAgICAgIGlmICghbGVmdE5vZGUpIHtcbiAgICAgICAgICAgIGlmIChyaWdodE5vZGUpIHtcbiAgICAgICAgICAgICAgICAvLyBFeGNlc3Mgbm9kZXMgaW4gYiBuZWVkIHRvIGJlIGFkZGVkXG4gICAgICAgICAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSxcbiAgICAgICAgICAgICAgICAgICAgbmV3IFZQYXRjaChWUGF0Y2guSU5TRVJULCBudWxsLCByaWdodE5vZGUpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgd2FsayhsZWZ0Tm9kZSwgcmlnaHROb2RlLCBwYXRjaCwgaW5kZXgpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNWTm9kZShsZWZ0Tm9kZSkgJiYgbGVmdE5vZGUuY291bnQpIHtcbiAgICAgICAgICAgIGluZGV4ICs9IGxlZnROb2RlLmNvdW50XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob3JkZXJlZFNldC5tb3Zlcykge1xuICAgICAgICAvLyBSZW9yZGVyIG5vZGVzIGxhc3RcbiAgICAgICAgYXBwbHkgPSBhcHBlbmRQYXRjaChhcHBseSwgbmV3IFZQYXRjaChcbiAgICAgICAgICAgIFZQYXRjaC5PUkRFUixcbiAgICAgICAgICAgIGEsXG4gICAgICAgICAgICBvcmRlcmVkU2V0Lm1vdmVzXG4gICAgICAgICkpXG4gICAgfVxuXG4gICAgcmV0dXJuIGFwcGx5XG59XG5cbmZ1bmN0aW9uIGNsZWFyU3RhdGUodk5vZGUsIHBhdGNoLCBpbmRleCkge1xuICAgIC8vIFRPRE86IE1ha2UgdGhpcyBhIHNpbmdsZSB3YWxrLCBub3QgdHdvXG4gICAgdW5ob29rKHZOb2RlLCBwYXRjaCwgaW5kZXgpXG4gICAgZGVzdHJveVdpZGdldHModk5vZGUsIHBhdGNoLCBpbmRleClcbn1cblxuLy8gUGF0Y2ggcmVjb3JkcyBmb3IgYWxsIGRlc3Ryb3llZCB3aWRnZXRzIG11c3QgYmUgYWRkZWQgYmVjYXVzZSB3ZSBuZWVkXG4vLyBhIERPTSBub2RlIHJlZmVyZW5jZSBmb3IgdGhlIGRlc3Ryb3kgZnVuY3Rpb25cbmZ1bmN0aW9uIGRlc3Ryb3lXaWRnZXRzKHZOb2RlLCBwYXRjaCwgaW5kZXgpIHtcbiAgICBpZiAoaXNXaWRnZXQodk5vZGUpKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygdk5vZGUuZGVzdHJveSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBwYXRjaFtpbmRleF0gPSBhcHBlbmRQYXRjaChcbiAgICAgICAgICAgICAgICBwYXRjaFtpbmRleF0sXG4gICAgICAgICAgICAgICAgbmV3IFZQYXRjaChWUGF0Y2guUkVNT1ZFLCB2Tm9kZSwgbnVsbClcbiAgICAgICAgICAgIClcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXNWTm9kZSh2Tm9kZSkgJiYgKHZOb2RlLmhhc1dpZGdldHMgfHwgdk5vZGUuaGFzVGh1bmtzKSkge1xuICAgICAgICB2YXIgY2hpbGRyZW4gPSB2Tm9kZS5jaGlsZHJlblxuICAgICAgICB2YXIgbGVuID0gY2hpbGRyZW4ubGVuZ3RoXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG4gICAgICAgICAgICBpbmRleCArPSAxXG5cbiAgICAgICAgICAgIGRlc3Ryb3lXaWRnZXRzKGNoaWxkLCBwYXRjaCwgaW5kZXgpXG5cbiAgICAgICAgICAgIGlmIChpc1ZOb2RlKGNoaWxkKSAmJiBjaGlsZC5jb3VudCkge1xuICAgICAgICAgICAgICAgIGluZGV4ICs9IGNoaWxkLmNvdW50XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzVGh1bmsodk5vZGUpKSB7XG4gICAgICAgIHRodW5rcyh2Tm9kZSwgbnVsbCwgcGF0Y2gsIGluZGV4KVxuICAgIH1cbn1cblxuLy8gQ3JlYXRlIGEgc3ViLXBhdGNoIGZvciB0aHVua3NcbmZ1bmN0aW9uIHRodW5rcyhhLCBiLCBwYXRjaCwgaW5kZXgpIHtcbiAgICB2YXIgbm9kZXMgPSBoYW5kbGVUaHVuayhhLCBiKVxuICAgIHZhciB0aHVua1BhdGNoID0gZGlmZihub2Rlcy5hLCBub2Rlcy5iKVxuICAgIGlmIChoYXNQYXRjaGVzKHRodW5rUGF0Y2gpKSB7XG4gICAgICAgIHBhdGNoW2luZGV4XSA9IG5ldyBWUGF0Y2goVlBhdGNoLlRIVU5LLCBudWxsLCB0aHVua1BhdGNoKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaGFzUGF0Y2hlcyhwYXRjaCkge1xuICAgIGZvciAodmFyIGluZGV4IGluIHBhdGNoKSB7XG4gICAgICAgIGlmIChpbmRleCAhPT0gXCJhXCIpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2Vcbn1cblxuLy8gRXhlY3V0ZSBob29rcyB3aGVuIHR3byBub2RlcyBhcmUgaWRlbnRpY2FsXG5mdW5jdGlvbiB1bmhvb2sodk5vZGUsIHBhdGNoLCBpbmRleCkge1xuICAgIGlmIChpc1ZOb2RlKHZOb2RlKSkge1xuICAgICAgICBpZiAodk5vZGUuaG9va3MpIHtcbiAgICAgICAgICAgIHBhdGNoW2luZGV4XSA9IGFwcGVuZFBhdGNoKFxuICAgICAgICAgICAgICAgIHBhdGNoW2luZGV4XSxcbiAgICAgICAgICAgICAgICBuZXcgVlBhdGNoKFxuICAgICAgICAgICAgICAgICAgICBWUGF0Y2guUFJPUFMsXG4gICAgICAgICAgICAgICAgICAgIHZOb2RlLFxuICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWRLZXlzKHZOb2RlLmhvb2tzKVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIClcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2Tm9kZS5kZXNjZW5kYW50SG9va3MgfHwgdk5vZGUuaGFzVGh1bmtzKSB7XG4gICAgICAgICAgICB2YXIgY2hpbGRyZW4gPSB2Tm9kZS5jaGlsZHJlblxuICAgICAgICAgICAgdmFyIGxlbiA9IGNoaWxkcmVuLmxlbmd0aFxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG4gICAgICAgICAgICAgICAgaW5kZXggKz0gMVxuXG4gICAgICAgICAgICAgICAgdW5ob29rKGNoaWxkLCBwYXRjaCwgaW5kZXgpXG5cbiAgICAgICAgICAgICAgICBpZiAoaXNWTm9kZShjaGlsZCkgJiYgY2hpbGQuY291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggKz0gY2hpbGQuY291bnRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzVGh1bmsodk5vZGUpKSB7XG4gICAgICAgIHRodW5rcyh2Tm9kZSwgbnVsbCwgcGF0Y2gsIGluZGV4KVxuICAgIH1cbn1cblxuZnVuY3Rpb24gdW5kZWZpbmVkS2V5cyhvYmopIHtcbiAgICB2YXIgcmVzdWx0ID0ge31cblxuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgcmVzdWx0W2tleV0gPSB1bmRlZmluZWRcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0XG59XG5cbi8vIExpc3QgZGlmZiwgbmFpdmUgbGVmdCB0byByaWdodCByZW9yZGVyaW5nXG5mdW5jdGlvbiByZW9yZGVyKGFDaGlsZHJlbiwgYkNoaWxkcmVuKSB7XG4gICAgLy8gTyhNKSB0aW1lLCBPKE0pIG1lbW9yeVxuICAgIHZhciBiQ2hpbGRJbmRleCA9IGtleUluZGV4KGJDaGlsZHJlbilcbiAgICB2YXIgYktleXMgPSBiQ2hpbGRJbmRleC5rZXlzXG4gICAgdmFyIGJGcmVlID0gYkNoaWxkSW5kZXguZnJlZVxuXG4gICAgaWYgKGJGcmVlLmxlbmd0aCA9PT0gYkNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY2hpbGRyZW46IGJDaGlsZHJlbixcbiAgICAgICAgICAgIG1vdmVzOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPKE4pIHRpbWUsIE8oTikgbWVtb3J5XG4gICAgdmFyIGFDaGlsZEluZGV4ID0ga2V5SW5kZXgoYUNoaWxkcmVuKVxuICAgIHZhciBhS2V5cyA9IGFDaGlsZEluZGV4LmtleXNcbiAgICB2YXIgYUZyZWUgPSBhQ2hpbGRJbmRleC5mcmVlXG5cbiAgICBpZiAoYUZyZWUubGVuZ3RoID09PSBhQ2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjaGlsZHJlbjogYkNoaWxkcmVuLFxuICAgICAgICAgICAgbW92ZXM6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE8oTUFYKE4sIE0pKSBtZW1vcnlcbiAgICB2YXIgbmV3Q2hpbGRyZW4gPSBbXVxuXG4gICAgdmFyIGZyZWVJbmRleCA9IDBcbiAgICB2YXIgZnJlZUNvdW50ID0gYkZyZWUubGVuZ3RoXG4gICAgdmFyIGRlbGV0ZWRJdGVtcyA9IDBcblxuICAgIC8vIEl0ZXJhdGUgdGhyb3VnaCBhIGFuZCBtYXRjaCBhIG5vZGUgaW4gYlxuICAgIC8vIE8oTikgdGltZSxcbiAgICBmb3IgKHZhciBpID0gMCA7IGkgPCBhQ2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGFJdGVtID0gYUNoaWxkcmVuW2ldXG4gICAgICAgIHZhciBpdGVtSW5kZXhcblxuICAgICAgICBpZiAoYUl0ZW0ua2V5KSB7XG4gICAgICAgICAgICBpZiAoYktleXMuaGFzT3duUHJvcGVydHkoYUl0ZW0ua2V5KSkge1xuICAgICAgICAgICAgICAgIC8vIE1hdGNoIHVwIHRoZSBvbGQga2V5c1xuICAgICAgICAgICAgICAgIGl0ZW1JbmRleCA9IGJLZXlzW2FJdGVtLmtleV1cbiAgICAgICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKGJDaGlsZHJlbltpdGVtSW5kZXhdKVxuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBvbGQga2V5ZWQgaXRlbXNcbiAgICAgICAgICAgICAgICBpdGVtSW5kZXggPSBpIC0gZGVsZXRlZEl0ZW1zKytcbiAgICAgICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKG51bGwpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBNYXRjaCB0aGUgaXRlbSBpbiBhIHdpdGggdGhlIG5leHQgZnJlZSBpdGVtIGluIGJcbiAgICAgICAgICAgIGlmIChmcmVlSW5kZXggPCBmcmVlQ291bnQpIHtcbiAgICAgICAgICAgICAgICBpdGVtSW5kZXggPSBiRnJlZVtmcmVlSW5kZXgrK11cbiAgICAgICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKGJDaGlsZHJlbltpdGVtSW5kZXhdKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBUaGVyZSBhcmUgbm8gZnJlZSBpdGVtcyBpbiBiIHRvIG1hdGNoIHdpdGhcbiAgICAgICAgICAgICAgICAvLyB0aGUgZnJlZSBpdGVtcyBpbiBhLCBzbyB0aGUgZXh0cmEgZnJlZSBub2Rlc1xuICAgICAgICAgICAgICAgIC8vIGFyZSBkZWxldGVkLlxuICAgICAgICAgICAgICAgIGl0ZW1JbmRleCA9IGkgLSBkZWxldGVkSXRlbXMrK1xuICAgICAgICAgICAgICAgIG5ld0NoaWxkcmVuLnB1c2gobnVsbClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBsYXN0RnJlZUluZGV4ID0gZnJlZUluZGV4ID49IGJGcmVlLmxlbmd0aCA/XG4gICAgICAgIGJDaGlsZHJlbi5sZW5ndGggOlxuICAgICAgICBiRnJlZVtmcmVlSW5kZXhdXG5cbiAgICAvLyBJdGVyYXRlIHRocm91Z2ggYiBhbmQgYXBwZW5kIGFueSBuZXcga2V5c1xuICAgIC8vIE8oTSkgdGltZVxuICAgIGZvciAodmFyIGogPSAwOyBqIDwgYkNoaWxkcmVuLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIHZhciBuZXdJdGVtID0gYkNoaWxkcmVuW2pdXG5cbiAgICAgICAgaWYgKG5ld0l0ZW0ua2V5KSB7XG4gICAgICAgICAgICBpZiAoIWFLZXlzLmhhc093blByb3BlcnR5KG5ld0l0ZW0ua2V5KSkge1xuICAgICAgICAgICAgICAgIC8vIEFkZCBhbnkgbmV3IGtleWVkIGl0ZW1zXG4gICAgICAgICAgICAgICAgLy8gV2UgYXJlIGFkZGluZyBuZXcgaXRlbXMgdG8gdGhlIGVuZCBhbmQgdGhlbiBzb3J0aW5nIHRoZW1cbiAgICAgICAgICAgICAgICAvLyBpbiBwbGFjZS4gSW4gZnV0dXJlIHdlIHNob3VsZCBpbnNlcnQgbmV3IGl0ZW1zIGluIHBsYWNlLlxuICAgICAgICAgICAgICAgIG5ld0NoaWxkcmVuLnB1c2gobmV3SXRlbSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChqID49IGxhc3RGcmVlSW5kZXgpIHtcbiAgICAgICAgICAgIC8vIEFkZCBhbnkgbGVmdG92ZXIgbm9uLWtleWVkIGl0ZW1zXG4gICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKG5ld0l0ZW0pXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgc2ltdWxhdGUgPSBuZXdDaGlsZHJlbi5zbGljZSgpXG4gICAgdmFyIHNpbXVsYXRlSW5kZXggPSAwXG4gICAgdmFyIHJlbW92ZXMgPSBbXVxuICAgIHZhciBpbnNlcnRzID0gW11cbiAgICB2YXIgc2ltdWxhdGVJdGVtXG5cbiAgICBmb3IgKHZhciBrID0gMDsgayA8IGJDaGlsZHJlbi5sZW5ndGg7KSB7XG4gICAgICAgIHZhciB3YW50ZWRJdGVtID0gYkNoaWxkcmVuW2tdXG4gICAgICAgIHNpbXVsYXRlSXRlbSA9IHNpbXVsYXRlW3NpbXVsYXRlSW5kZXhdXG5cbiAgICAgICAgLy8gcmVtb3ZlIGl0ZW1zXG4gICAgICAgIHdoaWxlIChzaW11bGF0ZUl0ZW0gPT09IG51bGwgJiYgc2ltdWxhdGUubGVuZ3RoKSB7XG4gICAgICAgICAgICByZW1vdmVzLnB1c2gocmVtb3ZlKHNpbXVsYXRlLCBzaW11bGF0ZUluZGV4LCBudWxsKSlcbiAgICAgICAgICAgIHNpbXVsYXRlSXRlbSA9IHNpbXVsYXRlW3NpbXVsYXRlSW5kZXhdXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXNpbXVsYXRlSXRlbSB8fCBzaW11bGF0ZUl0ZW0ua2V5ICE9PSB3YW50ZWRJdGVtLmtleSkge1xuICAgICAgICAgICAgLy8gaWYgd2UgbmVlZCBhIGtleSBpbiB0aGlzIHBvc2l0aW9uLi4uXG4gICAgICAgICAgICBpZiAod2FudGVkSXRlbS5rZXkpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2ltdWxhdGVJdGVtICYmIHNpbXVsYXRlSXRlbS5rZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgYW4gaW5zZXJ0IGRvZXNuJ3QgcHV0IHRoaXMga2V5IGluIHBsYWNlLCBpdCBuZWVkcyB0byBtb3ZlXG4gICAgICAgICAgICAgICAgICAgIGlmIChiS2V5c1tzaW11bGF0ZUl0ZW0ua2V5XSAhPT0gayArIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZXMucHVzaChyZW1vdmUoc2ltdWxhdGUsIHNpbXVsYXRlSW5kZXgsIHNpbXVsYXRlSXRlbS5rZXkpKVxuICAgICAgICAgICAgICAgICAgICAgICAgc2ltdWxhdGVJdGVtID0gc2ltdWxhdGVbc2ltdWxhdGVJbmRleF1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHRoZSByZW1vdmUgZGlkbid0IHB1dCB0aGUgd2FudGVkIGl0ZW0gaW4gcGxhY2UsIHdlIG5lZWQgdG8gaW5zZXJ0IGl0XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNpbXVsYXRlSXRlbSB8fCBzaW11bGF0ZUl0ZW0ua2V5ICE9PSB3YW50ZWRJdGVtLmtleSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluc2VydHMucHVzaCh7a2V5OiB3YW50ZWRJdGVtLmtleSwgdG86IGt9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaXRlbXMgYXJlIG1hdGNoaW5nLCBzbyBza2lwIGFoZWFkXG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaW11bGF0ZUluZGV4KytcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluc2VydHMucHVzaCh7a2V5OiB3YW50ZWRJdGVtLmtleSwgdG86IGt9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpbnNlcnRzLnB1c2goe2tleTogd2FudGVkSXRlbS5rZXksIHRvOiBrfSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaysrXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBhIGtleSBpbiBzaW11bGF0ZSBoYXMgbm8gbWF0Y2hpbmcgd2FudGVkIGtleSwgcmVtb3ZlIGl0XG4gICAgICAgICAgICBlbHNlIGlmIChzaW11bGF0ZUl0ZW0gJiYgc2ltdWxhdGVJdGVtLmtleSkge1xuICAgICAgICAgICAgICAgIHJlbW92ZXMucHVzaChyZW1vdmUoc2ltdWxhdGUsIHNpbXVsYXRlSW5kZXgsIHNpbXVsYXRlSXRlbS5rZXkpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgc2ltdWxhdGVJbmRleCsrXG4gICAgICAgICAgICBrKytcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlbW92ZSBhbGwgdGhlIHJlbWFpbmluZyBub2RlcyBmcm9tIHNpbXVsYXRlXG4gICAgd2hpbGUoc2ltdWxhdGVJbmRleCA8IHNpbXVsYXRlLmxlbmd0aCkge1xuICAgICAgICBzaW11bGF0ZUl0ZW0gPSBzaW11bGF0ZVtzaW11bGF0ZUluZGV4XVxuICAgICAgICByZW1vdmVzLnB1c2gocmVtb3ZlKHNpbXVsYXRlLCBzaW11bGF0ZUluZGV4LCBzaW11bGF0ZUl0ZW0gJiYgc2ltdWxhdGVJdGVtLmtleSkpXG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIG9ubHkgbW92ZXMgd2UgaGF2ZSBhcmUgZGVsZXRlcyB0aGVuIHdlIGNhbiBqdXN0XG4gICAgLy8gbGV0IHRoZSBkZWxldGUgcGF0Y2ggcmVtb3ZlIHRoZXNlIGl0ZW1zLlxuICAgIGlmIChyZW1vdmVzLmxlbmd0aCA9PT0gZGVsZXRlZEl0ZW1zICYmICFpbnNlcnRzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY2hpbGRyZW46IG5ld0NoaWxkcmVuLFxuICAgICAgICAgICAgbW92ZXM6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGNoaWxkcmVuOiBuZXdDaGlsZHJlbixcbiAgICAgICAgbW92ZXM6IHtcbiAgICAgICAgICAgIHJlbW92ZXM6IHJlbW92ZXMsXG4gICAgICAgICAgICBpbnNlcnRzOiBpbnNlcnRzXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZShhcnIsIGluZGV4LCBrZXkpIHtcbiAgICBhcnIuc3BsaWNlKGluZGV4LCAxKVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZnJvbTogaW5kZXgsXG4gICAgICAgIGtleToga2V5XG4gICAgfVxufVxuXG5mdW5jdGlvbiBrZXlJbmRleChjaGlsZHJlbikge1xuICAgIHZhciBrZXlzID0ge31cbiAgICB2YXIgZnJlZSA9IFtdXG4gICAgdmFyIGxlbmd0aCA9IGNoaWxkcmVuLmxlbmd0aFxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXVxuXG4gICAgICAgIGlmIChjaGlsZC5rZXkpIHtcbiAgICAgICAgICAgIGtleXNbY2hpbGQua2V5XSA9IGlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZyZWUucHVzaChpKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAga2V5czoga2V5cywgICAgIC8vIEEgaGFzaCBvZiBrZXkgbmFtZSB0byBpbmRleFxuICAgICAgICBmcmVlOiBmcmVlLCAgICAgLy8gQW4gYXJyYXkgb2YgdW5rZXllZCBpdGVtIGluZGljZXNcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGFwcGVuZFBhdGNoKGFwcGx5LCBwYXRjaCkge1xuICAgIGlmIChhcHBseSkge1xuICAgICAgICBpZiAoaXNBcnJheShhcHBseSkpIHtcbiAgICAgICAgICAgIGFwcGx5LnB1c2gocGF0Y2gpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcHBseSA9IFthcHBseSwgcGF0Y2hdXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXBwbHlcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcGF0Y2hcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBEaXNwYXRjaGVyIH0gZnJvbSAnLi4vZGlzcGF0Y2hlcic7XG5cbnZhciBTaGlwQWN0aW9ucyA9IHtcblxuICBpbmNyZW1lbnQ6IGZ1bmN0aW9uKHBheWxvYWQpIHtcbiAgICBEaXNwYXRjaGVyLmRpc3BhdGNoKCdpbmNyZW1lbnQnLCBwYXlsb2FkKTtcbiAgfSxcblxuICB1cGRhdGU6IGZ1bmN0aW9uKHBheWxvYWQpIHtcbiAgICBEaXNwYXRjaGVyLmRpc3BhdGNoKCd1cGRhdGUnLCBwYXlsb2FkKTtcbiAgfVxuXG59O1xuXG5leHBvcnQgeyBTaGlwQWN0aW9ucyB9XG4iLCJpbXBvcnQgeyBGbHV4IH0gZnJvbSAnZGVsb3JlYW4nO1xuaW1wb3J0IHsgU2hpcFN0b3JlIH0gZnJvbSAnLi9zdG9yZXMvc2hpcF9zdG9yZSc7XG5cbnZhciBEaXNwYXRjaGVyID0gRmx1eC5jcmVhdGVEaXNwYXRjaGVyKHtcblxuICBpbmNyZWFzZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5kaXNwYXRjaCgnaW5jcmVhc2UnKTtcbiAgfSxcblxuICBnZXRTdG9yZXM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICBzaGlwU3RvcmU6IFNoaXBTdG9yZVxuICAgIH07XG4gIH1cblxufSk7XG5cbmV4cG9ydCB7IERpc3BhdGNoZXIgfVxuIiwiaW1wb3J0IGZsaWdodCBmcm9tICdmbGlnaHRqcyc7XG5pbXBvcnQgeyB3aXRoVkRPTSB9IGZyb20gJy4vbWl4aW4vd2l0aF92ZG9tJztcblxuLy8gRmx1eFxuaW1wb3J0IHsgRGlzcGF0Y2hlciB9IGZyb20gJy4vZGlzcGF0Y2hlcic7XG5pbXBvcnQgeyBTaGlwQWN0aW9ucyB9IGZyb20gJy4vYWN0aW9ucy9zaGlwX2FjdGlvbnMnO1xuXG4vLyBUZW1wbGF0ZXMgYW5kIHBhcnRpYWxzXG5pbXBvcnQgdGVtcGxhdGUgZnJvbSAnLi4vdGVtcGxhdGVzL2luZGV4LmhvZ2FuJztcbmltcG9ydCBmaWVsZFBhcnRpYWwgZnJvbSAnLi4vdGVtcGxhdGVzL19maWVsZC5ob2dhbic7XG5pbXBvcnQgaW5jcmVtZW50UGFydGlhbCBmcm9tICcuLi90ZW1wbGF0ZXMvX2luY3JlbWVudC5ob2dhbic7XG5cbnZhciBkb2N1bWVudFVJID0gZmxpZ2h0LmNvbXBvbmVudCh3aXRoVkRPTSwgZnVuY3Rpb24oKSB7XG4gIHRoaXMuYXR0cmlidXRlcyh7XG4gICAgJ2luY3JlbWVudEJ5T25lJzogJ1tkYXRhLWluY3JlbWVudF0nLFxuICAgICdpbnB1dEZpZWxkJzogJ1t0eXBlPVwidGV4dFwiXScsXG4gIH0pO1xuXG4gIHRoaXMudXBkYXRlQXR0cmlidXRlcyA9IGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgYXR0ciA9IHt9XG4gICAgYXR0cltlLnRhcmdldC5uYW1lXSA9IGUudGFyZ2V0LnZhbHVlO1xuXG4gICAgU2hpcEFjdGlvbnMudXBkYXRlKGF0dHIpO1xuICB9O1xuXG4gIHRoaXMuaW5jcmVtZW50ID0gZnVuY3Rpb24oZSkge1xuICAgIFNoaXBBY3Rpb25zLmluY3JlbWVudCh7XG4gICAgICBrZXk6IGUudGFyZ2V0Lm5hbWUsXG4gICAgICBkaXJlY3Rpb246IGUudGFyZ2V0LmRhdGFzZXQuaW5jcmVtZW50XG4gICAgfSk7XG4gIH07XG5cbiAgdGhpcy5yZW5kZXIgPSBmdW5jdGlvbihzaGlwKSB7XG4gICAgdmFyIHNoaXAgPSBEaXNwYXRjaGVyLmdldFN0b3JlKCdzaGlwU3RvcmUnKTtcbiAgICB2YXIgcGFydGlhbHMgPSB7XG4gICAgICBmaWVsZDogZmllbGRQYXJ0aWFsLFxuICAgICAgaW5jcmVtZW50OiBpbmNyZW1lbnRQYXJ0aWFsXG4gICAgfTtcblxuICAgIHJldHVybiB0ZW1wbGF0ZS5yZW5kZXIoe1xuICAgICAgICBuYW1lOiBzaGlwLm5hbWUgfHwgJ1VudGl0bGVkJyxcbiAgICAgICAgc2hpcDogc2hpcCxcbiAgICAgICAgYXR0cmlidXRlczogT2JqZWN0LmtleXMoc2hpcCkucmVkdWNlKGZ1bmN0aW9uKG1lbW8sIGtleSkge1xuICAgICAgICAgIGlmICghaXNOYU4oc2hpcFtrZXldKSkge1xuICAgICAgICAgICAgbWVtby5wdXNoKHtcbiAgICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICAgIHZhbHVlOiBzaGlwW2tleV1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICB9LCBbXSlcbiAgICB9LCBwYXJ0aWFscyk7XG4gIH07XG5cbiAgdGhpcy51cGRhdGUgPSBmdW5jdGlvbihlKSB7XG4gICAgdmFyIGh0bWwgPSB0aGlzLnJlbmRlcigpO1xuICAgIHZhciB2VHJlZSA9IHRoaXMudmlydHVhbGl6ZShodG1sKTtcblxuICAgIHRoaXMudXBkYXRlVUkodlRyZWUpO1xuICB9O1xuXG4gIHRoaXMuYWZ0ZXIoJ2luaXRpYWxpemUnLCBmdW5jdGlvbigpIHtcbiAgICAvLyBVSSBFdmVudHNcbiAgICB0aGlzLm9uKCdjbGljaycsIHtcbiAgICAgICdpbmNyZW1lbnRCeU9uZSc6IHRoaXMuaW5jcmVtZW50XG4gICAgfSk7XG4gICAgdGhpcy5vbignaW5wdXQnLCB7XG4gICAgICAnaW5wdXRGaWVsZCc6IHRoaXMudXBkYXRlQXR0cmlidXRlc1xuICAgIH0pO1xuXG4gICAgLy8gRG9jdW1lbnQgRXZlbnRzXG4gICAgRGlzcGF0Y2hlci5vbignY2hhbmdlOmFsbCcsIHRoaXMudXBkYXRlLmJpbmQodGhpcykpO1xuICB9KTtcbn0pO1xuXG5leHBvcnQgeyBkb2N1bWVudFVJIH1cbiIsImltcG9ydCBoIGZyb20gJ3ZpcnR1YWwtZG9tL2gnO1xuaW1wb3J0IGRpZmYgZnJvbSAndmlydHVhbC1kb20vZGlmZic7XG5pbXBvcnQgcGF0Y2ggZnJvbSAndmlydHVhbC1kb20vcGF0Y2gnO1xuaW1wb3J0IGNyZWF0ZUVsZW1lbnQgZnJvbSAndmlydHVhbC1kb20vY3JlYXRlLWVsZW1lbnQnO1xuXG5pbXBvcnQgdmlydHVhbGl6ZSBmcm9tICd2ZG9tLXZpcnR1YWxpemUnO1xuXG53aW5kb3cucGF0Y2ggPSBwYXRjaDtcblxuJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiB3aXRoVkRPTSgpIHtcblxuICB0aGlzLmF0dHJpYnV0ZXMoe1xuICAgIHZUcmVlOiB1bmRlZmluZWRcbiAgfSk7XG5cbiAgdGhpcy52aXJ0dWFsaXplID0gdmlydHVhbGl6ZS5mcm9tSFRNTDtcblxuICAvKipcbiAgICogSW5pdGlhbGl6ZSB0aGUgRE9NIHRyZWVcbiAgICovXG4gIHRoaXMuYWZ0ZXIoJ2luaXRpYWxpemUnLCBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmF0dHIudlRyZWUgPSB0aGlzLnZpcnR1YWxpemUodGhpcy5yZW5kZXIoKSk7XG4gICAgdGhpcy5ub2RlID0gY3JlYXRlRWxlbWVudCh0aGlzLmF0dHIudlRyZWUpO1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLm5vZGUpO1xuICB9KTtcblxuICAvKipcbiAgICogVGhpcyBkb2VzIHRoZSBhY3R1YWwgZGlmZmluZyBhbmQgdXBkYXRpbmdcbiAgICovXG4gIHRoaXMudXBkYXRlVUkgPSBmdW5jdGlvbihuZXdUcmVlKSB7XG4gICAgdmFyIHBhdGNoZXMgPSBkaWZmKHRoaXMuYXR0ci52VHJlZSwgbmV3VHJlZSk7XG5cbiAgICB0aGlzLm5vZGUgPSBwYXRjaCh0aGlzLm5vZGUsIHBhdGNoZXMpO1xuICAgIHRoaXMuYXR0ci52VHJlZSA9IG5ld1RyZWU7XG4gIH07XG5cbn1cblxuZXhwb3J0IHsgd2l0aFZET00gfVxuIiwiaW1wb3J0IHsgRmx1eCB9IGZyb20gJ2RlbG9yZWFuJztcblxudmFyIFNoaXBTdG9yZSA9IEZsdXguY3JlYXRlU3RvcmUoe1xuXG4gIGFjdGlvbnM6IHtcbiAgICAnaW5jcmVtZW50JzogJ2luY3JlYXNlQXR0cmlidXRlJyxcbiAgICAndXBkYXRlJzogJ3VwZGF0ZUF0dHJpYnV0ZXMnXG4gIH0sXG5cbiAgc2NoZW1lOiB7XG4gICAgbmFtZTogdW5kZWZpbmVkLFxuICAgIHRvbm5hZ2U6IDAsXG4gICAgZnRsOiAwLFxuICAgIHRocnVzdDogMCxcbiAgICByZWFjdG9yOiAwXG4gIH0sXG5cbiAgaW5jcmVhc2VBdHRyaWJ1dGU6IGZ1bmN0aW9uKHBheWxvYWQpIHtcbiAgICB2YXIgaW5jcmVtZW50ID0gcGF5bG9hZC5kaXJlY3Rpb24gPT0gJ3VwJyA/IDEgOiAtMTtcbiAgICB0aGlzLnNldChwYXlsb2FkLmtleSwgdGhpcy5zdGF0ZVtwYXlsb2FkLmtleV0gKyBpbmNyZW1lbnQpO1xuICB9LFxuXG4gIHVwZGF0ZUF0dHJpYnV0ZXM6IGZ1bmN0aW9uKHBheWxvYWQpIHtcbiAgICBPYmplY3Qua2V5cyhwYXlsb2FkKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgdGhpcy5zZXQoa2V5LCBwYXlsb2FkW2tleV0pO1xuICAgIH0sIHRoaXMpO1xuICB9XG5cbn0pO1xuXG5leHBvcnQgeyBTaGlwU3RvcmUgfVxuIiwidmFyIEhvZ2FuID0gcmVxdWlyZSgnaG9nYW4uanMnKTtcbm1vZHVsZS5leHBvcnRzID0gbmV3IEhvZ2FuLlRlbXBsYXRlKHtjb2RlOiBmdW5jdGlvbiAoYyxwLGkpIHsgdmFyIHQ9dGhpczt0LmIoaT1pfHxcIlwiKTt0LmIoXCI8ZGl2IGNsYXNzPVxcXCJmaWVsZFxcXCI+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICA8ZGl2IGNsYXNzPVxcXCJsYWJlbFxcXCI+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICAgICAgPGxhYmVsIGZvcj1cXFwic2hpcG5hbWVcXFwiPlwiKTt0LmIodC52KHQuZihcImtleVwiLGMscCwwKSkpO3QuYihcIjwvbGFiZWw+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICA8L2Rpdj5cIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgIDxkaXYgY2xhc3M9XFxcImlucHV0XFxcIj5cIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgICAgICA8aW5wdXQgbmFtZT1cXFwiXCIpO3QuYih0LnYodC5mKFwia2V5XCIsYyxwLDApKSk7dC5iKFwiXFxcIlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgICAgICAgICAgICB2YWx1ZT1cXFwiXCIpO3QuYih0LnYodC5mKFwidmFsdWVcIixjLHAsMCkpKTt0LmIoXCJcXFwiXCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVxcXCJQbGVhc2UgZW50ZXIgYSBcIik7dC5iKHQudih0LmYoXCJrZXlcIixjLHAsMCkpKTt0LmIoXCJcXFwiXCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICAgICAgICAgICAgIGlkPVxcXCJzaGlwXCIpO3QuYih0LnYodC5mKFwia2V5XCIsYyxwLDApKSk7dC5iKFwiXFxcIj5cIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgIDwvZGl2PlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIjwvZGl2PlwiKTt0LmIoXCJcXG5cIik7cmV0dXJuIHQuZmwoKTsgfSxwYXJ0aWFsczoge30sIHN1YnM6IHsgIH19LCBcIjxkaXYgY2xhc3M9XFxcImZpZWxkXFxcIj5cXG4gIDxkaXYgY2xhc3M9XFxcImxhYmVsXFxcIj5cXG4gICAgICA8bGFiZWwgZm9yPVxcXCJzaGlwbmFtZVxcXCI+e3sga2V5IH19PC9sYWJlbD5cXG4gIDwvZGl2PlxcbiAgPGRpdiBjbGFzcz1cXFwiaW5wdXRcXFwiPlxcbiAgICAgIDxpbnB1dCBuYW1lPVxcXCJ7eyBrZXkgfX1cXFwiXFxuICAgICAgICAgICAgIHZhbHVlPVxcXCJ7eyB2YWx1ZSB9fVxcXCJcXG4gICAgICAgICAgICAgcGxhY2Vob2xkZXI9XFxcIlBsZWFzZSBlbnRlciBhIHt7IGtleSB9fVxcXCJcXG4gICAgICAgICAgICAgaWQ9XFxcInNoaXB7eyBrZXkgfX1cXFwiPlxcbiAgPC9kaXY+XFxuPC9kaXY+XFxuXCIsIEhvZ2FuKTsiLCJ2YXIgSG9nYW4gPSByZXF1aXJlKCdob2dhbi5qcycpO1xubW9kdWxlLmV4cG9ydHMgPSBuZXcgSG9nYW4uVGVtcGxhdGUoe2NvZGU6IGZ1bmN0aW9uIChjLHAsaSkgeyB2YXIgdD10aGlzO3QuYihpPWl8fFwiXCIpO3QuYihcIjxkaXYgY2xhc3M9XFxcImNvbnRyb2xzXFxcIj5cIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgIDxsYWJlbCBmb3I9XFxcIlwiKTt0LmIodC52KHQuZihcImtleVwiLGMscCwwKSkpO3QuYihcIlxcXCI+XCIpO3QuYih0LnYodC5mKFwia2V5XCIsYyxwLDApKSk7dC5iKFwiPC9sYWJlbD5cIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgIDxzcGFuIGNsYXNzPVxcXCJ2YWx1ZVxcXCI+XCIpO3QuYih0LnYodC5mKFwidmFsdWVcIixjLHAsMCkpKTt0LmIoXCI8L3NwYW4+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICA8YnV0dG9uIGNsYXNzPVxcXCJpbmNyZW1lbnRcXFwiIG5hbWU9XFxcIlwiKTt0LmIodC52KHQuZihcImtleVwiLGMscCwwKSkpO3QuYihcIlxcXCIgZGF0YS1pbmNyZW1lbnQ9XFxcInVwXFxcIj5cIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgICAgJnVhcnI7XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICA8L2J1dHRvbj5cIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgIDxidXR0b24gY2xhc3M9XFxcImluY3JlbWVudFxcXCIgbmFtZT1cXFwiXCIpO3QuYih0LnYodC5mKFwia2V5XCIsYyxwLDApKSk7dC5iKFwiXFxcIiBkYXRhLWluY3JlbWVudD1cXFwiZG93blxcXCI+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICAgICZkYXJyO1wiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgPC9idXR0b24+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiPC9kaXY+XCIpO3QuYihcIlxcblwiKTtyZXR1cm4gdC5mbCgpOyB9LHBhcnRpYWxzOiB7fSwgc3ViczogeyAgfX0sIFwiPGRpdiBjbGFzcz1cXFwiY29udHJvbHNcXFwiPlxcbiAgPGxhYmVsIGZvcj1cXFwie3sga2V5IH19XFxcIj57eyBrZXkgfX08L2xhYmVsPlxcbiAgPHNwYW4gY2xhc3M9XFxcInZhbHVlXFxcIj57eyB2YWx1ZSB9fTwvc3Bhbj5cXG4gIDxidXR0b24gY2xhc3M9XFxcImluY3JlbWVudFxcXCIgbmFtZT1cXFwie3sga2V5IH19XFxcIiBkYXRhLWluY3JlbWVudD1cXFwidXBcXFwiPlxcbiAgICAmdWFycjtcXG4gIDwvYnV0dG9uPlxcbiAgPGJ1dHRvbiBjbGFzcz1cXFwiaW5jcmVtZW50XFxcIiBuYW1lPVxcXCJ7eyBrZXkgfX1cXFwiIGRhdGEtaW5jcmVtZW50PVxcXCJkb3duXFxcIj5cXG4gICAgJmRhcnI7XFxuICA8L2J1dHRvbj5cXG48L2Rpdj5cXG5cIiwgSG9nYW4pOyIsInZhciBIb2dhbiA9IHJlcXVpcmUoJ2hvZ2FuLmpzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBIb2dhbi5UZW1wbGF0ZSh7Y29kZTogZnVuY3Rpb24gKGMscCxpKSB7IHZhciB0PXRoaXM7dC5iKGk9aXx8XCJcIik7dC5iKFwiPGRpdiBkYXRhLWNvbnRhaW5lcj5cIik7dC5iKFwiXFxuXCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICA8aDE+XCIpO3QuYih0LnYodC5mKFwibmFtZVwiLGMscCwwKSkpO3QuYihcIjwvaDE+XCIpO3QuYihcIlxcblwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgPGRpdiBjbGFzcz1cXFwiZmllbGRcXFwiPlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgICA8ZGl2IGNsYXNzPVxcXCJsYWJlbFxcXCI+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICAgICAgICA8bGFiZWwgZm9yPVxcXCJzaGlwbmFtZVxcXCI+TmFtZTwvbGFiZWw+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICAgIDwvZGl2PlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgICA8ZGl2IGNsYXNzPVxcXCJpbnB1dFxcXCI+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICAgICAgICA8aW5wdXQgbmFtZT1cXFwibmFtZVxcXCJcIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgICAgICAgICAgICAgICB2YWx1ZT1cXFwiXCIpO3QuYih0LnYodC5kKFwic2hpcC5uYW1lXCIsYyxwLDApKSk7dC5iKFwiXFxcIlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVxcXCJQbGVhc2UgZW50ZXIgYSBuYW1lXFxcIlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgICAgICAgICAgICAgIGlkPVxcXCJzaGlwbmFtZVxcXCI+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICAgIDwvZGl2PlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgPC9kaXY+XCIpO3QuYihcIlxcblwiKTt0LmIoXCJcXG5cIiArIGkpO2lmKHQucyh0LmYoXCJhdHRyaWJ1dGVzXCIsYyxwLDEpLGMscCwwLDM1NCwzNzYsXCJ7eyB9fVwiKSl7dC5ycyhjLHAsZnVuY3Rpb24oYyxwLHQpe3QuYih0LnJwKFwiPGluY3JlbWVudDBcIixjLHAsXCIgIFwiKSk7fSk7Yy5wb3AoKTt9dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCI8L2Rpdj5cIik7dC5iKFwiXFxuXCIpO3JldHVybiB0LmZsKCk7IH0scGFydGlhbHM6IHtcIjxpbmNyZW1lbnQwXCI6e25hbWU6XCJpbmNyZW1lbnRcIiwgcGFydGlhbHM6IHt9LCBzdWJzOiB7ICB9fX0sIHN1YnM6IHsgIH19LCBcIjxkaXYgZGF0YS1jb250YWluZXI+XFxuXFxuICA8aDE+e3sgbmFtZSB9fTwvaDE+XFxuXFxuICA8ZGl2IGNsYXNzPVxcXCJmaWVsZFxcXCI+XFxuICAgIDxkaXYgY2xhc3M9XFxcImxhYmVsXFxcIj5cXG4gICAgICAgIDxsYWJlbCBmb3I9XFxcInNoaXBuYW1lXFxcIj5OYW1lPC9sYWJlbD5cXG4gICAgPC9kaXY+XFxuICAgIDxkaXYgY2xhc3M9XFxcImlucHV0XFxcIj5cXG4gICAgICAgIDxpbnB1dCBuYW1lPVxcXCJuYW1lXFxcIlxcbiAgICAgICAgICAgICAgIHZhbHVlPVxcXCJ7eyBzaGlwLm5hbWUgfX1cXFwiXFxuICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XFxcIlBsZWFzZSBlbnRlciBhIG5hbWVcXFwiXFxuICAgICAgICAgICAgICAgaWQ9XFxcInNoaXBuYW1lXFxcIj5cXG4gICAgPC9kaXY+XFxuICA8L2Rpdj5cXG5cXG4gIHt7IyBhdHRyaWJ1dGVzIH19XFxuICB7ez4gaW5jcmVtZW50IH19XFxuICB7ey8gYXR0cmlidXRlcyB9fVxcblxcbjwvZGl2PlxcblwiLCBIb2dhbik7IiwiaW1wb3J0IHsgZG9jdW1lbnRVSSB9IGZyb20gJy4vZG9jdW1lbnRfdWknO1xuXG4vLyBpbml0aWFsaXplIEZsaWdodCBjb21wb25lbnRzXG5kb2N1bWVudFVJLmF0dGFjaFRvKGRvY3VtZW50LmJvZHkpO1xuIl19
