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

  this.update = function () {
    var html = this.render();
    this.updateUI(html);
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

'use strict';

function withVDOM() {

  this.attributes({
    vTree: undefined
  });

  /**
   * Initialize the DOM tree
   */
  this.after('initialize', function () {
    this.attr.vTree = _vdomVirtualize2['default'].fromHTML(this.render());
    this.node = (0, _virtualDomCreateElement2['default'])(this.attr.vTree);

    document.body.appendChild(this.node);
  });

  /**
   * This does the actual diffing and updating
   */
  this.updateUI = function (html) {
    var newTree = _vdomVirtualize2['default'].fromHTML(html);
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
    this.validate();
  },

  updateAttributes: function updateAttributes(payload) {
    Object.keys(payload).forEach(function (key) {
      this.set(key, payload[key]);
    }, this);
    this.validate();
  },

  validate: function validate() {
    Object.keys(this.state).forEach(function (key) {
      if (!isNaN(this.state[key]) && this.state[key] < 0) {
        this.set(key, 0);
      }
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1yZXNvbHZlL2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL2RlbG9yZWFuL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL21haW4uanMiLCJub2RlX21vZHVsZXMvZGVsb3JlYW4vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9hbGwuanMiLCJub2RlX21vZHVsZXMvZGVsb3JlYW4vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9hc2FwLmpzIiwibm9kZV9tb2R1bGVzL2RlbG9yZWFuL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvY29uZmlnLmpzIiwibm9kZV9tb2R1bGVzL2RlbG9yZWFuL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvcG9seWZpbGwuanMiLCJub2RlX21vZHVsZXMvZGVsb3JlYW4vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS9wcm9taXNlLmpzIiwibm9kZV9tb2R1bGVzL2RlbG9yZWFuL25vZGVfbW9kdWxlcy9lczYtcHJvbWlzZS9kaXN0L2NvbW1vbmpzL3Byb21pc2UvcmFjZS5qcyIsIm5vZGVfbW9kdWxlcy9kZWxvcmVhbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL3JlamVjdC5qcyIsIm5vZGVfbW9kdWxlcy9kZWxvcmVhbi9ub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9jb21tb25qcy9wcm9taXNlL3Jlc29sdmUuanMiLCJub2RlX21vZHVsZXMvZGVsb3JlYW4vbm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvY29tbW9uanMvcHJvbWlzZS91dGlscy5qcyIsIm5vZGVfbW9kdWxlcy9kZWxvcmVhbi9zcmMvZGVsb3JlYW4uanMiLCJub2RlX21vZHVsZXMvZGVsb3JlYW4vc3JjL3JlcXVpcmVtZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9mbGlnaHRqcy9idWlsZC9mbGlnaHQuanMiLCJub2RlX21vZHVsZXMvaG9nYW4uanMvbGliL2NvbXBpbGVyLmpzIiwibm9kZV9tb2R1bGVzL2hvZ2FuLmpzL2xpYi9ob2dhbi5qcyIsIm5vZGVfbW9kdWxlcy9ob2dhbi5qcy9saWIvdGVtcGxhdGUuanMiLCJub2RlX21vZHVsZXMvdmRvbS12aXJ0dWFsaXplL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL2NyZWF0ZS1lbGVtZW50LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL2RpZmYuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vaC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvYnJvd3Nlci1zcGxpdC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvZXYtc3RvcmUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vbm9kZV9tb2R1bGVzL2V2LXN0b3JlL25vZGVfbW9kdWxlcy9pbmRpdmlkdWFsL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL25vZGVfbW9kdWxlcy9ldi1zdG9yZS9ub2RlX21vZHVsZXMvaW5kaXZpZHVhbC9vbmUtdmVyc2lvbi5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvZ2xvYmFsL2RvY3VtZW50LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL25vZGVfbW9kdWxlcy9pcy1vYmplY3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vbm9kZV9tb2R1bGVzL3gtaXMtYXJyYXkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vcGF0Y2guanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmRvbS9hcHBseS1wcm9wZXJ0aWVzLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vY3JlYXRlLWVsZW1lbnQuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmRvbS9kb20taW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmRvbS9wYXRjaC1vcC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92ZG9tL3BhdGNoLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vdXBkYXRlLXdpZGdldC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92aXJ0dWFsLWh5cGVyc2NyaXB0L2hvb2tzL2V2LWhvb2suanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmlydHVhbC1oeXBlcnNjcmlwdC9ob29rcy9zb2Z0LXNldC1ob29rLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3ZpcnR1YWwtaHlwZXJzY3JpcHQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmlydHVhbC1oeXBlcnNjcmlwdC9wYXJzZS10YWcuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvaGFuZGxlLXRodW5rLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXRodW5rLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXZob29rLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXZub2RlLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXZ0ZXh0LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXdpZGdldC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS92ZXJzaW9uLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL3Zub2RlLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL3ZwYXRjaC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS92dGV4dC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92dHJlZS9kaWZmLXByb3BzLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Z0cmVlL2RpZmYuanMiLCIvVXNlcnMva2VpdGgvV29yay9WaXJ0dWFsRE9NL3ZpcnR1YWwtZG9tLWRlbW8vc3JjL2pzL2FjdGlvbnMvc2hpcF9hY3Rpb25zLmpzIiwiL1VzZXJzL2tlaXRoL1dvcmsvVmlydHVhbERPTS92aXJ0dWFsLWRvbS1kZW1vL3NyYy9qcy9kaXNwYXRjaGVyLmpzIiwiL1VzZXJzL2tlaXRoL1dvcmsvVmlydHVhbERPTS92aXJ0dWFsLWRvbS1kZW1vL3NyYy9qcy9kb2N1bWVudF91aS5qcyIsIi9Vc2Vycy9rZWl0aC9Xb3JrL1ZpcnR1YWxET00vdmlydHVhbC1kb20tZGVtby9zcmMvanMvbWl4aW4vd2l0aF92ZG9tLmpzIiwiL1VzZXJzL2tlaXRoL1dvcmsvVmlydHVhbERPTS92aXJ0dWFsLWRvbS1kZW1vL3NyYy9qcy9zdG9yZXMvc2hpcF9zdG9yZS5qcyIsInNyYy90ZW1wbGF0ZXMvX2ZpZWxkLmhvZ2FuIiwic3JjL3RlbXBsYXRlcy9faW5jcmVtZW50LmhvZ2FuIiwic3JjL3RlbXBsYXRlcy9pbmRleC5ob2dhbiIsIi9Vc2Vycy9rZWl0aC9Xb3JrL1ZpcnR1YWxET00vdmlydHVhbC1kb20tZGVtby9zcmMvanMvYXBwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1NkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZhQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25RQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7OzswQkMzYTJCLGVBQWU7O0FBRTFDLElBQUksV0FBVyxHQUFHOztBQUVoQixXQUFTLEVBQUUsbUJBQVMsT0FBTyxFQUFFO0FBQzNCLGdCQUxLLFVBQVUsQ0FLSixRQUFRLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0dBQzNDOztBQUVELFFBQU0sRUFBRSxnQkFBUyxPQUFPLEVBQUU7QUFDeEIsZ0JBVEssVUFBVSxDQVNKLFFBQVEsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7R0FDeEM7O0NBRUYsQ0FBQzs7UUFFTyxXQUFXLEdBQVgsV0FBVzs7Ozs7Ozs7O3dCQ2RDLFVBQVU7O2dDQUNMLHFCQUFxQjs7QUFFL0MsSUFBSSxVQUFVLEdBQUcsVUFIUixJQUFJLENBR1MsZ0JBQWdCLENBQUM7O0FBRXJDLFdBQVMsRUFBRSxxQkFBVztBQUNwQixXQUFPO0FBQ0wsZUFBUyxvQkFOTixTQUFTLEFBTVE7S0FDckIsQ0FBQztHQUNIOztDQUVGLENBQUMsQ0FBQzs7UUFFTSxVQUFVLEdBQVYsVUFBVTs7Ozs7Ozs7Ozs7d0JDYkEsVUFBVTs7Ozs4QkFDSixtQkFBbUI7Ozs7MEJBR2pCLGNBQWM7O21DQUNiLHdCQUF3Qjs7OzttQ0FHL0IsMEJBQTBCOzs7O29DQUN0QiwyQkFBMkI7Ozs7d0NBQ3ZCLCtCQUErQjs7OztBQUU1RCxJQUFJLFVBQVUsR0FBRyxzQkFBTyxTQUFTLGlCQVh4QixRQUFRLEVBVzJCLFlBQVc7QUFDckQsTUFBSSxDQUFDLFVBQVUsQ0FBQztBQUNkLG9CQUFnQixFQUFFLGtCQUFrQjtBQUNwQyxnQkFBWSxFQUFFLGVBQWUsRUFDOUIsQ0FBQyxDQUFDOztBQUVILE1BQUksQ0FBQyxnQkFBZ0IsR0FBRyxVQUFTLENBQUMsRUFBRTtBQUNsQyxRQUFJLElBQUksR0FBRyxFQUFFLENBQUE7QUFDYixRQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQzs7QUFFckMseUJBakJLLFdBQVcsQ0FpQkosTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0dBQzFCLENBQUM7O0FBRUYsTUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFTLENBQUMsRUFBRTtBQUMzQix5QkFyQkssV0FBVyxDQXFCSixTQUFTLENBQUM7QUFDcEIsU0FBRyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSTtBQUNsQixlQUFTLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUztLQUN0QyxDQUFDLENBQUM7R0FDSixDQUFDOztBQUVGLE1BQUksQ0FBQyxNQUFNLEdBQUcsVUFBUyxJQUFJLEVBQUU7QUFDM0IsUUFBSSxJQUFJLEdBQUcsWUE3Qk4sVUFBVSxDQTZCTyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDNUMsUUFBSSxRQUFRLEdBQUc7QUFDYixXQUFLLG1DQUFjO0FBQ25CLGVBQVMsdUNBQWtCO0tBQzVCLENBQUM7O0FBRUYsV0FBTyxpQ0FBUyxNQUFNLENBQUM7QUFDbkIsVUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLElBQUksVUFBVTtBQUM3QixVQUFJLEVBQUUsSUFBSTtBQUNWLGdCQUFVLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBUyxJQUFJLEVBQUUsR0FBRyxFQUFFO0FBQ3ZELFlBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUU7QUFDckIsY0FBSSxDQUFDLElBQUksQ0FBQztBQUNSLGVBQUcsRUFBRSxHQUFHO0FBQ1IsaUJBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDO1dBQ2pCLENBQUMsQ0FBQztTQUNKOztBQUVELGVBQU8sSUFBSSxDQUFDO09BQ2IsRUFBRSxFQUFFLENBQUM7S0FDVCxFQUFFLFFBQVEsQ0FBQyxDQUFDO0dBQ2QsQ0FBQzs7QUFFRixNQUFJLENBQUMsTUFBTSxHQUFHLFlBQVc7QUFDdkIsUUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQ3pCLFFBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7R0FDckIsQ0FBQzs7QUFFRixNQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxZQUFXOztBQUVsQyxRQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRTtBQUNmLHNCQUFnQixFQUFFLElBQUksQ0FBQyxTQUFTO0tBQ2pDLENBQUMsQ0FBQztBQUNILFFBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFO0FBQ2Ysa0JBQVksRUFBRSxJQUFJLENBQUMsZ0JBQWdCO0tBQ3BDLENBQUMsQ0FBQzs7O0FBR0gsZ0JBbEVLLFVBQVUsQ0FrRUosRUFBRSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0dBQ3JELENBQUMsQ0FBQztDQUNKLENBQUMsQ0FBQzs7UUFFTSxVQUFVLEdBQVYsVUFBVTs7Ozs7Ozs7Ozs7MkJDMUVMLGVBQWU7Ozs7OEJBQ1osa0JBQWtCOzs7OytCQUNqQixtQkFBbUI7Ozs7dUNBQ1gsNEJBQTRCOzs7OzhCQUUvQixpQkFBaUI7Ozs7QUFFeEMsWUFBWSxDQUFDOztBQUViLFNBQVMsUUFBUSxHQUFHOztBQUVsQixNQUFJLENBQUMsVUFBVSxDQUFDO0FBQ2QsU0FBSyxFQUFFLFNBQVM7R0FDakIsQ0FBQyxDQUFDOzs7OztBQUtILE1BQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFLFlBQVc7QUFDbEMsUUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsNEJBQVcsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ3JELFFBQUksQ0FBQyxJQUFJLEdBQUcsMENBQWMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQzs7QUFFM0MsWUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0dBQ3RDLENBQUMsQ0FBQzs7Ozs7QUFLSCxNQUFJLENBQUMsUUFBUSxHQUFHLFVBQVMsSUFBSSxFQUFFO0FBQzdCLFFBQUksT0FBTyxHQUFHLDRCQUFXLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN4QyxRQUFJLE9BQU8sR0FBRyxpQ0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQzs7QUFFN0MsUUFBSSxDQUFDLElBQUksR0FBRyxrQ0FBTSxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3RDLFFBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQztHQUMzQixDQUFDO0NBRUg7O1FBRVEsUUFBUSxHQUFSLFFBQVE7Ozs7Ozs7Ozt3QkN0Q0ksVUFBVTs7QUFFL0IsSUFBSSxTQUFTLEdBQUcsVUFGUCxJQUFJLENBRVEsV0FBVyxDQUFDOztBQUUvQixTQUFPLEVBQUU7QUFDUCxlQUFXLEVBQUUsbUJBQW1CO0FBQ2hDLFlBQVEsRUFBRSxrQkFBa0I7R0FDN0I7O0FBRUQsUUFBTSxFQUFFO0FBQ04sUUFBSSxFQUFFLFNBQVM7QUFDZixXQUFPLEVBQUUsQ0FBQztBQUNWLE9BQUcsRUFBRSxDQUFDO0FBQ04sVUFBTSxFQUFFLENBQUM7QUFDVCxXQUFPLEVBQUUsQ0FBQztHQUNYOztBQUVELG1CQUFpQixFQUFFLDJCQUFTLE9BQU8sRUFBRTtBQUNuQyxRQUFJLFNBQVMsR0FBRyxPQUFPLENBQUMsU0FBUyxJQUFJLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDbkQsUUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0FBQzNELFFBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztHQUNqQjs7QUFFRCxrQkFBZ0IsRUFBRSwwQkFBUyxPQUFPLEVBQUU7QUFDbEMsVUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBUyxHQUFHLEVBQUU7QUFDekMsVUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7S0FDN0IsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNULFFBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztHQUNqQjs7QUFFRCxVQUFRLEVBQUUsb0JBQVc7QUFDbkIsVUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVMsR0FBRyxFQUFFO0FBQzVDLFVBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQ2xELFlBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO09BQ2xCO0tBQ0YsRUFBRSxJQUFJLENBQUMsQ0FBQztHQUNWOztDQUVGLENBQUMsQ0FBQzs7UUFFTSxTQUFTLEdBQVQsU0FBUzs7O0FDeENsQjtBQUNBOztBQ0RBO0FBQ0E7O0FDREE7QUFDQTs7OzsyQkNEMkIsZUFBZTs7O0FBRzFDLGFBSFMsVUFBVSxDQUdSLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIixudWxsLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIlwidXNlIHN0cmljdFwiO1xudmFyIFByb21pc2UgPSByZXF1aXJlKFwiLi9wcm9taXNlL3Byb21pc2VcIikuUHJvbWlzZTtcbnZhciBwb2x5ZmlsbCA9IHJlcXVpcmUoXCIuL3Byb21pc2UvcG9seWZpbGxcIikucG9seWZpbGw7XG5leHBvcnRzLlByb21pc2UgPSBQcm9taXNlO1xuZXhwb3J0cy5wb2x5ZmlsbCA9IHBvbHlmaWxsOyIsIlwidXNlIHN0cmljdFwiO1xuLyogZ2xvYmFsIHRvU3RyaW5nICovXG5cbnZhciBpc0FycmF5ID0gcmVxdWlyZShcIi4vdXRpbHNcIikuaXNBcnJheTtcbnZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZShcIi4vdXRpbHNcIikuaXNGdW5jdGlvbjtcblxuLyoqXG4gIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdoZW4gYWxsIHRoZSBnaXZlbiBwcm9taXNlcyBoYXZlIGJlZW5cbiAgZnVsZmlsbGVkLCBvciByZWplY3RlZCBpZiBhbnkgb2YgdGhlbSBiZWNvbWUgcmVqZWN0ZWQuIFRoZSByZXR1cm4gcHJvbWlzZVxuICBpcyBmdWxmaWxsZWQgd2l0aCBhbiBhcnJheSB0aGF0IGdpdmVzIGFsbCB0aGUgdmFsdWVzIGluIHRoZSBvcmRlciB0aGV5IHdlcmVcbiAgcGFzc2VkIGluIHRoZSBgcHJvbWlzZXNgIGFycmF5IGFyZ3VtZW50LlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZTEgPSBSU1ZQLnJlc29sdmUoMSk7XG4gIHZhciBwcm9taXNlMiA9IFJTVlAucmVzb2x2ZSgyKTtcbiAgdmFyIHByb21pc2UzID0gUlNWUC5yZXNvbHZlKDMpO1xuICB2YXIgcHJvbWlzZXMgPSBbIHByb21pc2UxLCBwcm9taXNlMiwgcHJvbWlzZTMgXTtcblxuICBSU1ZQLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbihhcnJheSl7XG4gICAgLy8gVGhlIGFycmF5IGhlcmUgd291bGQgYmUgWyAxLCAyLCAzIF07XG4gIH0pO1xuICBgYGBcblxuICBJZiBhbnkgb2YgdGhlIGBwcm9taXNlc2AgZ2l2ZW4gdG8gYFJTVlAuYWxsYCBhcmUgcmVqZWN0ZWQsIHRoZSBmaXJzdCBwcm9taXNlXG4gIHRoYXQgaXMgcmVqZWN0ZWQgd2lsbCBiZSBnaXZlbiBhcyBhbiBhcmd1bWVudCB0byB0aGUgcmV0dXJuZWQgcHJvbWlzZXMnc1xuICByZWplY3Rpb24gaGFuZGxlci4gRm9yIGV4YW1wbGU6XG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIHZhciBwcm9taXNlMSA9IFJTVlAucmVzb2x2ZSgxKTtcbiAgdmFyIHByb21pc2UyID0gUlNWUC5yZWplY3QobmV3IEVycm9yKFwiMlwiKSk7XG4gIHZhciBwcm9taXNlMyA9IFJTVlAucmVqZWN0KG5ldyBFcnJvcihcIjNcIikpO1xuICB2YXIgcHJvbWlzZXMgPSBbIHByb21pc2UxLCBwcm9taXNlMiwgcHJvbWlzZTMgXTtcblxuICBSU1ZQLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbihhcnJheSl7XG4gICAgLy8gQ29kZSBoZXJlIG5ldmVyIHJ1bnMgYmVjYXVzZSB0aGVyZSBhcmUgcmVqZWN0ZWQgcHJvbWlzZXMhXG4gIH0sIGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgLy8gZXJyb3IubWVzc2FnZSA9PT0gXCIyXCJcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgYWxsXG4gIEBmb3IgUlNWUFxuICBAcGFyYW0ge0FycmF5fSBwcm9taXNlc1xuICBAcGFyYW0ge1N0cmluZ30gbGFiZWxcbiAgQHJldHVybiB7UHJvbWlzZX0gcHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aGVuIGFsbCBgcHJvbWlzZXNgIGhhdmUgYmVlblxuICBmdWxmaWxsZWQsIG9yIHJlamVjdGVkIGlmIGFueSBvZiB0aGVtIGJlY29tZSByZWplY3RlZC5cbiovXG5mdW5jdGlvbiBhbGwocHJvbWlzZXMpIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgdmFyIFByb21pc2UgPSB0aGlzO1xuXG4gIGlmICghaXNBcnJheShwcm9taXNlcykpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGFuIGFycmF5IHRvIGFsbC4nKTtcbiAgfVxuXG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdLCByZW1haW5pbmcgPSBwcm9taXNlcy5sZW5ndGgsXG4gICAgcHJvbWlzZTtcblxuICAgIGlmIChyZW1haW5pbmcgPT09IDApIHtcbiAgICAgIHJlc29sdmUoW10pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlc29sdmVyKGluZGV4KSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmVzb2x2ZUFsbChpbmRleCwgdmFsdWUpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXNvbHZlQWxsKGluZGV4LCB2YWx1ZSkge1xuICAgICAgcmVzdWx0c1tpbmRleF0gPSB2YWx1ZTtcbiAgICAgIGlmICgtLXJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICByZXNvbHZlKHJlc3VsdHMpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvbWlzZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHByb21pc2UgPSBwcm9taXNlc1tpXTtcblxuICAgICAgaWYgKHByb21pc2UgJiYgaXNGdW5jdGlvbihwcm9taXNlLnRoZW4pKSB7XG4gICAgICAgIHByb21pc2UudGhlbihyZXNvbHZlcihpKSwgcmVqZWN0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc29sdmVBbGwoaSwgcHJvbWlzZSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn1cblxuZXhwb3J0cy5hbGwgPSBhbGw7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgYnJvd3Nlckdsb2JhbCA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykgPyB3aW5kb3cgOiB7fTtcbnZhciBCcm93c2VyTXV0YXRpb25PYnNlcnZlciA9IGJyb3dzZXJHbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBicm93c2VyR2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG52YXIgbG9jYWwgPSAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcpID8gZ2xvYmFsIDogKHRoaXMgPT09IHVuZGVmaW5lZD8gd2luZG93OnRoaXMpO1xuXG4vLyBub2RlXG5mdW5jdGlvbiB1c2VOZXh0VGljaygpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHByb2Nlc3MubmV4dFRpY2soZmx1c2gpO1xuICB9O1xufVxuXG5mdW5jdGlvbiB1c2VNdXRhdGlvbk9ic2VydmVyKCkge1xuICB2YXIgaXRlcmF0aW9ucyA9IDA7XG4gIHZhciBvYnNlcnZlciA9IG5ldyBCcm93c2VyTXV0YXRpb25PYnNlcnZlcihmbHVzaCk7XG4gIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICBvYnNlcnZlci5vYnNlcnZlKG5vZGUsIHsgY2hhcmFjdGVyRGF0YTogdHJ1ZSB9KTtcblxuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgbm9kZS5kYXRhID0gKGl0ZXJhdGlvbnMgPSArK2l0ZXJhdGlvbnMgJSAyKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXNlU2V0VGltZW91dCgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGxvY2FsLnNldFRpbWVvdXQoZmx1c2gsIDEpO1xuICB9O1xufVxuXG52YXIgcXVldWUgPSBbXTtcbmZ1bmN0aW9uIGZsdXNoKCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHR1cGxlID0gcXVldWVbaV07XG4gICAgdmFyIGNhbGxiYWNrID0gdHVwbGVbMF0sIGFyZyA9IHR1cGxlWzFdO1xuICAgIGNhbGxiYWNrKGFyZyk7XG4gIH1cbiAgcXVldWUgPSBbXTtcbn1cblxudmFyIHNjaGVkdWxlRmx1c2g7XG5cbi8vIERlY2lkZSB3aGF0IGFzeW5jIG1ldGhvZCB0byB1c2UgdG8gdHJpZ2dlcmluZyBwcm9jZXNzaW5nIG9mIHF1ZXVlZCBjYWxsYmFja3M6XG5pZiAodHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHt9LnRvU3RyaW5nLmNhbGwocHJvY2VzcykgPT09ICdbb2JqZWN0IHByb2Nlc3NdJykge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlTmV4dFRpY2soKTtcbn0gZWxzZSBpZiAoQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZU11dGF0aW9uT2JzZXJ2ZXIoKTtcbn0gZWxzZSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VTZXRUaW1lb3V0KCk7XG59XG5cbmZ1bmN0aW9uIGFzYXAoY2FsbGJhY2ssIGFyZykge1xuICB2YXIgbGVuZ3RoID0gcXVldWUucHVzaChbY2FsbGJhY2ssIGFyZ10pO1xuICBpZiAobGVuZ3RoID09PSAxKSB7XG4gICAgLy8gSWYgbGVuZ3RoIGlzIDEsIHRoYXQgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHNjaGVkdWxlIGFuIGFzeW5jIGZsdXNoLlxuICAgIC8vIElmIGFkZGl0aW9uYWwgY2FsbGJhY2tzIGFyZSBxdWV1ZWQgYmVmb3JlIHRoZSBxdWV1ZSBpcyBmbHVzaGVkLCB0aGV5XG4gICAgLy8gd2lsbCBiZSBwcm9jZXNzZWQgYnkgdGhpcyBmbHVzaCB0aGF0IHdlIGFyZSBzY2hlZHVsaW5nLlxuICAgIHNjaGVkdWxlRmx1c2goKTtcbiAgfVxufVxuXG5leHBvcnRzLmFzYXAgPSBhc2FwOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIGNvbmZpZyA9IHtcbiAgaW5zdHJ1bWVudDogZmFsc2Vcbn07XG5cbmZ1bmN0aW9uIGNvbmZpZ3VyZShuYW1lLCB2YWx1ZSkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIGNvbmZpZ1tuYW1lXSA9IHZhbHVlO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBjb25maWdbbmFtZV07XG4gIH1cbn1cblxuZXhwb3J0cy5jb25maWcgPSBjb25maWc7XG5leHBvcnRzLmNvbmZpZ3VyZSA9IGNvbmZpZ3VyZTsiLCJcInVzZSBzdHJpY3RcIjtcbi8qZ2xvYmFsIHNlbGYqL1xudmFyIFJTVlBQcm9taXNlID0gcmVxdWlyZShcIi4vcHJvbWlzZVwiKS5Qcm9taXNlO1xudmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKFwiLi91dGlsc1wiKS5pc0Z1bmN0aW9uO1xuXG5mdW5jdGlvbiBwb2x5ZmlsbCgpIHtcbiAgdmFyIGxvY2FsO1xuXG4gIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgIGxvY2FsID0gZ2xvYmFsO1xuICB9IGVsc2UgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5kb2N1bWVudCkge1xuICAgIGxvY2FsID0gd2luZG93O1xuICB9IGVsc2Uge1xuICAgIGxvY2FsID0gc2VsZjtcbiAgfVxuXG4gIHZhciBlczZQcm9taXNlU3VwcG9ydCA9IFxuICAgIFwiUHJvbWlzZVwiIGluIGxvY2FsICYmXG4gICAgLy8gU29tZSBvZiB0aGVzZSBtZXRob2RzIGFyZSBtaXNzaW5nIGZyb21cbiAgICAvLyBGaXJlZm94L0Nocm9tZSBleHBlcmltZW50YWwgaW1wbGVtZW50YXRpb25zXG4gICAgXCJyZXNvbHZlXCIgaW4gbG9jYWwuUHJvbWlzZSAmJlxuICAgIFwicmVqZWN0XCIgaW4gbG9jYWwuUHJvbWlzZSAmJlxuICAgIFwiYWxsXCIgaW4gbG9jYWwuUHJvbWlzZSAmJlxuICAgIFwicmFjZVwiIGluIGxvY2FsLlByb21pc2UgJiZcbiAgICAvLyBPbGRlciB2ZXJzaW9uIG9mIHRoZSBzcGVjIGhhZCBhIHJlc29sdmVyIG9iamVjdFxuICAgIC8vIGFzIHRoZSBhcmcgcmF0aGVyIHRoYW4gYSBmdW5jdGlvblxuICAgIChmdW5jdGlvbigpIHtcbiAgICAgIHZhciByZXNvbHZlO1xuICAgICAgbmV3IGxvY2FsLlByb21pc2UoZnVuY3Rpb24ocikgeyByZXNvbHZlID0gcjsgfSk7XG4gICAgICByZXR1cm4gaXNGdW5jdGlvbihyZXNvbHZlKTtcbiAgICB9KCkpO1xuXG4gIGlmICghZXM2UHJvbWlzZVN1cHBvcnQpIHtcbiAgICBsb2NhbC5Qcm9taXNlID0gUlNWUFByb21pc2U7XG4gIH1cbn1cblxuZXhwb3J0cy5wb2x5ZmlsbCA9IHBvbHlmaWxsOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIGNvbmZpZyA9IHJlcXVpcmUoXCIuL2NvbmZpZ1wiKS5jb25maWc7XG52YXIgY29uZmlndXJlID0gcmVxdWlyZShcIi4vY29uZmlnXCIpLmNvbmZpZ3VyZTtcbnZhciBvYmplY3RPckZ1bmN0aW9uID0gcmVxdWlyZShcIi4vdXRpbHNcIikub2JqZWN0T3JGdW5jdGlvbjtcbnZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZShcIi4vdXRpbHNcIikuaXNGdW5jdGlvbjtcbnZhciBub3cgPSByZXF1aXJlKFwiLi91dGlsc1wiKS5ub3c7XG52YXIgYWxsID0gcmVxdWlyZShcIi4vYWxsXCIpLmFsbDtcbnZhciByYWNlID0gcmVxdWlyZShcIi4vcmFjZVwiKS5yYWNlO1xudmFyIHN0YXRpY1Jlc29sdmUgPSByZXF1aXJlKFwiLi9yZXNvbHZlXCIpLnJlc29sdmU7XG52YXIgc3RhdGljUmVqZWN0ID0gcmVxdWlyZShcIi4vcmVqZWN0XCIpLnJlamVjdDtcbnZhciBhc2FwID0gcmVxdWlyZShcIi4vYXNhcFwiKS5hc2FwO1xuXG52YXIgY291bnRlciA9IDA7XG5cbmNvbmZpZy5hc3luYyA9IGFzYXA7IC8vIGRlZmF1bHQgYXN5bmMgaXMgYXNhcDtcblxuZnVuY3Rpb24gUHJvbWlzZShyZXNvbHZlcikge1xuICBpZiAoIWlzRnVuY3Rpb24ocmVzb2x2ZXIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhIHJlc29sdmVyIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGUgcHJvbWlzZSBjb25zdHJ1Y3RvcicpO1xuICB9XG5cbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFByb21pc2UpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ1Byb21pc2UnOiBQbGVhc2UgdXNlIHRoZSAnbmV3JyBvcGVyYXRvciwgdGhpcyBvYmplY3QgY29uc3RydWN0b3IgY2Fubm90IGJlIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLlwiKTtcbiAgfVxuXG4gIHRoaXMuX3N1YnNjcmliZXJzID0gW107XG5cbiAgaW52b2tlUmVzb2x2ZXIocmVzb2x2ZXIsIHRoaXMpO1xufVxuXG5mdW5jdGlvbiBpbnZva2VSZXNvbHZlcihyZXNvbHZlciwgcHJvbWlzZSkge1xuICBmdW5jdGlvbiByZXNvbHZlUHJvbWlzZSh2YWx1ZSkge1xuICAgIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVqZWN0UHJvbWlzZShyZWFzb24pIHtcbiAgICByZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmVzb2x2ZXIocmVzb2x2ZVByb21pc2UsIHJlamVjdFByb21pc2UpO1xuICB9IGNhdGNoKGUpIHtcbiAgICByZWplY3RQcm9taXNlKGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGludm9rZUNhbGxiYWNrKHNldHRsZWQsIHByb21pc2UsIGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgdmFyIGhhc0NhbGxiYWNrID0gaXNGdW5jdGlvbihjYWxsYmFjayksXG4gICAgICB2YWx1ZSwgZXJyb3IsIHN1Y2NlZWRlZCwgZmFpbGVkO1xuXG4gIGlmIChoYXNDYWxsYmFjaykge1xuICAgIHRyeSB7XG4gICAgICB2YWx1ZSA9IGNhbGxiYWNrKGRldGFpbCk7XG4gICAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgZmFpbGVkID0gdHJ1ZTtcbiAgICAgIGVycm9yID0gZTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFsdWUgPSBkZXRhaWw7XG4gICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgfVxuXG4gIGlmIChoYW5kbGVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSkpIHtcbiAgICByZXR1cm47XG4gIH0gZWxzZSBpZiAoaGFzQ2FsbGJhY2sgJiYgc3VjY2VlZGVkKSB7XG4gICAgcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoZmFpbGVkKSB7XG4gICAgcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBGVUxGSUxMRUQpIHtcbiAgICByZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBSRUpFQ1RFRCkge1xuICAgIHJlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gIH1cbn1cblxudmFyIFBFTkRJTkcgICA9IHZvaWQgMDtcbnZhciBTRUFMRUQgICAgPSAwO1xudmFyIEZVTEZJTExFRCA9IDE7XG52YXIgUkVKRUNURUQgID0gMjtcblxuZnVuY3Rpb24gc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gIHZhciBzdWJzY3JpYmVycyA9IHBhcmVudC5fc3Vic2NyaWJlcnM7XG4gIHZhciBsZW5ndGggPSBzdWJzY3JpYmVycy5sZW5ndGg7XG5cbiAgc3Vic2NyaWJlcnNbbGVuZ3RoXSA9IGNoaWxkO1xuICBzdWJzY3JpYmVyc1tsZW5ndGggKyBGVUxGSUxMRURdID0gb25GdWxmaWxsbWVudDtcbiAgc3Vic2NyaWJlcnNbbGVuZ3RoICsgUkVKRUNURURdICA9IG9uUmVqZWN0aW9uO1xufVxuXG5mdW5jdGlvbiBwdWJsaXNoKHByb21pc2UsIHNldHRsZWQpIHtcbiAgdmFyIGNoaWxkLCBjYWxsYmFjaywgc3Vic2NyaWJlcnMgPSBwcm9taXNlLl9zdWJzY3JpYmVycywgZGV0YWlsID0gcHJvbWlzZS5fZGV0YWlsO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3Vic2NyaWJlcnMubGVuZ3RoOyBpICs9IDMpIHtcbiAgICBjaGlsZCA9IHN1YnNjcmliZXJzW2ldO1xuICAgIGNhbGxiYWNrID0gc3Vic2NyaWJlcnNbaSArIHNldHRsZWRdO1xuXG4gICAgaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwpO1xuICB9XG5cbiAgcHJvbWlzZS5fc3Vic2NyaWJlcnMgPSBudWxsO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZSA9IHtcbiAgY29uc3RydWN0b3I6IFByb21pc2UsXG5cbiAgX3N0YXRlOiB1bmRlZmluZWQsXG4gIF9kZXRhaWw6IHVuZGVmaW5lZCxcbiAgX3N1YnNjcmliZXJzOiB1bmRlZmluZWQsXG5cbiAgdGhlbjogZnVuY3Rpb24ob25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgICB2YXIgcHJvbWlzZSA9IHRoaXM7XG5cbiAgICB2YXIgdGhlblByb21pc2UgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcihmdW5jdGlvbigpIHt9KTtcblxuICAgIGlmICh0aGlzLl9zdGF0ZSkge1xuICAgICAgdmFyIGNhbGxiYWNrcyA9IGFyZ3VtZW50cztcbiAgICAgIGNvbmZpZy5hc3luYyhmdW5jdGlvbiBpbnZva2VQcm9taXNlQ2FsbGJhY2soKSB7XG4gICAgICAgIGludm9rZUNhbGxiYWNrKHByb21pc2UuX3N0YXRlLCB0aGVuUHJvbWlzZSwgY2FsbGJhY2tzW3Byb21pc2UuX3N0YXRlIC0gMV0sIHByb21pc2UuX2RldGFpbCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3Vic2NyaWJlKHRoaXMsIHRoZW5Qcm9taXNlLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoZW5Qcm9taXNlO1xuICB9LFxuXG4gICdjYXRjaCc6IGZ1bmN0aW9uKG9uUmVqZWN0aW9uKSB7XG4gICAgcmV0dXJuIHRoaXMudGhlbihudWxsLCBvblJlamVjdGlvbik7XG4gIH1cbn07XG5cblByb21pc2UuYWxsID0gYWxsO1xuUHJvbWlzZS5yYWNlID0gcmFjZTtcblByb21pc2UucmVzb2x2ZSA9IHN0YXRpY1Jlc29sdmU7XG5Qcm9taXNlLnJlamVjdCA9IHN0YXRpY1JlamVjdDtcblxuZnVuY3Rpb24gaGFuZGxlVGhlbmFibGUocHJvbWlzZSwgdmFsdWUpIHtcbiAgdmFyIHRoZW4gPSBudWxsLFxuICByZXNvbHZlZDtcblxuICB0cnkge1xuICAgIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkEgcHJvbWlzZXMgY2FsbGJhY2sgY2Fubm90IHJldHVybiB0aGF0IHNhbWUgcHJvbWlzZS5cIik7XG4gICAgfVxuXG4gICAgaWYgKG9iamVjdE9yRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICB0aGVuID0gdmFsdWUudGhlbjtcblxuICAgICAgaWYgKGlzRnVuY3Rpb24odGhlbikpIHtcbiAgICAgICAgdGhlbi5jYWxsKHZhbHVlLCBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICBpZiAocmVzb2x2ZWQpIHsgcmV0dXJuIHRydWU7IH1cbiAgICAgICAgICByZXNvbHZlZCA9IHRydWU7XG5cbiAgICAgICAgICBpZiAodmFsdWUgIT09IHZhbCkge1xuICAgICAgICAgICAgcmVzb2x2ZShwcm9taXNlLCB2YWwpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmdWxmaWxsKHByb21pc2UsIHZhbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICBpZiAocmVzb2x2ZWQpIHsgcmV0dXJuIHRydWU7IH1cbiAgICAgICAgICByZXNvbHZlZCA9IHRydWU7XG5cbiAgICAgICAgICByZWplY3QocHJvbWlzZSwgdmFsKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChyZXNvbHZlZCkgeyByZXR1cm4gdHJ1ZTsgfVxuICAgIHJlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmUocHJvbWlzZSwgdmFsdWUpIHtcbiAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG4gICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoIWhhbmRsZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlKSkge1xuICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpIHtcbiAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSB7IHJldHVybjsgfVxuICBwcm9taXNlLl9zdGF0ZSA9IFNFQUxFRDtcbiAgcHJvbWlzZS5fZGV0YWlsID0gdmFsdWU7XG5cbiAgY29uZmlnLmFzeW5jKHB1Ymxpc2hGdWxmaWxsbWVudCwgcHJvbWlzZSk7XG59XG5cbmZ1bmN0aW9uIHJlamVjdChwcm9taXNlLCByZWFzb24pIHtcbiAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSB7IHJldHVybjsgfVxuICBwcm9taXNlLl9zdGF0ZSA9IFNFQUxFRDtcbiAgcHJvbWlzZS5fZGV0YWlsID0gcmVhc29uO1xuXG4gIGNvbmZpZy5hc3luYyhwdWJsaXNoUmVqZWN0aW9uLCBwcm9taXNlKTtcbn1cblxuZnVuY3Rpb24gcHVibGlzaEZ1bGZpbGxtZW50KHByb21pc2UpIHtcbiAgcHVibGlzaChwcm9taXNlLCBwcm9taXNlLl9zdGF0ZSA9IEZVTEZJTExFRCk7XG59XG5cbmZ1bmN0aW9uIHB1Ymxpc2hSZWplY3Rpb24ocHJvbWlzZSkge1xuICBwdWJsaXNoKHByb21pc2UsIHByb21pc2UuX3N0YXRlID0gUkVKRUNURUQpO1xufVxuXG5leHBvcnRzLlByb21pc2UgPSBQcm9taXNlOyIsIlwidXNlIHN0cmljdFwiO1xuLyogZ2xvYmFsIHRvU3RyaW5nICovXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpLmlzQXJyYXk7XG5cbi8qKlxuICBgUlNWUC5yYWNlYCBhbGxvd3MgeW91IHRvIHdhdGNoIGEgc2VyaWVzIG9mIHByb21pc2VzIGFuZCBhY3QgYXMgc29vbiBhcyB0aGVcbiAgZmlyc3QgcHJvbWlzZSBnaXZlbiB0byB0aGUgYHByb21pc2VzYCBhcmd1bWVudCBmdWxmaWxscyBvciByZWplY3RzLlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICB2YXIgcHJvbWlzZTEgPSBuZXcgUlNWUC5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVzb2x2ZShcInByb21pc2UgMVwiKTtcbiAgICB9LCAyMDApO1xuICB9KTtcblxuICB2YXIgcHJvbWlzZTIgPSBuZXcgUlNWUC5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVzb2x2ZShcInByb21pc2UgMlwiKTtcbiAgICB9LCAxMDApO1xuICB9KTtcblxuICBSU1ZQLnJhY2UoW3Byb21pc2UxLCBwcm9taXNlMl0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAvLyByZXN1bHQgPT09IFwicHJvbWlzZSAyXCIgYmVjYXVzZSBpdCB3YXMgcmVzb2x2ZWQgYmVmb3JlIHByb21pc2UxXG4gICAgLy8gd2FzIHJlc29sdmVkLlxuICB9KTtcbiAgYGBgXG5cbiAgYFJTVlAucmFjZWAgaXMgZGV0ZXJtaW5pc3RpYyBpbiB0aGF0IG9ubHkgdGhlIHN0YXRlIG9mIHRoZSBmaXJzdCBjb21wbGV0ZWRcbiAgcHJvbWlzZSBtYXR0ZXJzLiBGb3IgZXhhbXBsZSwgZXZlbiBpZiBvdGhlciBwcm9taXNlcyBnaXZlbiB0byB0aGUgYHByb21pc2VzYFxuICBhcnJheSBhcmd1bWVudCBhcmUgcmVzb2x2ZWQsIGJ1dCB0aGUgZmlyc3QgY29tcGxldGVkIHByb21pc2UgaGFzIGJlY29tZVxuICByZWplY3RlZCBiZWZvcmUgdGhlIG90aGVyIHByb21pc2VzIGJlY2FtZSBmdWxmaWxsZWQsIHRoZSByZXR1cm5lZCBwcm9taXNlXG4gIHdpbGwgYmVjb21lIHJlamVjdGVkOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgdmFyIHByb21pc2UxID0gbmV3IFJTVlAuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlc29sdmUoXCJwcm9taXNlIDFcIik7XG4gICAgfSwgMjAwKTtcbiAgfSk7XG5cbiAgdmFyIHByb21pc2UyID0gbmV3IFJTVlAuUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJwcm9taXNlIDJcIikpO1xuICAgIH0sIDEwMCk7XG4gIH0pO1xuXG4gIFJTVlAucmFjZShbcHJvbWlzZTEsIHByb21pc2UyXSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgIC8vIENvZGUgaGVyZSBuZXZlciBydW5zIGJlY2F1c2UgdGhlcmUgYXJlIHJlamVjdGVkIHByb21pc2VzIVxuICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgIC8vIHJlYXNvbi5tZXNzYWdlID09PSBcInByb21pc2UyXCIgYmVjYXVzZSBwcm9taXNlIDIgYmVjYW1lIHJlamVjdGVkIGJlZm9yZVxuICAgIC8vIHByb21pc2UgMSBiZWNhbWUgZnVsZmlsbGVkXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIHJhY2VcbiAgQGZvciBSU1ZQXG4gIEBwYXJhbSB7QXJyYXl9IHByb21pc2VzIGFycmF5IG9mIHByb21pc2VzIHRvIG9ic2VydmVcbiAgQHBhcmFtIHtTdHJpbmd9IGxhYmVsIG9wdGlvbmFsIHN0cmluZyBmb3IgZGVzY3JpYmluZyB0aGUgcHJvbWlzZSByZXR1cm5lZC5cbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2UgdGhhdCBiZWNvbWVzIGZ1bGZpbGxlZCB3aXRoIHRoZSB2YWx1ZSB0aGUgZmlyc3RcbiAgY29tcGxldGVkIHByb21pc2VzIGlzIHJlc29sdmVkIHdpdGggaWYgdGhlIGZpcnN0IGNvbXBsZXRlZCBwcm9taXNlIHdhc1xuICBmdWxmaWxsZWQsIG9yIHJlamVjdGVkIHdpdGggdGhlIHJlYXNvbiB0aGF0IHRoZSBmaXJzdCBjb21wbGV0ZWQgcHJvbWlzZVxuICB3YXMgcmVqZWN0ZWQgd2l0aC5cbiovXG5mdW5jdGlvbiByYWNlKHByb21pc2VzKSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBQcm9taXNlID0gdGhpcztcblxuICBpZiAoIWlzQXJyYXkocHJvbWlzZXMpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhbiBhcnJheSB0byByYWNlLicpO1xuICB9XG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdLCBwcm9taXNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9taXNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgcHJvbWlzZSA9IHByb21pc2VzW2ldO1xuXG4gICAgICBpZiAocHJvbWlzZSAmJiB0eXBlb2YgcHJvbWlzZS50aGVuID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHByb21pc2UudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzb2x2ZShwcm9taXNlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnRzLnJhY2UgPSByYWNlOyIsIlwidXNlIHN0cmljdFwiO1xuLyoqXG4gIGBSU1ZQLnJlamVjdGAgcmV0dXJucyBhIHByb21pc2UgdGhhdCB3aWxsIGJlY29tZSByZWplY3RlZCB3aXRoIHRoZSBwYXNzZWRcbiAgYHJlYXNvbmAuIGBSU1ZQLnJlamVjdGAgaXMgZXNzZW50aWFsbHkgc2hvcnRoYW5kIGZvciB0aGUgZm9sbG93aW5nOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgdmFyIHByb21pc2UgPSBuZXcgUlNWUC5Qcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgcmVqZWN0KG5ldyBFcnJvcignV0hPT1BTJykpO1xuICB9KTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuICAgIC8vIENvZGUgaGVyZSBkb2Vzbid0IHJ1biBiZWNhdXNlIHRoZSBwcm9taXNlIGlzIHJlamVjdGVkIVxuICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgIC8vIHJlYXNvbi5tZXNzYWdlID09PSAnV0hPT1BTJ1xuICB9KTtcbiAgYGBgXG5cbiAgSW5zdGVhZCBvZiB3cml0aW5nIHRoZSBhYm92ZSwgeW91ciBjb2RlIG5vdyBzaW1wbHkgYmVjb21lcyB0aGUgZm9sbG93aW5nOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgdmFyIHByb21pc2UgPSBSU1ZQLnJlamVjdChuZXcgRXJyb3IoJ1dIT09QUycpKTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuICAgIC8vIENvZGUgaGVyZSBkb2Vzbid0IHJ1biBiZWNhdXNlIHRoZSBwcm9taXNlIGlzIHJlamVjdGVkIVxuICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgIC8vIHJlYXNvbi5tZXNzYWdlID09PSAnV0hPT1BTJ1xuICB9KTtcbiAgYGBgXG5cbiAgQG1ldGhvZCByZWplY3RcbiAgQGZvciBSU1ZQXG4gIEBwYXJhbSB7QW55fSByZWFzb24gdmFsdWUgdGhhdCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkIHdpdGguXG4gIEBwYXJhbSB7U3RyaW5nfSBsYWJlbCBvcHRpb25hbCBzdHJpbmcgZm9yIGlkZW50aWZ5aW5nIHRoZSByZXR1cm5lZCBwcm9taXNlLlxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIHJlamVjdGVkIHdpdGggdGhlIGdpdmVuXG4gIGByZWFzb25gLlxuKi9cbmZ1bmN0aW9uIHJlamVjdChyZWFzb24pIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgdmFyIFByb21pc2UgPSB0aGlzO1xuXG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgcmVqZWN0KHJlYXNvbik7XG4gIH0pO1xufVxuXG5leHBvcnRzLnJlamVjdCA9IHJlamVjdDsiLCJcInVzZSBzdHJpY3RcIjtcbmZ1bmN0aW9uIHJlc29sdmUodmFsdWUpIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUuY29uc3RydWN0b3IgPT09IHRoaXMpIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICB2YXIgUHJvbWlzZSA9IHRoaXM7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUpIHtcbiAgICByZXNvbHZlKHZhbHVlKTtcbiAgfSk7XG59XG5cbmV4cG9ydHMucmVzb2x2ZSA9IHJlc29sdmU7IiwiXCJ1c2Ugc3RyaWN0XCI7XG5mdW5jdGlvbiBvYmplY3RPckZ1bmN0aW9uKHgpIHtcbiAgcmV0dXJuIGlzRnVuY3Rpb24oeCkgfHwgKHR5cGVvZiB4ID09PSBcIm9iamVjdFwiICYmIHggIT09IG51bGwpO1xufVxuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHgpIHtcbiAgcmV0dXJuIHR5cGVvZiB4ID09PSBcImZ1bmN0aW9uXCI7XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkoeCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHgpID09PSBcIltvYmplY3QgQXJyYXldXCI7XG59XG5cbi8vIERhdGUubm93IGlzIG5vdCBhdmFpbGFibGUgaW4gYnJvd3NlcnMgPCBJRTlcbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL0RhdGUvbm93I0NvbXBhdGliaWxpdHlcbnZhciBub3cgPSBEYXRlLm5vdyB8fCBmdW5jdGlvbigpIHsgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpOyB9O1xuXG5cbmV4cG9ydHMub2JqZWN0T3JGdW5jdGlvbiA9IG9iamVjdE9yRnVuY3Rpb247XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcbmV4cG9ydHMubm93ID0gbm93OyIsIihmdW5jdGlvbiAoRGVMb3JlYW4pIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIC8vIFRoZXJlIGFyZSB0d28gbWFpbiBjb25jZXB0cyBpbiBGbHV4IHN0cnVjdHVyZTogKipEaXNwYXRjaGVycyoqIGFuZCAqKlN0b3JlcyoqLlxuICAvLyBBY3Rpb24gQ3JlYXRvcnMgYXJlIHNpbXBseSBoZWxwZXJzIGJ1dCBkb2Vzbid0IHJlcXVpcmUgYW55IGZyYW1ld29yayBsZXZlbFxuICAvLyBhYnN0cmFjdGlvbi5cblxuICB2YXIgRGlzcGF0Y2hlciwgU3RvcmU7XG5cbiAgLy8gIyMgUHJpdmF0ZSBIZWxwZXIgRnVuY3Rpb25zXG5cbiAgLy8gSGVscGVyIGZ1bmN0aW9ucyBhcmUgcHJpdmF0ZSBmdW5jdGlvbnMgdG8gYmUgdXNlZCBpbiBjb2RlYmFzZS5cbiAgLy8gSXQncyBiZXR0ZXIgdXNpbmcgdHdvIHVuZGVyc2NvcmUgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgZnVuY3Rpb24uXG5cbiAgLyogYF9faGFzT3duYCBmdW5jdGlvbiBpcyBhIHNob3J0Y3V0IGZvciBgT2JqZWN0I2hhc093blByb3BlcnR5YCAqL1xuICBmdW5jdGlvbiBfX2hhc093bihvYmplY3QsIHByb3ApIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgcHJvcCk7XG4gIH1cblxuICAvLyBVc2UgYF9fZ2VuZXJhdGVBY3Rpb25OYW1lYCBmdW5jdGlvbiB0byBnZW5lcmF0ZSBhY3Rpb24gbmFtZXMuXG4gIC8vIEUuZy4gSWYgeW91IGNyZWF0ZSBhbiBhY3Rpb24gd2l0aCBuYW1lIGBoZWxsb2AgaXQgd2lsbCBiZVxuICAvLyBgYWN0aW9uOmhlbGxvYCBmb3IgdGhlIEZsdXguXG4gIGZ1bmN0aW9uIF9fZ2VuZXJhdGVBY3Rpb25OYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gJ2FjdGlvbjonICsgbmFtZTtcbiAgfVxuXG4gIC8qIEl0J3MgdXNlZCBieSB0aGUgc2NoZW1lcyB0byBzYXZlIHRoZSBvcmlnaW5hbCB2ZXJzaW9uIChub3QgY2FsY3VsYXRlZClcbiAgICAgb2YgdGhlIGRhdGEuICovXG4gIGZ1bmN0aW9uIF9fZ2VuZXJhdGVPcmlnaW5hbE5hbWUobmFtZSkge1xuICAgIHJldHVybiAnb3JpZ2luYWw6JyArIG5hbWU7XG4gIH1cblxuICAvLyBgX19maW5kRGlzcGF0Y2hlcmAgaXMgYSBwcml2YXRlIGZ1bmN0aW9uIGZvciAqKlJlYWN0IGNvbXBvbmVudHMqKi5cbiAgZnVuY3Rpb24gX19maW5kRGlzcGF0Y2hlcih2aWV3KSB7XG4gICAgIC8vIFByb3ZpZGUgYSB1c2VmdWwgZXJyb3IgbWVzc2FnZSBpZiBubyBkaXNwYXRjaGVyIGlzIGZvdW5kIGluIHRoZSBjaGFpblxuICAgIGlmICh2aWV3ID09IG51bGwpIHtcbiAgICAgIHRocm93ICdObyBkaXNwYXRjaGVyIGZvdW5kLiBUaGUgRGVMb3JlYW5KUyBtaXhpbiByZXF1aXJlcyBhIFwiZGlzcGF0Y2hlclwiIHByb3BlcnR5IHRvIGJlIHBhc3NlZCB0byBhIGNvbXBvbmVudCwgb3Igb25lIG9mIGl0XFwncyBhbmNlc3RvcnMuJztcbiAgICB9XG4gICAgLyogYHZpZXdgIHNob3VsZCBiZSBhIGNvbXBvbmVudCBpbnN0YW5jZS4gSWYgYSBjb21wb25lbnQgZG9uJ3QgaGF2ZVxuICAgICAgICBhbnkgZGlzcGF0Y2hlciwgaXQgdHJpZXMgdG8gZmluZCBhIGRpc3BhdGNoZXIgZnJvbSB0aGUgcGFyZW50cy4gKi9cbiAgICBpZiAoIXZpZXcucHJvcHMuZGlzcGF0Y2hlcikge1xuICAgICAgcmV0dXJuIF9fZmluZERpc3BhdGNoZXIodmlldy5fb3duZXIpO1xuICAgIH1cbiAgICByZXR1cm4gdmlldy5wcm9wcy5kaXNwYXRjaGVyO1xuICB9XG5cbiAgLy8gYF9fY2xvbmVgIGNyZWF0ZXMgYSBkZWVwIGNvcHkgb2YgYW4gb2JqZWN0LlxuICBmdW5jdGlvbiBfX2Nsb25lKG9iaikge1xuICAgIGlmIChvYmogPT09IG51bGwgfHwgdHlwZW9mIG9iaiAhPT0gJ29iamVjdCcpIHsgcmV0dXJuIG9iajsgfVxuICAgIHZhciBjb3B5ID0gb2JqLmNvbnN0cnVjdG9yKCk7XG4gICAgZm9yICh2YXIgYXR0ciBpbiBvYmopIHtcbiAgICAgIGlmIChfX2hhc093bihvYmosIGF0dHIpKSB7XG4gICAgICAgIGNvcHlbYXR0cl0gPSBfX2Nsb25lKG9ialthdHRyXSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjb3B5O1xuICB9XG5cbiAgLy8gYF9fZXh0ZW5kYCBhZGRzIHByb3BzIHRvIG9ialxuICBmdW5jdGlvbiBfX2V4dGVuZChvYmosIHByb3BzKSB7XG4gICAgcHJvcHMgPSBfX2Nsb25lKHByb3BzKTtcbiAgICBmb3IgKHZhciBwcm9wIGluIHByb3BzKSB7XG4gICAgICBpZiAocHJvcHMuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgb2JqW3Byb3BdID0gcHJvcHNbcHJvcF07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICAvLyAjIyBEaXNwYXRjaGVyXG5cbiAgLy8gVGhlIGRpc3BhdGNoZXIgaXMgKip0aGUgY2VudHJhbCBodWIqKiB0aGF0ICoqbWFuYWdlcyBhbGwgZGF0YSBmbG93KiogaW5cbiAgLy8gYSBGbHV4IGFwcGxpY2F0aW9uLiBJdCBpcyBlc3NlbnRpYWxseSBhIF9yZWdpc3RyeSBvZiBjYWxsYmFja3MgaW50byB0aGVcbiAgLy8gc3RvcmVzXy4gRWFjaCBzdG9yZSByZWdpc3RlcnMgaXRzZWxmIGFuZCBwcm92aWRlcyBhIGNhbGxiYWNrLiBXaGVuIHRoZVxuICAvLyBkaXNwYXRjaGVyIHJlc3BvbmRzIHRvIGFuIGFjdGlvbiwgYWxsIHN0b3JlcyBpbiB0aGUgYXBwbGljYXRpb24gYXJlIHNlbnRcbiAgLy8gdGhlIGRhdGEgcGF5bG9hZCBwcm92aWRlZCBieSB0aGUgYWN0aW9uIHZpYSB0aGUgY2FsbGJhY2tzIGluIHRoZSByZWdpc3RyeS5cbiAgRGlzcGF0Y2hlciA9IChmdW5jdGlvbiAoKSB7XG5cbiAgICAvLyAjIyMgRGlzcGF0Y2hlciBIZWxwZXJzXG5cbiAgICAvLyBSb2xsYmFjayBsaXN0ZW5lciBhZGRzIGEgYHJvbGxiYWNrYCBldmVudCBsaXN0ZW5lciB0byB0aGUgYnVuY2ggb2ZcbiAgICAvLyBzdG9yZXMuXG4gICAgZnVuY3Rpb24gX19yb2xsYmFja0xpc3RlbmVyKHN0b3Jlcykge1xuXG4gICAgICBmdW5jdGlvbiBfX2xpc3RlbmVyKCkge1xuICAgICAgICBmb3IgKHZhciBpIGluIHN0b3Jlcykge1xuICAgICAgICAgIHN0b3Jlc1tpXS5saXN0ZW5lci5lbWl0KCdfX3JvbGxiYWNrJyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLyogSWYgYW55IG9mIHRoZW0gZmlyZXMgYHJvbGxiYWNrYCBldmVudCwgYWxsIG9mIHRoZSBzdG9yZXNcbiAgICAgICAgIHdpbGwgYmUgZW1pdHRlZCB0byBiZSByb2xsZWQgYmFjayB3aXRoIGBfX3JvbGxiYWNrYCBldmVudC4gKi9cbiAgICAgIGZvciAodmFyIGogaW4gc3RvcmVzKSB7XG4gICAgICAgIHN0b3Jlc1tqXS5saXN0ZW5lci5vbigncm9sbGJhY2snLCBfX2xpc3RlbmVyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyAjIyMgRGlzcGF0Y2hlciBQcm90b3R5cGVcbiAgICBmdW5jdGlvbiBEaXNwYXRjaGVyKHN0b3Jlcykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgLy8gYERlTG9yZWFuLkV2ZW50RW1pdHRlcmAgaXMgYHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcmAgYnkgZGVmYXVsdC5cbiAgICAgIC8vIHlvdSBjYW4gY2hhbmdlIGl0IHVzaW5nIGBEZUxvcmVhbi5GbHV4LmRlZmluZSgnRXZlbnRFbWl0dGVyJywgQW5vdGhlckV2ZW50RW1pdHRlcilgXG4gICAgICB0aGlzLmxpc3RlbmVyID0gbmV3IERlTG9yZWFuLkV2ZW50RW1pdHRlcigpO1xuICAgICAgdGhpcy5zdG9yZXMgPSBzdG9yZXM7XG5cbiAgICAgIC8qIFN0b3JlcyBzaG91bGQgYmUgbGlzdGVuZWQgZm9yIHJvbGxiYWNrIGV2ZW50cy4gKi9cbiAgICAgIF9fcm9sbGJhY2tMaXN0ZW5lcihPYmplY3Qua2V5cyhzdG9yZXMpLm1hcChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHJldHVybiBzdG9yZXNba2V5XTtcbiAgICAgIH0pKTtcbiAgICB9XG5cbiAgICAvLyBgZGlzcGF0Y2hgIG1ldGhvZCBkaXNwYXRjaCB0aGUgZXZlbnQgd2l0aCBgZGF0YWAgKG9yICoqcGF5bG9hZCoqKVxuICAgIERpc3BhdGNoZXIucHJvdG90eXBlLmRpc3BhdGNoID0gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLCBzdG9yZXMsIGRlZmVycmVkLCBhcmdzO1xuICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgICBcbiAgICAgIHRoaXMubGlzdGVuZXIuZW1pdC5hcHBseSh0aGlzLmxpc3RlbmVyLCBbJ2Rpc3BhdGNoJ10uY29uY2F0KGFyZ3MpKTtcbiAgICAgIFxuICAgICAgLyogU3RvcmVzIGFyZSBrZXktdmFsdWUgcGFpcnMuIENvbGxlY3Qgc3RvcmUgaW5zdGFuY2VzIGludG8gYW4gYXJyYXkuICovXG4gICAgICBzdG9yZXMgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc3RvcmVzID0gW10sIHN0b3JlO1xuICAgICAgICBmb3IgKHZhciBzdG9yZU5hbWUgaW4gc2VsZi5zdG9yZXMpIHtcbiAgICAgICAgICBzdG9yZSA9IHNlbGYuc3RvcmVzW3N0b3JlTmFtZV07XG4gICAgICAgICAgLyogU3RvcmUgdmFsdWUgbXVzdCBiZSBhbiBfaW5zdGFuY2Ugb2YgU3RvcmVfLiAqL1xuICAgICAgICAgIGlmICghc3RvcmUgaW5zdGFuY2VvZiBTdG9yZSkge1xuICAgICAgICAgICAgdGhyb3cgJ0dpdmVuIHN0b3JlIGlzIG5vdCBhIHN0b3JlIGluc3RhbmNlJztcbiAgICAgICAgICB9XG4gICAgICAgICAgc3RvcmVzLnB1c2goc3RvcmUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdG9yZXM7XG4gICAgICB9KCkpO1xuXG4gICAgICAvLyBTdG9yZSBpbnN0YW5jZXMgc2hvdWxkIHdhaXQgZm9yIGZpbmlzaC4gU28geW91IGNhbiBrbm93IGlmIGFsbCB0aGVcbiAgICAgIC8vIHN0b3JlcyBhcmUgZGlzcGF0Y2hlZCBwcm9wZXJseS5cbiAgICAgIGRlZmVycmVkID0gdGhpcy53YWl0Rm9yKHN0b3JlcywgYXJnc1swXSk7XG5cbiAgICAgIC8qIFBheWxvYWQgc2hvdWxkIHNlbmQgdG8gYWxsIHJlbGF0ZWQgc3RvcmVzLiAqL1xuICAgICAgZm9yICh2YXIgc3RvcmVOYW1lIGluIHNlbGYuc3RvcmVzKSB7XG4gICAgICAgIHNlbGYuc3RvcmVzW3N0b3JlTmFtZV0uZGlzcGF0Y2hBY3Rpb24uYXBwbHkoc2VsZi5zdG9yZXNbc3RvcmVOYW1lXSwgYXJncyk7XG4gICAgICB9XG5cbiAgICAgIC8vIGBkaXNwYXRjaGAgcmV0dXJucyBkZWZlcnJlZCBvYmplY3QgeW91IGNhbiBqdXN0IHVzZSAqKnByb21pc2UqKlxuICAgICAgLy8gZm9yIGRpc3BhdGNoaW5nOiBgZGlzcGF0Y2goLi4pLnRoZW4oLi4pYC5cbiAgICAgIHJldHVybiBkZWZlcnJlZDtcbiAgICB9O1xuXG4gICAgLy8gYHdhaXRGb3JgIGlzIGFjdHVhbGx5IGEgX3NlbWktcHJpdmF0ZV8gbWV0aG9kLiBCZWNhdXNlIGl0J3Mga2luZCBvZiBpbnRlcm5hbFxuICAgIC8vIGFuZCB5b3UgZG9uJ3QgbmVlZCB0byBjYWxsIGl0IGZyb20gb3V0c2lkZSBtb3N0IG9mIHRoZSB0aW1lcy4gSXQgdGFrZXNcbiAgICAvLyBhcnJheSBvZiBzdG9yZSBpbnN0YW5jZXMgKGBbU3RvcmUsIFN0b3JlLCBTdG9yZSwgLi4uXWApLiBJdCB3aWxsIGNyZWF0ZVxuICAgIC8vIGEgcHJvbWlzZSBhbmQgcmV0dXJuIGl0LiBfV2hlbmV2ZXIgc3RvcmUgY2hhbmdlcywgaXQgcmVzb2x2ZXMgdGhlIHByb21pc2VfLlxuICAgIERpc3BhdGNoZXIucHJvdG90eXBlLndhaXRGb3IgPSBmdW5jdGlvbiAoc3RvcmVzLCBhY3Rpb25OYW1lKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXMsIHByb21pc2VzO1xuICAgICAgcHJvbWlzZXMgPSAoZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgX19wcm9taXNlcyA9IFtdLCBwcm9taXNlO1xuXG4gICAgICAgIC8qIGBfX3Byb21pc2VHZW5lcmF0b3JgIGdlbmVyYXRlcyBhIHNpbXBsZSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgaXRzZWxmIHdoZW5cbiAgICAgICAgICAgIHJlbGF0ZWQgc3RvcmUgaXMgY2hhbmdlZC4gKi9cbiAgICAgICAgZnVuY3Rpb24gX19wcm9taXNlR2VuZXJhdG9yKHN0b3JlKSB7XG4gICAgICAgICAgLy8gYERlTG9yZWFuLlByb21pc2VgIGlzIGByZXF1aXJlKCdlczYtcHJvbWlzZScpLlByb21pc2VgIGJ5IGRlZmF1bHQuXG4gICAgICAgICAgLy8geW91IGNhbiBjaGFuZ2UgaXQgdXNpbmcgYERlTG9yZWFuLkZsdXguZGVmaW5lKCdQcm9taXNlJywgQW5vdGhlclByb21pc2UpYFxuICAgICAgICAgIHJldHVybiBuZXcgRGVMb3JlYW4uUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBzdG9yZS5saXN0ZW5lci5vbmNlKCdjaGFuZ2UnLCByZXNvbHZlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGkgaW4gc3RvcmVzKSB7XG4gICAgICAgICAgLy8gT25seSBnZW5lcmF0ZSBwcm9taXNlcyBmb3Igc3RvcmVzIHRoYXQgYWUgbGlzdGVuaW5nIGZvciB0aGlzIGFjdGlvblxuICAgICAgICAgIGlmIChzdG9yZXNbaV0uYWN0aW9ucyAmJiBzdG9yZXNbaV0uYWN0aW9uc1thY3Rpb25OYW1lXSAhPSBudWxsKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gX19wcm9taXNlR2VuZXJhdG9yKHN0b3Jlc1tpXSk7XG4gICAgICAgICAgICBfX3Byb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBfX3Byb21pc2VzO1xuICAgICAgfSgpKTtcbiAgICAgIC8vIFdoZW4gYWxsIHRoZSBwcm9taXNlcyBhcmUgcmVzb2x2ZWQsIGRpc3BhdGNoZXIgZW1pdHMgYGNoYW5nZTphbGxgIGV2ZW50LlxuICAgICAgcmV0dXJuIERlTG9yZWFuLlByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5saXN0ZW5lci5lbWl0KCdjaGFuZ2U6YWxsJyk7XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gYHJlZ2lzdGVyQWN0aW9uYCBtZXRob2QgYWRkcyBhIG1ldGhvZCB0byB0aGUgcHJvdG90eXBlLiBTbyB5b3UgY2FuIGp1c3QgdXNlXG4gICAgLy8gYGRpc3BhdGNoZXJJbnN0YW5jZS5hY3Rpb25OYW1lKClgLlxuICAgIERpc3BhdGNoZXIucHJvdG90eXBlLnJlZ2lzdGVyQWN0aW9uID0gZnVuY3Rpb24gKGFjdGlvbiwgY2FsbGJhY2spIHtcbiAgICAgIC8qIFRoZSBjYWxsYmFjayBtdXN0IGJlIGEgZnVuY3Rpb24uICovXG4gICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRoaXNbYWN0aW9uXSA9IGNhbGxiYWNrLmJpbmQodGhpcy5zdG9yZXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgJ0FjdGlvbiBjYWxsYmFjayBzaG91bGQgYmUgYSBmdW5jdGlvbi4nO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBgcmVnaXN0ZXJgIG1ldGhvZCBhZGRzIGFuIGdsb2JhbCBhY3Rpb24gY2FsbGJhY2sgdG8gdGhlIGRpc3BhdGNoZXIuXG4gICAgRGlzcGF0Y2hlci5wcm90b3R5cGUucmVnaXN0ZXIgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIC8qIFRoZSBjYWxsYmFjayBtdXN0IGJlIGEgZnVuY3Rpb24uICovXG4gICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRoaXMubGlzdGVuZXIub24oJ2Rpc3BhdGNoJywgY2FsbGJhY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgJ0dsb2JhbCBjYWxsYmFjayBzaG91bGQgYmUgYSBmdW5jdGlvbi4nO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBgZ2V0U3RvcmVgIHJldHVybnMgdGhlIHN0b3JlIGZyb20gc3RvcmVzIGhhc2guXG4gICAgLy8gWW91IGNhbiBhbHNvIHVzZSBgZGlzcGF0Y2hlckluc3RhbmNlLnN0b3Jlc1tzdG9yZU5hbWVdYCBidXRcbiAgICAvLyBpdCBjaGVja3MgaWYgdGhlIHN0b3JlIHJlYWxseSBleGlzdHMuXG4gICAgRGlzcGF0Y2hlci5wcm90b3R5cGUuZ2V0U3RvcmUgPSBmdW5jdGlvbiAoc3RvcmVOYW1lKSB7XG4gICAgICBpZiAoIXRoaXMuc3RvcmVzW3N0b3JlTmFtZV0pIHtcbiAgICAgICAgdGhyb3cgJ1N0b3JlICcgKyBzdG9yZU5hbWUgKyAnIGRvZXMgbm90IGV4aXN0Lic7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5zdG9yZXNbc3RvcmVOYW1lXS5nZXRTdGF0ZSgpO1xuICAgIH07XG5cbiAgICAvLyAjIyMgU2hvcnRjdXRzXG5cbiAgICBEaXNwYXRjaGVyLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzLmxpc3RlbmVyLm9uLmFwcGx5KHRoaXMubGlzdGVuZXIsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIERpc3BhdGNoZXIucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzLmxpc3RlbmVyLnJlbW92ZUxpc3RlbmVyLmFwcGx5KHRoaXMubGlzdGVuZXIsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIERpc3BhdGNoZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5saXN0ZW5lci5lbWl0LmFwcGx5KHRoaXMubGlzdGVuZXIsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIHJldHVybiBEaXNwYXRjaGVyO1xuICB9KCkpO1xuXG4gIC8vICMjIFN0b3JlXG5cbiAgLy8gU3RvcmVzIGNvbnRhaW4gdGhlIGFwcGxpY2F0aW9uIHN0YXRlIGFuZCBsb2dpYy4gVGhlaXIgcm9sZSBpcyBzb21ld2hhdCBzaW1pbGFyXG4gIC8vIHRvIGEgbW9kZWwgaW4gYSB0cmFkaXRpb25hbCBNVkMsIGJ1dCB0aGV5IG1hbmFnZSB0aGUgc3RhdGUgb2YgbWFueSBvYmplY3RzLlxuICAvLyBVbmxpa2UgTVZDIG1vZGVscywgdGhleSBhcmUgbm90IGluc3RhbmNlcyBvZiBvbmUgb2JqZWN0LCBub3IgYXJlIHRoZXkgdGhlXG4gIC8vIHNhbWUgYXMgQmFja2JvbmUncyBjb2xsZWN0aW9ucy4gTW9yZSB0aGFuIHNpbXBseSBtYW5hZ2luZyBhIGNvbGxlY3Rpb24gb2ZcbiAgLy8gT1JNLXN0eWxlIG9iamVjdHMsIHN0b3JlcyBtYW5hZ2UgdGhlIGFwcGxpY2F0aW9uIHN0YXRlIGZvciBhIHBhcnRpY3VsYXJcbiAgLy8gZG9tYWluIHdpdGhpbiB0aGUgYXBwbGljYXRpb24uXG4gIFN0b3JlID0gKGZ1bmN0aW9uICgpIHtcblxuICAgIC8vICMjIyBTdG9yZSBQcm90b3R5cGVcbiAgICBmdW5jdGlvbiBTdG9yZShhcmdzKSB7XG4gICAgICBpZiAoIXRoaXMuc3RhdGUpIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IHt9O1xuICAgICAgfVxuXG4gICAgICAvLyBgRGVMb3JlYW4uRXZlbnRFbWl0dGVyYCBpcyBgcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyYCBieSBkZWZhdWx0LlxuICAgICAgLy8geW91IGNhbiBjaGFuZ2UgaXQgdXNpbmcgYERlTG9yZWFuLkZsdXguZGVmaW5lKCdFdmVudEVtaXR0ZXInLCBBbm90aGVyRXZlbnRFbWl0dGVyKWBcbiAgICAgIHRoaXMubGlzdGVuZXIgPSBuZXcgRGVMb3JlYW4uRXZlbnRFbWl0dGVyKCk7XG4gICAgICB0aGlzLmJpbmRBY3Rpb25zKCk7XG4gICAgICB0aGlzLmJ1aWxkU2NoZW1lKCk7XG5cbiAgICAgIHRoaXMuaW5pdGlhbGl6ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIFN0b3JlLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24gKCkge1xuXG4gICAgfTtcblxuICAgIFN0b3JlLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoYXJnKSB7XG4gICAgICByZXR1cm4gdGhpcy5zdGF0ZVthcmddO1xuICAgIH07XG5cbiAgICAvLyBgc2V0YCBtZXRob2QgdXBkYXRlcyB0aGUgZGF0YSBkZWZpbmVkIGF0IHRoZSBgc2NoZW1lYCBvZiB0aGUgc3RvcmUuXG4gICAgU3RvcmUucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChhcmcxLCB2YWx1ZSkge1xuICAgICAgdmFyIGNoYW5nZWRQcm9wcyA9IFtdO1xuICAgICAgaWYgKHR5cGVvZiBhcmcxID09PSAnb2JqZWN0Jykge1xuICAgICAgICBmb3IgKHZhciBrZXlOYW1lIGluIGFyZzEpIHtcbiAgICAgICAgICBjaGFuZ2VkUHJvcHMucHVzaChrZXlOYW1lKTtcbiAgICAgICAgICB0aGlzLnNldFZhbHVlKGtleU5hbWUsIGFyZzFba2V5TmFtZV0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaGFuZ2VkUHJvcHMucHVzaChhcmcxKTtcbiAgICAgICAgdGhpcy5zZXRWYWx1ZShhcmcxLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgICB0aGlzLnJlY2FsY3VsYXRlKGNoYW5nZWRQcm9wcyk7XG4gICAgICByZXR1cm4gdGhpcy5zdGF0ZVthcmcxXTtcbiAgICB9O1xuXG4gICAgLy8gYHNldGAgbWV0aG9kIHVwZGF0ZXMgdGhlIGRhdGEgZGVmaW5lZCBhdCB0aGUgYHNjaGVtZWAgb2YgdGhlIHN0b3JlLlxuICAgIFN0b3JlLnByb3RvdHlwZS5zZXRWYWx1ZSA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgICB2YXIgc2NoZW1lID0gdGhpcy5zY2hlbWUsIGRlZmluaXRpb247XG4gICAgICBpZiAoc2NoZW1lICYmIHRoaXMuc2NoZW1lW2tleV0pIHtcbiAgICAgICAgZGVmaW5pdGlvbiA9IHNjaGVtZVtrZXldO1xuXG4gICAgICAgIC8vIFRoaXMgd2lsbCBhbGxvdyB5b3UgdG8gZGlyZWN0bHkgc2V0IGZhbHN5IHZhbHVlcyBiZWZvcmUgZmFsbGluZyBiYWNrIHRvIHRoZSBkZWZpbml0aW9uIGRlZmF1bHRcbiAgICAgICAgdGhpcy5zdGF0ZVtrZXldID0gKHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcpID8gdmFsdWUgOiBkZWZpbml0aW9uLmRlZmF1bHQ7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBkZWZpbml0aW9uLmNhbGN1bGF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRoaXMuc3RhdGVbX19nZW5lcmF0ZU9yaWdpbmFsTmFtZShrZXkpXSA9IHZhbHVlO1xuICAgICAgICAgIHRoaXMuc3RhdGVba2V5XSA9IGRlZmluaXRpb24uY2FsY3VsYXRlLmNhbGwodGhpcywgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTY2hlbWUgKiptdXN0KiogaW5jbHVkZSB0aGUga2V5IHlvdSB3YW50ZWQgdG8gc2V0LlxuICAgICAgICBpZiAoY29uc29sZSAhPSBudWxsKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKCdTY2hlbWUgbXVzdCBpbmNsdWRlIHRoZSBrZXksICcgKyBrZXkgKyAnLCB5b3UgYXJlIHRyeWluZyB0byBzZXQuICcgKyBrZXkgKyAnIHdpbGwgTk9UIGJlIHNldCBvbiB0aGUgc3RvcmUuJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnN0YXRlW2tleV07XG4gICAgfTtcblxuICAgIC8vIFJlbW92ZXMgdGhlIHNjaGVtZSBmb3JtYXQgYW5kIHN0YW5kYXJkaXplcyBhbGwgdGhlIHNob3J0Y3V0cy5cbiAgICAvLyBJZiB5b3UgcnVuIGBmb3JtYXRTY2hlbWUoe25hbWU6ICdqb2UnfSlgIGl0IHdpbGwgcmV0dXJuIHlvdVxuICAgIC8vIGB7bmFtZToge2RlZmF1bHQ6ICdqb2UnfX1gLiBBbHNvIGlmIHlvdSBydW4gYGZvcm1hdFNjaGVtZSh7ZnVsbG5hbWU6IGZ1bmN0aW9uICgpIHt9fSlgXG4gICAgLy8gaXQgd2lsbCByZXR1cm4gYHtmdWxsbmFtZToge2NhbGN1bGF0ZTogZnVuY3Rpb24gKCkge319fWAuXG4gICAgU3RvcmUucHJvdG90eXBlLmZvcm1hdFNjaGVtZSA9IGZ1bmN0aW9uIChzY2hlbWUpIHtcbiAgICAgIHZhciBmb3JtYXR0ZWRTY2hlbWUgPSB7fSwgZGVmaW5pdGlvbiwgZGVmYXVsdFZhbHVlLCBjYWxjdWxhdGVkVmFsdWU7XG4gICAgICBmb3IgKHZhciBrZXlOYW1lIGluIHNjaGVtZSkge1xuICAgICAgICBkZWZpbml0aW9uID0gc2NoZW1lW2tleU5hbWVdO1xuICAgICAgICBkZWZhdWx0VmFsdWUgPSBudWxsO1xuICAgICAgICBjYWxjdWxhdGVkVmFsdWUgPSBudWxsO1xuXG4gICAgICAgIGZvcm1hdHRlZFNjaGVtZVtrZXlOYW1lXSA9IHtkZWZhdWx0OiBudWxsfTtcblxuICAgICAgICAvKiB7a2V5OiAndmFsdWUnfSB3aWxsIGJlIHtrZXk6IHtkZWZhdWx0OiAndmFsdWUnfX0gKi9cbiAgICAgICAgZGVmYXVsdFZhbHVlID0gKGRlZmluaXRpb24gJiYgdHlwZW9mIGRlZmluaXRpb24gPT09ICdvYmplY3QnKSA/XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZpbml0aW9uLmRlZmF1bHQgOiBkZWZpbml0aW9uO1xuICAgICAgICBmb3JtYXR0ZWRTY2hlbWVba2V5TmFtZV0uZGVmYXVsdCA9IGRlZmF1bHRWYWx1ZTtcblxuICAgICAgICAvKiB7a2V5OiBmdW5jdGlvbiAoKSB7fX0gd2lsbCBiZSB7a2V5OiB7Y2FsY3VsYXRlOiBmdW5jdGlvbiAoKSB7fX19ICovXG4gICAgICAgIGlmIChkZWZpbml0aW9uICYmIHR5cGVvZiBkZWZpbml0aW9uLmNhbGN1bGF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGNhbGN1bGF0ZWRWYWx1ZSA9IGRlZmluaXRpb24uY2FsY3VsYXRlO1xuICAgICAgICAgIC8qIFB1dCBhIGRlcGVuZGVuY3kgYXJyYXkgb24gZm9ybWF0dGVkU2NoZW1lcyB3aXRoIGNhbGN1bGF0ZSBkZWZpbmVkICovXG4gICAgICAgICAgaWYgKGRlZmluaXRpb24uZGVwcykge1xuICAgICAgICAgICAgZm9ybWF0dGVkU2NoZW1lW2tleU5hbWVdLmRlcHMgPSBkZWZpbml0aW9uLmRlcHM7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvcm1hdHRlZFNjaGVtZVtrZXlOYW1lXS5kZXBzID0gW107XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGRlZmluaXRpb24gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBjYWxjdWxhdGVkVmFsdWUgPSBkZWZpbml0aW9uO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjYWxjdWxhdGVkVmFsdWUpIHtcbiAgICAgICAgICBmb3JtYXR0ZWRTY2hlbWVba2V5TmFtZV0uY2FsY3VsYXRlID0gY2FsY3VsYXRlZFZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZm9ybWF0dGVkU2NoZW1lO1xuICAgIH07XG5cbiAgICAvKiBBcHBseWluZyBgc2NoZW1lYCB0byB0aGUgc3RvcmUgaWYgZXhpc3RzLiAqL1xuICAgIFN0b3JlLnByb3RvdHlwZS5idWlsZFNjaGVtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBzY2hlbWUsIGNhbGN1bGF0ZWREYXRhLCBrZXlOYW1lLCBkZWZpbml0aW9uLCBkZXBlbmRlbmN5TWFwLCBkZXBlbmRlbnRzLCBkZXAsIGNoYW5nZWRQcm9wcyA9IFtdO1xuXG4gICAgICBpZiAodHlwZW9mIHRoaXMuc2NoZW1lID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvKiBTY2hlbWUgbXVzdCBiZSBmb3JtYXR0ZWQgdG8gc3RhbmRhcmRpemUgdGhlIGtleXMuICovXG4gICAgICAgIHNjaGVtZSA9IHRoaXMuc2NoZW1lID0gdGhpcy5mb3JtYXRTY2hlbWUodGhpcy5zY2hlbWUpO1xuICAgICAgICBkZXBlbmRlbmN5TWFwID0gdGhpcy5fX2RlcGVuZGVuY3lNYXAgPSB7fTtcblxuICAgICAgICAvKiBTZXQgdGhlIGRlZmF1bHRzIGZpcnN0ICovXG4gICAgICAgIGZvciAoa2V5TmFtZSBpbiBzY2hlbWUpIHtcbiAgICAgICAgICBkZWZpbml0aW9uID0gc2NoZW1lW2tleU5hbWVdO1xuICAgICAgICAgIHRoaXMuc3RhdGVba2V5TmFtZV0gPSBfX2Nsb25lKGRlZmluaXRpb24uZGVmYXVsdCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKiBTZXQgdGhlIGNhbGN1bGF0aW9ucyAqL1xuICAgICAgICBmb3IgKGtleU5hbWUgaW4gc2NoZW1lKSB7XG4gICAgICAgICAgZGVmaW5pdGlvbiA9IHNjaGVtZVtrZXlOYW1lXTtcbiAgICAgICAgICBpZiAoZGVmaW5pdGlvbi5jYWxjdWxhdGUpIHtcbiAgICAgICAgICAgIC8vIENyZWF0ZSBhIGRlcGVuZGVuY3kgbWFwIC0ge2tleU5hbWU6IFthcnJheU9mS2V5c1RoYXREZXBlbmRPbkl0XX1cbiAgICAgICAgICAgIGRlcGVuZGVudHMgPSBkZWZpbml0aW9uLmRlcHMgfHwgW107XG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGVwZW5kZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICBkZXAgPSBkZXBlbmRlbnRzW2ldO1xuICAgICAgICAgICAgICBpZiAoZGVwZW5kZW5jeU1hcFtkZXBdID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBkZXBlbmRlbmN5TWFwW2RlcF0gPSBbXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZXBlbmRlbmN5TWFwW2RlcF0ucHVzaChrZXlOYW1lKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zdGF0ZVtfX2dlbmVyYXRlT3JpZ2luYWxOYW1lKGtleU5hbWUpXSA9IGRlZmluaXRpb24uZGVmYXVsdDtcbiAgICAgICAgICAgIHRoaXMuc3RhdGVba2V5TmFtZV0gPSBkZWZpbml0aW9uLmNhbGN1bGF0ZS5jYWxsKHRoaXMsIGRlZmluaXRpb24uZGVmYXVsdCk7XG4gICAgICAgICAgICBjaGFuZ2VkUHJvcHMucHVzaChrZXlOYW1lKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gUmVjYWxjdWxhdGUgYW55IHByb3BlcnRpZXMgZGVwZW5kZW50IG9uIHRob3NlIHRoYXQgd2VyZSBqdXN0IHNldFxuICAgICAgICB0aGlzLnJlY2FsY3VsYXRlKGNoYW5nZWRQcm9wcyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFN0b3JlLnByb3RvdHlwZS5yZWNhbGN1bGF0ZSA9IGZ1bmN0aW9uIChjaGFuZ2VkUHJvcHMpIHtcbiAgICAgIHZhciBzY2hlbWUgPSB0aGlzLnNjaGVtZSwgZGVwZW5kZW5jeU1hcCA9IHRoaXMuX19kZXBlbmRlbmN5TWFwLCBkaWRSdW4gPSBbXSwgZGVmaW5pdGlvbiwga2V5TmFtZSwgZGVwZW5kZW50cywgZGVwO1xuICAgICAgLy8gT25seSBpdGVyYXRlIG92ZXIgdGhlIHByb3BlcnRpZXMgdGhhdCBqdXN0IGNoYW5nZWRcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlZFByb3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGRlcGVuZGVudHMgPSBkZXBlbmRlbmN5TWFwW2NoYW5nZWRQcm9wc1tpXV07XG4gICAgICAgIC8vIElmIHRoZXJlIGFyZSBubyBwcm9wZXJ0aWVzIGRlcGVuZGVudCBvbiB0aGlzIHByb3BlcnR5LCBkbyBub3RoaW5nXG4gICAgICAgIGlmIChkZXBlbmRlbnRzID09IG51bGwpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBJdGVyYXRlIG92ZXIgdGhlIGRlcGVuZGVuZGVudCBwcm9wZXJ0aWVzXG4gICAgICAgIGZvciAodmFyIGQgPSAwOyBkIDwgZGVwZW5kZW50cy5sZW5ndGg7IGQrKykge1xuICAgICAgICAgIGRlcCA9IGRlcGVuZGVudHNbZF07XG4gICAgICAgICAgLy8gRG8gbm90aGluZyBpZiB0aGlzIHZhbHVlIGhhcyBhbHJlYWR5IGJlZW4gcmVjYWxjdWxhdGVkIG9uIHRoaXMgY2hhbmdlIGJhdGNoXG4gICAgICAgICAgaWYgKGRpZFJ1bi5pbmRleE9mKGRlcCkgIT09IC0xKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gQ2FsY3VsYXRlIHRoaXMgdmFsdWVcbiAgICAgICAgICBkZWZpbml0aW9uID0gc2NoZW1lW2RlcF07XG4gICAgICAgICAgdGhpcy5zdGF0ZVtkZXBdID0gZGVmaW5pdGlvbi5jYWxjdWxhdGUuY2FsbCh0aGlzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdGVbX19nZW5lcmF0ZU9yaWdpbmFsTmFtZShkZXApXSB8fCBkZWZpbml0aW9uLmRlZmF1bHQpO1xuXG4gICAgICAgICAgLy8gTWFrZSBzdXJlIHRoaXMgZG9lcyBub3QgZ2V0IGNhbGN1bGF0ZWQgYWdhaW4gaW4gdGhpcyBjaGFuZ2UgYmF0Y2hcbiAgICAgICAgICBkaWRSdW4ucHVzaChkZXApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBVcGRhdGUgQW55IGRlcHMgb24gdGhlIGRlcHNcbiAgICAgIGlmIChkaWRSdW4ubGVuZ3RoID4gMCkge1xuICAgICAgICB0aGlzLnJlY2FsY3VsYXRlKGRpZFJ1bik7XG4gICAgICB9XG4gICAgICB0aGlzLmxpc3RlbmVyLmVtaXQoJ2NoYW5nZScpO1xuICAgIH07XG5cbiAgICBTdG9yZS5wcm90b3R5cGUuZ2V0U3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5zdGF0ZTtcbiAgICB9O1xuXG4gICAgU3RvcmUucHJvdG90eXBlLmNsZWFyU3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICB0aGlzLnN0YXRlID0ge307XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgU3RvcmUucHJvdG90eXBlLnJlc2V0U3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICB0aGlzLmJ1aWxkU2NoZW1lKCk7XG4gICAgICB0aGlzLmxpc3RlbmVyLmVtaXQoJ2NoYW5nZScpO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIC8vIFN0b3JlcyBtdXN0IGhhdmUgYSBgYWN0aW9uc2AgaGFzaCBvZiBgYWN0aW9uTmFtZTogbWV0aG9kTmFtZWBcbiAgICAvLyBgbWV0aG9kTmFtZWAgaXMgdGhlIGB0aGlzLnN0b3JlYCdzIHByb3RvdHlwZSBtZXRob2QuLlxuICAgIFN0b3JlLnByb3RvdHlwZS5iaW5kQWN0aW9ucyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBjYWxsYmFjaztcblxuICAgICAgdGhpcy5lbWl0Q2hhbmdlID0gdGhpcy5saXN0ZW5lci5lbWl0LmJpbmQodGhpcy5saXN0ZW5lciwgJ2NoYW5nZScpO1xuICAgICAgdGhpcy5lbWl0Um9sbGJhY2sgPSB0aGlzLmxpc3RlbmVyLmVtaXQuYmluZCh0aGlzLmxpc3RlbmVyLCAncm9sbGJhY2snKTtcbiAgICAgIHRoaXMucm9sbGJhY2sgPSB0aGlzLmxpc3RlbmVyLm9uLmJpbmQodGhpcy5saXN0ZW5lciwgJ19fcm9sbGJhY2snKTtcbiAgICAgIHRoaXMuZW1pdCA9IHRoaXMubGlzdGVuZXIuZW1pdC5iaW5kKHRoaXMubGlzdGVuZXIpO1xuXG4gICAgICBmb3IgKHZhciBhY3Rpb25OYW1lIGluIHRoaXMuYWN0aW9ucykge1xuICAgICAgICBpZiAoX19oYXNPd24odGhpcy5hY3Rpb25zLCBhY3Rpb25OYW1lKSkge1xuICAgICAgICAgIGNhbGxiYWNrID0gdGhpcy5hY3Rpb25zW2FjdGlvbk5hbWVdO1xuICAgICAgICAgIGlmICh0eXBlb2YgdGhpc1tjYWxsYmFja10gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRocm93ICdDYWxsYmFjayBcXCcnICsgY2FsbGJhY2sgKyAnXFwnIGRlZmluZWQgZm9yIGFjdGlvbiBcXCcnICsgYWN0aW9uTmFtZSArICdcXCcgc2hvdWxkIGJlIGEgbWV0aG9kIGRlZmluZWQgb24gdGhlIHN0b3JlISc7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8qIEFuZCBgYWN0aW9uTmFtZWAgc2hvdWxkIGJlIGEgbmFtZSBnZW5lcmF0ZWQgYnkgYF9fZ2VuZXJhdGVBY3Rpb25OYW1lYCAqL1xuICAgICAgICAgIHRoaXMubGlzdGVuZXIub24oX19nZW5lcmF0ZUFjdGlvbk5hbWUoYWN0aW9uTmFtZSksIHRoaXNbY2FsbGJhY2tdLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIGBkaXNwYXRjaEFjdGlvbmAgY2FsbGVkIGZyb20gYSBkaXNwYXRjaGVyLiBZb3UgY2FuIGFsc28gY2FsbCBhbnl3aGVyZSBidXRcbiAgICAvLyB5b3UgcHJvYmFibHkgd29uJ3QgbmVlZCB0byBkby4gSXQgc2ltcGx5ICoqZW1pdHMgYW4gZXZlbnQgd2l0aCBhIHBheWxvYWQqKi5cbiAgICBTdG9yZS5wcm90b3R5cGUuZGlzcGF0Y2hBY3Rpb24gPSBmdW5jdGlvbiAoYWN0aW9uTmFtZSwgZGF0YSkge1xuICAgICAgdGhpcy5saXN0ZW5lci5lbWl0KF9fZ2VuZXJhdGVBY3Rpb25OYW1lKGFjdGlvbk5hbWUpLCBkYXRhKTtcbiAgICB9O1xuXG4gICAgLy8gIyMjIFNob3J0Y3V0c1xuXG4gICAgLy8gYGxpc3RlbkNoYW5nZXNgIGlzIGEgc2hvcnRjdXQgZm9yIGBPYmplY3Qub2JzZXJ2ZWAgdXNhZ2UuIFlvdSBjYW4ganVzdCB1c2VcbiAgICAvLyBgT2JqZWN0Lm9ic2VydmUob2JqZWN0LCBmdW5jdGlvbiAoKSB7IC4uLiB9KWAgYnV0IGV2ZXJ5dGltZSB5b3UgdXNlIGl0IHlvdVxuICAgIC8vIHJlcGVhdCB5b3Vyc2VsZi4gRGVMb3JlYW4gaGFzIGEgc2hvcnRjdXQgZG9pbmcgdGhpcyBwcm9wZXJseS5cbiAgICBTdG9yZS5wcm90b3R5cGUubGlzdGVuQ2hhbmdlcyA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcywgb2JzZXJ2ZXI7XG4gICAgICBpZiAoIU9iamVjdC5vYnNlcnZlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1N0b3JlI2xpc3RlbkNoYW5nZXMgbWV0aG9kIHVzZXMgT2JqZWN0Lm9ic2VydmUsIHlvdSBzaG91bGQgZmlyZSBjaGFuZ2VzIG1hbnVhbGx5LicpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIG9ic2VydmVyID0gQXJyYXkuaXNBcnJheShvYmplY3QpID8gQXJyYXkub2JzZXJ2ZSA6IE9iamVjdC5vYnNlcnZlO1xuXG4gICAgICBvYnNlcnZlcihvYmplY3QsIGZ1bmN0aW9uIChjaGFuZ2VzKSB7XG4gICAgICAgIHNlbGYubGlzdGVuZXIuZW1pdCgnY2hhbmdlJywgY2hhbmdlcyk7XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gYG9uQ2hhbmdlYCBzaW1wbHkgbGlzdGVucyBjaGFuZ2VzIGFuZCBjYWxscyBhIGNhbGxiYWNrLiBTaG9ydGN1dCBmb3JcbiAgICAvLyBhIGBvbignY2hhbmdlJylgIGNvbW1hbmQuXG4gICAgU3RvcmUucHJvdG90eXBlLm9uQ2hhbmdlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICB0aGlzLmxpc3RlbmVyLm9uKCdjaGFuZ2UnLCBjYWxsYmFjayk7XG4gICAgfTtcblxuICAgIHJldHVybiBTdG9yZTtcbiAgfSgpKTtcblxuICAvLyAjIyMgRmx1eCBXcmFwcGVyXG4gIERlTG9yZWFuLkZsdXggPSB7XG5cbiAgICAvLyBgY3JlYXRlU3RvcmVgIGdlbmVyYXRlcyBhIHN0b3JlIGJhc2VkIG9uIHRoZSBkZWZpbml0aW9uXG4gICAgY3JlYXRlU3RvcmU6IGZ1bmN0aW9uIChkZWZpbml0aW9uKSB7XG4gICAgICAvKiBzdG9yZSBwYXJhbWV0ZXIgbXVzdCBiZSBhbiBgb2JqZWN0YCAqL1xuICAgICAgaWYgKHR5cGVvZiBkZWZpbml0aW9uICE9PSAnb2JqZWN0Jykge1xuICAgICAgICB0aHJvdyAnU3RvcmVzIHNob3VsZCBiZSBkZWZpbmVkIGJ5IHBhc3NpbmcgdGhlIGRlZmluaXRpb24gdG8gdGhlIGNvbnN0cnVjdG9yJztcbiAgICAgIH1cblxuICAgICAgLy8gZXh0ZW5kcyB0aGUgc3RvcmUgd2l0aCB0aGUgZGVmaW5pdGlvbiBhdHRyaWJ1dGVzXG4gICAgICB2YXIgQ2hpbGQgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBTdG9yZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpOyB9O1xuICAgICAgdmFyIFN1cnJvZ2F0ZSA9IGZ1bmN0aW9uICgpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IENoaWxkOyB9O1xuICAgICAgU3Vycm9nYXRlLnByb3RvdHlwZSA9IFN0b3JlLnByb3RvdHlwZTtcbiAgICAgIENoaWxkLnByb3RvdHlwZSA9IG5ldyBTdXJyb2dhdGUoKTtcblxuICAgICAgX19leHRlbmQoQ2hpbGQucHJvdG90eXBlLCBkZWZpbml0aW9uKTtcblxuICAgICAgcmV0dXJuIG5ldyBDaGlsZCgpO1xuICAgIH0sXG5cbiAgICAvLyBgY3JlYXRlRGlzcGF0Y2hlcmAgZ2VuZXJhdGVzIGEgZGlzcGF0Y2hlciB3aXRoIGFjdGlvbnMgdG8gZGlzcGF0Y2guXG4gICAgLyogYGFjdGlvbnNUb0Rpc3BhdGNoYCBzaG91bGQgYmUgYW4gb2JqZWN0LiAqL1xuICAgIGNyZWF0ZURpc3BhdGNoZXI6IGZ1bmN0aW9uIChhY3Rpb25zVG9EaXNwYXRjaCkge1xuICAgICAgdmFyIGFjdGlvbnNPZlN0b3JlcywgZGlzcGF0Y2hlciwgY2FsbGJhY2ssIHRyaWdnZXJzLCB0cmlnZ2VyTWV0aG9kO1xuXG4gICAgICAvLyBJZiBpdCBoYXMgYGdldFN0b3Jlc2AgbWV0aG9kIGl0IHNob3VsZCBiZSBnZXQgYW5kIHBhc3MgdG8gdGhlIGBEaXNwYXRjaGVyYFxuICAgICAgaWYgKHR5cGVvZiBhY3Rpb25zVG9EaXNwYXRjaC5nZXRTdG9yZXMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgYWN0aW9uc09mU3RvcmVzID0gYWN0aW9uc1RvRGlzcGF0Y2guZ2V0U3RvcmVzKCk7XG4gICAgICB9XG5cbiAgICAgIC8qIElmIHRoZXJlIGFyZSBubyBzdG9yZXMgZGVmaW5lZCwgaXQncyBhbiBlbXB0eSBvYmplY3QuICovXG4gICAgICBkaXNwYXRjaGVyID0gbmV3IERpc3BhdGNoZXIoYWN0aW9uc09mU3RvcmVzIHx8IHt9KTtcblxuICAgICAgLyogTm93IGNhbGwgYHJlZ2lzdGVyQWN0aW9uYCBtZXRob2QgZm9yIGV2ZXJ5IGFjdGlvbi4gKi9cbiAgICAgIGZvciAodmFyIGFjdGlvbk5hbWUgaW4gYWN0aW9uc1RvRGlzcGF0Y2gpIHtcbiAgICAgICAgaWYgKF9faGFzT3duKGFjdGlvbnNUb0Rpc3BhdGNoLCBhY3Rpb25OYW1lKSkge1xuICAgICAgICAgIC8qIGBnZXRTdG9yZXNgICYgYHZpZXdUcmlnZ2Vyc2AgYXJlIHNwZWNpYWwgcHJvcGVydGllcywgaXQncyBub3QgYW4gYWN0aW9uLiBBbHNvIGFuIGV4dHJhIGNoZWNrIHRvIG1ha2Ugc3VyZSB3ZSdyZSBiaW5kaW5nIHRvIGEgZnVuY3Rpb24gKi9cbiAgICAgICAgICBpZiAoYWN0aW9uTmFtZSAhPT0gJ2dldFN0b3JlcycgJiYgYWN0aW9uTmFtZSAhPT0gJ3ZpZXdUcmlnZ2VycycgJiYgdHlwZW9mIGFjdGlvbnNUb0Rpc3BhdGNoW2FjdGlvbk5hbWVdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IGFjdGlvbnNUb0Rpc3BhdGNoW2FjdGlvbk5hbWVdO1xuICAgICAgICAgICAgZGlzcGF0Y2hlci5yZWdpc3RlckFjdGlvbihhY3Rpb25OYW1lLCBjYWxsYmFjay5iaW5kKGRpc3BhdGNoZXIpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLyogQmluZCB0cmlnZ2VycyAqL1xuICAgICAgdHJpZ2dlcnMgPSBhY3Rpb25zVG9EaXNwYXRjaC52aWV3VHJpZ2dlcnM7XG4gICAgICBmb3IgKHZhciB0cmlnZ2VyTmFtZSBpbiB0cmlnZ2Vycykge1xuICAgICAgICB0cmlnZ2VyTWV0aG9kID0gdHJpZ2dlcnNbdHJpZ2dlck5hbWVdO1xuICAgICAgICBpZiAodHlwZW9mIGRpc3BhdGNoZXJbdHJpZ2dlck1ldGhvZF0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBkaXNwYXRjaGVyLm9uKHRyaWdnZXJOYW1lLCBkaXNwYXRjaGVyW3RyaWdnZXJNZXRob2RdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoY29uc29sZSAhPSBudWxsKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4odHJpZ2dlck1ldGhvZCArICcgc2hvdWxkIGJlIGEgbWV0aG9kIGRlZmluZWQgb24geW91ciBkaXNwYXRjaGVyLiBUaGUgJyArIHRyaWdnZXJOYW1lICsgJyB0cmlnZ2VyIHdpbGwgbm90IGJlIGJvdW5kIHRvIGFueSBtZXRob2QuJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBkaXNwYXRjaGVyO1xuICAgIH0sXG4gICAgLy8gIyMjIGBEZUxvcmVhbi5GbHV4LmRlZmluZWBcbiAgICAvLyBJdCdzIGEga2V5IHRvIF9oYWNrXyBEZUxvcmVhbiBlYXNpbHkuIFlvdSBjYW4ganVzdCBpbmplY3Qgc29tZXRoaW5nXG4gICAgLy8geW91IHdhbnQgdG8gZGVmaW5lLlxuICAgIGRlZmluZTogZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICAgIERlTG9yZWFuW2tleV0gPSB2YWx1ZTtcbiAgICB9XG4gIH07XG5cbiAgLy8gU3RvcmUgYW5kIERpc3BhdGNoZXIgYXJlIHRoZSBvbmx5IGJhc2UgY2xhc3NlcyBvZiBEZUxvcmVhbi5cbiAgRGVMb3JlYW4uRGlzcGF0Y2hlciA9IERpc3BhdGNoZXI7XG4gIERlTG9yZWFuLlN0b3JlID0gU3RvcmU7XG5cbiAgLy8gIyMgQnVpbHQtaW4gUmVhY3QgTWl4aW5cbiAgRGVMb3JlYW4uRmx1eC5taXhpbnMgPSB7XG4gICAgLy8gSXQgc2hvdWxkIGJlIGluc2VydGVkIHRvIHRoZSBSZWFjdCBjb21wb25lbnRzIHdoaWNoXG4gICAgLy8gdXNlZCBpbiBGbHV4LlxuICAgIC8vIFNpbXBseSBgbWl4aW46IFtGbHV4Lm1peGlucy5zdG9yZUxpc3RlbmVyXWAgd2lsbCB3b3JrLlxuICAgIHN0b3JlTGlzdGVuZXI6IHtcblxuICAgICAgdHJpZ2dlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLl9fZGlzcGF0Y2hlci5lbWl0LmFwcGx5KHRoaXMuX19kaXNwYXRjaGVyLCBhcmd1bWVudHMpO1xuICAgICAgfSxcblxuICAgICAgLy8gQWZ0ZXIgdGhlIGNvbXBvbmVudCBtb3VudGVkLCBsaXN0ZW4gY2hhbmdlcyBvZiB0aGUgcmVsYXRlZCBzdG9yZXNcbiAgICAgIGNvbXBvbmVudERpZE1vdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgc3RvcmUsIHN0b3JlTmFtZTtcblxuICAgICAgICAvKiBgX19jaGFuZ2VIYW5kbGVyYCBpcyBhICoqbGlzdGVuZXIgZ2VuZXJhdG9yKiogdG8gcGFzcyB0byB0aGUgYG9uQ2hhbmdlYCBmdW5jdGlvbi4gKi9cbiAgICAgICAgZnVuY3Rpb24gX19jaGFuZ2VIYW5kbGVyKHN0b3JlLCBzdG9yZU5hbWUpIHtcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHN0YXRlLCBhcmdzO1xuICAgICAgICAgICAgLyogSWYgdGhlIGNvbXBvbmVudCBpcyBtb3VudGVkLCBjaGFuZ2Ugc3RhdGUuICovXG4gICAgICAgICAgICBpZiAoc2VsZi5pc01vdW50ZWQoKSkge1xuICAgICAgICAgICAgICBzZWxmLnNldFN0YXRlKHNlbGYuZ2V0U3RvcmVTdGF0ZXMoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBXaGVuIHNvbWV0aGluZyBjaGFuZ2VzIGl0IGNhbGxzIHRoZSBjb21wb25lbnRzIGBzdG9yZURpZENoYW5nZWRgIG1ldGhvZCBpZiBleGlzdHMuXG4gICAgICAgICAgICBpZiAoc2VsZi5zdG9yZURpZENoYW5nZSkge1xuICAgICAgICAgICAgICBhcmdzID0gW3N0b3JlTmFtZV0uY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCkpO1xuICAgICAgICAgICAgICBzZWxmLnN0b3JlRGlkQ2hhbmdlLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZW1lbWJlciB0aGUgY2hhbmdlIGhhbmRsZXJzIHNvIHRoZXkgY2FuIGJlIHJlbW92ZWQgbGF0ZXJcbiAgICAgICAgdGhpcy5fX2NoYW5nZUhhbmRsZXJzID0ge307XG5cbiAgICAgICAgLyogR2VuZXJhdGUgYW5kIGJpbmQgdGhlIGNoYW5nZSBoYW5kbGVycyB0byB0aGUgc3RvcmVzLiAqL1xuICAgICAgICBmb3IgKHN0b3JlTmFtZSBpbiB0aGlzLl9fd2F0Y2hTdG9yZXMpIHtcbiAgICAgICAgICBpZiAoX19oYXNPd24odGhpcy5zdG9yZXMsIHN0b3JlTmFtZSkpIHtcbiAgICAgICAgICAgIHN0b3JlID0gdGhpcy5zdG9yZXNbc3RvcmVOYW1lXTtcbiAgICAgICAgICAgIHRoaXMuX19jaGFuZ2VIYW5kbGVyc1tzdG9yZU5hbWVdID0gX19jaGFuZ2VIYW5kbGVyKHN0b3JlLCBzdG9yZU5hbWUpO1xuICAgICAgICAgICAgc3RvcmUub25DaGFuZ2UodGhpcy5fX2NoYW5nZUhhbmRsZXJzW3N0b3JlTmFtZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLy8gV2hlbiBhIGNvbXBvbmVudCB1bm1vdW50ZWQsIGl0IHNob3VsZCBzdG9wIGxpc3RlbmluZy5cbiAgICAgIGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZvciAodmFyIHN0b3JlTmFtZSBpbiB0aGlzLl9fY2hhbmdlSGFuZGxlcnMpIHtcbiAgICAgICAgICBpZiAoX19oYXNPd24odGhpcy5zdG9yZXMsIHN0b3JlTmFtZSkpIHtcbiAgICAgICAgICAgIHZhciBzdG9yZSA9IHRoaXMuc3RvcmVzW3N0b3JlTmFtZV07XG4gICAgICAgICAgICBzdG9yZS5saXN0ZW5lci5yZW1vdmVMaXN0ZW5lcignY2hhbmdlJywgdGhpcy5fX2NoYW5nZUhhbmRsZXJzW3N0b3JlTmFtZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcywgc3RhdGUsIHN0b3JlTmFtZTtcblxuICAgICAgICAvKiBUaGUgZGlzcGF0Y2hlciBzaG91bGQgYmUgZWFzeSB0byBhY2Nlc3MgYW5kIGl0IHNob3VsZCB1c2UgYF9fZmluZERpc3BhdGNoZXJgXG4gICAgICAgICAgIG1ldGhvZCB0byBmaW5kIHRoZSBwYXJlbnQgZGlzcGF0Y2hlcnMuICovXG4gICAgICAgIHRoaXMuX19kaXNwYXRjaGVyID0gX19maW5kRGlzcGF0Y2hlcih0aGlzKTtcblxuICAgICAgICAvLyBJZiBgc3RvcmVzRGlkQ2hhbmdlYCBtZXRob2QgcHJlc2VudHMsIGl0J2xsIGJlIGNhbGxlZCBhZnRlciBhbGwgdGhlIHN0b3Jlc1xuICAgICAgICAvLyB3ZXJlIGNoYW5nZWQuXG4gICAgICAgIGlmICh0aGlzLnN0b3Jlc0RpZENoYW5nZSkge1xuICAgICAgICAgIHRoaXMuX19kaXNwYXRjaGVyLm9uKCdjaGFuZ2U6YWxsJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5zdG9yZXNEaWRDaGFuZ2UoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNpbmNlIGBkaXNwYXRjaGVyLnN0b3Jlc2AgaXMgaGFyZGVyIHRvIHdyaXRlLCB0aGVyZSdzIGEgc2hvcnRjdXQgZm9yIGl0LlxuICAgICAgICAvLyBZb3UgY2FuIHVzZSBgdGhpcy5zdG9yZXNgIGZyb20gdGhlIFJlYWN0IGNvbXBvbmVudC5cbiAgICAgICAgdGhpcy5zdG9yZXMgPSB0aGlzLl9fZGlzcGF0Y2hlci5zdG9yZXM7XG5cbiAgICAgICAgdGhpcy5fX3dhdGNoU3RvcmVzID0ge307XG4gICAgICAgIGlmICh0aGlzLndhdGNoU3RvcmVzICE9IG51bGwpIHtcbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMud2F0Y2hTdG9yZXMubGVuZ3RoOyAgaSsrKSB7XG4gICAgICAgICAgICBzdG9yZU5hbWUgPSB0aGlzLndhdGNoU3RvcmVzW2ldO1xuICAgICAgICAgICAgdGhpcy5fX3dhdGNoU3RvcmVzW3N0b3JlTmFtZV0gPSB0aGlzLnN0b3Jlc1tzdG9yZU5hbWVdO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLl9fd2F0Y2hTdG9yZXMgPSB0aGlzLnN0b3JlcztcbiAgICAgICAgICBpZiAoY29uc29sZSAhPSBudWxsICYmIE9iamVjdC5rZXlzICE9IG51bGwgJiYgT2JqZWN0LmtleXModGhpcy5zdG9yZXMpLmxlbmd0aCA+IDQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignWW91ciBjb21wb25lbnQgaXMgd2F0Y2hpbmcgY2hhbmdlcyBvbiBhbGwgc3RvcmVzLCB5b3UgbWF5IHdhbnQgdG8gZGVmaW5lIGEgXCJ3YXRjaFN0b3Jlc1wiIHByb3BlcnR5IGluIG9yZGVyIHRvIG9ubHkgd2F0Y2ggc3RvcmVzIHJlbGV2YW50IHRvIHRoaXMgY29tcG9uZW50LicpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmdldFN0b3JlU3RhdGVzKCk7XG4gICAgICB9LFxuXG4gICAgICBnZXRTdG9yZVN0YXRlczogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc3RhdGUgPSB7c3RvcmVzOiB7fX0sIHN0b3JlO1xuXG4gICAgICAgIC8qIFNldCBgc3RhdGUuc3RvcmVzYCBmb3IgYWxsIHByZXNlbnQgc3RvcmVzIHdpdGggYSBgc2V0U3RhdGVgIG1ldGhvZCBkZWZpbmVkLiAqL1xuICAgICAgICBmb3IgKHZhciBzdG9yZU5hbWUgaW4gdGhpcy5fX3dhdGNoU3RvcmVzKSB7XG4gICAgICAgICAgaWYgKF9faGFzT3duKHRoaXMuc3RvcmVzLCBzdG9yZU5hbWUpKSB7XG4gICAgICAgICAgICBzdGF0ZS5zdG9yZXNbc3RvcmVOYW1lXSA9IHRoaXMuX193YXRjaFN0b3Jlc1tzdG9yZU5hbWVdLmdldFN0YXRlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICAgIH0sXG5cbiAgICAgIC8vIGBnZXRTdG9yZWAgaXMgYSBzaG9ydGN1dCB0byBnZXQgdGhlIHN0b3JlIGZyb20gdGhlIHN0YXRlLlxuICAgICAgZ2V0U3RvcmU6IGZ1bmN0aW9uIChzdG9yZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhdGUuc3RvcmVzW3N0b3JlTmFtZV07XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIC8vICMjIERlTG9yZWFuIEFQSVxuICAvLyBEZUxvcmVhbiBjYW4gYmUgdXNlZCBpbiAqKkNvbW1vbkpTKiogcHJvamVjdHMuXG4gIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG5cbiAgICB2YXIgcmVxdWlyZW1lbnRzID0gcmVxdWlyZSgnLi9yZXF1aXJlbWVudHMnKTtcbiAgICBmb3IgKHZhciByZXF1aXJlbWVudCBpbiByZXF1aXJlbWVudHMpIHtcbiAgICAgIERlTG9yZWFuLkZsdXguZGVmaW5lKHJlcXVpcmVtZW50LCByZXF1aXJlbWVudHNbcmVxdWlyZW1lbnRdKTtcbiAgICB9XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBEZUxvcmVhbjtcblxuICAvLyBJdCBjYW4gYmUgYWxzbyB1c2VkIGluICoqQU1EKiogcHJvamVjdHMsIHRvby5cbiAgLy8gQW5kIGlmIHRoZXJlIGlzIG5vIG1vZHVsZSBzeXN0ZW0gaW5pdGlhbGl6ZWQsIGp1c3QgcGFzcyB0aGUgRGVMb3JlYW5cbiAgLy8gdG8gdGhlIGB3aW5kb3dgLlxuICB9IGVsc2Uge1xuICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgIGRlZmluZShbJy4vcmVxdWlyZW1lbnRzLmpzJ10sIGZ1bmN0aW9uIChyZXF1aXJlbWVudHMpIHtcbiAgICAgICAgLy8gSW1wb3J0IE1vZHVsZXMgaW4gcmVxdWlyZS5qcyBwYXR0ZXJuXG4gICAgICAgIGZvciAodmFyIHJlcXVpcmVtZW50IGluIHJlcXVpcmVtZW50cykge1xuICAgICAgICAgIERlTG9yZWFuLkZsdXguZGVmaW5lKHJlcXVpcmVtZW50LCByZXF1aXJlbWVudHNbcmVxdWlyZW1lbnRdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBEZUxvcmVhbjtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aW5kb3cuRGVMb3JlYW4gPSBEZUxvcmVhbjtcbiAgICB9XG4gIH1cblxufSkoe30pO1xuIiwiLy8gIyMgRGVwZW5kZW5jeSBpbmplY3Rpb24gZmlsZS5cblxuLy8gWW91IGNhbiBjaGFuZ2UgZGVwZW5kZW5jaWVzIHVzaW5nIGBEZUxvcmVhbi5GbHV4LmRlZmluZWAuIFRoZXJlIGFyZVxuLy8gdHdvIGRlcGVuZGVuY2llcyBub3c6IGBFdmVudEVtaXR0ZXJgIGFuZCBgUHJvbWlzZWBcbnZhciByZXF1aXJlbWVudHM7XG5cbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gcmVxdWlyZW1lbnRzID0ge1xuICAgIC8vIERlTG9yZWFuIHVzZXMgKipOb2RlLmpzIG5hdGl2ZSBFdmVudEVtaXR0ZXIqKiBmb3IgZXZlbnQgZW1pdHRpb25cbiAgICBFdmVudEVtaXR0ZXI6IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcixcbiAgICAvLyBhbmQgKiplczYtcHJvbWlzZSoqIGZvciBEZWZlcnJlZCBvYmplY3QgbWFuYWdlbWVudC5cbiAgICBQcm9taXNlOiByZXF1aXJlKCdlczYtcHJvbWlzZScpLlByb21pc2VcbiAgfTtcbn0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gIGRlZmluZShmdW5jdGlvbiAocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgdmFyIGV2ZW50cyA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgICAgICBwcm9taXNlID0gcmVxdWlyZSgnZXM2LXByb21pc2UnKTtcblxuICAgIC8vIFJldHVybiB0aGUgbW9kdWxlIHZhbHVlIC0gaHR0cDovL3JlcXVpcmVqcy5vcmcvZG9jcy9hcGkuaHRtbCNjanNtb2R1bGVcbiAgICAvLyBVc2luZyBzaW1wbGlmaWVkIHdyYXBwZXJcbiAgICByZXR1cm4ge1xuICAgICAgLy8gRGVMb3JlYW4gdXNlcyAqKk5vZGUuanMgbmF0aXZlIEV2ZW50RW1pdHRlcioqIGZvciBldmVudCBlbWl0dGlvblxuICAgICAgRXZlbnRFbWl0dGVyOiByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXIsXG4gICAgICAvLyBhbmQgKiplczYtcHJvbWlzZSoqIGZvciBEZWZlcnJlZCBvYmplY3QgbWFuYWdlbWVudC5cbiAgICAgIFByb21pc2U6IHJlcXVpcmUoJ2VzNi1wcm9taXNlJykuUHJvbWlzZVxuICAgIH07XG4gIH0pO1xufSBlbHNlIHtcbiAgd2luZG93LkRlTG9yZWFuID0gRGVMb3JlYW47XG59XG5cbi8vIEl0J3MgYmV0dGVyIHlvdSBkb24ndCBjaGFuZ2UgdGhlbSBpZiB5b3UgcmVhbGx5IG5lZWQgdG8uXG5cbi8vIFRoaXMgbGlicmFyeSBuZWVkcyB0byB3b3JrIGZvciBCcm93c2VyaWZ5IGFuZCBhbHNvIHN0YW5kYWxvbmUuXG4vLyBJZiBEZUxvcmVhbiBpcyBkZWZpbmVkLCBpdCBtZWFucyBpdCdzIGNhbGxlZCBmcm9tIHRoZSBicm93c2VyLCBub3Rcbi8vIHRoZSBicm93c2VyaWZ5LlxuXG5pZiAodHlwZW9mIERlTG9yZWFuICE9PSAndW5kZWZpbmVkJykge1xuICBmb3IgKHZhciByZXF1aXJlbWVudCBpbiByZXF1aXJlbWVudHMpIHtcbiAgICBEZUxvcmVhbi5GbHV4LmRlZmluZShyZXF1aXJlbWVudCwgcmVxdWlyZW1lbnRzW3JlcXVpcmVtZW50XSk7XG4gIH1cbn1cbiIsIi8qISBGbGlnaHQgdjEuNS4wIHwgKGMpIFR3aXR0ZXIsIEluYy4gfCBNSVQgTGljZW5zZSAqL1xuKGZ1bmN0aW9uIHdlYnBhY2tVbml2ZXJzYWxNb2R1bGVEZWZpbml0aW9uKHJvb3QsIGZhY3RvcnkpIHtcblx0aWYodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnKVxuXHRcdG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpO1xuXHRlbHNlIGlmKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZClcblx0XHRkZWZpbmUoZmFjdG9yeSk7XG5cdGVsc2UgaWYodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKVxuXHRcdGV4cG9ydHNbXCJmbGlnaHRcIl0gPSBmYWN0b3J5KCk7XG5cdGVsc2Vcblx0XHRyb290W1wiZmxpZ2h0XCJdID0gZmFjdG9yeSgpO1xufSkodGhpcywgZnVuY3Rpb24oKSB7XG5yZXR1cm4gLyoqKioqKi8gKGZ1bmN0aW9uKG1vZHVsZXMpIHsgLy8gd2VicGFja0Jvb3RzdHJhcFxuLyoqKioqKi8gXHQvLyBUaGUgbW9kdWxlIGNhY2hlXG4vKioqKioqLyBcdHZhciBpbnN0YWxsZWRNb2R1bGVzID0ge307XG4vKioqKioqL1xuLyoqKioqKi8gXHQvLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuLyoqKioqKi8gXHRmdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG4vKioqKioqL1xuLyoqKioqKi8gXHRcdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuLyoqKioqKi8gXHRcdGlmKGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdKVxuLyoqKioqKi8gXHRcdFx0cmV0dXJuIGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdLmV4cG9ydHM7XG4vKioqKioqL1xuLyoqKioqKi8gXHRcdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG4vKioqKioqLyBcdFx0dmFyIG1vZHVsZSA9IGluc3RhbGxlZE1vZHVsZXNbbW9kdWxlSWRdID0ge1xuLyoqKioqKi8gXHRcdFx0ZXhwb3J0czoge30sXG4vKioqKioqLyBcdFx0XHRpZDogbW9kdWxlSWQsXG4vKioqKioqLyBcdFx0XHRsb2FkZWQ6IGZhbHNlXG4vKioqKioqLyBcdFx0fTtcbi8qKioqKiovXG4vKioqKioqLyBcdFx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG4vKioqKioqLyBcdFx0bW9kdWxlc1ttb2R1bGVJZF0uY2FsbChtb2R1bGUuZXhwb3J0cywgbW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG4vKioqKioqL1xuLyoqKioqKi8gXHRcdC8vIEZsYWcgdGhlIG1vZHVsZSBhcyBsb2FkZWRcbi8qKioqKiovIFx0XHRtb2R1bGUubG9hZGVkID0gdHJ1ZTtcbi8qKioqKiovXG4vKioqKioqLyBcdFx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcbi8qKioqKiovIFx0XHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG4vKioqKioqLyBcdH1cbi8qKioqKiovXG4vKioqKioqL1xuLyoqKioqKi8gXHQvLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuLyoqKioqKi8gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm0gPSBtb2R1bGVzO1xuLyoqKioqKi9cbi8qKioqKiovIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGUgY2FjaGVcbi8qKioqKiovIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5jID0gaW5zdGFsbGVkTW9kdWxlcztcbi8qKioqKiovXG4vKioqKioqLyBcdC8vIF9fd2VicGFja19wdWJsaWNfcGF0aF9fXG4vKioqKioqLyBcdF9fd2VicGFja19yZXF1aXJlX18ucCA9IFwiXCI7XG4vKioqKioqL1xuLyoqKioqKi8gXHQvLyBMb2FkIGVudHJ5IG1vZHVsZSBhbmQgcmV0dXJuIGV4cG9ydHNcbi8qKioqKiovIFx0cmV0dXJuIF9fd2VicGFja19yZXF1aXJlX18oMCk7XG4vKioqKioqLyB9KVxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qKioqKiovIChbXG4vKiAwICovXG4vKioqLyBmdW5jdGlvbihtb2R1bGUsIGV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pIHtcblxudmFyIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fOy8qIENvcHlyaWdodCAyMDEzIFR3aXR0ZXIsIEluYy4gTGljZW5zZWQgdW5kZXIgVGhlIE1JVCBMaWNlbnNlLiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUICovXG5cbiEoX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXyA9IFtcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDEpLFxuICAgIF9fd2VicGFja19yZXF1aXJlX18oMiksXG4gICAgX193ZWJwYWNrX3JlcXVpcmVfXygzKSxcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDQpLFxuICAgIF9fd2VicGFja19yZXF1aXJlX18oNSksXG4gICAgX193ZWJwYWNrX3JlcXVpcmVfXyg2KSxcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDcpXG4gIF0sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fID0gZnVuY3Rpb24oYWR2aWNlLCBjb21wb25lbnQsIGNvbXBvc2UsIGRlYnVnLCBsb2dnZXIsIHJlZ2lzdHJ5LCB1dGlscykge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHJldHVybiB7XG4gICAgICBhZHZpY2U6IGFkdmljZSxcbiAgICAgIGNvbXBvbmVudDogY29tcG9uZW50LFxuICAgICAgY29tcG9zZTogY29tcG9zZSxcbiAgICAgIGRlYnVnOiBkZWJ1ZyxcbiAgICAgIGxvZ2dlcjogbG9nZ2VyLFxuICAgICAgcmVnaXN0cnk6IHJlZ2lzdHJ5LFxuICAgICAgdXRpbHM6IHV0aWxzXG4gICAgfTtcblxuICB9LmFwcGx5KGV4cG9ydHMsIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18pLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyAhPT0gdW5kZWZpbmVkICYmIChtb2R1bGUuZXhwb3J0cyA9IF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fKSk7XG5cblxuLyoqKi8gfSxcbi8qIDEgKi9cbi8qKiovIGZ1bmN0aW9uKG1vZHVsZSwgZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXykge1xuXG52YXIgX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXywgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX187LyogQ29weXJpZ2h0IDIwMTMgVHdpdHRlciwgSW5jLiBMaWNlbnNlZCB1bmRlciBUaGUgTUlUIExpY2Vuc2UuIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVQgKi9cblxuIShfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fID0gW1xuICAgIF9fd2VicGFja19yZXF1aXJlX18oNylcbiAgXSwgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18gPSBmdW5jdGlvbih1dGlscykge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBhZHZpY2UgPSB7XG5cbiAgICAgIGFyb3VuZDogZnVuY3Rpb24oYmFzZSwgd3JhcHBlZCkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gY29tcG9zZWRBcm91bmQoKSB7XG4gICAgICAgICAgLy8gdW5wYWNraW5nIGFyZ3VtZW50cyBieSBoYW5kIGJlbmNobWFya2VkIGZhc3RlclxuICAgICAgICAgIHZhciBpID0gMCwgbCA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBuZXcgQXJyYXkobCArIDEpO1xuICAgICAgICAgIGFyZ3NbMF0gPSBiYXNlLmJpbmQodGhpcyk7XG4gICAgICAgICAgZm9yICg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSArIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gd3JhcHBlZC5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfTtcbiAgICAgIH0sXG5cbiAgICAgIGJlZm9yZTogZnVuY3Rpb24oYmFzZSwgYmVmb3JlKSB7XG4gICAgICAgIHZhciBiZWZvcmVGbiA9ICh0eXBlb2YgYmVmb3JlID09ICdmdW5jdGlvbicpID8gYmVmb3JlIDogYmVmb3JlLm9ialtiZWZvcmUuZm5OYW1lXTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGNvbXBvc2VkQmVmb3JlKCkge1xuICAgICAgICAgIGJlZm9yZUZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgcmV0dXJuIGJhc2UuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcbiAgICAgIH0sXG5cbiAgICAgIGFmdGVyOiBmdW5jdGlvbihiYXNlLCBhZnRlcikge1xuICAgICAgICB2YXIgYWZ0ZXJGbiA9ICh0eXBlb2YgYWZ0ZXIgPT0gJ2Z1bmN0aW9uJykgPyBhZnRlciA6IGFmdGVyLm9ialthZnRlci5mbk5hbWVdO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gY29tcG9zZWRBZnRlcigpIHtcbiAgICAgICAgICB2YXIgcmVzID0gKGJhc2UudW5ib3VuZCB8fCBiYXNlKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgIGFmdGVyRm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICByZXR1cm4gcmVzO1xuICAgICAgICB9O1xuICAgICAgfSxcblxuICAgICAgLy8gYSBtaXhpbiB0aGF0IGFsbG93cyBvdGhlciBtaXhpbnMgdG8gYXVnbWVudCBleGlzdGluZyBmdW5jdGlvbnMgYnkgYWRkaW5nIGFkZGl0aW9uYWxcbiAgICAgIC8vIGNvZGUgYmVmb3JlLCBhZnRlciBvciBhcm91bmQuXG4gICAgICB3aXRoQWR2aWNlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgWydiZWZvcmUnLCAnYWZ0ZXInLCAnYXJvdW5kJ10uZm9yRWFjaChmdW5jdGlvbihtKSB7XG4gICAgICAgICAgdGhpc1ttXSA9IGZ1bmN0aW9uKG1ldGhvZCwgZm4pIHtcbiAgICAgICAgICAgIHZhciBtZXRob2RzID0gbWV0aG9kLnRyaW0oKS5zcGxpdCgnICcpO1xuXG4gICAgICAgICAgICBtZXRob2RzLmZvckVhY2goZnVuY3Rpb24oaSkge1xuICAgICAgICAgICAgICB1dGlscy5tdXRhdGVQcm9wZXJ0eSh0aGlzLCBpLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXNbaV0gPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgdGhpc1tpXSA9IGFkdmljZVttXSh0aGlzW2ldLCBmbik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHRoaXNbaV0gPSBmbjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpc1tpXTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9LCB0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIGFkdmljZTtcbiAgfS5hcHBseShleHBvcnRzLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fKSwgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18gIT09IHVuZGVmaW5lZCAmJiAobW9kdWxlLmV4cG9ydHMgPSBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXykpO1xuXG5cbi8qKiovIH0sXG4vKiAyICovXG4vKioqLyBmdW5jdGlvbihtb2R1bGUsIGV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pIHtcblxudmFyIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fOy8qIENvcHlyaWdodCAyMDEzIFR3aXR0ZXIsIEluYy4gTGljZW5zZWQgdW5kZXIgVGhlIE1JVCBMaWNlbnNlLiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUICovXG5cbiEoX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXyA9IFtcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDEpLFxuICAgIF9fd2VicGFja19yZXF1aXJlX18oNyksXG4gICAgX193ZWJwYWNrX3JlcXVpcmVfXygzKSxcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDgpLFxuICAgIF9fd2VicGFja19yZXF1aXJlX18oNiksXG4gICAgX193ZWJwYWNrX3JlcXVpcmVfXyg1KSxcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDQpXG4gIF0sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fID0gZnVuY3Rpb24oYWR2aWNlLCB1dGlscywgY29tcG9zZSwgd2l0aEJhc2UsIHJlZ2lzdHJ5LCB3aXRoTG9nZ2luZywgZGVidWcpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgZnVuY3Rpb25OYW1lUmVnRXggPSAvZnVuY3Rpb24gKC4qPylcXHM/XFwoLztcbiAgICB2YXIgaWdub3JlZE1peGluID0ge1xuICAgICAgd2l0aEJhc2U6IHRydWUsXG4gICAgICB3aXRoTG9nZ2luZzogdHJ1ZVxuICAgIH07XG5cbiAgICAvLyB0ZWFyZG93biBmb3IgYWxsIGluc3RhbmNlcyBvZiB0aGlzIGNvbnN0cnVjdG9yXG4gICAgZnVuY3Rpb24gdGVhcmRvd25BbGwoKSB7XG4gICAgICB2YXIgY29tcG9uZW50SW5mbyA9IHJlZ2lzdHJ5LmZpbmRDb21wb25lbnRJbmZvKHRoaXMpO1xuXG4gICAgICBjb21wb25lbnRJbmZvICYmIE9iamVjdC5rZXlzKGNvbXBvbmVudEluZm8uaW5zdGFuY2VzKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgdmFyIGluZm8gPSBjb21wb25lbnRJbmZvLmluc3RhbmNlc1trXTtcbiAgICAgICAgLy8gSXQncyBwb3NzaWJsZSB0aGF0IGEgcHJldmlvdXMgdGVhcmRvd24gY2F1c2VkIGFub3RoZXIgY29tcG9uZW50IHRvIHRlYXJkb3duLFxuICAgICAgICAvLyBzbyB3ZSBjYW4ndCBhc3N1bWUgdGhhdCB0aGUgaW5zdGFuY2VzIG9iamVjdCBpcyBhcyBpdCB3YXMuXG4gICAgICAgIGlmIChpbmZvICYmIGluZm8uaW5zdGFuY2UpIHtcbiAgICAgICAgICBpbmZvLmluc3RhbmNlLnRlYXJkb3duKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGF0dGFjaFRvKHNlbGVjdG9yLyosIG9wdGlvbnMgYXJncyAqLykge1xuICAgICAgLy8gdW5wYWNraW5nIGFyZ3VtZW50cyBieSBoYW5kIGJlbmNobWFya2VkIGZhc3RlclxuICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICB9XG5cbiAgICAgIGlmICghc2VsZWN0b3IpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb21wb25lbnQgbmVlZHMgdG8gYmUgYXR0YWNoVG9cXCdkIGEgalF1ZXJ5IG9iamVjdCwgbmF0aXZlIG5vZGUgb3Igc2VsZWN0b3Igc3RyaW5nJyk7XG4gICAgICB9XG5cbiAgICAgIHZhciBvcHRpb25zID0gdXRpbHMubWVyZ2UuYXBwbHkodXRpbHMsIGFyZ3MpO1xuICAgICAgdmFyIGNvbXBvbmVudEluZm8gPSByZWdpc3RyeS5maW5kQ29tcG9uZW50SW5mbyh0aGlzKTtcblxuICAgICAgJChzZWxlY3RvcikuZWFjaChmdW5jdGlvbihpLCBub2RlKSB7XG4gICAgICAgIGlmIChjb21wb25lbnRJbmZvICYmIGNvbXBvbmVudEluZm8uaXNBdHRhY2hlZFRvKG5vZGUpKSB7XG4gICAgICAgICAgLy8gYWxyZWFkeSBhdHRhY2hlZFxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIChuZXcgdGhpcykuaW5pdGlhbGl6ZShub2RlLCBvcHRpb25zKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcHJldHR5UHJpbnRNaXhpbnMoKSB7XG4gICAgICAvL2NvdWxkIGJlIGNhbGxlZCBmcm9tIGNvbnN0cnVjdG9yIG9yIGNvbnN0cnVjdG9yLnByb3RvdHlwZVxuICAgICAgdmFyIG1peGVkSW4gPSB0aGlzLm1peGVkSW4gfHwgdGhpcy5wcm90b3R5cGUubWl4ZWRJbiB8fCBbXTtcbiAgICAgIHJldHVybiBtaXhlZEluLm1hcChmdW5jdGlvbihtaXhpbikge1xuICAgICAgICBpZiAobWl4aW4ubmFtZSA9PSBudWxsKSB7XG4gICAgICAgICAgLy8gZnVuY3Rpb24gbmFtZSBwcm9wZXJ0eSBub3Qgc3VwcG9ydGVkIGJ5IHRoaXMgYnJvd3NlciwgdXNlIHJlZ2V4XG4gICAgICAgICAgdmFyIG0gPSBtaXhpbi50b1N0cmluZygpLm1hdGNoKGZ1bmN0aW9uTmFtZVJlZ0V4KTtcbiAgICAgICAgICByZXR1cm4gKG0gJiYgbVsxXSkgPyBtWzFdIDogJyc7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICghaWdub3JlZE1peGluW21peGluLm5hbWVdID8gbWl4aW4ubmFtZSA6ICcnKTtcbiAgICAgIH0pLmZpbHRlcihCb29sZWFuKS5qb2luKCcsICcpO1xuICAgIH07XG5cblxuICAgIC8vIGRlZmluZSB0aGUgY29uc3RydWN0b3IgZm9yIGEgY3VzdG9tIGNvbXBvbmVudCB0eXBlXG4gICAgLy8gdGFrZXMgYW4gdW5saW1pdGVkIG51bWJlciBvZiBtaXhpbiBmdW5jdGlvbnMgYXMgYXJndW1lbnRzXG4gICAgLy8gdHlwaWNhbCBhcGkgY2FsbCB3aXRoIDMgbWl4aW5zOiBkZWZpbmUodGltZWxpbmUsIHdpdGhUd2VldENhcGFiaWxpdHksIHdpdGhTY3JvbGxDYXBhYmlsaXR5KTtcbiAgICBmdW5jdGlvbiBkZWZpbmUoLyptaXhpbnMqLykge1xuICAgICAgLy8gdW5wYWNraW5nIGFyZ3VtZW50cyBieSBoYW5kIGJlbmNobWFya2VkIGZhc3RlclxuICAgICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgdmFyIG1peGlucyA9IG5ldyBBcnJheShsKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIG1peGluc1tpXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIH1cblxuICAgICAgdmFyIENvbXBvbmVudCA9IGZ1bmN0aW9uKCkge307XG5cbiAgICAgIENvbXBvbmVudC50b1N0cmluZyA9IENvbXBvbmVudC5wcm90b3R5cGUudG9TdHJpbmcgPSBwcmV0dHlQcmludE1peGlucztcbiAgICAgIGlmIChkZWJ1Zy5lbmFibGVkKSB7XG4gICAgICAgIENvbXBvbmVudC5kZXNjcmliZSA9IENvbXBvbmVudC5wcm90b3R5cGUuZGVzY3JpYmUgPSBDb21wb25lbnQudG9TdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgLy8gJ29wdGlvbnMnIGlzIG9wdGlvbmFsIGhhc2ggdG8gYmUgbWVyZ2VkIHdpdGggJ2RlZmF1bHRzJyBpbiB0aGUgY29tcG9uZW50IGRlZmluaXRpb25cbiAgICAgIENvbXBvbmVudC5hdHRhY2hUbyA9IGF0dGFjaFRvO1xuICAgICAgLy8gZW5hYmxlcyBleHRlbnNpb24gb2YgZXhpc3RpbmcgXCJiYXNlXCIgQ29tcG9uZW50c1xuICAgICAgQ29tcG9uZW50Lm1peGluID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBuZXdDb21wb25lbnQgPSBkZWZpbmUoKTsgLy9UT0RPOiBmaXggcHJldHR5IHByaW50XG4gICAgICAgIHZhciBuZXdQcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKENvbXBvbmVudC5wcm90b3R5cGUpO1xuICAgICAgICBuZXdQcm90b3R5cGUubWl4ZWRJbiA9IFtdLmNvbmNhdChDb21wb25lbnQucHJvdG90eXBlLm1peGVkSW4pO1xuICAgICAgICBuZXdQcm90b3R5cGUuZGVmYXVsdHMgPSB1dGlscy5tZXJnZShDb21wb25lbnQucHJvdG90eXBlLmRlZmF1bHRzKTtcbiAgICAgICAgbmV3UHJvdG90eXBlLmF0dHJEZWYgPSBDb21wb25lbnQucHJvdG90eXBlLmF0dHJEZWY7XG4gICAgICAgIGNvbXBvc2UubWl4aW4obmV3UHJvdG90eXBlLCBhcmd1bWVudHMpO1xuICAgICAgICBuZXdDb21wb25lbnQucHJvdG90eXBlID0gbmV3UHJvdG90eXBlO1xuICAgICAgICBuZXdDb21wb25lbnQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gbmV3Q29tcG9uZW50O1xuICAgICAgICByZXR1cm4gbmV3Q29tcG9uZW50O1xuICAgICAgfTtcbiAgICAgIENvbXBvbmVudC50ZWFyZG93bkFsbCA9IHRlYXJkb3duQWxsO1xuXG4gICAgICAvLyBwcmVwZW5kIGNvbW1vbiBtaXhpbnMgdG8gc3VwcGxpZWQgbGlzdCwgdGhlbiBtaXhpbiBhbGwgZmxhdm9yc1xuICAgICAgaWYgKGRlYnVnLmVuYWJsZWQpIHtcbiAgICAgICAgbWl4aW5zLnVuc2hpZnQod2l0aExvZ2dpbmcpO1xuICAgICAgfVxuICAgICAgbWl4aW5zLnVuc2hpZnQod2l0aEJhc2UsIGFkdmljZS53aXRoQWR2aWNlLCByZWdpc3RyeS53aXRoUmVnaXN0cmF0aW9uKTtcbiAgICAgIGNvbXBvc2UubWl4aW4oQ29tcG9uZW50LnByb3RvdHlwZSwgbWl4aW5zKTtcblxuICAgICAgcmV0dXJuIENvbXBvbmVudDtcbiAgICB9XG5cbiAgICBkZWZpbmUudGVhcmRvd25BbGwgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJlZ2lzdHJ5LmNvbXBvbmVudHMuc2xpY2UoKS5mb3JFYWNoKGZ1bmN0aW9uKGMpIHtcbiAgICAgICAgYy5jb21wb25lbnQudGVhcmRvd25BbGwoKTtcbiAgICAgIH0pO1xuICAgICAgcmVnaXN0cnkucmVzZXQoKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGRlZmluZTtcbiAgfS5hcHBseShleHBvcnRzLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fKSwgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18gIT09IHVuZGVmaW5lZCAmJiAobW9kdWxlLmV4cG9ydHMgPSBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXykpO1xuXG5cbi8qKiovIH0sXG4vKiAzICovXG4vKioqLyBmdW5jdGlvbihtb2R1bGUsIGV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pIHtcblxudmFyIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fOy8qIENvcHlyaWdodCAyMDEzIFR3aXR0ZXIsIEluYy4gTGljZW5zZWQgdW5kZXIgVGhlIE1JVCBMaWNlbnNlLiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUICovXG5cbiEoX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXyA9IFtcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDcpXG4gIF0sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fID0gZnVuY3Rpb24odXRpbHMpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgZG9udExvY2sgPSBbJ21peGVkSW4nLCAnYXR0ckRlZiddO1xuXG4gICAgZnVuY3Rpb24gc2V0V3JpdGFiaWxpdHkob2JqLCB3cml0YWJsZSkge1xuICAgICAgT2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgaWYgKGRvbnRMb2NrLmluZGV4T2Yoa2V5KSA8IDApIHtcbiAgICAgICAgICB1dGlscy5wcm9wZXJ0eVdyaXRhYmlsaXR5KG9iaiwga2V5LCB3cml0YWJsZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1peGluKGJhc2UsIG1peGlucykge1xuICAgICAgYmFzZS5taXhlZEluID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGJhc2UsICdtaXhlZEluJykgPyBiYXNlLm1peGVkSW4gOiBbXTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtaXhpbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGJhc2UubWl4ZWRJbi5pbmRleE9mKG1peGluc1tpXSkgPT0gLTEpIHtcbiAgICAgICAgICBzZXRXcml0YWJpbGl0eShiYXNlLCBmYWxzZSk7XG4gICAgICAgICAgbWl4aW5zW2ldLmNhbGwoYmFzZSk7XG4gICAgICAgICAgYmFzZS5taXhlZEluLnB1c2gobWl4aW5zW2ldKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzZXRXcml0YWJpbGl0eShiYXNlLCB0cnVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgbWl4aW46IG1peGluXG4gICAgfTtcblxuICB9LmFwcGx5KGV4cG9ydHMsIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18pLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyAhPT0gdW5kZWZpbmVkICYmIChtb2R1bGUuZXhwb3J0cyA9IF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fKSk7XG5cblxuLyoqKi8gfSxcbi8qIDQgKi9cbi8qKiovIGZ1bmN0aW9uKG1vZHVsZSwgZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXykge1xuXG52YXIgX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXywgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX187LyogQ29weXJpZ2h0IDIwMTMgVHdpdHRlciwgSW5jLiBMaWNlbnNlZCB1bmRlciBUaGUgTUlUIExpY2Vuc2UuIGh0dHA6Ly9vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVQgKi9cblxuIShfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fID0gW19fd2VicGFja19yZXF1aXJlX18oNildLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyA9IGZ1bmN0aW9uKHJlZ2lzdHJ5KSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gU2VhcmNoIG9iamVjdCBtb2RlbFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgZnVuY3Rpb24gdHJhdmVyc2UodXRpbCwgc2VhcmNoVGVybSwgb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICB2YXIgb2JqID0gb3B0aW9ucy5vYmogfHwgd2luZG93O1xuICAgICAgdmFyIHBhdGggPSBvcHRpb25zLnBhdGggfHwgKChvYmogPT0gd2luZG93KSA/ICd3aW5kb3cnIDogJycpO1xuICAgICAgdmFyIHByb3BzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgICAgIHByb3BzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgICBpZiAoKHRlc3RzW3V0aWxdIHx8IHV0aWwpKHNlYXJjaFRlcm0sIG9iaiwgcHJvcCkpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhbcGF0aCwgJy4nLCBwcm9wXS5qb2luKCcnKSwgJy0+JywgWycoJywgdHlwZW9mIG9ialtwcm9wXSwgJyknXS5qb2luKCcnKSwgb2JqW3Byb3BdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9ialtwcm9wXSkgPT0gJ1tvYmplY3QgT2JqZWN0XScgJiYgKG9ialtwcm9wXSAhPSBvYmopICYmIHBhdGguc3BsaXQoJy4nKS5pbmRleE9mKHByb3ApID09IC0xKSB7XG4gICAgICAgICAgdHJhdmVyc2UodXRpbCwgc2VhcmNoVGVybSwge29iajogb2JqW3Byb3BdLCBwYXRoOiBbcGF0aCxwcm9wXS5qb2luKCcuJyl9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2VhcmNoKHV0aWwsIGV4cGVjdGVkLCBzZWFyY2hUZXJtLCBvcHRpb25zKSB7XG4gICAgICBpZiAoIWV4cGVjdGVkIHx8IHR5cGVvZiBzZWFyY2hUZXJtID09IGV4cGVjdGVkKSB7XG4gICAgICAgIHRyYXZlcnNlKHV0aWwsIHNlYXJjaFRlcm0sIG9wdGlvbnMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihbc2VhcmNoVGVybSwgJ211c3QgYmUnLCBleHBlY3RlZF0uam9pbignICcpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgdGVzdHMgPSB7XG4gICAgICAnbmFtZSc6IGZ1bmN0aW9uKHNlYXJjaFRlcm0sIG9iaiwgcHJvcCkge3JldHVybiBzZWFyY2hUZXJtID09IHByb3A7fSxcbiAgICAgICduYW1lQ29udGFpbnMnOiBmdW5jdGlvbihzZWFyY2hUZXJtLCBvYmosIHByb3ApIHtyZXR1cm4gcHJvcC5pbmRleE9mKHNlYXJjaFRlcm0pID4gLTE7fSxcbiAgICAgICd0eXBlJzogZnVuY3Rpb24oc2VhcmNoVGVybSwgb2JqLCBwcm9wKSB7cmV0dXJuIG9ialtwcm9wXSBpbnN0YW5jZW9mIHNlYXJjaFRlcm07fSxcbiAgICAgICd2YWx1ZSc6IGZ1bmN0aW9uKHNlYXJjaFRlcm0sIG9iaiwgcHJvcCkge3JldHVybiBvYmpbcHJvcF0gPT09IHNlYXJjaFRlcm07fSxcbiAgICAgICd2YWx1ZUNvZXJjZWQnOiBmdW5jdGlvbihzZWFyY2hUZXJtLCBvYmosIHByb3ApIHtyZXR1cm4gb2JqW3Byb3BdID09IHNlYXJjaFRlcm07fVxuICAgIH07XG5cbiAgICBmdW5jdGlvbiBieU5hbWUoc2VhcmNoVGVybSwgb3B0aW9ucykge3NlYXJjaCgnbmFtZScsICdzdHJpbmcnLCBzZWFyY2hUZXJtLCBvcHRpb25zKTt9XG4gICAgZnVuY3Rpb24gYnlOYW1lQ29udGFpbnMoc2VhcmNoVGVybSwgb3B0aW9ucykge3NlYXJjaCgnbmFtZUNvbnRhaW5zJywgJ3N0cmluZycsIHNlYXJjaFRlcm0sIG9wdGlvbnMpO31cbiAgICBmdW5jdGlvbiBieVR5cGUoc2VhcmNoVGVybSwgb3B0aW9ucykge3NlYXJjaCgndHlwZScsICdmdW5jdGlvbicsIHNlYXJjaFRlcm0sIG9wdGlvbnMpO31cbiAgICBmdW5jdGlvbiBieVZhbHVlKHNlYXJjaFRlcm0sIG9wdGlvbnMpIHtzZWFyY2goJ3ZhbHVlJywgbnVsbCwgc2VhcmNoVGVybSwgb3B0aW9ucyk7fVxuICAgIGZ1bmN0aW9uIGJ5VmFsdWVDb2VyY2VkKHNlYXJjaFRlcm0sIG9wdGlvbnMpIHtzZWFyY2goJ3ZhbHVlQ29lcmNlZCcsIG51bGwsIHNlYXJjaFRlcm0sIG9wdGlvbnMpO31cbiAgICBmdW5jdGlvbiBjdXN0b20oZm4sIG9wdGlvbnMpIHt0cmF2ZXJzZShmbiwgbnVsbCwgb3B0aW9ucyk7fVxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gRXZlbnQgbG9nZ2luZ1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgdmFyIEFMTCA9ICdhbGwnOyAvL25vIGZpbHRlclxuXG4gICAgLy9sb2cgbm90aGluZyBieSBkZWZhdWx0XG4gICAgdmFyIGxvZ0ZpbHRlciA9IHtcbiAgICAgIGV2ZW50TmFtZXM6IFtdLFxuICAgICAgYWN0aW9uczogW11cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmaWx0ZXJFdmVudExvZ3NCeUFjdGlvbigvKmFjdGlvbnMqLykge1xuICAgICAgdmFyIGFjdGlvbnMgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICAgIGxvZ0ZpbHRlci5ldmVudE5hbWVzLmxlbmd0aCB8fCAobG9nRmlsdGVyLmV2ZW50TmFtZXMgPSBBTEwpO1xuICAgICAgbG9nRmlsdGVyLmFjdGlvbnMgPSBhY3Rpb25zLmxlbmd0aCA/IGFjdGlvbnMgOiBBTEw7XG4gICAgICBzYXZlTG9nRmlsdGVyKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmlsdGVyRXZlbnRMb2dzQnlOYW1lKC8qZXZlbnROYW1lcyovKSB7XG4gICAgICB2YXIgZXZlbnROYW1lcyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgICAgbG9nRmlsdGVyLmFjdGlvbnMubGVuZ3RoIHx8IChsb2dGaWx0ZXIuYWN0aW9ucyA9IEFMTCk7XG4gICAgICBsb2dGaWx0ZXIuZXZlbnROYW1lcyA9IGV2ZW50TmFtZXMubGVuZ3RoID8gZXZlbnROYW1lcyA6IEFMTDtcbiAgICAgIHNhdmVMb2dGaWx0ZXIoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBoaWRlQWxsRXZlbnRMb2dzKCkge1xuICAgICAgbG9nRmlsdGVyLmFjdGlvbnMgPSBbXTtcbiAgICAgIGxvZ0ZpbHRlci5ldmVudE5hbWVzID0gW107XG4gICAgICBzYXZlTG9nRmlsdGVyKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2hvd0FsbEV2ZW50TG9ncygpIHtcbiAgICAgIGxvZ0ZpbHRlci5hY3Rpb25zID0gQUxMO1xuICAgICAgbG9nRmlsdGVyLmV2ZW50TmFtZXMgPSBBTEw7XG4gICAgICBzYXZlTG9nRmlsdGVyKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2F2ZUxvZ0ZpbHRlcigpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGlmICh3aW5kb3cubG9jYWxTdG9yYWdlKSB7XG4gICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ2xvZ0ZpbHRlcl9ldmVudE5hbWVzJywgbG9nRmlsdGVyLmV2ZW50TmFtZXMpO1xuICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdsb2dGaWx0ZXJfYWN0aW9ucycsIGxvZ0ZpbHRlci5hY3Rpb25zKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoaWdub3JlZCkge307XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmV0cmlldmVMb2dGaWx0ZXIoKSB7XG4gICAgICB2YXIgZXZlbnROYW1lcywgYWN0aW9ucztcbiAgICAgIHRyeSB7XG4gICAgICAgIGV2ZW50TmFtZXMgPSAod2luZG93LmxvY2FsU3RvcmFnZSAmJiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbG9nRmlsdGVyX2V2ZW50TmFtZXMnKSk7XG4gICAgICAgIGFjdGlvbnMgPSAod2luZG93LmxvY2FsU3RvcmFnZSAmJiBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbG9nRmlsdGVyX2FjdGlvbnMnKSk7XG4gICAgICB9IGNhdGNoIChpZ25vcmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGV2ZW50TmFtZXMgJiYgKGxvZ0ZpbHRlci5ldmVudE5hbWVzID0gZXZlbnROYW1lcyk7XG4gICAgICBhY3Rpb25zICYmIChsb2dGaWx0ZXIuYWN0aW9ucyA9IGFjdGlvbnMpO1xuXG4gICAgICAvLyByZWNvbnN0aXR1dGUgYXJyYXlzIGluIHBsYWNlXG4gICAgICBPYmplY3Qua2V5cyhsb2dGaWx0ZXIpLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICB2YXIgdGhpc1Byb3AgPSBsb2dGaWx0ZXJba107XG4gICAgICAgIGlmICh0eXBlb2YgdGhpc1Byb3AgPT0gJ3N0cmluZycgJiYgdGhpc1Byb3AgIT09IEFMTCkge1xuICAgICAgICAgIGxvZ0ZpbHRlcltrXSA9IHRoaXNQcm9wID8gdGhpc1Byb3Auc3BsaXQoJywnKSA6IFtdO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuXG4gICAgICBlbmFibGU6IGZ1bmN0aW9uKGVuYWJsZSkge1xuICAgICAgICB0aGlzLmVuYWJsZWQgPSAhIWVuYWJsZTtcblxuICAgICAgICBpZiAoZW5hYmxlICYmIHdpbmRvdy5jb25zb2xlKSB7XG4gICAgICAgICAgY29uc29sZS5pbmZvKCdCb290aW5nIGluIERFQlVHIG1vZGUnKTtcbiAgICAgICAgICBjb25zb2xlLmluZm8oJ1lvdSBjYW4gY29uZmlndXJlIGV2ZW50IGxvZ2dpbmcgd2l0aCBERUJVRy5ldmVudHMubG9nQWxsKCkvbG9nTm9uZSgpL2xvZ0J5TmFtZSgpL2xvZ0J5QWN0aW9uKCknKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHJpZXZlTG9nRmlsdGVyKCk7XG5cbiAgICAgICAgd2luZG93LkRFQlVHID0gdGhpcztcbiAgICAgIH0sXG5cbiAgICAgIHdhcm46IGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgICAgIGlmICghd2luZG93LmNvbnNvbGUpIHsgcmV0dXJuOyB9XG4gICAgICAgIHZhciBmbiA9IChjb25zb2xlLndhcm4gfHwgY29uc29sZS5sb2cpO1xuICAgICAgICBmbi5jYWxsKGNvbnNvbGUsIHRoaXMudG9TdHJpbmcoKSArICc6ICcgKyBtZXNzYWdlKTtcbiAgICAgIH0sXG5cbiAgICAgIHJlZ2lzdHJ5OiByZWdpc3RyeSxcblxuICAgICAgZmluZDoge1xuICAgICAgICBieU5hbWU6IGJ5TmFtZSxcbiAgICAgICAgYnlOYW1lQ29udGFpbnM6IGJ5TmFtZUNvbnRhaW5zLFxuICAgICAgICBieVR5cGU6IGJ5VHlwZSxcbiAgICAgICAgYnlWYWx1ZTogYnlWYWx1ZSxcbiAgICAgICAgYnlWYWx1ZUNvZXJjZWQ6IGJ5VmFsdWVDb2VyY2VkLFxuICAgICAgICBjdXN0b206IGN1c3RvbVxuICAgICAgfSxcblxuICAgICAgZXZlbnRzOiB7XG4gICAgICAgIGxvZ0ZpbHRlcjogbG9nRmlsdGVyLFxuXG4gICAgICAgIC8vIEFjY2VwdHMgYW55IG51bWJlciBvZiBhY3Rpb24gYXJnc1xuICAgICAgICAvLyBlLmcuIERFQlVHLmV2ZW50cy5sb2dCeUFjdGlvbihcIm9uXCIsIFwib2ZmXCIpXG4gICAgICAgIGxvZ0J5QWN0aW9uOiBmaWx0ZXJFdmVudExvZ3NCeUFjdGlvbixcblxuICAgICAgICAvLyBBY2NlcHRzIGFueSBudW1iZXIgb2YgZXZlbnQgbmFtZSBhcmdzIChpbmMuIHJlZ2V4IG9yIHdpbGRjYXJkcylcbiAgICAgICAgLy8gZS5nLiBERUJVRy5ldmVudHMubG9nQnlOYW1lKC91aS4qLywgXCIqVGhyZWFkKlwiKTtcbiAgICAgICAgbG9nQnlOYW1lOiBmaWx0ZXJFdmVudExvZ3NCeU5hbWUsXG5cbiAgICAgICAgbG9nQWxsOiBzaG93QWxsRXZlbnRMb2dzLFxuICAgICAgICBsb2dOb25lOiBoaWRlQWxsRXZlbnRMb2dzXG4gICAgICB9XG4gICAgfTtcbiAgfS5hcHBseShleHBvcnRzLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fKSwgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18gIT09IHVuZGVmaW5lZCAmJiAobW9kdWxlLmV4cG9ydHMgPSBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXykpO1xuXG5cbi8qKiovIH0sXG4vKiA1ICovXG4vKioqLyBmdW5jdGlvbihtb2R1bGUsIGV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pIHtcblxudmFyIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fOy8qIENvcHlyaWdodCAyMDEzIFR3aXR0ZXIsIEluYy4gTGljZW5zZWQgdW5kZXIgVGhlIE1JVCBMaWNlbnNlLiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUICovXG5cbiEoX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXyA9IFtcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDcpXG4gIF0sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fID0gZnVuY3Rpb24odXRpbHMpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICB2YXIgYWN0aW9uU3ltYm9scyA9IHtcbiAgICAgIG9uOiAnPC0nLFxuICAgICAgdHJpZ2dlcjogJy0+JyxcbiAgICAgIG9mZjogJ3ggJ1xuICAgIH07XG5cbiAgICBmdW5jdGlvbiBlbGVtVG9TdHJpbmcoZWxlbSkge1xuICAgICAgdmFyIHRhZ1N0ciA9IGVsZW0udGFnTmFtZSA/IGVsZW0udGFnTmFtZS50b0xvd2VyQ2FzZSgpIDogZWxlbS50b1N0cmluZygpO1xuICAgICAgdmFyIGNsYXNzU3RyID0gZWxlbS5jbGFzc05hbWUgPyAnLicgKyAoZWxlbS5jbGFzc05hbWUpIDogJyc7XG4gICAgICB2YXIgcmVzdWx0ID0gdGFnU3RyICsgY2xhc3NTdHI7XG4gICAgICByZXR1cm4gZWxlbS50YWdOYW1lID8gWydcXCcnLCAnXFwnJ10uam9pbihyZXN1bHQpIDogcmVzdWx0O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvZyhhY3Rpb24sIGNvbXBvbmVudCwgZXZlbnRBcmdzKSB7XG4gICAgICBpZiAoIXdpbmRvdy5ERUJVRyB8fCAhd2luZG93LkRFQlVHLmVuYWJsZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdmFyIG5hbWUsIGV2ZW50VHlwZSwgZWxlbSwgZm4sIHBheWxvYWQsIGxvZ0ZpbHRlciwgdG9SZWdFeHAsIGFjdGlvbkxvZ2dhYmxlLCBuYW1lTG9nZ2FibGUsIGluZm87XG5cbiAgICAgIGlmICh0eXBlb2YgZXZlbnRBcmdzW2V2ZW50QXJncy5sZW5ndGggLSAxXSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZuID0gZXZlbnRBcmdzLnBvcCgpO1xuICAgICAgICBmbiA9IGZuLnVuYm91bmQgfHwgZm47IC8vIHVzZSB1bmJvdW5kIHZlcnNpb24gaWYgYW55IChiZXR0ZXIgaW5mbylcbiAgICAgIH1cblxuICAgICAgaWYgKGV2ZW50QXJncy5sZW5ndGggPT0gMSkge1xuICAgICAgICBlbGVtID0gY29tcG9uZW50LiRub2RlWzBdO1xuICAgICAgICBldmVudFR5cGUgPSBldmVudEFyZ3NbMF07XG4gICAgICB9IGVsc2UgaWYgKChldmVudEFyZ3MubGVuZ3RoID09IDIpICYmIHR5cGVvZiBldmVudEFyZ3NbMV0gPT0gJ29iamVjdCcgJiYgIWV2ZW50QXJnc1sxXS50eXBlKSB7XG4gICAgICAgIC8vMiBhcmdzLCBmaXJzdCBhcmcgaXMgbm90IGVsZW1cbiAgICAgICAgZWxlbSA9IGNvbXBvbmVudC4kbm9kZVswXTtcbiAgICAgICAgZXZlbnRUeXBlID0gZXZlbnRBcmdzWzBdO1xuICAgICAgICBpZiAoYWN0aW9uID09IFwidHJpZ2dlclwiKSB7XG4gICAgICAgICAgcGF5bG9hZCA9IGV2ZW50QXJnc1sxXTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8yKyBhcmdzLCBmaXJzdCBhcmcgaXMgZWxlbVxuICAgICAgICBlbGVtID0gZXZlbnRBcmdzWzBdO1xuICAgICAgICBldmVudFR5cGUgPSBldmVudEFyZ3NbMV07XG4gICAgICAgIGlmIChhY3Rpb24gPT0gXCJ0cmlnZ2VyXCIpIHtcbiAgICAgICAgICBwYXlsb2FkID0gZXZlbnRBcmdzWzJdO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIG5hbWUgPSB0eXBlb2YgZXZlbnRUeXBlID09ICdvYmplY3QnID8gZXZlbnRUeXBlLnR5cGUgOiBldmVudFR5cGU7XG5cbiAgICAgIGxvZ0ZpbHRlciA9IERFQlVHLmV2ZW50cy5sb2dGaWx0ZXI7XG5cbiAgICAgIC8vIG5vIHJlZ2V4IGZvciB5b3UsIGFjdGlvbnMuLi5cbiAgICAgIGFjdGlvbkxvZ2dhYmxlID0gbG9nRmlsdGVyLmFjdGlvbnMgPT0gJ2FsbCcgfHwgKGxvZ0ZpbHRlci5hY3Rpb25zLmluZGV4T2YoYWN0aW9uKSA+IC0xKTtcbiAgICAgIC8vIGV2ZW50IG5hbWUgZmlsdGVyIGFsbG93IHdpbGRjYXJkcyBvciByZWdleC4uLlxuICAgICAgdG9SZWdFeHAgPSBmdW5jdGlvbihleHByKSB7XG4gICAgICAgIHJldHVybiBleHByLnRlc3QgPyBleHByIDogbmV3IFJlZ0V4cCgnXicgKyBleHByLnJlcGxhY2UoL1xcKi9nLCAnLionKSArICckJyk7XG4gICAgICB9O1xuICAgICAgbmFtZUxvZ2dhYmxlID1cbiAgICAgICAgbG9nRmlsdGVyLmV2ZW50TmFtZXMgPT0gJ2FsbCcgfHxcbiAgICAgICAgbG9nRmlsdGVyLmV2ZW50TmFtZXMuc29tZShmdW5jdGlvbihlKSB7cmV0dXJuIHRvUmVnRXhwKGUpLnRlc3QobmFtZSk7fSk7XG5cbiAgICAgIGlmIChhY3Rpb25Mb2dnYWJsZSAmJiBuYW1lTG9nZ2FibGUpIHtcbiAgICAgICAgaW5mbyA9IFthY3Rpb25TeW1ib2xzW2FjdGlvbl0sIGFjdGlvbiwgJ1snICsgbmFtZSArICddJ107XG4gICAgICAgIHBheWxvYWQgJiYgaW5mby5wdXNoKHBheWxvYWQpO1xuICAgICAgICBpbmZvLnB1c2goZWxlbVRvU3RyaW5nKGVsZW0pKTtcbiAgICAgICAgaW5mby5wdXNoKGNvbXBvbmVudC5jb25zdHJ1Y3Rvci5kZXNjcmliZS5zcGxpdCgnICcpLnNsaWNlKDAsMykuam9pbignICcpKTtcbiAgICAgICAgY29uc29sZS5ncm91cENvbGxhcHNlZCAmJiBhY3Rpb24gPT0gJ3RyaWdnZXInICYmIGNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoYWN0aW9uLCBuYW1lKTtcbiAgICAgICAgLy8gSUU5IGRvZXNuJ3QgZGVmaW5lIGBhcHBseWAgZm9yIGNvbnNvbGUgbWV0aG9kcywgYnV0IHRoaXMgd29ya3MgZXZlcnl3aGVyZTpcbiAgICAgICAgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmNhbGwoY29uc29sZS5pbmZvLCBjb25zb2xlLCBpbmZvKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB3aXRoTG9nZ2luZygpIHtcbiAgICAgIHRoaXMuYmVmb3JlKCd0cmlnZ2VyJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIGxvZygndHJpZ2dlcicsIHRoaXMsIHV0aWxzLnRvQXJyYXkoYXJndW1lbnRzKSk7XG4gICAgICB9KTtcbiAgICAgIGlmIChjb25zb2xlLmdyb3VwQ29sbGFwc2VkKSB7XG4gICAgICAgIHRoaXMuYWZ0ZXIoJ3RyaWdnZXInLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBjb25zb2xlLmdyb3VwRW5kKCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgdGhpcy5iZWZvcmUoJ29uJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIGxvZygnb24nLCB0aGlzLCB1dGlscy50b0FycmF5KGFyZ3VtZW50cykpO1xuICAgICAgfSk7XG4gICAgICB0aGlzLmJlZm9yZSgnb2ZmJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIGxvZygnb2ZmJywgdGhpcywgdXRpbHMudG9BcnJheShhcmd1bWVudHMpKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiB3aXRoTG9nZ2luZztcbiAgfS5hcHBseShleHBvcnRzLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fKSwgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18gIT09IHVuZGVmaW5lZCAmJiAobW9kdWxlLmV4cG9ydHMgPSBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXykpO1xuXG5cbi8qKiovIH0sXG4vKiA2ICovXG4vKioqLyBmdW5jdGlvbihtb2R1bGUsIGV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pIHtcblxudmFyIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fOy8qIENvcHlyaWdodCAyMDEzIFR3aXR0ZXIsIEluYy4gTGljZW5zZWQgdW5kZXIgVGhlIE1JVCBMaWNlbnNlLiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUICovXG5cbiEoX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXyA9IFtdLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyA9IGZ1bmN0aW9uKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIGZ1bmN0aW9uIHBhcnNlRXZlbnRBcmdzKGluc3RhbmNlLCBhcmdzKSB7XG4gICAgICB2YXIgZWxlbWVudCwgdHlwZSwgY2FsbGJhY2s7XG4gICAgICB2YXIgZW5kID0gYXJncy5sZW5ndGg7XG5cbiAgICAgIGlmICh0eXBlb2YgYXJnc1tlbmQgLSAxXSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGVuZCAtPSAxO1xuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbZW5kXTtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiBhcmdzW2VuZCAtIDFdID09ICdvYmplY3QnKSB7XG4gICAgICAgIGVuZCAtPSAxO1xuICAgICAgfVxuXG4gICAgICBpZiAoZW5kID09IDIpIHtcbiAgICAgICAgZWxlbWVudCA9IGFyZ3NbMF07XG4gICAgICAgIHR5cGUgPSBhcmdzWzFdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWxlbWVudCA9IGluc3RhbmNlLm5vZGU7XG4gICAgICAgIHR5cGUgPSBhcmdzWzBdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBlbGVtZW50OiBlbGVtZW50LFxuICAgICAgICB0eXBlOiB0eXBlLFxuICAgICAgICBjYWxsYmFjazogY2FsbGJhY2tcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWF0Y2hFdmVudChhLCBiKSB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICAoYS5lbGVtZW50ID09IGIuZWxlbWVudCkgJiZcbiAgICAgICAgKGEudHlwZSA9PSBiLnR5cGUpICYmXG4gICAgICAgIChiLmNhbGxiYWNrID09IG51bGwgfHwgKGEuY2FsbGJhY2sgPT0gYi5jYWxsYmFjaykpXG4gICAgICApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIFJlZ2lzdHJ5KCkge1xuXG4gICAgICB2YXIgcmVnaXN0cnkgPSB0aGlzO1xuXG4gICAgICAodGhpcy5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmNvbXBvbmVudHMgPSBbXTtcbiAgICAgICAgdGhpcy5hbGxJbnN0YW5jZXMgPSB7fTtcbiAgICAgICAgdGhpcy5ldmVudHMgPSBbXTtcbiAgICAgIH0pLmNhbGwodGhpcyk7XG5cbiAgICAgIGZ1bmN0aW9uIENvbXBvbmVudEluZm8oY29tcG9uZW50KSB7XG4gICAgICAgIHRoaXMuY29tcG9uZW50ID0gY29tcG9uZW50O1xuICAgICAgICB0aGlzLmF0dGFjaGVkVG8gPSBbXTtcbiAgICAgICAgdGhpcy5pbnN0YW5jZXMgPSB7fTtcblxuICAgICAgICB0aGlzLmFkZEluc3RhbmNlID0gZnVuY3Rpb24oaW5zdGFuY2UpIHtcbiAgICAgICAgICB2YXIgaW5zdGFuY2VJbmZvID0gbmV3IEluc3RhbmNlSW5mbyhpbnN0YW5jZSk7XG4gICAgICAgICAgdGhpcy5pbnN0YW5jZXNbaW5zdGFuY2UuaWRlbnRpdHldID0gaW5zdGFuY2VJbmZvO1xuICAgICAgICAgIHRoaXMuYXR0YWNoZWRUby5wdXNoKGluc3RhbmNlLm5vZGUpO1xuXG4gICAgICAgICAgcmV0dXJuIGluc3RhbmNlSW5mbztcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLnJlbW92ZUluc3RhbmNlID0gZnVuY3Rpb24oaW5zdGFuY2UpIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5pbnN0YW5jZXNbaW5zdGFuY2UuaWRlbnRpdHldO1xuICAgICAgICAgIHZhciBpbmRleE9mTm9kZSA9IHRoaXMuYXR0YWNoZWRUby5pbmRleE9mKGluc3RhbmNlLm5vZGUpO1xuICAgICAgICAgIChpbmRleE9mTm9kZSA+IC0xKSAmJiB0aGlzLmF0dGFjaGVkVG8uc3BsaWNlKGluZGV4T2ZOb2RlLCAxKTtcblxuICAgICAgICAgIGlmICghT2JqZWN0LmtleXModGhpcy5pbnN0YW5jZXMpLmxlbmd0aCkge1xuICAgICAgICAgICAgLy9pZiBJIGhvbGQgbm8gbW9yZSBpbnN0YW5jZXMgcmVtb3ZlIG1lIGZyb20gcmVnaXN0cnlcbiAgICAgICAgICAgIHJlZ2lzdHJ5LnJlbW92ZUNvbXBvbmVudEluZm8odGhpcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuaXNBdHRhY2hlZFRvID0gZnVuY3Rpb24obm9kZSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLmF0dGFjaGVkVG8uaW5kZXhPZihub2RlKSA+IC0xO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBJbnN0YW5jZUluZm8oaW5zdGFuY2UpIHtcbiAgICAgICAgdGhpcy5pbnN0YW5jZSA9IGluc3RhbmNlO1xuICAgICAgICB0aGlzLmV2ZW50cyA9IFtdO1xuXG4gICAgICAgIHRoaXMuYWRkQmluZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgdGhpcy5ldmVudHMucHVzaChldmVudCk7XG4gICAgICAgICAgcmVnaXN0cnkuZXZlbnRzLnB1c2goZXZlbnQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMucmVtb3ZlQmluZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGU7IGUgPSB0aGlzLmV2ZW50c1tpXTsgaSsrKSB7XG4gICAgICAgICAgICBpZiAobWF0Y2hFdmVudChlLCBldmVudCkpIHtcbiAgICAgICAgICAgICAgdGhpcy5ldmVudHMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5hZGRJbnN0YW5jZSA9IGZ1bmN0aW9uKGluc3RhbmNlKSB7XG4gICAgICAgIHZhciBjb21wb25lbnQgPSB0aGlzLmZpbmRDb21wb25lbnRJbmZvKGluc3RhbmNlKTtcblxuICAgICAgICBpZiAoIWNvbXBvbmVudCkge1xuICAgICAgICAgIGNvbXBvbmVudCA9IG5ldyBDb21wb25lbnRJbmZvKGluc3RhbmNlLmNvbnN0cnVjdG9yKTtcbiAgICAgICAgICB0aGlzLmNvbXBvbmVudHMucHVzaChjb21wb25lbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGluc3QgPSBjb21wb25lbnQuYWRkSW5zdGFuY2UoaW5zdGFuY2UpO1xuXG4gICAgICAgIHRoaXMuYWxsSW5zdGFuY2VzW2luc3RhbmNlLmlkZW50aXR5XSA9IGluc3Q7XG5cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMucmVtb3ZlSW5zdGFuY2UgPSBmdW5jdGlvbihpbnN0YW5jZSkge1xuICAgICAgICAvL3JlbW92ZSBmcm9tIGNvbXBvbmVudCBpbmZvXG4gICAgICAgIHZhciBjb21wb25lbnRJbmZvID0gdGhpcy5maW5kQ29tcG9uZW50SW5mbyhpbnN0YW5jZSk7XG4gICAgICAgIGNvbXBvbmVudEluZm8gJiYgY29tcG9uZW50SW5mby5yZW1vdmVJbnN0YW5jZShpbnN0YW5jZSk7XG5cbiAgICAgICAgLy9yZW1vdmUgZnJvbSByZWdpc3RyeVxuICAgICAgICBkZWxldGUgdGhpcy5hbGxJbnN0YW5jZXNbaW5zdGFuY2UuaWRlbnRpdHldO1xuICAgICAgfTtcblxuICAgICAgdGhpcy5yZW1vdmVDb21wb25lbnRJbmZvID0gZnVuY3Rpb24oY29tcG9uZW50SW5mbykge1xuICAgICAgICB2YXIgaW5kZXggPSB0aGlzLmNvbXBvbmVudHMuaW5kZXhPZihjb21wb25lbnRJbmZvKTtcbiAgICAgICAgKGluZGV4ID4gLTEpICYmIHRoaXMuY29tcG9uZW50cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgfTtcblxuICAgICAgdGhpcy5maW5kQ29tcG9uZW50SW5mbyA9IGZ1bmN0aW9uKHdoaWNoKSB7XG4gICAgICAgIHZhciBjb21wb25lbnQgPSB3aGljaC5hdHRhY2hUbyA/IHdoaWNoIDogd2hpY2guY29uc3RydWN0b3I7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGM7IGMgPSB0aGlzLmNvbXBvbmVudHNbaV07IGkrKykge1xuICAgICAgICAgIGlmIChjLmNvbXBvbmVudCA9PT0gY29tcG9uZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gYztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuZmluZEluc3RhbmNlSW5mbyA9IGZ1bmN0aW9uKGluc3RhbmNlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFsbEluc3RhbmNlc1tpbnN0YW5jZS5pZGVudGl0eV0gfHwgbnVsbDtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuZ2V0Qm91bmRFdmVudE5hbWVzID0gZnVuY3Rpb24oaW5zdGFuY2UpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmluZEluc3RhbmNlSW5mbyhpbnN0YW5jZSkuZXZlbnRzLm1hcChmdW5jdGlvbihldikge1xuICAgICAgICAgIHJldHVybiBldi50eXBlO1xuICAgICAgICB9KTtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuZmluZEluc3RhbmNlSW5mb0J5Tm9kZSA9IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgICAgICBPYmplY3Qua2V5cyh0aGlzLmFsbEluc3RhbmNlcykuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgICAgdmFyIHRoaXNJbnN0YW5jZUluZm8gPSB0aGlzLmFsbEluc3RhbmNlc1trXTtcbiAgICAgICAgICBpZiAodGhpc0luc3RhbmNlSW5mby5pbnN0YW5jZS5ub2RlID09PSBub2RlKSB7XG4gICAgICAgICAgICByZXN1bHQucHVzaCh0aGlzSW5zdGFuY2VJbmZvKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIHRoaXMpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfTtcblxuICAgICAgdGhpcy5vbiA9IGZ1bmN0aW9uKGNvbXBvbmVudE9uKSB7XG4gICAgICAgIHZhciBpbnN0YW5jZSA9IHJlZ2lzdHJ5LmZpbmRJbnN0YW5jZUluZm8odGhpcyksIGJvdW5kQ2FsbGJhY2s7XG5cbiAgICAgICAgLy8gdW5wYWNraW5nIGFyZ3VtZW50cyBieSBoYW5kIGJlbmNobWFya2VkIGZhc3RlclxuICAgICAgICB2YXIgbCA9IGFyZ3VtZW50cy5sZW5ndGgsIGkgPSAxO1xuICAgICAgICB2YXIgb3RoZXJBcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcbiAgICAgICAgZm9yICg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICBvdGhlckFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluc3RhbmNlKSB7XG4gICAgICAgICAgYm91bmRDYWxsYmFjayA9IGNvbXBvbmVudE9uLmFwcGx5KG51bGwsIG90aGVyQXJncyk7XG4gICAgICAgICAgaWYgKGJvdW5kQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIG90aGVyQXJnc1tvdGhlckFyZ3MubGVuZ3RoIC0gMV0gPSBib3VuZENhbGxiYWNrO1xuICAgICAgICAgIH1cbiAgICAgICAgICB2YXIgZXZlbnQgPSBwYXJzZUV2ZW50QXJncyh0aGlzLCBvdGhlckFyZ3MpO1xuICAgICAgICAgIGluc3RhbmNlLmFkZEJpbmQoZXZlbnQpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICB0aGlzLm9mZiA9IGZ1bmN0aW9uKC8qZWwsIHR5cGUsIGNhbGxiYWNrKi8pIHtcbiAgICAgICAgdmFyIGV2ZW50ID0gcGFyc2VFdmVudEFyZ3ModGhpcywgYXJndW1lbnRzKSxcbiAgICAgICAgICAgIGluc3RhbmNlID0gcmVnaXN0cnkuZmluZEluc3RhbmNlSW5mbyh0aGlzKTtcblxuICAgICAgICBpZiAoaW5zdGFuY2UpIHtcbiAgICAgICAgICBpbnN0YW5jZS5yZW1vdmVCaW5kKGV2ZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vcmVtb3ZlIGZyb20gZ2xvYmFsIGV2ZW50IHJlZ2lzdHJ5XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBlOyBlID0gcmVnaXN0cnkuZXZlbnRzW2ldOyBpKyspIHtcbiAgICAgICAgICBpZiAobWF0Y2hFdmVudChlLCBldmVudCkpIHtcbiAgICAgICAgICAgIHJlZ2lzdHJ5LmV2ZW50cy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBkZWJ1ZyB0b29scyBtYXkgd2FudCB0byBhZGQgYWR2aWNlIHRvIHRyaWdnZXJcbiAgICAgIHJlZ2lzdHJ5LnRyaWdnZXIgPSBmdW5jdGlvbigpIHt9O1xuXG4gICAgICB0aGlzLnRlYXJkb3duID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlZ2lzdHJ5LnJlbW92ZUluc3RhbmNlKHRoaXMpO1xuICAgICAgfTtcblxuICAgICAgdGhpcy53aXRoUmVnaXN0cmF0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuYWZ0ZXIoJ2luaXRpYWxpemUnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZWdpc3RyeS5hZGRJbnN0YW5jZSh0aGlzKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5hcm91bmQoJ29uJywgcmVnaXN0cnkub24pO1xuICAgICAgICB0aGlzLmFmdGVyKCdvZmYnLCByZWdpc3RyeS5vZmYpO1xuICAgICAgICAvL2RlYnVnIHRvb2xzIG1heSB3YW50IHRvIGFkZCBhZHZpY2UgdG8gdHJpZ2dlclxuICAgICAgICB3aW5kb3cuREVCVUcgJiYgKGZhbHNlKS5lbmFibGVkICYmIHRoaXMuYWZ0ZXIoJ3RyaWdnZXInLCByZWdpc3RyeS50cmlnZ2VyKTtcbiAgICAgICAgdGhpcy5hZnRlcigndGVhcmRvd24nLCB7b2JqOiByZWdpc3RyeSwgZm5OYW1lOiAndGVhcmRvd24nfSk7XG4gICAgICB9O1xuXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBSZWdpc3RyeTtcbiAgfS5hcHBseShleHBvcnRzLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fKSwgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18gIT09IHVuZGVmaW5lZCAmJiAobW9kdWxlLmV4cG9ydHMgPSBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXykpO1xuXG5cbi8qKiovIH0sXG4vKiA3ICovXG4vKioqLyBmdW5jdGlvbihtb2R1bGUsIGV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pIHtcblxudmFyIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fOy8qIENvcHlyaWdodCAyMDEzIFR3aXR0ZXIsIEluYy4gTGljZW5zZWQgdW5kZXIgVGhlIE1JVCBMaWNlbnNlLiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUICovXG5cbiEoX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXyA9IFtfX3dlYnBhY2tfcmVxdWlyZV9fKDQpXSwgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18gPSBmdW5jdGlvbihkZWJ1Zykge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHZhciBERUZBVUxUX0lOVEVSVkFMID0gMTAwO1xuXG4gICAgZnVuY3Rpb24gY2FuV3JpdGVQcm90ZWN0KCkge1xuICAgICAgdmFyIHdyaXRlUHJvdGVjdFN1cHBvcnRlZCA9IGRlYnVnLmVuYWJsZWQgJiYgIU9iamVjdC5wcm9wZXJ0eUlzRW51bWVyYWJsZSgnZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yJyk7XG4gICAgICBpZiAod3JpdGVQcm90ZWN0U3VwcG9ydGVkKSB7XG4gICAgICAgIC8vSUU4IGdldE93blByb3BlcnR5RGVzY3JpcHRvciBpcyBidWlsdC1pbiBidXQgdGhyb3dzIGV4ZXB0aW9uIG9uIG5vbiBET00gb2JqZWN0c1xuICAgICAgICB0cnkge1xuICAgICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoT2JqZWN0LCAna2V5cycpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHdyaXRlUHJvdGVjdFN1cHBvcnRlZDtcbiAgICB9XG5cbiAgICB2YXIgdXRpbHMgPSB7XG5cbiAgICAgIGlzRG9tT2JqOiBmdW5jdGlvbihvYmopIHtcbiAgICAgICAgcmV0dXJuICEhKG9iai5ub2RlVHlwZSB8fCAob2JqID09PSB3aW5kb3cpKTtcbiAgICAgIH0sXG5cbiAgICAgIHRvQXJyYXk6IGZ1bmN0aW9uKG9iaiwgZnJvbSkge1xuICAgICAgICBmcm9tID0gZnJvbSB8fCAwO1xuICAgICAgICB2YXIgbGVuID0gb2JqLmxlbmd0aCwgYXJyID0gbmV3IEFycmF5KGxlbiAtIGZyb20pO1xuICAgICAgICBmb3IgKHZhciBpID0gZnJvbTsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgYXJyW2kgLSBmcm9tXSA9IG9ialtpXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXJyO1xuICAgICAgfSxcblxuICAgICAgLy8gcmV0dXJucyBuZXcgb2JqZWN0IHJlcHJlc2VudGluZyBtdWx0aXBsZSBvYmplY3RzIG1lcmdlZCB0b2dldGhlclxuICAgICAgLy8gb3B0aW9uYWwgZmluYWwgYXJndW1lbnQgaXMgYm9vbGVhbiB3aGljaCBzcGVjaWZpZXMgaWYgbWVyZ2UgaXMgcmVjdXJzaXZlXG4gICAgICAvLyBvcmlnaW5hbCBvYmplY3RzIGFyZSB1bm1vZGlmaWVkXG4gICAgICAvL1xuICAgICAgLy8gdXNhZ2U6XG4gICAgICAvLyAgIHZhciBiYXNlID0ge2E6MiwgYjo2fTtcbiAgICAgIC8vICAgdmFyIGV4dHJhID0ge2I6MywgYzo0fTtcbiAgICAgIC8vICAgbWVyZ2UoYmFzZSwgZXh0cmEpOyAvL3thOjIsIGI6MywgYzo0fVxuICAgICAgLy8gICBiYXNlOyAvL3thOjIsIGI6Nn1cbiAgICAgIC8vXG4gICAgICAvLyAgIHZhciBiYXNlID0ge2E6MiwgYjo2fTtcbiAgICAgIC8vICAgdmFyIGV4dHJhID0ge2I6MywgYzo0fTtcbiAgICAgIC8vICAgdmFyIGV4dHJhRXh0cmEgPSB7YTo0LCBkOjl9O1xuICAgICAgLy8gICBtZXJnZShiYXNlLCBleHRyYSwgZXh0cmFFeHRyYSk7IC8ve2E6NCwgYjozLCBjOjQuIGQ6IDl9XG4gICAgICAvLyAgIGJhc2U7IC8ve2E6MiwgYjo2fVxuICAgICAgLy9cbiAgICAgIC8vICAgdmFyIGJhc2UgPSB7YToyLCBiOntiYjo0LCBjYzo1fX07XG4gICAgICAvLyAgIHZhciBleHRyYSA9IHthOjQsIGI6e2NjOjcsIGRkOjF9fTtcbiAgICAgIC8vICAgbWVyZ2UoYmFzZSwgZXh0cmEsIHRydWUpOyAvL3thOjQsIGI6e2JiOjQsIGNjOjcsIGRkOjF9fVxuICAgICAgLy8gICBiYXNlOyAvL3thOjIsIGI6e2JiOjQsIGNjOjV9fTtcblxuICAgICAgbWVyZ2U6IGZ1bmN0aW9uKC8qb2JqMSwgb2JqMiwuLi4uZGVlcENvcHkqLykge1xuICAgICAgICAvLyB1bnBhY2tpbmcgYXJndW1lbnRzIGJ5IGhhbmQgYmVuY2htYXJrZWQgZmFzdGVyXG4gICAgICAgIHZhciBsID0gYXJndW1lbnRzLmxlbmd0aCxcbiAgICAgICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobCArIDEpO1xuXG4gICAgICAgIGlmIChsID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICBhcmdzW2kgKyAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vc3RhcnQgd2l0aCBlbXB0eSBvYmplY3Qgc28gYSBjb3B5IGlzIGNyZWF0ZWRcbiAgICAgICAgYXJnc1swXSA9IHt9O1xuXG4gICAgICAgIGlmIChhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09IHRydWUpIHtcbiAgICAgICAgICAvL2pxdWVyeSBleHRlbmQgcmVxdWlyZXMgZGVlcCBjb3B5IGFzIGZpcnN0IGFyZ1xuICAgICAgICAgIGFyZ3MucG9wKCk7XG4gICAgICAgICAgYXJncy51bnNoaWZ0KHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICQuZXh0ZW5kLmFwcGx5KHVuZGVmaW5lZCwgYXJncyk7XG4gICAgICB9LFxuXG4gICAgICAvLyB1cGRhdGVzIGJhc2UgaW4gcGxhY2UgYnkgY29weWluZyBwcm9wZXJ0aWVzIG9mIGV4dHJhIHRvIGl0XG4gICAgICAvLyBvcHRpb25hbGx5IGNsb2JiZXIgcHJvdGVjdGVkXG4gICAgICAvLyB1c2FnZTpcbiAgICAgIC8vICAgdmFyIGJhc2UgPSB7YToyLCBiOjZ9O1xuICAgICAgLy8gICB2YXIgZXh0cmEgPSB7Yzo0fTtcbiAgICAgIC8vICAgcHVzaChiYXNlLCBleHRyYSk7IC8ve2E6MiwgYjo2LCBjOjR9XG4gICAgICAvLyAgIGJhc2U7IC8ve2E6MiwgYjo2LCBjOjR9XG4gICAgICAvL1xuICAgICAgLy8gICB2YXIgYmFzZSA9IHthOjIsIGI6Nn07XG4gICAgICAvLyAgIHZhciBleHRyYSA9IHtiOiA0IGM6NH07XG4gICAgICAvLyAgIHB1c2goYmFzZSwgZXh0cmEsIHRydWUpOyAvL0Vycm9yIChcInV0aWxzLnB1c2ggYXR0ZW1wdGVkIHRvIG92ZXJ3cml0ZSAnYicgd2hpbGUgcnVubmluZyBpbiBwcm90ZWN0ZWQgbW9kZVwiKVxuICAgICAgLy8gICBiYXNlOyAvL3thOjIsIGI6Nn1cbiAgICAgIC8vXG4gICAgICAvLyBvYmplY3RzIHdpdGggdGhlIHNhbWUga2V5IHdpbGwgbWVyZ2UgcmVjdXJzaXZlbHkgd2hlbiBwcm90ZWN0IGlzIGZhbHNlXG4gICAgICAvLyBlZzpcbiAgICAgIC8vIHZhciBiYXNlID0ge2E6MTYsIGI6e2JiOjQsIGNjOjEwfX07XG4gICAgICAvLyB2YXIgZXh0cmEgPSB7Yjp7Y2M6MjUsIGRkOjE5fSwgYzo1fTtcbiAgICAgIC8vIHB1c2goYmFzZSwgZXh0cmEpOyAvL3thOjE2LCB7YmI6NCwgY2M6MjUsIGRkOjE5fSwgYzo1fVxuICAgICAgLy9cbiAgICAgIHB1c2g6IGZ1bmN0aW9uKGJhc2UsIGV4dHJhLCBwcm90ZWN0KSB7XG4gICAgICAgIGlmIChiYXNlKSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMoZXh0cmEgfHwge30pLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgICAgICBpZiAoYmFzZVtrZXldICYmIHByb3RlY3QpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1dGlscy5wdXNoIGF0dGVtcHRlZCB0byBvdmVyd3JpdGUgXCInICsga2V5ICsgJ1wiIHdoaWxlIHJ1bm5pbmcgaW4gcHJvdGVjdGVkIG1vZGUnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBiYXNlW2tleV0gPT0gJ29iamVjdCcgJiYgdHlwZW9mIGV4dHJhW2tleV0gPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgLy8gcmVjdXJzZVxuICAgICAgICAgICAgICB0aGlzLnB1c2goYmFzZVtrZXldLCBleHRyYVtrZXldKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIG5vIHByb3RlY3QsIHNvIGV4dHJhIHdpbnNcbiAgICAgICAgICAgICAgYmFzZVtrZXldID0gZXh0cmFba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBiYXNlO1xuICAgICAgfSxcblxuICAgICAgLy8gSWYgb2JqLmtleSBwb2ludHMgdG8gYW4gZW51bWVyYWJsZSBwcm9wZXJ0eSwgcmV0dXJuIGl0cyB2YWx1ZVxuICAgICAgLy8gSWYgb2JqLmtleSBwb2ludHMgdG8gYSBub24tZW51bWVyYWJsZSBwcm9wZXJ0eSwgcmV0dXJuIHVuZGVmaW5lZFxuICAgICAgZ2V0RW51bWVyYWJsZVByb3BlcnR5OiBmdW5jdGlvbihvYmosIGtleSkge1xuICAgICAgICByZXR1cm4gb2JqLnByb3BlcnR5SXNFbnVtZXJhYmxlKGtleSkgPyBvYmpba2V5XSA6IHVuZGVmaW5lZDtcbiAgICAgIH0sXG5cbiAgICAgIC8vIGJ1aWxkIGEgZnVuY3Rpb24gZnJvbSBvdGhlciBmdW5jdGlvbihzKVxuICAgICAgLy8gdXRpbHMuY29tcG9zZShhLGIsYykgLT4gYShiKGMoKSkpO1xuICAgICAgLy8gaW1wbGVtZW50YXRpb24gbGlmdGVkIGZyb20gdW5kZXJzY29yZS5qcyAoYykgMjAwOS0yMDEyIEplcmVteSBBc2hrZW5hc1xuICAgICAgY29tcG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBmdW5jcyA9IGFyZ3VtZW50cztcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG5cbiAgICAgICAgICBmb3IgKHZhciBpID0gZnVuY3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgIGFyZ3MgPSBbZnVuY3NbaV0uYXBwbHkodGhpcywgYXJncyldO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBhcmdzWzBdO1xuICAgICAgICB9O1xuICAgICAgfSxcblxuICAgICAgLy8gQ2FuIG9ubHkgdW5pcXVlIGFycmF5cyBvZiBob21vZ2VuZW91cyBwcmltaXRpdmVzLCBlLmcuIGFuIGFycmF5IG9mIG9ubHkgc3RyaW5ncywgYW4gYXJyYXkgb2Ygb25seSBib29sZWFucywgb3IgYW4gYXJyYXkgb2Ygb25seSBudW1lcmljc1xuICAgICAgdW5pcXVlQXJyYXk6IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgICAgIHZhciB1ID0ge30sIGEgPSBbXTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGFycmF5Lmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgICAgICAgIGlmICh1Lmhhc093blByb3BlcnR5KGFycmF5W2ldKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYS5wdXNoKGFycmF5W2ldKTtcbiAgICAgICAgICB1W2FycmF5W2ldXSA9IDE7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYTtcbiAgICAgIH0sXG5cbiAgICAgIGRlYm91bmNlOiBmdW5jdGlvbihmdW5jLCB3YWl0LCBpbW1lZGlhdGUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB3YWl0ICE9ICdudW1iZXInKSB7XG4gICAgICAgICAgd2FpdCA9IERFRkFVTFRfSU5URVJWQUw7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdGltZW91dCwgcmVzdWx0O1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgY29udGV4dCA9IHRoaXMsIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICAgICAgdmFyIGxhdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgICAgIGlmICghaW1tZWRpYXRlKSB7XG4gICAgICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgICB2YXIgY2FsbE5vdyA9IGltbWVkaWF0ZSAmJiAhdGltZW91dDtcblxuICAgICAgICAgIHRpbWVvdXQgJiYgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0KTtcblxuICAgICAgICAgIGlmIChjYWxsTm93KSB7XG4gICAgICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH07XG4gICAgICB9LFxuXG4gICAgICB0aHJvdHRsZTogZnVuY3Rpb24oZnVuYywgd2FpdCkge1xuICAgICAgICBpZiAodHlwZW9mIHdhaXQgIT0gJ251bWJlcicpIHtcbiAgICAgICAgICB3YWl0ID0gREVGQVVMVF9JTlRFUlZBTDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjb250ZXh0LCBhcmdzLCB0aW1lb3V0LCB0aHJvdHRsaW5nLCBtb3JlLCByZXN1bHQ7XG4gICAgICAgIHZhciB3aGVuRG9uZSA9IHRoaXMuZGVib3VuY2UoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgbW9yZSA9IHRocm90dGxpbmcgPSBmYWxzZTtcbiAgICAgICAgfSwgd2FpdCk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNvbnRleHQgPSB0aGlzOyBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgICAgIHZhciBsYXRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICBpZiAobW9yZSkge1xuICAgICAgICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hlbkRvbmUoKTtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgaWYgKCF0aW1lb3V0KSB7XG4gICAgICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHRocm90dGxpbmcpIHtcbiAgICAgICAgICAgIG1vcmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdHRsaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgd2hlbkRvbmUoKTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9O1xuICAgICAgfSxcblxuICAgICAgY291bnRUaGVuOiBmdW5jdGlvbihudW0sIGJhc2UpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGlmICghLS1udW0pIHsgcmV0dXJuIGJhc2UuYXBwbHkodGhpcywgYXJndW1lbnRzKTsgfVxuICAgICAgICB9O1xuICAgICAgfSxcblxuICAgICAgZGVsZWdhdGU6IGZ1bmN0aW9uKHJ1bGVzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbihlLCBkYXRhKSB7XG4gICAgICAgICAgdmFyIHRhcmdldCA9ICQoZS50YXJnZXQpLCBwYXJlbnQ7XG5cbiAgICAgICAgICBPYmplY3Qua2V5cyhydWxlcykuZm9yRWFjaChmdW5jdGlvbihzZWxlY3Rvcikge1xuICAgICAgICAgICAgaWYgKCFlLmlzUHJvcGFnYXRpb25TdG9wcGVkKCkgJiYgKHBhcmVudCA9IHRhcmdldC5jbG9zZXN0KHNlbGVjdG9yKSkubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGRhdGEgPSBkYXRhIHx8IHt9O1xuICAgICAgICAgICAgICBlLmN1cnJlbnRUYXJnZXQgPSBkYXRhLmVsID0gcGFyZW50WzBdO1xuICAgICAgICAgICAgICByZXR1cm4gcnVsZXNbc2VsZWN0b3JdLmFwcGx5KHRoaXMsIFtlLCBkYXRhXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIH07XG4gICAgICB9LFxuXG4gICAgICAvLyBlbnN1cmVzIHRoYXQgYSBmdW5jdGlvbiB3aWxsIG9ubHkgYmUgY2FsbGVkIG9uY2UuXG4gICAgICAvLyB1c2FnZTpcbiAgICAgIC8vIHdpbGwgb25seSBjcmVhdGUgdGhlIGFwcGxpY2F0aW9uIG9uY2VcbiAgICAgIC8vICAgdmFyIGluaXRpYWxpemUgPSB1dGlscy5vbmNlKGNyZWF0ZUFwcGxpY2F0aW9uKVxuICAgICAgLy8gICAgIGluaXRpYWxpemUoKTtcbiAgICAgIC8vICAgICBpbml0aWFsaXplKCk7XG4gICAgICAvL1xuICAgICAgLy8gd2lsbCBvbmx5IGRlbGV0ZSBhIHJlY29yZCBvbmNlXG4gICAgICAvLyAgIHZhciBteUhhbmxkZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAvLyAgICAgJC5hamF4KHt0eXBlOiAnREVMRVRFJywgdXJsOiAnc29tZXVybC5jb20nLCBkYXRhOiB7aWQ6IDF9fSk7XG4gICAgICAvLyAgIH07XG4gICAgICAvLyAgIHRoaXMub24oJ2NsaWNrJywgdXRpbHMub25jZShteUhhbmRsZXIpKTtcbiAgICAgIC8vXG4gICAgICBvbmNlOiBmdW5jdGlvbihmdW5jKSB7XG4gICAgICAgIHZhciByYW4sIHJlc3VsdDtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKHJhbikge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByYW4gPSB0cnVlO1xuICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH07XG4gICAgICB9LFxuXG4gICAgICBwcm9wZXJ0eVdyaXRhYmlsaXR5OiBmdW5jdGlvbihvYmosIHByb3AsIHdyaXRhYmxlKSB7XG4gICAgICAgIGlmIChjYW5Xcml0ZVByb3RlY3QoKSAmJiBvYmouaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBwcm9wLCB7IHdyaXRhYmxlOiB3cml0YWJsZSB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLy8gUHJvcGVydHkgbG9ja2luZy91bmxvY2tpbmdcbiAgICAgIG11dGF0ZVByb3BlcnR5OiBmdW5jdGlvbihvYmosIHByb3AsIG9wKSB7XG4gICAgICAgIHZhciB3cml0YWJsZTtcblxuICAgICAgICBpZiAoIWNhbldyaXRlUHJvdGVjdCgpIHx8ICFvYmouaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICBvcC5jYWxsKG9iaik7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgd3JpdGFibGUgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iaiwgcHJvcCkud3JpdGFibGU7XG5cbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgcHJvcCwgeyB3cml0YWJsZTogdHJ1ZSB9KTtcbiAgICAgICAgb3AuY2FsbChvYmopO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBwcm9wLCB7IHdyaXRhYmxlOiB3cml0YWJsZSB9KTtcblxuICAgICAgfVxuXG4gICAgfTtcblxuICAgIHJldHVybiB1dGlscztcbiAgfS5hcHBseShleHBvcnRzLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fKSwgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18gIT09IHVuZGVmaW5lZCAmJiAobW9kdWxlLmV4cG9ydHMgPSBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXykpO1xuXG5cbi8qKiovIH0sXG4vKiA4ICovXG4vKioqLyBmdW5jdGlvbihtb2R1bGUsIGV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pIHtcblxudmFyIF9fV0VCUEFDS19BTURfREVGSU5FX0FSUkFZX18sIF9fV0VCUEFDS19BTURfREVGSU5FX1JFU1VMVF9fOy8qIENvcHlyaWdodCAyMDEzIFR3aXR0ZXIsIEluYy4gTGljZW5zZWQgdW5kZXIgVGhlIE1JVCBMaWNlbnNlLiBodHRwOi8vb3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUICovXG5cbiEoX19XRUJQQUNLX0FNRF9ERUZJTkVfQVJSQVlfXyA9IFtcbiAgICBfX3dlYnBhY2tfcmVxdWlyZV9fKDcpLFxuICAgIF9fd2VicGFja19yZXF1aXJlX18oNiksXG4gICAgX193ZWJwYWNrX3JlcXVpcmVfXyg0KVxuICBdLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXyA9IGZ1bmN0aW9uKHV0aWxzLCByZWdpc3RyeSwgZGVidWcpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvLyBjb21tb24gbWl4aW4gYWxsb2NhdGVzIGJhc2ljIGZ1bmN0aW9uYWxpdHkgLSB1c2VkIGJ5IGFsbCBjb21wb25lbnQgcHJvdG90eXBlc1xuICAgIC8vIGNhbGxiYWNrIGNvbnRleHQgaXMgYm91bmQgdG8gY29tcG9uZW50XG4gICAgdmFyIGNvbXBvbmVudElkID0gMDtcblxuICAgIGZ1bmN0aW9uIHRlYXJkb3duSW5zdGFuY2UoaW5zdGFuY2VJbmZvKSB7XG4gICAgICBpbnN0YW5jZUluZm8uZXZlbnRzLnNsaWNlKCkuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgICAgICB2YXIgYXJncyA9IFtldmVudC50eXBlXTtcblxuICAgICAgICBldmVudC5lbGVtZW50ICYmIGFyZ3MudW5zaGlmdChldmVudC5lbGVtZW50KTtcbiAgICAgICAgKHR5cGVvZiBldmVudC5jYWxsYmFjayA9PSAnZnVuY3Rpb24nKSAmJiBhcmdzLnB1c2goZXZlbnQuY2FsbGJhY2spO1xuXG4gICAgICAgIHRoaXMub2ZmLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgfSwgaW5zdGFuY2VJbmZvLmluc3RhbmNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjaGVja1NlcmlhbGl6YWJsZSh0eXBlLCBkYXRhKSB7XG4gICAgICB0cnkge1xuICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2UoZGF0YSwgJyonKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgZGVidWcud2Fybi5jYWxsKHRoaXMsIFtcbiAgICAgICAgICAnRXZlbnQgXCInLCB0eXBlLCAnXCIgd2FzIHRyaWdnZXJlZCB3aXRoIG5vbi1zZXJpYWxpemFibGUgZGF0YS4gJyxcbiAgICAgICAgICAnRmxpZ2h0IHJlY29tbWVuZHMgeW91IGF2b2lkIHBhc3Npbmcgbm9uLXNlcmlhbGl6YWJsZSBkYXRhIGluIGV2ZW50cy4nXG4gICAgICAgIF0uam9pbignJykpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHdhcm5BYm91dFJlZmVyZW5jZVR5cGUoa2V5KSB7XG4gICAgICBkZWJ1Zy53YXJuLmNhbGwodGhpcywgW1xuICAgICAgICAnQXR0cmlidXRlIFwiJywga2V5LCAnXCIgZGVmYXVsdHMgdG8gYW4gYXJyYXkgb3Igb2JqZWN0LiAnLFxuICAgICAgICAnRW5jbG9zZSB0aGlzIGluIGEgZnVuY3Rpb24gdG8gYXZvaWQgc2hhcmluZyBiZXR3ZWVuIGNvbXBvbmVudCBpbnN0YW5jZXMuJ1xuICAgICAgXS5qb2luKCcnKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5pdEF0dHJpYnV0ZXMoYXR0cnMpIHtcbiAgICAgIHZhciBkZWZpbmVkS2V5cyA9IFtdLCBpbmNvbWluZ0tleXM7XG5cbiAgICAgIHRoaXMuYXR0ciA9IG5ldyB0aGlzLmF0dHJEZWY7XG5cbiAgICAgIGlmIChkZWJ1Zy5lbmFibGVkICYmIHdpbmRvdy5jb25zb2xlKSB7XG4gICAgICAgIGZvciAodmFyIGtleSBpbiB0aGlzLmF0dHJEZWYucHJvdG90eXBlKSB7XG4gICAgICAgICAgZGVmaW5lZEtleXMucHVzaChrZXkpO1xuICAgICAgICB9XG4gICAgICAgIGluY29taW5nS2V5cyA9IE9iamVjdC5rZXlzKGF0dHJzKTtcblxuICAgICAgICBmb3IgKHZhciBpID0gaW5jb21pbmdLZXlzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgaWYgKGRlZmluZWRLZXlzLmluZGV4T2YoaW5jb21pbmdLZXlzW2ldKSA9PSAtMSkge1xuICAgICAgICAgICAgZGVidWcud2Fybi5jYWxsKHRoaXMsICdQYXNzZWQgdW51c2VkIGF0dHJpYnV0ZSBcIicgKyBpbmNvbWluZ0tleXNbaV0gKyAnXCIuJyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMuYXR0ckRlZi5wcm90b3R5cGUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBhdHRyc1trZXldID09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgaWYgKHRoaXMuYXR0cltrZXldID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlcXVpcmVkIGF0dHJpYnV0ZSBcIicgKyBrZXkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdcIiBub3Qgc3BlY2lmaWVkIGluIGF0dGFjaFRvIGZvciBjb21wb25lbnQgXCInICsgdGhpcy50b1N0cmluZygpICsgJ1wiLicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBXYXJuIGFib3V0IHJlZmVyZW5jZSB0eXBlcyBpbiBhdHRyaWJ1dGVzXG4gICAgICAgICAgaWYgKGRlYnVnLmVuYWJsZWQgJiYgdHlwZW9mIHRoaXMuYXR0cltrZXldID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgd2FybkFib3V0UmVmZXJlbmNlVHlwZS5jYWxsKHRoaXMsIGtleSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuYXR0cltrZXldID0gYXR0cnNba2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5hdHRyW2tleV0gPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRoaXMuYXR0cltrZXldID0gdGhpcy5hdHRyW2tleV0uY2FsbCh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW5pdERlcHJlY2F0ZWRBdHRyaWJ1dGVzKGF0dHJzKSB7XG4gICAgICAvLyBtZXJnZSBkZWZhdWx0cyB3aXRoIHN1cHBsaWVkIG9wdGlvbnNcbiAgICAgIC8vIHB1dCBvcHRpb25zIGluIGF0dHIuX19wcm90b19fIHRvIGF2b2lkIG1lcmdlIG92ZXJoZWFkXG4gICAgICB2YXIgYXR0ciA9IE9iamVjdC5jcmVhdGUoYXR0cnMpO1xuXG4gICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5kZWZhdWx0cykge1xuICAgICAgICBpZiAoIWF0dHJzLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICBhdHRyW2tleV0gPSB0aGlzLmRlZmF1bHRzW2tleV07XG4gICAgICAgICAgLy8gV2FybiBhYm91dCByZWZlcmVuY2UgdHlwZXMgaW4gZGVmYXVsdEF0dHJzXG4gICAgICAgICAgaWYgKGRlYnVnLmVuYWJsZWQgJiYgdHlwZW9mIHRoaXMuZGVmYXVsdHNba2V5XSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHdhcm5BYm91dFJlZmVyZW5jZVR5cGUuY2FsbCh0aGlzLCBrZXkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLmF0dHIgPSBhdHRyO1xuXG4gICAgICBPYmplY3Qua2V5cyh0aGlzLmRlZmF1bHRzIHx8IHt9KS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICBpZiAodGhpcy5kZWZhdWx0c1trZXldID09PSBudWxsICYmIHRoaXMuYXR0cltrZXldID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdSZXF1aXJlZCBhdHRyaWJ1dGUgXCInICsga2V5ICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJ1wiIG5vdCBzcGVjaWZpZWQgaW4gYXR0YWNoVG8gZm9yIGNvbXBvbmVudCBcIicgKyB0aGlzLnRvU3RyaW5nKCkgKyAnXCIuJyk7XG4gICAgICAgIH1cbiAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByb3h5RXZlbnRUbyh0YXJnZXRFdmVudCkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKGUsIGRhdGEpIHtcbiAgICAgICAgJChlLnRhcmdldCkudHJpZ2dlcih0YXJnZXRFdmVudCwgZGF0YSk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHdpdGhCYXNlKCkge1xuXG4gICAgICAvLyBkZWxlZ2F0ZSB0cmlnZ2VyLCBiaW5kIGFuZCB1bmJpbmQgdG8gYW4gZWxlbWVudFxuICAgICAgLy8gaWYgJGVsZW1lbnQgbm90IHN1cHBsaWVkLCB1c2UgY29tcG9uZW50J3Mgbm9kZVxuICAgICAgLy8gb3RoZXIgYXJndW1lbnRzIGFyZSBwYXNzZWQgb25cbiAgICAgIC8vIGV2ZW50IGNhbiBiZSBlaXRoZXIgYSBzdHJpbmcgc3BlY2lmeWluZyB0aGUgdHlwZVxuICAgICAgLy8gb2YgdGhlIGV2ZW50LCBvciBhIGhhc2ggc3BlY2lmeWluZyBib3RoIHRoZSB0eXBlXG4gICAgICAvLyBhbmQgYSBkZWZhdWx0IGZ1bmN0aW9uIHRvIGJlIGNhbGxlZC5cbiAgICAgIHRoaXMudHJpZ2dlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgJGVsZW1lbnQsIHR5cGUsIGRhdGEsIGV2ZW50LCBkZWZhdWx0Rm47XG4gICAgICAgIHZhciBsYXN0SW5kZXggPSBhcmd1bWVudHMubGVuZ3RoIC0gMSwgbGFzdEFyZyA9IGFyZ3VtZW50c1tsYXN0SW5kZXhdO1xuXG4gICAgICAgIGlmICh0eXBlb2YgbGFzdEFyZyAhPSAnc3RyaW5nJyAmJiAhKGxhc3RBcmcgJiYgbGFzdEFyZy5kZWZhdWx0QmVoYXZpb3IpKSB7XG4gICAgICAgICAgbGFzdEluZGV4LS07XG4gICAgICAgICAgZGF0YSA9IGxhc3RBcmc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGFzdEluZGV4ID09IDEpIHtcbiAgICAgICAgICAkZWxlbWVudCA9ICQoYXJndW1lbnRzWzBdKTtcbiAgICAgICAgICBldmVudCA9IGFyZ3VtZW50c1sxXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAkZWxlbWVudCA9IHRoaXMuJG5vZGU7XG4gICAgICAgICAgZXZlbnQgPSBhcmd1bWVudHNbMF07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXZlbnQuZGVmYXVsdEJlaGF2aW9yKSB7XG4gICAgICAgICAgZGVmYXVsdEZuID0gZXZlbnQuZGVmYXVsdEJlaGF2aW9yO1xuICAgICAgICAgIGV2ZW50ID0gJC5FdmVudChldmVudC50eXBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHR5cGUgPSBldmVudC50eXBlIHx8IGV2ZW50O1xuXG4gICAgICAgIGlmIChkZWJ1Zy5lbmFibGVkICYmIHdpbmRvdy5wb3N0TWVzc2FnZSkge1xuICAgICAgICAgIGNoZWNrU2VyaWFsaXphYmxlLmNhbGwodGhpcywgdHlwZSwgZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIHRoaXMuYXR0ci5ldmVudERhdGEgPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBkYXRhID0gJC5leHRlbmQodHJ1ZSwge30sIHRoaXMuYXR0ci5ldmVudERhdGEsIGRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgJGVsZW1lbnQudHJpZ2dlcigoZXZlbnQgfHwgdHlwZSksIGRhdGEpO1xuXG4gICAgICAgIGlmIChkZWZhdWx0Rm4gJiYgIWV2ZW50LmlzRGVmYXVsdFByZXZlbnRlZCgpKSB7XG4gICAgICAgICAgKHRoaXNbZGVmYXVsdEZuXSB8fCBkZWZhdWx0Rm4pLmNhbGwodGhpcywgZXZlbnQsIGRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICRlbGVtZW50O1xuICAgICAgfTtcblxuXG4gICAgICB0aGlzLm9uID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciAkZWxlbWVudCwgdHlwZSwgY2FsbGJhY2ssIG9yaWdpbmFsQ2I7XG4gICAgICAgIHZhciBsYXN0SW5kZXggPSBhcmd1bWVudHMubGVuZ3RoIC0gMSwgb3JpZ2luID0gYXJndW1lbnRzW2xhc3RJbmRleF07XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcmlnaW4gPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAvL2RlbGVnYXRlIGNhbGxiYWNrXG4gICAgICAgICAgb3JpZ2luYWxDYiA9IHV0aWxzLmRlbGVnYXRlKFxuICAgICAgICAgICAgdGhpcy5yZXNvbHZlRGVsZWdhdGVSdWxlcyhvcmlnaW4pXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb3JpZ2luID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgb3JpZ2luYWxDYiA9IHByb3h5RXZlbnRUbyhvcmlnaW4pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9yaWdpbmFsQ2IgPSBvcmlnaW47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGFzdEluZGV4ID09IDIpIHtcbiAgICAgICAgICAkZWxlbWVudCA9ICQoYXJndW1lbnRzWzBdKTtcbiAgICAgICAgICB0eXBlID0gYXJndW1lbnRzWzFdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICRlbGVtZW50ID0gdGhpcy4kbm9kZTtcbiAgICAgICAgICB0eXBlID0gYXJndW1lbnRzWzBdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBvcmlnaW5hbENiICE9ICdmdW5jdGlvbicgJiYgdHlwZW9mIG9yaWdpbmFsQ2IgIT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byBiaW5kIHRvIFwiJyArIHR5cGUgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnXCIgYmVjYXVzZSB0aGUgZ2l2ZW4gY2FsbGJhY2sgaXMgbm90IGEgZnVuY3Rpb24gb3IgYW4gb2JqZWN0Jyk7XG4gICAgICAgIH1cblxuICAgICAgICBjYWxsYmFjayA9IG9yaWdpbmFsQ2IuYmluZCh0aGlzKTtcbiAgICAgICAgY2FsbGJhY2sudGFyZ2V0ID0gb3JpZ2luYWxDYjtcbiAgICAgICAgY2FsbGJhY2suY29udGV4dCA9IHRoaXM7XG5cbiAgICAgICAgJGVsZW1lbnQub24odHlwZSwgY2FsbGJhY2spO1xuXG4gICAgICAgIC8vIHN0b3JlIGV2ZXJ5IGJvdW5kIHZlcnNpb24gb2YgdGhlIGNhbGxiYWNrXG4gICAgICAgIG9yaWdpbmFsQ2IuYm91bmQgfHwgKG9yaWdpbmFsQ2IuYm91bmQgPSBbXSk7XG4gICAgICAgIG9yaWdpbmFsQ2IuYm91bmQucHVzaChjYWxsYmFjayk7XG5cbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrO1xuICAgICAgfTtcblxuICAgICAgdGhpcy5vZmYgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyICRlbGVtZW50LCB0eXBlLCBjYWxsYmFjaztcbiAgICAgICAgdmFyIGxhc3RJbmRleCA9IGFyZ3VtZW50cy5sZW5ndGggLSAxO1xuXG4gICAgICAgIGlmICh0eXBlb2YgYXJndW1lbnRzW2xhc3RJbmRleF0gPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGNhbGxiYWNrID0gYXJndW1lbnRzW2xhc3RJbmRleF07XG4gICAgICAgICAgbGFzdEluZGV4IC09IDE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGFzdEluZGV4ID09IDEpIHtcbiAgICAgICAgICAkZWxlbWVudCA9ICQoYXJndW1lbnRzWzBdKTtcbiAgICAgICAgICB0eXBlID0gYXJndW1lbnRzWzFdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICRlbGVtZW50ID0gdGhpcy4kbm9kZTtcbiAgICAgICAgICB0eXBlID0gYXJndW1lbnRzWzBdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgLy90aGlzIGNhbGxiYWNrIG1heSBiZSB0aGUgb3JpZ2luYWwgZnVuY3Rpb24gb3IgYSBib3VuZCB2ZXJzaW9uXG4gICAgICAgICAgdmFyIGJvdW5kRnVuY3Rpb25zID0gY2FsbGJhY2sudGFyZ2V0ID8gY2FsbGJhY2sudGFyZ2V0LmJvdW5kIDogY2FsbGJhY2suYm91bmQgfHwgW107XG4gICAgICAgICAgLy9zZXQgY2FsbGJhY2sgdG8gdmVyc2lvbiBib3VuZCBhZ2FpbnN0IHRoaXMgaW5zdGFuY2VcbiAgICAgICAgICBib3VuZEZ1bmN0aW9ucyAmJiBib3VuZEZ1bmN0aW9ucy5zb21lKGZ1bmN0aW9uKGZuLCBpLCBhcnIpIHtcbiAgICAgICAgICAgIGlmIChmbi5jb250ZXh0ICYmICh0aGlzLmlkZW50aXR5ID09IGZuLmNvbnRleHQuaWRlbnRpdHkpKSB7XG4gICAgICAgICAgICAgIGFyci5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgIGNhbGxiYWNrID0gZm47XG4gICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICAgICRlbGVtZW50Lm9mZih0eXBlLCBjYWxsYmFjayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gTG9vcCB0aHJvdWdoIHRoZSBldmVudHMgb2YgYHRoaXNgIGluc3RhbmNlXG4gICAgICAgICAgLy8gYW5kIHVuYmluZCB1c2luZyB0aGUgY2FsbGJhY2tcbiAgICAgICAgICByZWdpc3RyeS5maW5kSW5zdGFuY2VJbmZvKHRoaXMpLmV2ZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgaWYgKHR5cGUgPT0gZXZlbnQudHlwZSkge1xuICAgICAgICAgICAgICAkZWxlbWVudC5vZmYodHlwZSwgZXZlbnQuY2FsbGJhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICRlbGVtZW50O1xuICAgICAgfTtcblxuICAgICAgdGhpcy5yZXNvbHZlRGVsZWdhdGVSdWxlcyA9IGZ1bmN0aW9uKHJ1bGVJbmZvKSB7XG4gICAgICAgIHZhciBydWxlcyA9IHt9O1xuXG4gICAgICAgIE9iamVjdC5rZXlzKHJ1bGVJbmZvKS5mb3JFYWNoKGZ1bmN0aW9uKHIpIHtcbiAgICAgICAgICBpZiAoIShyIGluIHRoaXMuYXR0cikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ29tcG9uZW50IFwiJyArIHRoaXMudG9TdHJpbmcoKSArICdcIiB3YW50cyB0byBsaXN0ZW4gb24gXCInICsgciArICdcIiBidXQgbm8gc3VjaCBhdHRyaWJ1dGUgd2FzIGRlZmluZWQuJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJ1bGVzW3RoaXMuYXR0cltyXV0gPSAodHlwZW9mIHJ1bGVJbmZvW3JdID09ICdzdHJpbmcnKSA/IHByb3h5RXZlbnRUbyhydWxlSW5mb1tyXSkgOiBydWxlSW5mb1tyXTtcbiAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgcmV0dXJuIHJ1bGVzO1xuICAgICAgfTtcblxuICAgICAgdGhpcy5zZWxlY3QgPSBmdW5jdGlvbihhdHRyaWJ1dGVLZXkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJG5vZGUuZmluZCh0aGlzLmF0dHJbYXR0cmlidXRlS2V5XSk7XG4gICAgICB9O1xuXG4gICAgICAvLyBOZXctc3R5bGUgYXR0cmlidXRlc1xuXG4gICAgICB0aGlzLmF0dHJpYnV0ZXMgPSBmdW5jdGlvbihhdHRycykge1xuXG4gICAgICAgIHZhciBBdHRyaWJ1dGVzID0gZnVuY3Rpb24oKSB7fTtcblxuICAgICAgICBpZiAodGhpcy5hdHRyRGVmKSB7XG4gICAgICAgICAgQXR0cmlidXRlcy5wcm90b3R5cGUgPSBuZXcgdGhpcy5hdHRyRGVmO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yICh2YXIgbmFtZSBpbiBhdHRycykge1xuICAgICAgICAgIEF0dHJpYnV0ZXMucHJvdG90eXBlW25hbWVdID0gYXR0cnNbbmFtZV07XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmF0dHJEZWYgPSBBdHRyaWJ1dGVzO1xuICAgICAgfTtcblxuICAgICAgLy8gRGVwcmVjYXRlZCBhdHRyaWJ1dGVzXG5cbiAgICAgIHRoaXMuZGVmYXVsdEF0dHJzID0gZnVuY3Rpb24oZGVmYXVsdHMpIHtcbiAgICAgICAgdXRpbHMucHVzaCh0aGlzLmRlZmF1bHRzLCBkZWZhdWx0cywgdHJ1ZSkgfHwgKHRoaXMuZGVmYXVsdHMgPSBkZWZhdWx0cyk7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLmluaXRpYWxpemUgPSBmdW5jdGlvbihub2RlLCBhdHRycykge1xuICAgICAgICBhdHRycyA9IGF0dHJzIHx8IHt9O1xuICAgICAgICB0aGlzLmlkZW50aXR5IHx8ICh0aGlzLmlkZW50aXR5ID0gY29tcG9uZW50SWQrKyk7XG5cbiAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb21wb25lbnQgbmVlZHMgYSBub2RlJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5qcXVlcnkpIHtcbiAgICAgICAgICB0aGlzLm5vZGUgPSBub2RlWzBdO1xuICAgICAgICAgIHRoaXMuJG5vZGUgPSBub2RlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMubm9kZSA9IG5vZGU7XG4gICAgICAgICAgdGhpcy4kbm9kZSA9ICQobm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5hdHRyRGVmKSB7XG4gICAgICAgICAgaW5pdEF0dHJpYnV0ZXMuY2FsbCh0aGlzLCBhdHRycyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaW5pdERlcHJlY2F0ZWRBdHRyaWJ1dGVzLmNhbGwodGhpcywgYXR0cnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLnRlYXJkb3duID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRlYXJkb3duSW5zdGFuY2UocmVnaXN0cnkuZmluZEluc3RhbmNlSW5mbyh0aGlzKSk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiB3aXRoQmFzZTtcbiAgfS5hcHBseShleHBvcnRzLCBfX1dFQlBBQ0tfQU1EX0RFRklORV9BUlJBWV9fKSwgX19XRUJQQUNLX0FNRF9ERUZJTkVfUkVTVUxUX18gIT09IHVuZGVmaW5lZCAmJiAobW9kdWxlLmV4cG9ydHMgPSBfX1dFQlBBQ0tfQU1EX0RFRklORV9SRVNVTFRfXykpO1xuXG5cbi8qKiovIH1cbi8qKioqKiovIF0pXG59KTtcbiIsIi8qXG4gKiAgQ29weXJpZ2h0IDIwMTEgVHdpdHRlciwgSW5jLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiAgeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiAgVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqICBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqICBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiAgbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuKGZ1bmN0aW9uIChIb2dhbikge1xuICAvLyBTZXR1cCByZWdleCAgYXNzaWdubWVudHNcbiAgLy8gcmVtb3ZlIHdoaXRlc3BhY2UgYWNjb3JkaW5nIHRvIE11c3RhY2hlIHNwZWNcbiAgdmFyIHJJc1doaXRlc3BhY2UgPSAvXFxTLyxcbiAgICAgIHJRdW90ID0gL1xcXCIvZyxcbiAgICAgIHJOZXdsaW5lID0gIC9cXG4vZyxcbiAgICAgIHJDciA9IC9cXHIvZyxcbiAgICAgIHJTbGFzaCA9IC9cXFxcL2csXG4gICAgICByTGluZVNlcCA9IC9cXHUyMDI4LyxcbiAgICAgIHJQYXJhZ3JhcGhTZXAgPSAvXFx1MjAyOS87XG5cbiAgSG9nYW4udGFncyA9IHtcbiAgICAnIyc6IDEsICdeJzogMiwgJzwnOiAzLCAnJCc6IDQsXG4gICAgJy8nOiA1LCAnISc6IDYsICc+JzogNywgJz0nOiA4LCAnX3YnOiA5LFxuICAgICd7JzogMTAsICcmJzogMTEsICdfdCc6IDEyXG4gIH07XG5cbiAgSG9nYW4uc2NhbiA9IGZ1bmN0aW9uIHNjYW4odGV4dCwgZGVsaW1pdGVycykge1xuICAgIHZhciBsZW4gPSB0ZXh0Lmxlbmd0aCxcbiAgICAgICAgSU5fVEVYVCA9IDAsXG4gICAgICAgIElOX1RBR19UWVBFID0gMSxcbiAgICAgICAgSU5fVEFHID0gMixcbiAgICAgICAgc3RhdGUgPSBJTl9URVhULFxuICAgICAgICB0YWdUeXBlID0gbnVsbCxcbiAgICAgICAgdGFnID0gbnVsbCxcbiAgICAgICAgYnVmID0gJycsXG4gICAgICAgIHRva2VucyA9IFtdLFxuICAgICAgICBzZWVuVGFnID0gZmFsc2UsXG4gICAgICAgIGkgPSAwLFxuICAgICAgICBsaW5lU3RhcnQgPSAwLFxuICAgICAgICBvdGFnID0gJ3t7JyxcbiAgICAgICAgY3RhZyA9ICd9fSc7XG5cbiAgICBmdW5jdGlvbiBhZGRCdWYoKSB7XG4gICAgICBpZiAoYnVmLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdG9rZW5zLnB1c2goe3RhZzogJ190JywgdGV4dDogbmV3IFN0cmluZyhidWYpfSk7XG4gICAgICAgIGJ1ZiA9ICcnO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpbmVJc1doaXRlc3BhY2UoKSB7XG4gICAgICB2YXIgaXNBbGxXaGl0ZXNwYWNlID0gdHJ1ZTtcbiAgICAgIGZvciAodmFyIGogPSBsaW5lU3RhcnQ7IGogPCB0b2tlbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaXNBbGxXaGl0ZXNwYWNlID1cbiAgICAgICAgICAoSG9nYW4udGFnc1t0b2tlbnNbal0udGFnXSA8IEhvZ2FuLnRhZ3NbJ192J10pIHx8XG4gICAgICAgICAgKHRva2Vuc1tqXS50YWcgPT0gJ190JyAmJiB0b2tlbnNbal0udGV4dC5tYXRjaChySXNXaGl0ZXNwYWNlKSA9PT0gbnVsbCk7XG4gICAgICAgIGlmICghaXNBbGxXaGl0ZXNwYWNlKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBpc0FsbFdoaXRlc3BhY2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmlsdGVyTGluZShoYXZlU2VlblRhZywgbm9OZXdMaW5lKSB7XG4gICAgICBhZGRCdWYoKTtcblxuICAgICAgaWYgKGhhdmVTZWVuVGFnICYmIGxpbmVJc1doaXRlc3BhY2UoKSkge1xuICAgICAgICBmb3IgKHZhciBqID0gbGluZVN0YXJ0LCBuZXh0OyBqIDwgdG9rZW5zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgaWYgKHRva2Vuc1tqXS50ZXh0KSB7XG4gICAgICAgICAgICBpZiAoKG5leHQgPSB0b2tlbnNbaisxXSkgJiYgbmV4dC50YWcgPT0gJz4nKSB7XG4gICAgICAgICAgICAgIC8vIHNldCBpbmRlbnQgdG8gdG9rZW4gdmFsdWVcbiAgICAgICAgICAgICAgbmV4dC5pbmRlbnQgPSB0b2tlbnNbal0udGV4dC50b1N0cmluZygpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0b2tlbnMuc3BsaWNlKGosIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghbm9OZXdMaW5lKSB7XG4gICAgICAgIHRva2Vucy5wdXNoKHt0YWc6J1xcbid9KTtcbiAgICAgIH1cblxuICAgICAgc2VlblRhZyA9IGZhbHNlO1xuICAgICAgbGluZVN0YXJ0ID0gdG9rZW5zLmxlbmd0aDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjaGFuZ2VEZWxpbWl0ZXJzKHRleHQsIGluZGV4KSB7XG4gICAgICB2YXIgY2xvc2UgPSAnPScgKyBjdGFnLFxuICAgICAgICAgIGNsb3NlSW5kZXggPSB0ZXh0LmluZGV4T2YoY2xvc2UsIGluZGV4KSxcbiAgICAgICAgICBkZWxpbWl0ZXJzID0gdHJpbShcbiAgICAgICAgICAgIHRleHQuc3Vic3RyaW5nKHRleHQuaW5kZXhPZignPScsIGluZGV4KSArIDEsIGNsb3NlSW5kZXgpXG4gICAgICAgICAgKS5zcGxpdCgnICcpO1xuXG4gICAgICBvdGFnID0gZGVsaW1pdGVyc1swXTtcbiAgICAgIGN0YWcgPSBkZWxpbWl0ZXJzW2RlbGltaXRlcnMubGVuZ3RoIC0gMV07XG5cbiAgICAgIHJldHVybiBjbG9zZUluZGV4ICsgY2xvc2UubGVuZ3RoIC0gMTtcbiAgICB9XG5cbiAgICBpZiAoZGVsaW1pdGVycykge1xuICAgICAgZGVsaW1pdGVycyA9IGRlbGltaXRlcnMuc3BsaXQoJyAnKTtcbiAgICAgIG90YWcgPSBkZWxpbWl0ZXJzWzBdO1xuICAgICAgY3RhZyA9IGRlbGltaXRlcnNbMV07XG4gICAgfVxuXG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZiAoc3RhdGUgPT0gSU5fVEVYVCkge1xuICAgICAgICBpZiAodGFnQ2hhbmdlKG90YWcsIHRleHQsIGkpKSB7XG4gICAgICAgICAgLS1pO1xuICAgICAgICAgIGFkZEJ1ZigpO1xuICAgICAgICAgIHN0YXRlID0gSU5fVEFHX1RZUEU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHRleHQuY2hhckF0KGkpID09ICdcXG4nKSB7XG4gICAgICAgICAgICBmaWx0ZXJMaW5lKHNlZW5UYWcpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBidWYgKz0gdGV4dC5jaGFyQXQoaSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHN0YXRlID09IElOX1RBR19UWVBFKSB7XG4gICAgICAgIGkgKz0gb3RhZy5sZW5ndGggLSAxO1xuICAgICAgICB0YWcgPSBIb2dhbi50YWdzW3RleHQuY2hhckF0KGkgKyAxKV07XG4gICAgICAgIHRhZ1R5cGUgPSB0YWcgPyB0ZXh0LmNoYXJBdChpICsgMSkgOiAnX3YnO1xuICAgICAgICBpZiAodGFnVHlwZSA9PSAnPScpIHtcbiAgICAgICAgICBpID0gY2hhbmdlRGVsaW1pdGVycyh0ZXh0LCBpKTtcbiAgICAgICAgICBzdGF0ZSA9IElOX1RFWFQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHRhZykge1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzdGF0ZSA9IElOX1RBRztcbiAgICAgICAgfVxuICAgICAgICBzZWVuVGFnID0gaTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0YWdDaGFuZ2UoY3RhZywgdGV4dCwgaSkpIHtcbiAgICAgICAgICB0b2tlbnMucHVzaCh7dGFnOiB0YWdUeXBlLCBuOiB0cmltKGJ1ZiksIG90YWc6IG90YWcsIGN0YWc6IGN0YWcsXG4gICAgICAgICAgICAgICAgICAgICAgIGk6ICh0YWdUeXBlID09ICcvJykgPyBzZWVuVGFnIC0gb3RhZy5sZW5ndGggOiBpICsgY3RhZy5sZW5ndGh9KTtcbiAgICAgICAgICBidWYgPSAnJztcbiAgICAgICAgICBpICs9IGN0YWcubGVuZ3RoIC0gMTtcbiAgICAgICAgICBzdGF0ZSA9IElOX1RFWFQ7XG4gICAgICAgICAgaWYgKHRhZ1R5cGUgPT0gJ3snKSB7XG4gICAgICAgICAgICBpZiAoY3RhZyA9PSAnfX0nKSB7XG4gICAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNsZWFuVHJpcGxlU3RhY2hlKHRva2Vuc1t0b2tlbnMubGVuZ3RoIC0gMV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBidWYgKz0gdGV4dC5jaGFyQXQoaSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmaWx0ZXJMaW5lKHNlZW5UYWcsIHRydWUpO1xuXG4gICAgcmV0dXJuIHRva2VucztcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsZWFuVHJpcGxlU3RhY2hlKHRva2VuKSB7XG4gICAgaWYgKHRva2VuLm4uc3Vic3RyKHRva2VuLm4ubGVuZ3RoIC0gMSkgPT09ICd9Jykge1xuICAgICAgdG9rZW4ubiA9IHRva2VuLm4uc3Vic3RyaW5nKDAsIHRva2VuLm4ubGVuZ3RoIC0gMSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdHJpbShzKSB7XG4gICAgaWYgKHMudHJpbSkge1xuICAgICAgcmV0dXJuIHMudHJpbSgpO1xuICAgIH1cblxuICAgIHJldHVybiBzLnJlcGxhY2UoL15cXHMqfFxccyokL2csICcnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRhZ0NoYW5nZSh0YWcsIHRleHQsIGluZGV4KSB7XG4gICAgaWYgKHRleHQuY2hhckF0KGluZGV4KSAhPSB0YWcuY2hhckF0KDApKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDEsIGwgPSB0YWcubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBpZiAodGV4dC5jaGFyQXQoaW5kZXggKyBpKSAhPSB0YWcuY2hhckF0KGkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIHRoZSB0YWdzIGFsbG93ZWQgaW5zaWRlIHN1cGVyIHRlbXBsYXRlc1xuICB2YXIgYWxsb3dlZEluU3VwZXIgPSB7J190JzogdHJ1ZSwgJ1xcbic6IHRydWUsICckJzogdHJ1ZSwgJy8nOiB0cnVlfTtcblxuICBmdW5jdGlvbiBidWlsZFRyZWUodG9rZW5zLCBraW5kLCBzdGFjaywgY3VzdG9tVGFncykge1xuICAgIHZhciBpbnN0cnVjdGlvbnMgPSBbXSxcbiAgICAgICAgb3BlbmVyID0gbnVsbCxcbiAgICAgICAgdGFpbCA9IG51bGwsXG4gICAgICAgIHRva2VuID0gbnVsbDtcblxuICAgIHRhaWwgPSBzdGFja1tzdGFjay5sZW5ndGggLSAxXTtcblxuICAgIHdoaWxlICh0b2tlbnMubGVuZ3RoID4gMCkge1xuICAgICAgdG9rZW4gPSB0b2tlbnMuc2hpZnQoKTtcblxuICAgICAgaWYgKHRhaWwgJiYgdGFpbC50YWcgPT0gJzwnICYmICEodG9rZW4udGFnIGluIGFsbG93ZWRJblN1cGVyKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lsbGVnYWwgY29udGVudCBpbiA8IHN1cGVyIHRhZy4nKTtcbiAgICAgIH1cblxuICAgICAgaWYgKEhvZ2FuLnRhZ3NbdG9rZW4udGFnXSA8PSBIb2dhbi50YWdzWyckJ10gfHwgaXNPcGVuZXIodG9rZW4sIGN1c3RvbVRhZ3MpKSB7XG4gICAgICAgIHN0YWNrLnB1c2godG9rZW4pO1xuICAgICAgICB0b2tlbi5ub2RlcyA9IGJ1aWxkVHJlZSh0b2tlbnMsIHRva2VuLnRhZywgc3RhY2ssIGN1c3RvbVRhZ3MpO1xuICAgICAgfSBlbHNlIGlmICh0b2tlbi50YWcgPT0gJy8nKSB7XG4gICAgICAgIGlmIChzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nsb3NpbmcgdGFnIHdpdGhvdXQgb3BlbmVyOiAvJyArIHRva2VuLm4pO1xuICAgICAgICB9XG4gICAgICAgIG9wZW5lciA9IHN0YWNrLnBvcCgpO1xuICAgICAgICBpZiAodG9rZW4ubiAhPSBvcGVuZXIubiAmJiAhaXNDbG9zZXIodG9rZW4ubiwgb3BlbmVyLm4sIGN1c3RvbVRhZ3MpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdOZXN0aW5nIGVycm9yOiAnICsgb3BlbmVyLm4gKyAnIHZzLiAnICsgdG9rZW4ubik7XG4gICAgICAgIH1cbiAgICAgICAgb3BlbmVyLmVuZCA9IHRva2VuLmk7XG4gICAgICAgIHJldHVybiBpbnN0cnVjdGlvbnM7XG4gICAgICB9IGVsc2UgaWYgKHRva2VuLnRhZyA9PSAnXFxuJykge1xuICAgICAgICB0b2tlbi5sYXN0ID0gKHRva2Vucy5sZW5ndGggPT0gMCkgfHwgKHRva2Vuc1swXS50YWcgPT0gJ1xcbicpO1xuICAgICAgfVxuXG4gICAgICBpbnN0cnVjdGlvbnMucHVzaCh0b2tlbik7XG4gICAgfVxuXG4gICAgaWYgKHN0YWNrLmxlbmd0aCA+IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignbWlzc2luZyBjbG9zaW5nIHRhZzogJyArIHN0YWNrLnBvcCgpLm4pO1xuICAgIH1cblxuICAgIHJldHVybiBpbnN0cnVjdGlvbnM7XG4gIH1cblxuICBmdW5jdGlvbiBpc09wZW5lcih0b2tlbiwgdGFncykge1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGFncy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIGlmICh0YWdzW2ldLm8gPT0gdG9rZW4ubikge1xuICAgICAgICB0b2tlbi50YWcgPSAnIyc7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGlzQ2xvc2VyKGNsb3NlLCBvcGVuLCB0YWdzKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0YWdzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgaWYgKHRhZ3NbaV0uYyA9PSBjbG9zZSAmJiB0YWdzW2ldLm8gPT0gb3Blbikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBzdHJpbmdpZnlTdWJzdGl0dXRpb25zKG9iaikge1xuICAgIHZhciBpdGVtcyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGl0ZW1zLnB1c2goJ1wiJyArIGVzYyhrZXkpICsgJ1wiOiBmdW5jdGlvbihjLHAsdCxpKSB7JyArIG9ialtrZXldICsgJ30nKTtcbiAgICB9XG4gICAgcmV0dXJuIFwieyBcIiArIGl0ZW1zLmpvaW4oXCIsXCIpICsgXCIgfVwiO1xuICB9XG5cbiAgZnVuY3Rpb24gc3RyaW5naWZ5UGFydGlhbHMoY29kZU9iaikge1xuICAgIHZhciBwYXJ0aWFscyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBjb2RlT2JqLnBhcnRpYWxzKSB7XG4gICAgICBwYXJ0aWFscy5wdXNoKCdcIicgKyBlc2Moa2V5KSArICdcIjp7bmFtZTpcIicgKyBlc2MoY29kZU9iai5wYXJ0aWFsc1trZXldLm5hbWUpICsgJ1wiLCAnICsgc3RyaW5naWZ5UGFydGlhbHMoY29kZU9iai5wYXJ0aWFsc1trZXldKSArIFwifVwiKTtcbiAgICB9XG4gICAgcmV0dXJuIFwicGFydGlhbHM6IHtcIiArIHBhcnRpYWxzLmpvaW4oXCIsXCIpICsgXCJ9LCBzdWJzOiBcIiArIHN0cmluZ2lmeVN1YnN0aXR1dGlvbnMoY29kZU9iai5zdWJzKTtcbiAgfVxuXG4gIEhvZ2FuLnN0cmluZ2lmeSA9IGZ1bmN0aW9uKGNvZGVPYmosIHRleHQsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gXCJ7Y29kZTogZnVuY3Rpb24gKGMscCxpKSB7IFwiICsgSG9nYW4ud3JhcE1haW4oY29kZU9iai5jb2RlKSArIFwiIH0sXCIgKyBzdHJpbmdpZnlQYXJ0aWFscyhjb2RlT2JqKSArICBcIn1cIjtcbiAgfVxuXG4gIHZhciBzZXJpYWxObyA9IDA7XG4gIEhvZ2FuLmdlbmVyYXRlID0gZnVuY3Rpb24odHJlZSwgdGV4dCwgb3B0aW9ucykge1xuICAgIHNlcmlhbE5vID0gMDtcbiAgICB2YXIgY29udGV4dCA9IHsgY29kZTogJycsIHN1YnM6IHt9LCBwYXJ0aWFsczoge30gfTtcbiAgICBIb2dhbi53YWxrKHRyZWUsIGNvbnRleHQpO1xuXG4gICAgaWYgKG9wdGlvbnMuYXNTdHJpbmcpIHtcbiAgICAgIHJldHVybiB0aGlzLnN0cmluZ2lmeShjb250ZXh0LCB0ZXh0LCBvcHRpb25zKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5tYWtlVGVtcGxhdGUoY29udGV4dCwgdGV4dCwgb3B0aW9ucyk7XG4gIH1cblxuICBIb2dhbi53cmFwTWFpbiA9IGZ1bmN0aW9uKGNvZGUpIHtcbiAgICByZXR1cm4gJ3ZhciB0PXRoaXM7dC5iKGk9aXx8XCJcIik7JyArIGNvZGUgKyAncmV0dXJuIHQuZmwoKTsnO1xuICB9XG5cbiAgSG9nYW4udGVtcGxhdGUgPSBIb2dhbi5UZW1wbGF0ZTtcblxuICBIb2dhbi5tYWtlVGVtcGxhdGUgPSBmdW5jdGlvbihjb2RlT2JqLCB0ZXh0LCBvcHRpb25zKSB7XG4gICAgdmFyIHRlbXBsYXRlID0gdGhpcy5tYWtlUGFydGlhbHMoY29kZU9iaik7XG4gICAgdGVtcGxhdGUuY29kZSA9IG5ldyBGdW5jdGlvbignYycsICdwJywgJ2knLCB0aGlzLndyYXBNYWluKGNvZGVPYmouY29kZSkpO1xuICAgIHJldHVybiBuZXcgdGhpcy50ZW1wbGF0ZSh0ZW1wbGF0ZSwgdGV4dCwgdGhpcywgb3B0aW9ucyk7XG4gIH1cblxuICBIb2dhbi5tYWtlUGFydGlhbHMgPSBmdW5jdGlvbihjb2RlT2JqKSB7XG4gICAgdmFyIGtleSwgdGVtcGxhdGUgPSB7c3Viczoge30sIHBhcnRpYWxzOiBjb2RlT2JqLnBhcnRpYWxzLCBuYW1lOiBjb2RlT2JqLm5hbWV9O1xuICAgIGZvciAoa2V5IGluIHRlbXBsYXRlLnBhcnRpYWxzKSB7XG4gICAgICB0ZW1wbGF0ZS5wYXJ0aWFsc1trZXldID0gdGhpcy5tYWtlUGFydGlhbHModGVtcGxhdGUucGFydGlhbHNba2V5XSk7XG4gICAgfVxuICAgIGZvciAoa2V5IGluIGNvZGVPYmouc3Vicykge1xuICAgICAgdGVtcGxhdGUuc3Vic1trZXldID0gbmV3IEZ1bmN0aW9uKCdjJywgJ3AnLCAndCcsICdpJywgY29kZU9iai5zdWJzW2tleV0pO1xuICAgIH1cbiAgICByZXR1cm4gdGVtcGxhdGU7XG4gIH1cblxuICBmdW5jdGlvbiBlc2Mocykge1xuICAgIHJldHVybiBzLnJlcGxhY2UoclNsYXNoLCAnXFxcXFxcXFwnKVxuICAgICAgICAgICAgLnJlcGxhY2UoclF1b3QsICdcXFxcXFxcIicpXG4gICAgICAgICAgICAucmVwbGFjZShyTmV3bGluZSwgJ1xcXFxuJylcbiAgICAgICAgICAgIC5yZXBsYWNlKHJDciwgJ1xcXFxyJylcbiAgICAgICAgICAgIC5yZXBsYWNlKHJMaW5lU2VwLCAnXFxcXHUyMDI4JylcbiAgICAgICAgICAgIC5yZXBsYWNlKHJQYXJhZ3JhcGhTZXAsICdcXFxcdTIwMjknKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNob29zZU1ldGhvZChzKSB7XG4gICAgcmV0dXJuICh+cy5pbmRleE9mKCcuJykpID8gJ2QnIDogJ2YnO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlUGFydGlhbChub2RlLCBjb250ZXh0KSB7XG4gICAgdmFyIHByZWZpeCA9IFwiPFwiICsgKGNvbnRleHQucHJlZml4IHx8IFwiXCIpO1xuICAgIHZhciBzeW0gPSBwcmVmaXggKyBub2RlLm4gKyBzZXJpYWxObysrO1xuICAgIGNvbnRleHQucGFydGlhbHNbc3ltXSA9IHtuYW1lOiBub2RlLm4sIHBhcnRpYWxzOiB7fX07XG4gICAgY29udGV4dC5jb2RlICs9ICd0LmIodC5ycChcIicgKyAgZXNjKHN5bSkgKyAnXCIsYyxwLFwiJyArIChub2RlLmluZGVudCB8fCAnJykgKyAnXCIpKTsnO1xuICAgIHJldHVybiBzeW07XG4gIH1cblxuICBIb2dhbi5jb2RlZ2VuID0ge1xuICAgICcjJzogZnVuY3Rpb24obm9kZSwgY29udGV4dCkge1xuICAgICAgY29udGV4dC5jb2RlICs9ICdpZih0LnModC4nICsgY2hvb3NlTWV0aG9kKG5vZGUubikgKyAnKFwiJyArIGVzYyhub2RlLm4pICsgJ1wiLGMscCwxKSwnICtcbiAgICAgICAgICAgICAgICAgICAgICAnYyxwLDAsJyArIG5vZGUuaSArICcsJyArIG5vZGUuZW5kICsgJyxcIicgKyBub2RlLm90YWcgKyBcIiBcIiArIG5vZGUuY3RhZyArICdcIikpeycgK1xuICAgICAgICAgICAgICAgICAgICAgICd0LnJzKGMscCwnICsgJ2Z1bmN0aW9uKGMscCx0KXsnO1xuICAgICAgSG9nYW4ud2Fsayhub2RlLm5vZGVzLCBjb250ZXh0KTtcbiAgICAgIGNvbnRleHQuY29kZSArPSAnfSk7Yy5wb3AoKTt9JztcbiAgICB9LFxuXG4gICAgJ14nOiBmdW5jdGlvbihub2RlLCBjb250ZXh0KSB7XG4gICAgICBjb250ZXh0LmNvZGUgKz0gJ2lmKCF0LnModC4nICsgY2hvb3NlTWV0aG9kKG5vZGUubikgKyAnKFwiJyArIGVzYyhub2RlLm4pICsgJ1wiLGMscCwxKSxjLHAsMSwwLDAsXCJcIikpeyc7XG4gICAgICBIb2dhbi53YWxrKG5vZGUubm9kZXMsIGNvbnRleHQpO1xuICAgICAgY29udGV4dC5jb2RlICs9ICd9Oyc7XG4gICAgfSxcblxuICAgICc+JzogY3JlYXRlUGFydGlhbCxcbiAgICAnPCc6IGZ1bmN0aW9uKG5vZGUsIGNvbnRleHQpIHtcbiAgICAgIHZhciBjdHggPSB7cGFydGlhbHM6IHt9LCBjb2RlOiAnJywgc3Viczoge30sIGluUGFydGlhbDogdHJ1ZX07XG4gICAgICBIb2dhbi53YWxrKG5vZGUubm9kZXMsIGN0eCk7XG4gICAgICB2YXIgdGVtcGxhdGUgPSBjb250ZXh0LnBhcnRpYWxzW2NyZWF0ZVBhcnRpYWwobm9kZSwgY29udGV4dCldO1xuICAgICAgdGVtcGxhdGUuc3VicyA9IGN0eC5zdWJzO1xuICAgICAgdGVtcGxhdGUucGFydGlhbHMgPSBjdHgucGFydGlhbHM7XG4gICAgfSxcblxuICAgICckJzogZnVuY3Rpb24obm9kZSwgY29udGV4dCkge1xuICAgICAgdmFyIGN0eCA9IHtzdWJzOiB7fSwgY29kZTogJycsIHBhcnRpYWxzOiBjb250ZXh0LnBhcnRpYWxzLCBwcmVmaXg6IG5vZGUubn07XG4gICAgICBIb2dhbi53YWxrKG5vZGUubm9kZXMsIGN0eCk7XG4gICAgICBjb250ZXh0LnN1YnNbbm9kZS5uXSA9IGN0eC5jb2RlO1xuICAgICAgaWYgKCFjb250ZXh0LmluUGFydGlhbCkge1xuICAgICAgICBjb250ZXh0LmNvZGUgKz0gJ3Quc3ViKFwiJyArIGVzYyhub2RlLm4pICsgJ1wiLGMscCxpKTsnO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAnXFxuJzogZnVuY3Rpb24obm9kZSwgY29udGV4dCkge1xuICAgICAgY29udGV4dC5jb2RlICs9IHdyaXRlKCdcIlxcXFxuXCInICsgKG5vZGUubGFzdCA/ICcnIDogJyArIGknKSk7XG4gICAgfSxcblxuICAgICdfdic6IGZ1bmN0aW9uKG5vZGUsIGNvbnRleHQpIHtcbiAgICAgIGNvbnRleHQuY29kZSArPSAndC5iKHQudih0LicgKyBjaG9vc2VNZXRob2Qobm9kZS5uKSArICcoXCInICsgZXNjKG5vZGUubikgKyAnXCIsYyxwLDApKSk7JztcbiAgICB9LFxuXG4gICAgJ190JzogZnVuY3Rpb24obm9kZSwgY29udGV4dCkge1xuICAgICAgY29udGV4dC5jb2RlICs9IHdyaXRlKCdcIicgKyBlc2Mobm9kZS50ZXh0KSArICdcIicpO1xuICAgIH0sXG5cbiAgICAneyc6IHRyaXBsZVN0YWNoZSxcblxuICAgICcmJzogdHJpcGxlU3RhY2hlXG4gIH1cblxuICBmdW5jdGlvbiB0cmlwbGVTdGFjaGUobm9kZSwgY29udGV4dCkge1xuICAgIGNvbnRleHQuY29kZSArPSAndC5iKHQudCh0LicgKyBjaG9vc2VNZXRob2Qobm9kZS5uKSArICcoXCInICsgZXNjKG5vZGUubikgKyAnXCIsYyxwLDApKSk7JztcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlKHMpIHtcbiAgICByZXR1cm4gJ3QuYignICsgcyArICcpOyc7XG4gIH1cblxuICBIb2dhbi53YWxrID0gZnVuY3Rpb24obm9kZWxpc3QsIGNvbnRleHQpIHtcbiAgICB2YXIgZnVuYztcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IG5vZGVsaXN0Lmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgZnVuYyA9IEhvZ2FuLmNvZGVnZW5bbm9kZWxpc3RbaV0udGFnXTtcbiAgICAgIGZ1bmMgJiYgZnVuYyhub2RlbGlzdFtpXSwgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiBjb250ZXh0O1xuICB9XG5cbiAgSG9nYW4ucGFyc2UgPSBmdW5jdGlvbih0b2tlbnMsIHRleHQsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICByZXR1cm4gYnVpbGRUcmVlKHRva2VucywgJycsIFtdLCBvcHRpb25zLnNlY3Rpb25UYWdzIHx8IFtdKTtcbiAgfVxuXG4gIEhvZ2FuLmNhY2hlID0ge307XG5cbiAgSG9nYW4uY2FjaGVLZXkgPSBmdW5jdGlvbih0ZXh0LCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIFt0ZXh0LCAhIW9wdGlvbnMuYXNTdHJpbmcsICEhb3B0aW9ucy5kaXNhYmxlTGFtYmRhLCBvcHRpb25zLmRlbGltaXRlcnMsICEhb3B0aW9ucy5tb2RlbEdldF0uam9pbignfHwnKTtcbiAgfVxuXG4gIEhvZ2FuLmNvbXBpbGUgPSBmdW5jdGlvbih0ZXh0LCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdmFyIGtleSA9IEhvZ2FuLmNhY2hlS2V5KHRleHQsIG9wdGlvbnMpO1xuICAgIHZhciB0ZW1wbGF0ZSA9IHRoaXMuY2FjaGVba2V5XTtcblxuICAgIGlmICh0ZW1wbGF0ZSkge1xuICAgICAgdmFyIHBhcnRpYWxzID0gdGVtcGxhdGUucGFydGlhbHM7XG4gICAgICBmb3IgKHZhciBuYW1lIGluIHBhcnRpYWxzKSB7XG4gICAgICAgIGRlbGV0ZSBwYXJ0aWFsc1tuYW1lXS5pbnN0YW5jZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgICB9XG5cbiAgICB0ZW1wbGF0ZSA9IHRoaXMuZ2VuZXJhdGUodGhpcy5wYXJzZSh0aGlzLnNjYW4odGV4dCwgb3B0aW9ucy5kZWxpbWl0ZXJzKSwgdGV4dCwgb3B0aW9ucyksIHRleHQsIG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNhY2hlW2tleV0gPSB0ZW1wbGF0ZTtcbiAgfVxufSkodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnID8gZXhwb3J0cyA6IEhvZ2FuKTtcbiIsIi8qXG4gKiAgQ29weXJpZ2h0IDIwMTEgVHdpdHRlciwgSW5jLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiAgeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiAgVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqICBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqICBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiAgbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuLy8gVGhpcyBmaWxlIGlzIGZvciB1c2Ugd2l0aCBOb2RlLmpzLiBTZWUgZGlzdC8gZm9yIGJyb3dzZXIgZmlsZXMuXG5cbnZhciBIb2dhbiA9IHJlcXVpcmUoJy4vY29tcGlsZXInKTtcbkhvZ2FuLlRlbXBsYXRlID0gcmVxdWlyZSgnLi90ZW1wbGF0ZScpLlRlbXBsYXRlO1xuSG9nYW4udGVtcGxhdGUgPSBIb2dhbi5UZW1wbGF0ZTtcbm1vZHVsZS5leHBvcnRzID0gSG9nYW47XG4iLCIvKlxuICogIENvcHlyaWdodCAyMDExIFR3aXR0ZXIsIEluYy5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqICBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqICBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiAgV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiAgU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbnZhciBIb2dhbiA9IHt9O1xuXG4oZnVuY3Rpb24gKEhvZ2FuKSB7XG4gIEhvZ2FuLlRlbXBsYXRlID0gZnVuY3Rpb24gKGNvZGVPYmosIHRleHQsIGNvbXBpbGVyLCBvcHRpb25zKSB7XG4gICAgY29kZU9iaiA9IGNvZGVPYmogfHwge307XG4gICAgdGhpcy5yID0gY29kZU9iai5jb2RlIHx8IHRoaXMucjtcbiAgICB0aGlzLmMgPSBjb21waWxlcjtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHRoaXMudGV4dCA9IHRleHQgfHwgJyc7XG4gICAgdGhpcy5wYXJ0aWFscyA9IGNvZGVPYmoucGFydGlhbHMgfHwge307XG4gICAgdGhpcy5zdWJzID0gY29kZU9iai5zdWJzIHx8IHt9O1xuICAgIHRoaXMuYnVmID0gJyc7XG4gIH1cblxuICBIb2dhbi5UZW1wbGF0ZS5wcm90b3R5cGUgPSB7XG4gICAgLy8gcmVuZGVyOiByZXBsYWNlZCBieSBnZW5lcmF0ZWQgY29kZS5cbiAgICByOiBmdW5jdGlvbiAoY29udGV4dCwgcGFydGlhbHMsIGluZGVudCkgeyByZXR1cm4gJyc7IH0sXG5cbiAgICAvLyB2YXJpYWJsZSBlc2NhcGluZ1xuICAgIHY6IGhvZ2FuRXNjYXBlLFxuXG4gICAgLy8gdHJpcGxlIHN0YWNoZVxuICAgIHQ6IGNvZXJjZVRvU3RyaW5nLFxuXG4gICAgcmVuZGVyOiBmdW5jdGlvbiByZW5kZXIoY29udGV4dCwgcGFydGlhbHMsIGluZGVudCkge1xuICAgICAgcmV0dXJuIHRoaXMucmkoW2NvbnRleHRdLCBwYXJ0aWFscyB8fCB7fSwgaW5kZW50KTtcbiAgICB9LFxuXG4gICAgLy8gcmVuZGVyIGludGVybmFsIC0tIGEgaG9vayBmb3Igb3ZlcnJpZGVzIHRoYXQgY2F0Y2hlcyBwYXJ0aWFscyB0b29cbiAgICByaTogZnVuY3Rpb24gKGNvbnRleHQsIHBhcnRpYWxzLCBpbmRlbnQpIHtcbiAgICAgIHJldHVybiB0aGlzLnIoY29udGV4dCwgcGFydGlhbHMsIGluZGVudCk7XG4gICAgfSxcblxuICAgIC8vIGVuc3VyZVBhcnRpYWxcbiAgICBlcDogZnVuY3Rpb24oc3ltYm9sLCBwYXJ0aWFscykge1xuICAgICAgdmFyIHBhcnRpYWwgPSB0aGlzLnBhcnRpYWxzW3N5bWJvbF07XG5cbiAgICAgIC8vIGNoZWNrIHRvIHNlZSB0aGF0IGlmIHdlJ3ZlIGluc3RhbnRpYXRlZCB0aGlzIHBhcnRpYWwgYmVmb3JlXG4gICAgICB2YXIgdGVtcGxhdGUgPSBwYXJ0aWFsc1twYXJ0aWFsLm5hbWVdO1xuICAgICAgaWYgKHBhcnRpYWwuaW5zdGFuY2UgJiYgcGFydGlhbC5iYXNlID09IHRlbXBsYXRlKSB7XG4gICAgICAgIHJldHVybiBwYXJ0aWFsLmluc3RhbmNlO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIHRlbXBsYXRlID09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghdGhpcy5jKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gY29tcGlsZXIgYXZhaWxhYmxlLlwiKTtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wbGF0ZSA9IHRoaXMuYy5jb21waWxlKHRlbXBsYXRlLCB0aGlzLm9wdGlvbnMpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXRlbXBsYXRlKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICAvLyBXZSB1c2UgdGhpcyB0byBjaGVjayB3aGV0aGVyIHRoZSBwYXJ0aWFscyBkaWN0aW9uYXJ5IGhhcyBjaGFuZ2VkXG4gICAgICB0aGlzLnBhcnRpYWxzW3N5bWJvbF0uYmFzZSA9IHRlbXBsYXRlO1xuXG4gICAgICBpZiAocGFydGlhbC5zdWJzKSB7XG4gICAgICAgIC8vIE1ha2Ugc3VyZSB3ZSBjb25zaWRlciBwYXJlbnQgdGVtcGxhdGUgbm93XG4gICAgICAgIGlmICghcGFydGlhbHMuc3RhY2tUZXh0KSBwYXJ0aWFscy5zdGFja1RleHQgPSB7fTtcbiAgICAgICAgZm9yIChrZXkgaW4gcGFydGlhbC5zdWJzKSB7XG4gICAgICAgICAgaWYgKCFwYXJ0aWFscy5zdGFja1RleHRba2V5XSkge1xuICAgICAgICAgICAgcGFydGlhbHMuc3RhY2tUZXh0W2tleV0gPSAodGhpcy5hY3RpdmVTdWIgIT09IHVuZGVmaW5lZCAmJiBwYXJ0aWFscy5zdGFja1RleHRbdGhpcy5hY3RpdmVTdWJdKSA/IHBhcnRpYWxzLnN0YWNrVGV4dFt0aGlzLmFjdGl2ZVN1Yl0gOiB0aGlzLnRleHQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRlbXBsYXRlID0gY3JlYXRlU3BlY2lhbGl6ZWRQYXJ0aWFsKHRlbXBsYXRlLCBwYXJ0aWFsLnN1YnMsIHBhcnRpYWwucGFydGlhbHMsXG4gICAgICAgICAgdGhpcy5zdGFja1N1YnMsIHRoaXMuc3RhY2tQYXJ0aWFscywgcGFydGlhbHMuc3RhY2tUZXh0KTtcbiAgICAgIH1cbiAgICAgIHRoaXMucGFydGlhbHNbc3ltYm9sXS5pbnN0YW5jZSA9IHRlbXBsYXRlO1xuXG4gICAgICByZXR1cm4gdGVtcGxhdGU7XG4gICAgfSxcblxuICAgIC8vIHRyaWVzIHRvIGZpbmQgYSBwYXJ0aWFsIGluIHRoZSBjdXJyZW50IHNjb3BlIGFuZCByZW5kZXIgaXRcbiAgICBycDogZnVuY3Rpb24oc3ltYm9sLCBjb250ZXh0LCBwYXJ0aWFscywgaW5kZW50KSB7XG4gICAgICB2YXIgcGFydGlhbCA9IHRoaXMuZXAoc3ltYm9sLCBwYXJ0aWFscyk7XG4gICAgICBpZiAoIXBhcnRpYWwpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFydGlhbC5yaShjb250ZXh0LCBwYXJ0aWFscywgaW5kZW50KTtcbiAgICB9LFxuXG4gICAgLy8gcmVuZGVyIGEgc2VjdGlvblxuICAgIHJzOiBmdW5jdGlvbihjb250ZXh0LCBwYXJ0aWFscywgc2VjdGlvbikge1xuICAgICAgdmFyIHRhaWwgPSBjb250ZXh0W2NvbnRleHQubGVuZ3RoIC0gMV07XG5cbiAgICAgIGlmICghaXNBcnJheSh0YWlsKSkge1xuICAgICAgICBzZWN0aW9uKGNvbnRleHQsIHBhcnRpYWxzLCB0aGlzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRhaWwubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29udGV4dC5wdXNoKHRhaWxbaV0pO1xuICAgICAgICBzZWN0aW9uKGNvbnRleHQsIHBhcnRpYWxzLCB0aGlzKTtcbiAgICAgICAgY29udGV4dC5wb3AoKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gbWF5YmUgc3RhcnQgYSBzZWN0aW9uXG4gICAgczogZnVuY3Rpb24odmFsLCBjdHgsIHBhcnRpYWxzLCBpbnZlcnRlZCwgc3RhcnQsIGVuZCwgdGFncykge1xuICAgICAgdmFyIHBhc3M7XG5cbiAgICAgIGlmIChpc0FycmF5KHZhbCkgJiYgdmFsLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgdmFsID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdmFsID0gdGhpcy5tcyh2YWwsIGN0eCwgcGFydGlhbHMsIGludmVydGVkLCBzdGFydCwgZW5kLCB0YWdzKTtcbiAgICAgIH1cblxuICAgICAgcGFzcyA9ICEhdmFsO1xuXG4gICAgICBpZiAoIWludmVydGVkICYmIHBhc3MgJiYgY3R4KSB7XG4gICAgICAgIGN0eC5wdXNoKCh0eXBlb2YgdmFsID09ICdvYmplY3QnKSA/IHZhbCA6IGN0eFtjdHgubGVuZ3RoIC0gMV0pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFzcztcbiAgICB9LFxuXG4gICAgLy8gZmluZCB2YWx1ZXMgd2l0aCBkb3R0ZWQgbmFtZXNcbiAgICBkOiBmdW5jdGlvbihrZXksIGN0eCwgcGFydGlhbHMsIHJldHVybkZvdW5kKSB7XG4gICAgICB2YXIgZm91bmQsXG4gICAgICAgICAgbmFtZXMgPSBrZXkuc3BsaXQoJy4nKSxcbiAgICAgICAgICB2YWwgPSB0aGlzLmYobmFtZXNbMF0sIGN0eCwgcGFydGlhbHMsIHJldHVybkZvdW5kKSxcbiAgICAgICAgICBkb01vZGVsR2V0ID0gdGhpcy5vcHRpb25zLm1vZGVsR2V0LFxuICAgICAgICAgIGN4ID0gbnVsbDtcblxuICAgICAgaWYgKGtleSA9PT0gJy4nICYmIGlzQXJyYXkoY3R4W2N0eC5sZW5ndGggLSAyXSkpIHtcbiAgICAgICAgdmFsID0gY3R4W2N0eC5sZW5ndGggLSAxXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgbmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBmb3VuZCA9IGZpbmRJblNjb3BlKG5hbWVzW2ldLCB2YWwsIGRvTW9kZWxHZXQpO1xuICAgICAgICAgIGlmIChmb3VuZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjeCA9IHZhbDtcbiAgICAgICAgICAgIHZhbCA9IGZvdW5kO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YWwgPSAnJztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHJldHVybkZvdW5kICYmICF2YWwpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXJldHVybkZvdW5kICYmIHR5cGVvZiB2YWwgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjdHgucHVzaChjeCk7XG4gICAgICAgIHZhbCA9IHRoaXMubXYodmFsLCBjdHgsIHBhcnRpYWxzKTtcbiAgICAgICAgY3R4LnBvcCgpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdmFsO1xuICAgIH0sXG5cbiAgICAvLyBmaW5kIHZhbHVlcyB3aXRoIG5vcm1hbCBuYW1lc1xuICAgIGY6IGZ1bmN0aW9uKGtleSwgY3R4LCBwYXJ0aWFscywgcmV0dXJuRm91bmQpIHtcbiAgICAgIHZhciB2YWwgPSBmYWxzZSxcbiAgICAgICAgICB2ID0gbnVsbCxcbiAgICAgICAgICBmb3VuZCA9IGZhbHNlLFxuICAgICAgICAgIGRvTW9kZWxHZXQgPSB0aGlzLm9wdGlvbnMubW9kZWxHZXQ7XG5cbiAgICAgIGZvciAodmFyIGkgPSBjdHgubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgdiA9IGN0eFtpXTtcbiAgICAgICAgdmFsID0gZmluZEluU2NvcGUoa2V5LCB2LCBkb01vZGVsR2V0KTtcbiAgICAgICAgaWYgKHZhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghZm91bmQpIHtcbiAgICAgICAgcmV0dXJuIChyZXR1cm5Gb3VuZCkgPyBmYWxzZSA6IFwiXCI7XG4gICAgICB9XG5cbiAgICAgIGlmICghcmV0dXJuRm91bmQgJiYgdHlwZW9mIHZhbCA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHZhbCA9IHRoaXMubXYodmFsLCBjdHgsIHBhcnRpYWxzKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHZhbDtcbiAgICB9LFxuXG4gICAgLy8gaGlnaGVyIG9yZGVyIHRlbXBsYXRlc1xuICAgIGxzOiBmdW5jdGlvbihmdW5jLCBjeCwgcGFydGlhbHMsIHRleHQsIHRhZ3MpIHtcbiAgICAgIHZhciBvbGRUYWdzID0gdGhpcy5vcHRpb25zLmRlbGltaXRlcnM7XG5cbiAgICAgIHRoaXMub3B0aW9ucy5kZWxpbWl0ZXJzID0gdGFncztcbiAgICAgIHRoaXMuYih0aGlzLmN0KGNvZXJjZVRvU3RyaW5nKGZ1bmMuY2FsbChjeCwgdGV4dCkpLCBjeCwgcGFydGlhbHMpKTtcbiAgICAgIHRoaXMub3B0aW9ucy5kZWxpbWl0ZXJzID0gb2xkVGFncztcblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0sXG5cbiAgICAvLyBjb21waWxlIHRleHRcbiAgICBjdDogZnVuY3Rpb24odGV4dCwgY3gsIHBhcnRpYWxzKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25zLmRpc2FibGVMYW1iZGEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdMYW1iZGEgZmVhdHVyZXMgZGlzYWJsZWQuJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5jLmNvbXBpbGUodGV4dCwgdGhpcy5vcHRpb25zKS5yZW5kZXIoY3gsIHBhcnRpYWxzKTtcbiAgICB9LFxuXG4gICAgLy8gdGVtcGxhdGUgcmVzdWx0IGJ1ZmZlcmluZ1xuICAgIGI6IGZ1bmN0aW9uKHMpIHsgdGhpcy5idWYgKz0gczsgfSxcblxuICAgIGZsOiBmdW5jdGlvbigpIHsgdmFyIHIgPSB0aGlzLmJ1ZjsgdGhpcy5idWYgPSAnJzsgcmV0dXJuIHI7IH0sXG5cbiAgICAvLyBtZXRob2QgcmVwbGFjZSBzZWN0aW9uXG4gICAgbXM6IGZ1bmN0aW9uKGZ1bmMsIGN0eCwgcGFydGlhbHMsIGludmVydGVkLCBzdGFydCwgZW5kLCB0YWdzKSB7XG4gICAgICB2YXIgdGV4dFNvdXJjZSxcbiAgICAgICAgICBjeCA9IGN0eFtjdHgubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgcmVzdWx0ID0gZnVuYy5jYWxsKGN4KTtcblxuICAgICAgaWYgKHR5cGVvZiByZXN1bHQgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBpZiAoaW52ZXJ0ZWQpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0ZXh0U291cmNlID0gKHRoaXMuYWN0aXZlU3ViICYmIHRoaXMuc3Vic1RleHQgJiYgdGhpcy5zdWJzVGV4dFt0aGlzLmFjdGl2ZVN1Yl0pID8gdGhpcy5zdWJzVGV4dFt0aGlzLmFjdGl2ZVN1Yl0gOiB0aGlzLnRleHQ7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubHMocmVzdWx0LCBjeCwgcGFydGlhbHMsIHRleHRTb3VyY2Uuc3Vic3RyaW5nKHN0YXJ0LCBlbmQpLCB0YWdzKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG5cbiAgICAvLyBtZXRob2QgcmVwbGFjZSB2YXJpYWJsZVxuICAgIG12OiBmdW5jdGlvbihmdW5jLCBjdHgsIHBhcnRpYWxzKSB7XG4gICAgICB2YXIgY3ggPSBjdHhbY3R4Lmxlbmd0aCAtIDFdO1xuICAgICAgdmFyIHJlc3VsdCA9IGZ1bmMuY2FsbChjeCk7XG5cbiAgICAgIGlmICh0eXBlb2YgcmVzdWx0ID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3QoY29lcmNlVG9TdHJpbmcocmVzdWx0LmNhbGwoY3gpKSwgY3gsIHBhcnRpYWxzKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgc3ViOiBmdW5jdGlvbihuYW1lLCBjb250ZXh0LCBwYXJ0aWFscywgaW5kZW50KSB7XG4gICAgICB2YXIgZiA9IHRoaXMuc3Vic1tuYW1lXTtcbiAgICAgIGlmIChmKSB7XG4gICAgICAgIHRoaXMuYWN0aXZlU3ViID0gbmFtZTtcbiAgICAgICAgZihjb250ZXh0LCBwYXJ0aWFscywgdGhpcywgaW5kZW50KTtcbiAgICAgICAgdGhpcy5hY3RpdmVTdWIgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgfTtcblxuICAvL0ZpbmQgYSBrZXkgaW4gYW4gb2JqZWN0XG4gIGZ1bmN0aW9uIGZpbmRJblNjb3BlKGtleSwgc2NvcGUsIGRvTW9kZWxHZXQpIHtcbiAgICB2YXIgdmFsO1xuXG4gICAgaWYgKHNjb3BlICYmIHR5cGVvZiBzY29wZSA9PSAnb2JqZWN0Jykge1xuXG4gICAgICBpZiAoc2NvcGVba2V5XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHZhbCA9IHNjb3BlW2tleV07XG5cbiAgICAgIC8vIHRyeSBsb29rdXAgd2l0aCBnZXQgZm9yIGJhY2tib25lIG9yIHNpbWlsYXIgbW9kZWwgZGF0YVxuICAgICAgfSBlbHNlIGlmIChkb01vZGVsR2V0ICYmIHNjb3BlLmdldCAmJiB0eXBlb2Ygc2NvcGUuZ2V0ID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdmFsID0gc2NvcGUuZ2V0KGtleSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVNwZWNpYWxpemVkUGFydGlhbChpbnN0YW5jZSwgc3VicywgcGFydGlhbHMsIHN0YWNrU3Vicywgc3RhY2tQYXJ0aWFscywgc3RhY2tUZXh0KSB7XG4gICAgZnVuY3Rpb24gUGFydGlhbFRlbXBsYXRlKCkge307XG4gICAgUGFydGlhbFRlbXBsYXRlLnByb3RvdHlwZSA9IGluc3RhbmNlO1xuICAgIGZ1bmN0aW9uIFN1YnN0aXR1dGlvbnMoKSB7fTtcbiAgICBTdWJzdGl0dXRpb25zLnByb3RvdHlwZSA9IGluc3RhbmNlLnN1YnM7XG4gICAgdmFyIGtleTtcbiAgICB2YXIgcGFydGlhbCA9IG5ldyBQYXJ0aWFsVGVtcGxhdGUoKTtcbiAgICBwYXJ0aWFsLnN1YnMgPSBuZXcgU3Vic3RpdHV0aW9ucygpO1xuICAgIHBhcnRpYWwuc3Vic1RleHQgPSB7fTsgIC8vaGVoZS4gc3Vic3RleHQuXG4gICAgcGFydGlhbC5idWYgPSAnJztcblxuICAgIHN0YWNrU3VicyA9IHN0YWNrU3VicyB8fCB7fTtcbiAgICBwYXJ0aWFsLnN0YWNrU3VicyA9IHN0YWNrU3VicztcbiAgICBwYXJ0aWFsLnN1YnNUZXh0ID0gc3RhY2tUZXh0O1xuICAgIGZvciAoa2V5IGluIHN1YnMpIHtcbiAgICAgIGlmICghc3RhY2tTdWJzW2tleV0pIHN0YWNrU3Vic1trZXldID0gc3Vic1trZXldO1xuICAgIH1cbiAgICBmb3IgKGtleSBpbiBzdGFja1N1YnMpIHtcbiAgICAgIHBhcnRpYWwuc3Vic1trZXldID0gc3RhY2tTdWJzW2tleV07XG4gICAgfVxuXG4gICAgc3RhY2tQYXJ0aWFscyA9IHN0YWNrUGFydGlhbHMgfHwge307XG4gICAgcGFydGlhbC5zdGFja1BhcnRpYWxzID0gc3RhY2tQYXJ0aWFscztcbiAgICBmb3IgKGtleSBpbiBwYXJ0aWFscykge1xuICAgICAgaWYgKCFzdGFja1BhcnRpYWxzW2tleV0pIHN0YWNrUGFydGlhbHNba2V5XSA9IHBhcnRpYWxzW2tleV07XG4gICAgfVxuICAgIGZvciAoa2V5IGluIHN0YWNrUGFydGlhbHMpIHtcbiAgICAgIHBhcnRpYWwucGFydGlhbHNba2V5XSA9IHN0YWNrUGFydGlhbHNba2V5XTtcbiAgICB9XG5cbiAgICByZXR1cm4gcGFydGlhbDtcbiAgfVxuXG4gIHZhciByQW1wID0gLyYvZyxcbiAgICAgIHJMdCA9IC88L2csXG4gICAgICByR3QgPSAvPi9nLFxuICAgICAgckFwb3MgPSAvXFwnL2csXG4gICAgICByUXVvdCA9IC9cXFwiL2csXG4gICAgICBoQ2hhcnMgPSAvWyY8PlxcXCJcXCddLztcblxuICBmdW5jdGlvbiBjb2VyY2VUb1N0cmluZyh2YWwpIHtcbiAgICByZXR1cm4gU3RyaW5nKCh2YWwgPT09IG51bGwgfHwgdmFsID09PSB1bmRlZmluZWQpID8gJycgOiB2YWwpO1xuICB9XG5cbiAgZnVuY3Rpb24gaG9nYW5Fc2NhcGUoc3RyKSB7XG4gICAgc3RyID0gY29lcmNlVG9TdHJpbmcoc3RyKTtcbiAgICByZXR1cm4gaENoYXJzLnRlc3Qoc3RyKSA/XG4gICAgICBzdHJcbiAgICAgICAgLnJlcGxhY2UockFtcCwgJyZhbXA7JylcbiAgICAgICAgLnJlcGxhY2Uockx0LCAnJmx0OycpXG4gICAgICAgIC5yZXBsYWNlKHJHdCwgJyZndDsnKVxuICAgICAgICAucmVwbGFjZShyQXBvcywgJyYjMzk7JylcbiAgICAgICAgLnJlcGxhY2UoclF1b3QsICcmcXVvdDsnKSA6XG4gICAgICBzdHI7XG4gIH1cblxuICB2YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24oYSkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYSkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG5cbn0pKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJyA/IGV4cG9ydHMgOiBIb2dhbik7XG4iLCIvKiFcclxuKiB2ZG9tLXZpcnR1YWxpemVcclxuKiBDb3B5cmlnaHQgMjAxNCBieSBNYXJjZWwgS2xlaHIgPG1rbGVockBnbXgubmV0PlxyXG4qXHJcbiogKE1JVCBMSUNFTlNFKVxyXG4qIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcclxuKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXHJcbiogaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0c1xyXG4qIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcclxuKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcclxuKiBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyBjb25kaXRpb25zOlxyXG4qXHJcbiogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cclxuKiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cclxuKlxyXG4qIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcclxuKiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSxcclxuKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcclxuKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXHJcbiogTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSxcclxuKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXHJcbiogVEhFIFNPRlRXQVJFLlxyXG4qL1xyXG52YXIgVk5vZGUgPSByZXF1aXJlKFwidmlydHVhbC1kb20vdm5vZGUvdm5vZGVcIilcclxuICAsIFZUZXh0ID0gcmVxdWlyZShcInZpcnR1YWwtZG9tL3Zub2RlL3Z0ZXh0XCIpXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVZOb2RlXHJcblxyXG5mdW5jdGlvbiBjcmVhdGVWTm9kZShkb21Ob2RlLCBrZXkpIHtcclxuICBrZXkgPSBrZXkgfHwgbnVsbCAvLyBYWFg6IExlYXZlIG91dCBga2V5YCBmb3Igbm93Li4uIG1lcmVseSB1c2VkIGZvciAocmUtKW9yZGVyaW5nXHJcblxyXG4gIGlmKGRvbU5vZGUubm9kZVR5cGUgPT0gMSkgcmV0dXJuIGNyZWF0ZUZyb21FbGVtZW50KGRvbU5vZGUsIGtleSlcclxuICBpZihkb21Ob2RlLm5vZGVUeXBlID09IDMpIHJldHVybiBjcmVhdGVGcm9tVGV4dE5vZGUoZG9tTm9kZSwga2V5KVxyXG4gIHJldHVyblxyXG59XHJcblxyXG5jcmVhdGVWTm9kZS5mcm9tSFRNTCA9IGZ1bmN0aW9uKGh0bWwsIGtleSkge1xyXG4gIHZhciBkb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7IC8vIGNyZWF0ZSBjb250YWluZXJcclxuICBkb21Ob2RlLmlubmVySFRNTCA9IGh0bWw7IC8vIGJyb3dzZXIgcGFyc2VzIEhUTUwgaW50byBET00gdHJlZVxyXG4gIGRvbU5vZGUgPSBkb21Ob2RlLmNoaWxkcmVuWzBdIHx8IGRvbU5vZGU7IC8vIHNlbGVjdCBmaXJzdCBub2RlIGluIHRyZWVcclxuICByZXR1cm4gY3JlYXRlVk5vZGUoZG9tTm9kZSwga2V5KTtcclxufTtcclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZUZyb21UZXh0Tm9kZSh0Tm9kZSkge1xyXG4gIHJldHVybiBuZXcgVlRleHQodE5vZGUubm9kZVZhbHVlKVxyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gY3JlYXRlRnJvbUVsZW1lbnQoZWwpIHtcclxuICB2YXIgdGFnTmFtZSA9IGVsLnRhZ05hbWVcclxuICAsIG5hbWVzcGFjZSA9IGVsLm5hbWVzcGFjZVVSSSA9PSAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbCc/IG51bGwgOiBlbC5uYW1lc3BhY2VVUklcclxuICAsIHByb3BlcnRpZXMgPSBnZXRFbGVtZW50UHJvcGVydGllcyhlbClcclxuICAsIGNoaWxkcmVuID0gW11cclxuXHJcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbC5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICBjaGlsZHJlbi5wdXNoKGNyZWF0ZVZOb2RlKGVsLmNoaWxkTm9kZXNbaV0vKiwgaSovKSlcclxuICB9XHJcblxyXG4gIHJldHVybiBuZXcgVk5vZGUodGFnTmFtZSwgcHJvcGVydGllcywgY2hpbGRyZW4sIG51bGwsIG5hbWVzcGFjZSlcclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIGdldEVsZW1lbnRQcm9wZXJ0aWVzKGVsKSB7XHJcbiAgdmFyIG9iaiA9IHt9XHJcblxyXG4gIHByb3BzLmZvckVhY2goZnVuY3Rpb24ocHJvcE5hbWUpIHtcclxuICAgIGlmKCFlbFtwcm9wTmFtZV0pIHJldHVyblxyXG5cclxuICAgIC8vIFNwZWNpYWwgY2FzZTogc3R5bGVcclxuICAgIC8vIC5zdHlsZSBpcyBhIERPTVN0eWxlRGVjbGFyYXRpb24sIHRodXMgd2UgbmVlZCB0byBpdGVyYXRlIG92ZXIgYWxsXHJcbiAgICAvLyBydWxlcyB0byBjcmVhdGUgYSBoYXNoIG9mIGFwcGxpZWQgY3NzIHByb3BlcnRpZXMuXHJcbiAgICAvL1xyXG4gICAgLy8gWW91IGNhbiBkaXJlY3RseSBzZXQgYSBzcGVjaWZpYyAuc3R5bGVbcHJvcF0gPSB2YWx1ZSBzbyBwYXRjaGluZyB3aXRoIHZkb21cclxuICAgIC8vIGlzIHBvc3NpYmxlLlxyXG4gICAgaWYoXCJzdHlsZVwiID09IHByb3BOYW1lKSB7XHJcbiAgICAgIHZhciBjc3MgPSB7fVxyXG4gICAgICAgICwgc3R5bGVQcm9wXHJcbiAgICAgIGZvcih2YXIgaT0wOyBpPGVsLnN0eWxlLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgc3R5bGVQcm9wID0gZWwuc3R5bGVbaV1cclxuICAgICAgICBjc3Nbc3R5bGVQcm9wXSA9IGVsLnN0eWxlLmdldFByb3BlcnR5VmFsdWUoc3R5bGVQcm9wKSAvLyBYWFg6IGFkZCBzdXBwb3J0IGZvciBcIiFpbXBvcnRhbnRcIiB2aWEgZ2V0UHJvcGVydHlQcmlvcml0eSgpIVxyXG4gICAgICB9XHJcblxyXG4gICAgICBvYmpbcHJvcE5hbWVdID0gY3NzXHJcbiAgICAgIHJldHVyblxyXG4gICAgfVxyXG5cclxuICAgIC8vIFNwZWNpYWwgY2FzZTogZGF0YXNldFxyXG4gICAgLy8gd2UgY2FuIGl0ZXJhdGUgb3ZlciAuZGF0YXNldCB3aXRoIGEgc2ltcGxlIGZvci4uaW4gbG9vcC5cclxuICAgIC8vIFRoZSBhbGwtdGltZSBmb28gd2l0aCBkYXRhLSogYXR0cmlicyBpcyB0aGUgZGFzaC1zbmFrZSB0byBjYW1lbENhc2VcclxuICAgIC8vIGNvbnZlcnNpb24uXHJcbiAgICAvLyBIb3dldmVyLCBJJ20gbm90IHN1cmUgaWYgdGhpcyBpcyBjb21wYXRpYmxlIHdpdGggaCgpXHJcbiAgICAvL1xyXG4gICAgLy8gLmRhdGFzZXQgcHJvcGVydGllcyBhcmUgZGlyZWN0bHkgYWNjZXNzaWJsZSBhcyB0cmFuc3BhcmVudCBnZXR0ZXJzL3NldHRlcnMsIHNvXHJcbiAgICAvLyBwYXRjaGluZyB3aXRoIHZkb20gaXMgcG9zc2libGUuXHJcbiAgICBpZihcImRhdGFzZXRcIiA9PSBwcm9wTmFtZSkge1xyXG4gICAgICB2YXIgZGF0YSA9IHt9XHJcbiAgICAgIGZvcih2YXIgcCBpbiBlbC5kYXRhc2V0KSB7XHJcbiAgICAgICAgZGF0YVtwXSA9IGVsLmRhdGFzZXRbcF1cclxuICAgICAgfVxyXG5cclxuICAgICAgb2JqW3Byb3BOYW1lXSA9IGRhdGFcclxuICAgICAgcmV0dXJuXHJcbiAgICB9XHJcblxyXG4gICAgLy8gU3BlY2lhbCBjYXNlOiBhdHRyaWJ1dGVzXHJcbiAgICAvLyBzb21lIHByb3BlcnRpZXMgYXJlIG9ubHkgYWNjZXNzaWJsZSB2aWEgLmF0dHJpYnV0ZXMsIHNvXHJcbiAgICAvLyB0aGF0J3Mgd2hhdCB3ZSdkIGRvLCBpZiB2ZG9tLWNyZWF0ZS1lbGVtZW50IGNvdWxkIGhhbmRsZSB0aGlzLlxyXG4gICAgaWYoXCJhdHRyaWJ1dGVzXCIgPT0gcHJvcE5hbWUpIHJldHVyblxyXG4gICAgaWYoXCJ0YWJJbmRleFwiID09IHByb3BOYW1lICYmIGVsLnRhYkluZGV4ID09PSAtMSkgcmV0dXJuXHJcblxyXG5cclxuICAgIC8vIGRlZmF1bHQ6IGp1c3QgY29weSB0aGUgcHJvcGVydHlcclxuICAgIG9ialtwcm9wTmFtZV0gPSBlbFtwcm9wTmFtZV1cclxuICAgIHJldHVyblxyXG4gIH0pXHJcblxyXG4gIHJldHVybiBvYmpcclxufVxyXG5cclxuLyoqXHJcbiAqIERPTU5vZGUgcHJvcGVydHkgd2hpdGUgbGlzdFxyXG4gKiBUYWtlbiBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9SYXlub3MvcmVhY3QvYmxvYi9kb20tcHJvcGVydHktY29uZmlnL3NyYy9icm93c2VyL3VpL2RvbS9EZWZhdWx0RE9NUHJvcGVydHlDb25maWcuanNcclxuICovXHJcbnZhciBwcm9wcyA9XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5wcm9wZXJ0aWVzID0gW1xyXG4gXCJhY2NlcHRcIlxyXG4sXCJhY2Nlc3NLZXlcIlxyXG4sXCJhY3Rpb25cIlxyXG4sXCJhbHRcIlxyXG4sXCJhc3luY1wiXHJcbixcImF1dG9Db21wbGV0ZVwiXHJcbixcImF1dG9QbGF5XCJcclxuLFwiY2VsbFBhZGRpbmdcIlxyXG4sXCJjZWxsU3BhY2luZ1wiXHJcbixcImNoZWNrZWRcIlxyXG4sXCJjbGFzc05hbWVcIlxyXG4sXCJjb2xTcGFuXCJcclxuLFwiY29udGVudFwiXHJcbixcImNvbnRlbnRFZGl0YWJsZVwiXHJcbixcImNvbnRyb2xzXCJcclxuLFwiY3Jvc3NPcmlnaW5cIlxyXG4sXCJkYXRhXCJcclxuLFwiZGF0YXNldFwiXHJcbixcImRlZmVyXCJcclxuLFwiZGlyXCJcclxuLFwiZG93bmxvYWRcIlxyXG4sXCJkcmFnZ2FibGVcIlxyXG4sXCJlbmNUeXBlXCJcclxuLFwiZm9ybU5vVmFsaWRhdGVcIlxyXG4sXCJocmVmXCJcclxuLFwiaHJlZkxhbmdcIlxyXG4sXCJodG1sRm9yXCJcclxuLFwiaHR0cEVxdWl2XCJcclxuLFwiaWNvblwiXHJcbixcImlkXCJcclxuLFwibGFiZWxcIlxyXG4sXCJsYW5nXCJcclxuLFwibGlzdFwiXHJcbixcImxvb3BcIlxyXG4sXCJtYXhcIlxyXG4sXCJtZWRpYUdyb3VwXCJcclxuLFwibWV0aG9kXCJcclxuLFwibWluXCJcclxuLFwibXVsdGlwbGVcIlxyXG4sXCJtdXRlZFwiXHJcbixcIm5hbWVcIlxyXG4sXCJub1ZhbGlkYXRlXCJcclxuLFwicGF0dGVyblwiXHJcbixcInBsYWNlaG9sZGVyXCJcclxuLFwicG9zdGVyXCJcclxuLFwicHJlbG9hZFwiXHJcbixcInJhZGlvR3JvdXBcIlxyXG4sXCJyZWFkT25seVwiXHJcbixcInJlbFwiXHJcbixcInJlcXVpcmVkXCJcclxuLFwicm93U3BhblwiXHJcbixcInNhbmRib3hcIlxyXG4sXCJzY29wZVwiXHJcbixcInNjcm9sbExlZnRcIlxyXG4sXCJzY3JvbGxpbmdcIlxyXG4sXCJzY3JvbGxUb3BcIlxyXG4sXCJzZWxlY3RlZFwiXHJcbixcInNwYW5cIlxyXG4sXCJzcGVsbENoZWNrXCJcclxuLFwic3JjXCJcclxuLFwic3JjRG9jXCJcclxuLFwic3JjU2V0XCJcclxuLFwic3RhcnRcIlxyXG4sXCJzdGVwXCJcclxuLFwic3R5bGVcIlxyXG4sXCJ0YWJJbmRleFwiXHJcbixcInRhcmdldFwiXHJcbixcInRpdGxlXCJcclxuLFwidHlwZVwiXHJcbixcInZhbHVlXCJcclxuXHJcbi8vIE5vbi1zdGFuZGFyZCBQcm9wZXJ0aWVzXHJcbixcImF1dG9DYXBpdGFsaXplXCJcclxuLFwiYXV0b0NvcnJlY3RcIlxyXG4sXCJwcm9wZXJ0eVwiXHJcblxyXG4sIFwiYXR0cmlidXRlc1wiXHJcbl1cclxuXHJcbnZhciBhdHRycyA9XHJcbm1vZHVsZS5leHBvcnRzLmF0dHJzID0gW1xyXG4gXCJhbGxvd0Z1bGxTY3JlZW5cIlxyXG4sXCJhbGxvd1RyYW5zcGFyZW5jeVwiXHJcbixcImNoYXJTZXRcIlxyXG4sXCJjb2xzXCJcclxuLFwiY29udGV4dE1lbnVcIlxyXG4sXCJkYXRlVGltZVwiXHJcbixcImRpc2FibGVkXCJcclxuLFwiZm9ybVwiXHJcbixcImZyYW1lQm9yZGVyXCJcclxuLFwiaGVpZ2h0XCJcclxuLFwiaGlkZGVuXCJcclxuLFwibWF4TGVuZ3RoXCJcclxuLFwicm9sZVwiXHJcbixcInJvd3NcIlxyXG4sXCJzZWFtbGVzc1wiXHJcbixcInNpemVcIlxyXG4sXCJ3aWR0aFwiXHJcbixcIndtb2RlXCJcclxuXHJcbi8vIFNWRyBQcm9wZXJ0aWVzXHJcbixcImN4XCJcclxuLFwiY3lcIlxyXG4sXCJkXCJcclxuLFwiZHhcIlxyXG4sXCJkeVwiXHJcbixcImZpbGxcIlxyXG4sXCJmeFwiXHJcbixcImZ5XCJcclxuLFwiZ3JhZGllbnRUcmFuc2Zvcm1cIlxyXG4sXCJncmFkaWVudFVuaXRzXCJcclxuLFwib2Zmc2V0XCJcclxuLFwicG9pbnRzXCJcclxuLFwiclwiXHJcbixcInJ4XCJcclxuLFwicnlcIlxyXG4sXCJzcHJlYWRNZXRob2RcIlxyXG4sXCJzdG9wQ29sb3JcIlxyXG4sXCJzdG9wT3BhY2l0eVwiXHJcbixcInN0cm9rZVwiXHJcbixcInN0cm9rZUxpbmVjYXBcIlxyXG4sXCJzdHJva2VXaWR0aFwiXHJcbixcInRleHRBbmNob3JcIlxyXG4sXCJ0cmFuc2Zvcm1cIlxyXG4sXCJ2ZXJzaW9uXCJcclxuLFwidmlld0JveFwiXHJcbixcIngxXCJcclxuLFwieDJcIlxyXG4sXCJ4XCJcclxuLFwieTFcIlxyXG4sXCJ5MlwiXHJcbixcInlcIlxyXG5dXHJcbiIsInZhciBjcmVhdGVFbGVtZW50ID0gcmVxdWlyZShcIi4vdmRvbS9jcmVhdGUtZWxlbWVudC5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUVsZW1lbnRcbiIsInZhciBkaWZmID0gcmVxdWlyZShcIi4vdnRyZWUvZGlmZi5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRpZmZcbiIsInZhciBoID0gcmVxdWlyZShcIi4vdmlydHVhbC1oeXBlcnNjcmlwdC9pbmRleC5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhcbiIsIi8qIVxuICogQ3Jvc3MtQnJvd3NlciBTcGxpdCAxLjEuMVxuICogQ29weXJpZ2h0IDIwMDctMjAxMiBTdGV2ZW4gTGV2aXRoYW4gPHN0ZXZlbmxldml0aGFuLmNvbT5cbiAqIEF2YWlsYWJsZSB1bmRlciB0aGUgTUlUIExpY2Vuc2VcbiAqIEVDTUFTY3JpcHQgY29tcGxpYW50LCB1bmlmb3JtIGNyb3NzLWJyb3dzZXIgc3BsaXQgbWV0aG9kXG4gKi9cblxuLyoqXG4gKiBTcGxpdHMgYSBzdHJpbmcgaW50byBhbiBhcnJheSBvZiBzdHJpbmdzIHVzaW5nIGEgcmVnZXggb3Igc3RyaW5nIHNlcGFyYXRvci4gTWF0Y2hlcyBvZiB0aGVcbiAqIHNlcGFyYXRvciBhcmUgbm90IGluY2x1ZGVkIGluIHRoZSByZXN1bHQgYXJyYXkuIEhvd2V2ZXIsIGlmIGBzZXBhcmF0b3JgIGlzIGEgcmVnZXggdGhhdCBjb250YWluc1xuICogY2FwdHVyaW5nIGdyb3VwcywgYmFja3JlZmVyZW5jZXMgYXJlIHNwbGljZWQgaW50byB0aGUgcmVzdWx0IGVhY2ggdGltZSBgc2VwYXJhdG9yYCBpcyBtYXRjaGVkLlxuICogRml4ZXMgYnJvd3NlciBidWdzIGNvbXBhcmVkIHRvIHRoZSBuYXRpdmUgYFN0cmluZy5wcm90b3R5cGUuc3BsaXRgIGFuZCBjYW4gYmUgdXNlZCByZWxpYWJseVxuICogY3Jvc3MtYnJvd3Nlci5cbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIHNwbGl0LlxuICogQHBhcmFtIHtSZWdFeHB8U3RyaW5nfSBzZXBhcmF0b3IgUmVnZXggb3Igc3RyaW5nIHRvIHVzZSBmb3Igc2VwYXJhdGluZyB0aGUgc3RyaW5nLlxuICogQHBhcmFtIHtOdW1iZXJ9IFtsaW1pdF0gTWF4aW11bSBudW1iZXIgb2YgaXRlbXMgdG8gaW5jbHVkZSBpbiB0aGUgcmVzdWx0IGFycmF5LlxuICogQHJldHVybnMge0FycmF5fSBBcnJheSBvZiBzdWJzdHJpbmdzLlxuICogQGV4YW1wbGVcbiAqXG4gKiAvLyBCYXNpYyB1c2VcbiAqIHNwbGl0KCdhIGIgYyBkJywgJyAnKTtcbiAqIC8vIC0+IFsnYScsICdiJywgJ2MnLCAnZCddXG4gKlxuICogLy8gV2l0aCBsaW1pdFxuICogc3BsaXQoJ2EgYiBjIGQnLCAnICcsIDIpO1xuICogLy8gLT4gWydhJywgJ2InXVxuICpcbiAqIC8vIEJhY2tyZWZlcmVuY2VzIGluIHJlc3VsdCBhcnJheVxuICogc3BsaXQoJy4ud29yZDEgd29yZDIuLicsIC8oW2Etel0rKShcXGQrKS9pKTtcbiAqIC8vIC0+IFsnLi4nLCAnd29yZCcsICcxJywgJyAnLCAnd29yZCcsICcyJywgJy4uJ11cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24gc3BsaXQodW5kZWYpIHtcblxuICB2YXIgbmF0aXZlU3BsaXQgPSBTdHJpbmcucHJvdG90eXBlLnNwbGl0LFxuICAgIGNvbXBsaWFudEV4ZWNOcGNnID0gLygpPz8vLmV4ZWMoXCJcIilbMV0gPT09IHVuZGVmLFxuICAgIC8vIE5QQ0c6IG5vbnBhcnRpY2lwYXRpbmcgY2FwdHVyaW5nIGdyb3VwXG4gICAgc2VsZjtcblxuICBzZWxmID0gZnVuY3Rpb24oc3RyLCBzZXBhcmF0b3IsIGxpbWl0KSB7XG4gICAgLy8gSWYgYHNlcGFyYXRvcmAgaXMgbm90IGEgcmVnZXgsIHVzZSBgbmF0aXZlU3BsaXRgXG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChzZXBhcmF0b3IpICE9PSBcIltvYmplY3QgUmVnRXhwXVwiKSB7XG4gICAgICByZXR1cm4gbmF0aXZlU3BsaXQuY2FsbChzdHIsIHNlcGFyYXRvciwgbGltaXQpO1xuICAgIH1cbiAgICB2YXIgb3V0cHV0ID0gW10sXG4gICAgICBmbGFncyA9IChzZXBhcmF0b3IuaWdub3JlQ2FzZSA/IFwiaVwiIDogXCJcIikgKyAoc2VwYXJhdG9yLm11bHRpbGluZSA/IFwibVwiIDogXCJcIikgKyAoc2VwYXJhdG9yLmV4dGVuZGVkID8gXCJ4XCIgOiBcIlwiKSArIC8vIFByb3Bvc2VkIGZvciBFUzZcbiAgICAgIChzZXBhcmF0b3Iuc3RpY2t5ID8gXCJ5XCIgOiBcIlwiKSxcbiAgICAgIC8vIEZpcmVmb3ggMytcbiAgICAgIGxhc3RMYXN0SW5kZXggPSAwLFxuICAgICAgLy8gTWFrZSBgZ2xvYmFsYCBhbmQgYXZvaWQgYGxhc3RJbmRleGAgaXNzdWVzIGJ5IHdvcmtpbmcgd2l0aCBhIGNvcHlcbiAgICAgIHNlcGFyYXRvciA9IG5ldyBSZWdFeHAoc2VwYXJhdG9yLnNvdXJjZSwgZmxhZ3MgKyBcImdcIiksXG4gICAgICBzZXBhcmF0b3IyLCBtYXRjaCwgbGFzdEluZGV4LCBsYXN0TGVuZ3RoO1xuICAgIHN0ciArPSBcIlwiOyAvLyBUeXBlLWNvbnZlcnRcbiAgICBpZiAoIWNvbXBsaWFudEV4ZWNOcGNnKSB7XG4gICAgICAvLyBEb2Vzbid0IG5lZWQgZmxhZ3MgZ3ksIGJ1dCB0aGV5IGRvbid0IGh1cnRcbiAgICAgIHNlcGFyYXRvcjIgPSBuZXcgUmVnRXhwKFwiXlwiICsgc2VwYXJhdG9yLnNvdXJjZSArIFwiJCg/IVxcXFxzKVwiLCBmbGFncyk7XG4gICAgfVxuICAgIC8qIFZhbHVlcyBmb3IgYGxpbWl0YCwgcGVyIHRoZSBzcGVjOlxuICAgICAqIElmIHVuZGVmaW5lZDogNDI5NDk2NzI5NSAvLyBNYXRoLnBvdygyLCAzMikgLSAxXG4gICAgICogSWYgMCwgSW5maW5pdHksIG9yIE5hTjogMFxuICAgICAqIElmIHBvc2l0aXZlIG51bWJlcjogbGltaXQgPSBNYXRoLmZsb29yKGxpbWl0KTsgaWYgKGxpbWl0ID4gNDI5NDk2NzI5NSkgbGltaXQgLT0gNDI5NDk2NzI5NjtcbiAgICAgKiBJZiBuZWdhdGl2ZSBudW1iZXI6IDQyOTQ5NjcyOTYgLSBNYXRoLmZsb29yKE1hdGguYWJzKGxpbWl0KSlcbiAgICAgKiBJZiBvdGhlcjogVHlwZS1jb252ZXJ0LCB0aGVuIHVzZSB0aGUgYWJvdmUgcnVsZXNcbiAgICAgKi9cbiAgICBsaW1pdCA9IGxpbWl0ID09PSB1bmRlZiA/IC0xID4+PiAwIDogLy8gTWF0aC5wb3coMiwgMzIpIC0gMVxuICAgIGxpbWl0ID4+PiAwOyAvLyBUb1VpbnQzMihsaW1pdClcbiAgICB3aGlsZSAobWF0Y2ggPSBzZXBhcmF0b3IuZXhlYyhzdHIpKSB7XG4gICAgICAvLyBgc2VwYXJhdG9yLmxhc3RJbmRleGAgaXMgbm90IHJlbGlhYmxlIGNyb3NzLWJyb3dzZXJcbiAgICAgIGxhc3RJbmRleCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgaWYgKGxhc3RJbmRleCA+IGxhc3RMYXN0SW5kZXgpIHtcbiAgICAgICAgb3V0cHV0LnB1c2goc3RyLnNsaWNlKGxhc3RMYXN0SW5kZXgsIG1hdGNoLmluZGV4KSk7XG4gICAgICAgIC8vIEZpeCBicm93c2VycyB3aG9zZSBgZXhlY2AgbWV0aG9kcyBkb24ndCBjb25zaXN0ZW50bHkgcmV0dXJuIGB1bmRlZmluZWRgIGZvclxuICAgICAgICAvLyBub25wYXJ0aWNpcGF0aW5nIGNhcHR1cmluZyBncm91cHNcbiAgICAgICAgaWYgKCFjb21wbGlhbnRFeGVjTnBjZyAmJiBtYXRjaC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgbWF0Y2hbMF0ucmVwbGFjZShzZXBhcmF0b3IyLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aCAtIDI7IGkrKykge1xuICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzW2ldID09PSB1bmRlZikge1xuICAgICAgICAgICAgICAgIG1hdGNoW2ldID0gdW5kZWY7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2gubGVuZ3RoID4gMSAmJiBtYXRjaC5pbmRleCA8IHN0ci5sZW5ndGgpIHtcbiAgICAgICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShvdXRwdXQsIG1hdGNoLnNsaWNlKDEpKTtcbiAgICAgICAgfVxuICAgICAgICBsYXN0TGVuZ3RoID0gbWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgICBsYXN0TGFzdEluZGV4ID0gbGFzdEluZGV4O1xuICAgICAgICBpZiAob3V0cHV0Lmxlbmd0aCA+PSBsaW1pdCkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoc2VwYXJhdG9yLmxhc3RJbmRleCA9PT0gbWF0Y2guaW5kZXgpIHtcbiAgICAgICAgc2VwYXJhdG9yLmxhc3RJbmRleCsrOyAvLyBBdm9pZCBhbiBpbmZpbml0ZSBsb29wXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChsYXN0TGFzdEluZGV4ID09PSBzdHIubGVuZ3RoKSB7XG4gICAgICBpZiAobGFzdExlbmd0aCB8fCAhc2VwYXJhdG9yLnRlc3QoXCJcIikpIHtcbiAgICAgICAgb3V0cHV0LnB1c2goXCJcIik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC5wdXNoKHN0ci5zbGljZShsYXN0TGFzdEluZGV4KSk7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQubGVuZ3RoID4gbGltaXQgPyBvdXRwdXQuc2xpY2UoMCwgbGltaXQpIDogb3V0cHV0O1xuICB9O1xuXG4gIHJldHVybiBzZWxmO1xufSkoKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIE9uZVZlcnNpb25Db25zdHJhaW50ID0gcmVxdWlyZSgnaW5kaXZpZHVhbC9vbmUtdmVyc2lvbicpO1xuXG52YXIgTVlfVkVSU0lPTiA9ICc3Jztcbk9uZVZlcnNpb25Db25zdHJhaW50KCdldi1zdG9yZScsIE1ZX1ZFUlNJT04pO1xuXG52YXIgaGFzaEtleSA9ICdfX0VWX1NUT1JFX0tFWUAnICsgTVlfVkVSU0lPTjtcblxubW9kdWxlLmV4cG9ydHMgPSBFdlN0b3JlO1xuXG5mdW5jdGlvbiBFdlN0b3JlKGVsZW0pIHtcbiAgICB2YXIgaGFzaCA9IGVsZW1baGFzaEtleV07XG5cbiAgICBpZiAoIWhhc2gpIHtcbiAgICAgICAgaGFzaCA9IGVsZW1baGFzaEtleV0gPSB7fTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFzaDtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuLypnbG9iYWwgd2luZG93LCBnbG9iYWwqL1xuXG52YXIgcm9vdCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID9cbiAgICB3aW5kb3cgOiB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/XG4gICAgZ2xvYmFsIDoge307XG5cbm1vZHVsZS5leHBvcnRzID0gSW5kaXZpZHVhbDtcblxuZnVuY3Rpb24gSW5kaXZpZHVhbChrZXksIHZhbHVlKSB7XG4gICAgaWYgKGtleSBpbiByb290KSB7XG4gICAgICAgIHJldHVybiByb290W2tleV07XG4gICAgfVxuXG4gICAgcm9vdFtrZXldID0gdmFsdWU7XG5cbiAgICByZXR1cm4gdmFsdWU7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBJbmRpdmlkdWFsID0gcmVxdWlyZSgnLi9pbmRleC5qcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9uZVZlcnNpb247XG5cbmZ1bmN0aW9uIE9uZVZlcnNpb24obW9kdWxlTmFtZSwgdmVyc2lvbiwgZGVmYXVsdFZhbHVlKSB7XG4gICAgdmFyIGtleSA9ICdfX0lORElWSURVQUxfT05FX1ZFUlNJT05fJyArIG1vZHVsZU5hbWU7XG4gICAgdmFyIGVuZm9yY2VLZXkgPSBrZXkgKyAnX0VORk9SQ0VfU0lOR0xFVE9OJztcblxuICAgIHZhciB2ZXJzaW9uVmFsdWUgPSBJbmRpdmlkdWFsKGVuZm9yY2VLZXksIHZlcnNpb24pO1xuXG4gICAgaWYgKHZlcnNpb25WYWx1ZSAhPT0gdmVyc2lvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGhhdmUgb25lIGNvcHkgb2YgJyArXG4gICAgICAgICAgICBtb2R1bGVOYW1lICsgJy5cXG4nICtcbiAgICAgICAgICAgICdZb3UgYWxyZWFkeSBoYXZlIHZlcnNpb24gJyArIHZlcnNpb25WYWx1ZSArXG4gICAgICAgICAgICAnIGluc3RhbGxlZC5cXG4nICtcbiAgICAgICAgICAgICdUaGlzIG1lYW5zIHlvdSBjYW5ub3QgaW5zdGFsbCB2ZXJzaW9uICcgKyB2ZXJzaW9uKTtcbiAgICB9XG5cbiAgICByZXR1cm4gSW5kaXZpZHVhbChrZXksIGRlZmF1bHRWYWx1ZSk7XG59XG4iLCJ2YXIgdG9wTGV2ZWwgPSB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6XG4gICAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB7fVxudmFyIG1pbkRvYyA9IHJlcXVpcmUoJ21pbi1kb2N1bWVudCcpO1xuXG5pZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZG9jdW1lbnQ7XG59IGVsc2Uge1xuICAgIHZhciBkb2NjeSA9IHRvcExldmVsWydfX0dMT0JBTF9ET0NVTUVOVF9DQUNIRUA0J107XG5cbiAgICBpZiAoIWRvY2N5KSB7XG4gICAgICAgIGRvY2N5ID0gdG9wTGV2ZWxbJ19fR0xPQkFMX0RPQ1VNRU5UX0NBQ0hFQDQnXSA9IG1pbkRvYztcbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGRvY2N5O1xufVxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNPYmplY3QoeCkge1xuXHRyZXR1cm4gdHlwZW9mIHggPT09IFwib2JqZWN0XCIgJiYgeCAhPT0gbnVsbDtcbn07XG4iLCJ2YXIgbmF0aXZlSXNBcnJheSA9IEFycmF5LmlzQXJyYXlcbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmdcblxubW9kdWxlLmV4cG9ydHMgPSBuYXRpdmVJc0FycmF5IHx8IGlzQXJyYXlcblxuZnVuY3Rpb24gaXNBcnJheShvYmopIHtcbiAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmopID09PSBcIltvYmplY3QgQXJyYXldXCJcbn1cbiIsInZhciBwYXRjaCA9IHJlcXVpcmUoXCIuL3Zkb20vcGF0Y2guanNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBwYXRjaFxuIiwidmFyIGlzT2JqZWN0ID0gcmVxdWlyZShcImlzLW9iamVjdFwiKVxudmFyIGlzSG9vayA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12aG9vay5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFwcGx5UHJvcGVydGllc1xuXG5mdW5jdGlvbiBhcHBseVByb3BlcnRpZXMobm9kZSwgcHJvcHMsIHByZXZpb3VzKSB7XG4gICAgZm9yICh2YXIgcHJvcE5hbWUgaW4gcHJvcHMpIHtcbiAgICAgICAgdmFyIHByb3BWYWx1ZSA9IHByb3BzW3Byb3BOYW1lXVxuXG4gICAgICAgIGlmIChwcm9wVmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmVtb3ZlUHJvcGVydHkobm9kZSwgcHJvcE5hbWUsIHByb3BWYWx1ZSwgcHJldmlvdXMpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzSG9vayhwcm9wVmFsdWUpKSB7XG4gICAgICAgICAgICByZW1vdmVQcm9wZXJ0eShub2RlLCBwcm9wTmFtZSwgcHJvcFZhbHVlLCBwcmV2aW91cylcbiAgICAgICAgICAgIGlmIChwcm9wVmFsdWUuaG9vaykge1xuICAgICAgICAgICAgICAgIHByb3BWYWx1ZS5ob29rKG5vZGUsXG4gICAgICAgICAgICAgICAgICAgIHByb3BOYW1lLFxuICAgICAgICAgICAgICAgICAgICBwcmV2aW91cyA/IHByZXZpb3VzW3Byb3BOYW1lXSA6IHVuZGVmaW5lZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChpc09iamVjdChwcm9wVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcGF0Y2hPYmplY3Qobm9kZSwgcHJvcHMsIHByZXZpb3VzLCBwcm9wTmFtZSwgcHJvcFZhbHVlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbm9kZVtwcm9wTmFtZV0gPSBwcm9wVmFsdWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlUHJvcGVydHkobm9kZSwgcHJvcE5hbWUsIHByb3BWYWx1ZSwgcHJldmlvdXMpIHtcbiAgICBpZiAocHJldmlvdXMpIHtcbiAgICAgICAgdmFyIHByZXZpb3VzVmFsdWUgPSBwcmV2aW91c1twcm9wTmFtZV1cblxuICAgICAgICBpZiAoIWlzSG9vayhwcmV2aW91c1ZhbHVlKSkge1xuICAgICAgICAgICAgaWYgKHByb3BOYW1lID09PSBcImF0dHJpYnV0ZXNcIikge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGF0dHJOYW1lIGluIHByZXZpb3VzVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0ck5hbWUpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wTmFtZSA9PT0gXCJzdHlsZVwiKSB7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSBpbiBwcmV2aW91c1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUuc3R5bGVbaV0gPSBcIlwiXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgcHJldmlvdXNWYWx1ZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgICAgIG5vZGVbcHJvcE5hbWVdID0gXCJcIlxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBub2RlW3Byb3BOYW1lXSA9IG51bGxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChwcmV2aW91c1ZhbHVlLnVuaG9vaykge1xuICAgICAgICAgICAgcHJldmlvdXNWYWx1ZS51bmhvb2sobm9kZSwgcHJvcE5hbWUsIHByb3BWYWx1ZSlcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcGF0Y2hPYmplY3Qobm9kZSwgcHJvcHMsIHByZXZpb3VzLCBwcm9wTmFtZSwgcHJvcFZhbHVlKSB7XG4gICAgdmFyIHByZXZpb3VzVmFsdWUgPSBwcmV2aW91cyA/IHByZXZpb3VzW3Byb3BOYW1lXSA6IHVuZGVmaW5lZFxuXG4gICAgLy8gU2V0IGF0dHJpYnV0ZXNcbiAgICBpZiAocHJvcE5hbWUgPT09IFwiYXR0cmlidXRlc1wiKSB7XG4gICAgICAgIGZvciAodmFyIGF0dHJOYW1lIGluIHByb3BWYWx1ZSkge1xuICAgICAgICAgICAgdmFyIGF0dHJWYWx1ZSA9IHByb3BWYWx1ZVthdHRyTmFtZV1cblxuICAgICAgICAgICAgaWYgKGF0dHJWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5yZW1vdmVBdHRyaWJ1dGUoYXR0ck5hbWUpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKGF0dHJOYW1lLCBhdHRyVmFsdWUpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZihwcmV2aW91c1ZhbHVlICYmIGlzT2JqZWN0KHByZXZpb3VzVmFsdWUpICYmXG4gICAgICAgIGdldFByb3RvdHlwZShwcmV2aW91c1ZhbHVlKSAhPT0gZ2V0UHJvdG90eXBlKHByb3BWYWx1ZSkpIHtcbiAgICAgICAgbm9kZVtwcm9wTmFtZV0gPSBwcm9wVmFsdWVcbiAgICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKCFpc09iamVjdChub2RlW3Byb3BOYW1lXSkpIHtcbiAgICAgICAgbm9kZVtwcm9wTmFtZV0gPSB7fVxuICAgIH1cblxuICAgIHZhciByZXBsYWNlciA9IHByb3BOYW1lID09PSBcInN0eWxlXCIgPyBcIlwiIDogdW5kZWZpbmVkXG5cbiAgICBmb3IgKHZhciBrIGluIHByb3BWYWx1ZSkge1xuICAgICAgICB2YXIgdmFsdWUgPSBwcm9wVmFsdWVba11cbiAgICAgICAgbm9kZVtwcm9wTmFtZV1ba10gPSAodmFsdWUgPT09IHVuZGVmaW5lZCkgPyByZXBsYWNlciA6IHZhbHVlXG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRQcm90b3R5cGUodmFsdWUpIHtcbiAgICBpZiAoT2JqZWN0LmdldFByb3RvdHlwZU9mKSB7XG4gICAgICAgIHJldHVybiBPYmplY3QuZ2V0UHJvdG90eXBlT2YodmFsdWUpXG4gICAgfSBlbHNlIGlmICh2YWx1ZS5fX3Byb3RvX18pIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlLl9fcHJvdG9fX1xuICAgIH0gZWxzZSBpZiAodmFsdWUuY29uc3RydWN0b3IpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlLmNvbnN0cnVjdG9yLnByb3RvdHlwZVxuICAgIH1cbn1cbiIsInZhciBkb2N1bWVudCA9IHJlcXVpcmUoXCJnbG9iYWwvZG9jdW1lbnRcIilcblxudmFyIGFwcGx5UHJvcGVydGllcyA9IHJlcXVpcmUoXCIuL2FwcGx5LXByb3BlcnRpZXNcIilcblxudmFyIGlzVk5vZGUgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdm5vZGUuanNcIilcbnZhciBpc1ZUZXh0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZ0ZXh0LmpzXCIpXG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtd2lkZ2V0LmpzXCIpXG52YXIgaGFuZGxlVGh1bmsgPSByZXF1aXJlKFwiLi4vdm5vZGUvaGFuZGxlLXRodW5rLmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlRWxlbWVudFxuXG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50KHZub2RlLCBvcHRzKSB7XG4gICAgdmFyIGRvYyA9IG9wdHMgPyBvcHRzLmRvY3VtZW50IHx8IGRvY3VtZW50IDogZG9jdW1lbnRcbiAgICB2YXIgd2FybiA9IG9wdHMgPyBvcHRzLndhcm4gOiBudWxsXG5cbiAgICB2bm9kZSA9IGhhbmRsZVRodW5rKHZub2RlKS5hXG5cbiAgICBpZiAoaXNXaWRnZXQodm5vZGUpKSB7XG4gICAgICAgIHJldHVybiB2bm9kZS5pbml0KClcbiAgICB9IGVsc2UgaWYgKGlzVlRleHQodm5vZGUpKSB7XG4gICAgICAgIHJldHVybiBkb2MuY3JlYXRlVGV4dE5vZGUodm5vZGUudGV4dClcbiAgICB9IGVsc2UgaWYgKCFpc1ZOb2RlKHZub2RlKSkge1xuICAgICAgICBpZiAod2Fybikge1xuICAgICAgICAgICAgd2FybihcIkl0ZW0gaXMgbm90IGEgdmFsaWQgdmlydHVhbCBkb20gbm9kZVwiLCB2bm9kZSlcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIHZhciBub2RlID0gKHZub2RlLm5hbWVzcGFjZSA9PT0gbnVsbCkgP1xuICAgICAgICBkb2MuY3JlYXRlRWxlbWVudCh2bm9kZS50YWdOYW1lKSA6XG4gICAgICAgIGRvYy5jcmVhdGVFbGVtZW50TlModm5vZGUubmFtZXNwYWNlLCB2bm9kZS50YWdOYW1lKVxuXG4gICAgdmFyIHByb3BzID0gdm5vZGUucHJvcGVydGllc1xuICAgIGFwcGx5UHJvcGVydGllcyhub2RlLCBwcm9wcylcblxuICAgIHZhciBjaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBjaGlsZE5vZGUgPSBjcmVhdGVFbGVtZW50KGNoaWxkcmVuW2ldLCBvcHRzKVxuICAgICAgICBpZiAoY2hpbGROb2RlKSB7XG4gICAgICAgICAgICBub2RlLmFwcGVuZENoaWxkKGNoaWxkTm9kZSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBub2RlXG59XG4iLCIvLyBNYXBzIGEgdmlydHVhbCBET00gdHJlZSBvbnRvIGEgcmVhbCBET00gdHJlZSBpbiBhbiBlZmZpY2llbnQgbWFubmVyLlxuLy8gV2UgZG9uJ3Qgd2FudCB0byByZWFkIGFsbCBvZiB0aGUgRE9NIG5vZGVzIGluIHRoZSB0cmVlIHNvIHdlIHVzZVxuLy8gdGhlIGluLW9yZGVyIHRyZWUgaW5kZXhpbmcgdG8gZWxpbWluYXRlIHJlY3Vyc2lvbiBkb3duIGNlcnRhaW4gYnJhbmNoZXMuXG4vLyBXZSBvbmx5IHJlY3Vyc2UgaW50byBhIERPTSBub2RlIGlmIHdlIGtub3cgdGhhdCBpdCBjb250YWlucyBhIGNoaWxkIG9mXG4vLyBpbnRlcmVzdC5cblxudmFyIG5vQ2hpbGQgPSB7fVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRvbUluZGV4XG5cbmZ1bmN0aW9uIGRvbUluZGV4KHJvb3ROb2RlLCB0cmVlLCBpbmRpY2VzLCBub2Rlcykge1xuICAgIGlmICghaW5kaWNlcyB8fCBpbmRpY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4ge31cbiAgICB9IGVsc2Uge1xuICAgICAgICBpbmRpY2VzLnNvcnQoYXNjZW5kaW5nKVxuICAgICAgICByZXR1cm4gcmVjdXJzZShyb290Tm9kZSwgdHJlZSwgaW5kaWNlcywgbm9kZXMsIDApXG4gICAgfVxufVxuXG5mdW5jdGlvbiByZWN1cnNlKHJvb3ROb2RlLCB0cmVlLCBpbmRpY2VzLCBub2Rlcywgcm9vdEluZGV4KSB7XG4gICAgbm9kZXMgPSBub2RlcyB8fCB7fVxuXG5cbiAgICBpZiAocm9vdE5vZGUpIHtcbiAgICAgICAgaWYgKGluZGV4SW5SYW5nZShpbmRpY2VzLCByb290SW5kZXgsIHJvb3RJbmRleCkpIHtcbiAgICAgICAgICAgIG5vZGVzW3Jvb3RJbmRleF0gPSByb290Tm9kZVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHZDaGlsZHJlbiA9IHRyZWUuY2hpbGRyZW5cblxuICAgICAgICBpZiAodkNoaWxkcmVuKSB7XG5cbiAgICAgICAgICAgIHZhciBjaGlsZE5vZGVzID0gcm9vdE5vZGUuY2hpbGROb2Rlc1xuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRyZWUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICByb290SW5kZXggKz0gMVxuXG4gICAgICAgICAgICAgICAgdmFyIHZDaGlsZCA9IHZDaGlsZHJlbltpXSB8fCBub0NoaWxkXG4gICAgICAgICAgICAgICAgdmFyIG5leHRJbmRleCA9IHJvb3RJbmRleCArICh2Q2hpbGQuY291bnQgfHwgMClcblxuICAgICAgICAgICAgICAgIC8vIHNraXAgcmVjdXJzaW9uIGRvd24gdGhlIHRyZWUgaWYgdGhlcmUgYXJlIG5vIG5vZGVzIGRvd24gaGVyZVxuICAgICAgICAgICAgICAgIGlmIChpbmRleEluUmFuZ2UoaW5kaWNlcywgcm9vdEluZGV4LCBuZXh0SW5kZXgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlY3Vyc2UoY2hpbGROb2Rlc1tpXSwgdkNoaWxkLCBpbmRpY2VzLCBub2Rlcywgcm9vdEluZGV4KVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJvb3RJbmRleCA9IG5leHRJbmRleFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGVzXG59XG5cbi8vIEJpbmFyeSBzZWFyY2ggZm9yIGFuIGluZGV4IGluIHRoZSBpbnRlcnZhbCBbbGVmdCwgcmlnaHRdXG5mdW5jdGlvbiBpbmRleEluUmFuZ2UoaW5kaWNlcywgbGVmdCwgcmlnaHQpIHtcbiAgICBpZiAoaW5kaWNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuXG4gICAgdmFyIG1pbkluZGV4ID0gMFxuICAgIHZhciBtYXhJbmRleCA9IGluZGljZXMubGVuZ3RoIC0gMVxuICAgIHZhciBjdXJyZW50SW5kZXhcbiAgICB2YXIgY3VycmVudEl0ZW1cblxuICAgIHdoaWxlIChtaW5JbmRleCA8PSBtYXhJbmRleCkge1xuICAgICAgICBjdXJyZW50SW5kZXggPSAoKG1heEluZGV4ICsgbWluSW5kZXgpIC8gMikgPj4gMFxuICAgICAgICBjdXJyZW50SXRlbSA9IGluZGljZXNbY3VycmVudEluZGV4XVxuXG4gICAgICAgIGlmIChtaW5JbmRleCA9PT0gbWF4SW5kZXgpIHtcbiAgICAgICAgICAgIHJldHVybiBjdXJyZW50SXRlbSA+PSBsZWZ0ICYmIGN1cnJlbnRJdGVtIDw9IHJpZ2h0XG4gICAgICAgIH0gZWxzZSBpZiAoY3VycmVudEl0ZW0gPCBsZWZ0KSB7XG4gICAgICAgICAgICBtaW5JbmRleCA9IGN1cnJlbnRJbmRleCArIDFcbiAgICAgICAgfSBlbHNlICBpZiAoY3VycmVudEl0ZW0gPiByaWdodCkge1xuICAgICAgICAgICAgbWF4SW5kZXggPSBjdXJyZW50SW5kZXggLSAxXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBhc2NlbmRpbmcoYSwgYikge1xuICAgIHJldHVybiBhID4gYiA/IDEgOiAtMVxufVxuIiwidmFyIGFwcGx5UHJvcGVydGllcyA9IHJlcXVpcmUoXCIuL2FwcGx5LXByb3BlcnRpZXNcIilcblxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXdpZGdldC5qc1wiKVxudmFyIFZQYXRjaCA9IHJlcXVpcmUoXCIuLi92bm9kZS92cGF0Y2guanNcIilcblxudmFyIHJlbmRlciA9IHJlcXVpcmUoXCIuL2NyZWF0ZS1lbGVtZW50XCIpXG52YXIgdXBkYXRlV2lkZ2V0ID0gcmVxdWlyZShcIi4vdXBkYXRlLXdpZGdldFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFwcGx5UGF0Y2hcblxuZnVuY3Rpb24gYXBwbHlQYXRjaCh2cGF0Y2gsIGRvbU5vZGUsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgdHlwZSA9IHZwYXRjaC50eXBlXG4gICAgdmFyIHZOb2RlID0gdnBhdGNoLnZOb2RlXG4gICAgdmFyIHBhdGNoID0gdnBhdGNoLnBhdGNoXG5cbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgY2FzZSBWUGF0Y2guUkVNT1ZFOlxuICAgICAgICAgICAgcmV0dXJuIHJlbW92ZU5vZGUoZG9tTm9kZSwgdk5vZGUpXG4gICAgICAgIGNhc2UgVlBhdGNoLklOU0VSVDpcbiAgICAgICAgICAgIHJldHVybiBpbnNlcnROb2RlKGRvbU5vZGUsIHBhdGNoLCByZW5kZXJPcHRpb25zKVxuICAgICAgICBjYXNlIFZQYXRjaC5WVEVYVDpcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmdQYXRjaChkb21Ob2RlLCB2Tm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpXG4gICAgICAgIGNhc2UgVlBhdGNoLldJREdFVDpcbiAgICAgICAgICAgIHJldHVybiB3aWRnZXRQYXRjaChkb21Ob2RlLCB2Tm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpXG4gICAgICAgIGNhc2UgVlBhdGNoLlZOT0RFOlxuICAgICAgICAgICAgcmV0dXJuIHZOb2RlUGF0Y2goZG9tTm9kZSwgdk5vZGUsIHBhdGNoLCByZW5kZXJPcHRpb25zKVxuICAgICAgICBjYXNlIFZQYXRjaC5PUkRFUjpcbiAgICAgICAgICAgIHJlb3JkZXJDaGlsZHJlbihkb21Ob2RlLCBwYXRjaClcbiAgICAgICAgICAgIHJldHVybiBkb21Ob2RlXG4gICAgICAgIGNhc2UgVlBhdGNoLlBST1BTOlxuICAgICAgICAgICAgYXBwbHlQcm9wZXJ0aWVzKGRvbU5vZGUsIHBhdGNoLCB2Tm9kZS5wcm9wZXJ0aWVzKVxuICAgICAgICAgICAgcmV0dXJuIGRvbU5vZGVcbiAgICAgICAgY2FzZSBWUGF0Y2guVEhVTks6XG4gICAgICAgICAgICByZXR1cm4gcmVwbGFjZVJvb3QoZG9tTm9kZSxcbiAgICAgICAgICAgICAgICByZW5kZXJPcHRpb25zLnBhdGNoKGRvbU5vZGUsIHBhdGNoLCByZW5kZXJPcHRpb25zKSlcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBkb21Ob2RlXG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmVOb2RlKGRvbU5vZGUsIHZOb2RlKSB7XG4gICAgdmFyIHBhcmVudE5vZGUgPSBkb21Ob2RlLnBhcmVudE5vZGVcblxuICAgIGlmIChwYXJlbnROb2RlKSB7XG4gICAgICAgIHBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZG9tTm9kZSlcbiAgICB9XG5cbiAgICBkZXN0cm95V2lkZ2V0KGRvbU5vZGUsIHZOb2RlKTtcblxuICAgIHJldHVybiBudWxsXG59XG5cbmZ1bmN0aW9uIGluc2VydE5vZGUocGFyZW50Tm9kZSwgdk5vZGUsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgbmV3Tm9kZSA9IHJlbmRlcih2Tm9kZSwgcmVuZGVyT3B0aW9ucylcblxuICAgIGlmIChwYXJlbnROb2RlKSB7XG4gICAgICAgIHBhcmVudE5vZGUuYXBwZW5kQ2hpbGQobmV3Tm9kZSlcbiAgICB9XG5cbiAgICByZXR1cm4gcGFyZW50Tm9kZVxufVxuXG5mdW5jdGlvbiBzdHJpbmdQYXRjaChkb21Ob2RlLCBsZWZ0Vk5vZGUsIHZUZXh0LCByZW5kZXJPcHRpb25zKSB7XG4gICAgdmFyIG5ld05vZGVcblxuICAgIGlmIChkb21Ob2RlLm5vZGVUeXBlID09PSAzKSB7XG4gICAgICAgIGRvbU5vZGUucmVwbGFjZURhdGEoMCwgZG9tTm9kZS5sZW5ndGgsIHZUZXh0LnRleHQpXG4gICAgICAgIG5ld05vZGUgPSBkb21Ob2RlXG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHBhcmVudE5vZGUgPSBkb21Ob2RlLnBhcmVudE5vZGVcbiAgICAgICAgbmV3Tm9kZSA9IHJlbmRlcih2VGV4dCwgcmVuZGVyT3B0aW9ucylcblxuICAgICAgICBpZiAocGFyZW50Tm9kZSAmJiBuZXdOb2RlICE9PSBkb21Ob2RlKSB7XG4gICAgICAgICAgICBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdOb2RlLCBkb21Ob2RlKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld05vZGVcbn1cblxuZnVuY3Rpb24gd2lkZ2V0UGF0Y2goZG9tTm9kZSwgbGVmdFZOb2RlLCB3aWRnZXQsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgdXBkYXRpbmcgPSB1cGRhdGVXaWRnZXQobGVmdFZOb2RlLCB3aWRnZXQpXG4gICAgdmFyIG5ld05vZGVcblxuICAgIGlmICh1cGRhdGluZykge1xuICAgICAgICBuZXdOb2RlID0gd2lkZ2V0LnVwZGF0ZShsZWZ0Vk5vZGUsIGRvbU5vZGUpIHx8IGRvbU5vZGVcbiAgICB9IGVsc2Uge1xuICAgICAgICBuZXdOb2RlID0gcmVuZGVyKHdpZGdldCwgcmVuZGVyT3B0aW9ucylcbiAgICB9XG5cbiAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZVxuXG4gICAgaWYgKHBhcmVudE5vZGUgJiYgbmV3Tm9kZSAhPT0gZG9tTm9kZSkge1xuICAgICAgICBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdOb2RlLCBkb21Ob2RlKVxuICAgIH1cblxuICAgIGlmICghdXBkYXRpbmcpIHtcbiAgICAgICAgZGVzdHJveVdpZGdldChkb21Ob2RlLCBsZWZ0Vk5vZGUpXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld05vZGVcbn1cblxuZnVuY3Rpb24gdk5vZGVQYXRjaChkb21Ob2RlLCBsZWZ0Vk5vZGUsIHZOb2RlLCByZW5kZXJPcHRpb25zKSB7XG4gICAgdmFyIHBhcmVudE5vZGUgPSBkb21Ob2RlLnBhcmVudE5vZGVcbiAgICB2YXIgbmV3Tm9kZSA9IHJlbmRlcih2Tm9kZSwgcmVuZGVyT3B0aW9ucylcblxuICAgIGlmIChwYXJlbnROb2RlICYmIG5ld05vZGUgIT09IGRvbU5vZGUpIHtcbiAgICAgICAgcGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobmV3Tm9kZSwgZG9tTm9kZSlcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Tm9kZVxufVxuXG5mdW5jdGlvbiBkZXN0cm95V2lkZ2V0KGRvbU5vZGUsIHcpIHtcbiAgICBpZiAodHlwZW9mIHcuZGVzdHJveSA9PT0gXCJmdW5jdGlvblwiICYmIGlzV2lkZ2V0KHcpKSB7XG4gICAgICAgIHcuZGVzdHJveShkb21Ob2RlKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVvcmRlckNoaWxkcmVuKGRvbU5vZGUsIG1vdmVzKSB7XG4gICAgdmFyIGNoaWxkTm9kZXMgPSBkb21Ob2RlLmNoaWxkTm9kZXNcbiAgICB2YXIga2V5TWFwID0ge31cbiAgICB2YXIgbm9kZVxuICAgIHZhciByZW1vdmVcbiAgICB2YXIgaW5zZXJ0XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1vdmVzLnJlbW92ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcmVtb3ZlID0gbW92ZXMucmVtb3Zlc1tpXVxuICAgICAgICBub2RlID0gY2hpbGROb2Rlc1tyZW1vdmUuZnJvbV1cbiAgICAgICAgaWYgKHJlbW92ZS5rZXkpIHtcbiAgICAgICAgICAgIGtleU1hcFtyZW1vdmUua2V5XSA9IG5vZGVcbiAgICAgICAgfVxuICAgICAgICBkb21Ob2RlLnJlbW92ZUNoaWxkKG5vZGUpXG4gICAgfVxuXG4gICAgdmFyIGxlbmd0aCA9IGNoaWxkTm9kZXMubGVuZ3RoXG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBtb3Zlcy5pbnNlcnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGluc2VydCA9IG1vdmVzLmluc2VydHNbal1cbiAgICAgICAgbm9kZSA9IGtleU1hcFtpbnNlcnQua2V5XVxuICAgICAgICAvLyB0aGlzIGlzIHRoZSB3ZWlyZGVzdCBidWcgaSd2ZSBldmVyIHNlZW4gaW4gd2Via2l0XG4gICAgICAgIGRvbU5vZGUuaW5zZXJ0QmVmb3JlKG5vZGUsIGluc2VydC50byA+PSBsZW5ndGgrKyA/IG51bGwgOiBjaGlsZE5vZGVzW2luc2VydC50b10pXG4gICAgfVxufVxuXG5mdW5jdGlvbiByZXBsYWNlUm9vdChvbGRSb290LCBuZXdSb290KSB7XG4gICAgaWYgKG9sZFJvb3QgJiYgbmV3Um9vdCAmJiBvbGRSb290ICE9PSBuZXdSb290ICYmIG9sZFJvb3QucGFyZW50Tm9kZSkge1xuICAgICAgICBvbGRSb290LnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld1Jvb3QsIG9sZFJvb3QpXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld1Jvb3Q7XG59XG4iLCJ2YXIgZG9jdW1lbnQgPSByZXF1aXJlKFwiZ2xvYmFsL2RvY3VtZW50XCIpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoXCJ4LWlzLWFycmF5XCIpXG5cbnZhciBkb21JbmRleCA9IHJlcXVpcmUoXCIuL2RvbS1pbmRleFwiKVxudmFyIHBhdGNoT3AgPSByZXF1aXJlKFwiLi9wYXRjaC1vcFwiKVxubW9kdWxlLmV4cG9ydHMgPSBwYXRjaFxuXG5mdW5jdGlvbiBwYXRjaChyb290Tm9kZSwgcGF0Y2hlcykge1xuICAgIHJldHVybiBwYXRjaFJlY3Vyc2l2ZShyb290Tm9kZSwgcGF0Y2hlcylcbn1cblxuZnVuY3Rpb24gcGF0Y2hSZWN1cnNpdmUocm9vdE5vZGUsIHBhdGNoZXMsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgaW5kaWNlcyA9IHBhdGNoSW5kaWNlcyhwYXRjaGVzKVxuXG4gICAgaWYgKGluZGljZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiByb290Tm9kZVxuICAgIH1cblxuICAgIHZhciBpbmRleCA9IGRvbUluZGV4KHJvb3ROb2RlLCBwYXRjaGVzLmEsIGluZGljZXMpXG4gICAgdmFyIG93bmVyRG9jdW1lbnQgPSByb290Tm9kZS5vd25lckRvY3VtZW50XG5cbiAgICBpZiAoIXJlbmRlck9wdGlvbnMpIHtcbiAgICAgICAgcmVuZGVyT3B0aW9ucyA9IHsgcGF0Y2g6IHBhdGNoUmVjdXJzaXZlIH1cbiAgICAgICAgaWYgKG93bmVyRG9jdW1lbnQgIT09IGRvY3VtZW50KSB7XG4gICAgICAgICAgICByZW5kZXJPcHRpb25zLmRvY3VtZW50ID0gb3duZXJEb2N1bWVudFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbmRpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBub2RlSW5kZXggPSBpbmRpY2VzW2ldXG4gICAgICAgIHJvb3ROb2RlID0gYXBwbHlQYXRjaChyb290Tm9kZSxcbiAgICAgICAgICAgIGluZGV4W25vZGVJbmRleF0sXG4gICAgICAgICAgICBwYXRjaGVzW25vZGVJbmRleF0sXG4gICAgICAgICAgICByZW5kZXJPcHRpb25zKVxuICAgIH1cblxuICAgIHJldHVybiByb290Tm9kZVxufVxuXG5mdW5jdGlvbiBhcHBseVBhdGNoKHJvb3ROb2RlLCBkb21Ob2RlLCBwYXRjaExpc3QsIHJlbmRlck9wdGlvbnMpIHtcbiAgICBpZiAoIWRvbU5vZGUpIHtcbiAgICAgICAgcmV0dXJuIHJvb3ROb2RlXG4gICAgfVxuXG4gICAgdmFyIG5ld05vZGVcblxuICAgIGlmIChpc0FycmF5KHBhdGNoTGlzdCkpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXRjaExpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIG5ld05vZGUgPSBwYXRjaE9wKHBhdGNoTGlzdFtpXSwgZG9tTm9kZSwgcmVuZGVyT3B0aW9ucylcblxuICAgICAgICAgICAgaWYgKGRvbU5vZGUgPT09IHJvb3ROb2RlKSB7XG4gICAgICAgICAgICAgICAgcm9vdE5vZGUgPSBuZXdOb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBuZXdOb2RlID0gcGF0Y2hPcChwYXRjaExpc3QsIGRvbU5vZGUsIHJlbmRlck9wdGlvbnMpXG5cbiAgICAgICAgaWYgKGRvbU5vZGUgPT09IHJvb3ROb2RlKSB7XG4gICAgICAgICAgICByb290Tm9kZSA9IG5ld05vZGVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByb290Tm9kZVxufVxuXG5mdW5jdGlvbiBwYXRjaEluZGljZXMocGF0Y2hlcykge1xuICAgIHZhciBpbmRpY2VzID0gW11cblxuICAgIGZvciAodmFyIGtleSBpbiBwYXRjaGVzKSB7XG4gICAgICAgIGlmIChrZXkgIT09IFwiYVwiKSB7XG4gICAgICAgICAgICBpbmRpY2VzLnB1c2goTnVtYmVyKGtleSkpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gaW5kaWNlc1xufVxuIiwidmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXdpZGdldC5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHVwZGF0ZVdpZGdldFxuXG5mdW5jdGlvbiB1cGRhdGVXaWRnZXQoYSwgYikge1xuICAgIGlmIChpc1dpZGdldChhKSAmJiBpc1dpZGdldChiKSkge1xuICAgICAgICBpZiAoXCJuYW1lXCIgaW4gYSAmJiBcIm5hbWVcIiBpbiBiKSB7XG4gICAgICAgICAgICByZXR1cm4gYS5pZCA9PT0gYi5pZFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGEuaW5pdCA9PT0gYi5pbml0XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2Vcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIEV2U3RvcmUgPSByZXF1aXJlKCdldi1zdG9yZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV2SG9vaztcblxuZnVuY3Rpb24gRXZIb29rKHZhbHVlKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEV2SG9vaykpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBFdkhvb2sodmFsdWUpO1xuICAgIH1cblxuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbn1cblxuRXZIb29rLnByb3RvdHlwZS5ob29rID0gZnVuY3Rpb24gKG5vZGUsIHByb3BlcnR5TmFtZSkge1xuICAgIHZhciBlcyA9IEV2U3RvcmUobm9kZSk7XG4gICAgdmFyIHByb3BOYW1lID0gcHJvcGVydHlOYW1lLnN1YnN0cigzKTtcblxuICAgIGVzW3Byb3BOYW1lXSA9IHRoaXMudmFsdWU7XG59O1xuXG5Fdkhvb2sucHJvdG90eXBlLnVuaG9vayA9IGZ1bmN0aW9uKG5vZGUsIHByb3BlcnR5TmFtZSkge1xuICAgIHZhciBlcyA9IEV2U3RvcmUobm9kZSk7XG4gICAgdmFyIHByb3BOYW1lID0gcHJvcGVydHlOYW1lLnN1YnN0cigzKTtcblxuICAgIGVzW3Byb3BOYW1lXSA9IHVuZGVmaW5lZDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gU29mdFNldEhvb2s7XG5cbmZ1bmN0aW9uIFNvZnRTZXRIb29rKHZhbHVlKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFNvZnRTZXRIb29rKSkge1xuICAgICAgICByZXR1cm4gbmV3IFNvZnRTZXRIb29rKHZhbHVlKTtcbiAgICB9XG5cbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG59XG5cblNvZnRTZXRIb29rLnByb3RvdHlwZS5ob29rID0gZnVuY3Rpb24gKG5vZGUsIHByb3BlcnR5TmFtZSkge1xuICAgIGlmIChub2RlW3Byb3BlcnR5TmFtZV0gIT09IHRoaXMudmFsdWUpIHtcbiAgICAgICAgbm9kZVtwcm9wZXJ0eU5hbWVdID0gdGhpcy52YWx1ZTtcbiAgICB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ3gtaXMtYXJyYXknKTtcblxudmFyIFZOb2RlID0gcmVxdWlyZSgnLi4vdm5vZGUvdm5vZGUuanMnKTtcbnZhciBWVGV4dCA9IHJlcXVpcmUoJy4uL3Zub2RlL3Z0ZXh0LmpzJyk7XG52YXIgaXNWTm9kZSA9IHJlcXVpcmUoJy4uL3Zub2RlL2lzLXZub2RlJyk7XG52YXIgaXNWVGV4dCA9IHJlcXVpcmUoJy4uL3Zub2RlL2lzLXZ0ZXh0Jyk7XG52YXIgaXNXaWRnZXQgPSByZXF1aXJlKCcuLi92bm9kZS9pcy13aWRnZXQnKTtcbnZhciBpc0hvb2sgPSByZXF1aXJlKCcuLi92bm9kZS9pcy12aG9vaycpO1xudmFyIGlzVlRodW5rID0gcmVxdWlyZSgnLi4vdm5vZGUvaXMtdGh1bmsnKTtcblxudmFyIHBhcnNlVGFnID0gcmVxdWlyZSgnLi9wYXJzZS10YWcuanMnKTtcbnZhciBzb2Z0U2V0SG9vayA9IHJlcXVpcmUoJy4vaG9va3Mvc29mdC1zZXQtaG9vay5qcycpO1xudmFyIGV2SG9vayA9IHJlcXVpcmUoJy4vaG9va3MvZXYtaG9vay5qcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGg7XG5cbmZ1bmN0aW9uIGgodGFnTmFtZSwgcHJvcGVydGllcywgY2hpbGRyZW4pIHtcbiAgICB2YXIgY2hpbGROb2RlcyA9IFtdO1xuICAgIHZhciB0YWcsIHByb3BzLCBrZXksIG5hbWVzcGFjZTtcblxuICAgIGlmICghY2hpbGRyZW4gJiYgaXNDaGlsZHJlbihwcm9wZXJ0aWVzKSkge1xuICAgICAgICBjaGlsZHJlbiA9IHByb3BlcnRpZXM7XG4gICAgICAgIHByb3BzID0ge307XG4gICAgfVxuXG4gICAgcHJvcHMgPSBwcm9wcyB8fCBwcm9wZXJ0aWVzIHx8IHt9O1xuICAgIHRhZyA9IHBhcnNlVGFnKHRhZ05hbWUsIHByb3BzKTtcblxuICAgIC8vIHN1cHBvcnQga2V5c1xuICAgIGlmIChwcm9wcy5oYXNPd25Qcm9wZXJ0eSgna2V5JykpIHtcbiAgICAgICAga2V5ID0gcHJvcHMua2V5O1xuICAgICAgICBwcm9wcy5rZXkgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLy8gc3VwcG9ydCBuYW1lc3BhY2VcbiAgICBpZiAocHJvcHMuaGFzT3duUHJvcGVydHkoJ25hbWVzcGFjZScpKSB7XG4gICAgICAgIG5hbWVzcGFjZSA9IHByb3BzLm5hbWVzcGFjZTtcbiAgICAgICAgcHJvcHMubmFtZXNwYWNlID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIC8vIGZpeCBjdXJzb3IgYnVnXG4gICAgaWYgKHRhZyA9PT0gJ0lOUFVUJyAmJlxuICAgICAgICAhbmFtZXNwYWNlICYmXG4gICAgICAgIHByb3BzLmhhc093blByb3BlcnR5KCd2YWx1ZScpICYmXG4gICAgICAgIHByb3BzLnZhbHVlICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgIWlzSG9vayhwcm9wcy52YWx1ZSlcbiAgICApIHtcbiAgICAgICAgcHJvcHMudmFsdWUgPSBzb2Z0U2V0SG9vayhwcm9wcy52YWx1ZSk7XG4gICAgfVxuXG4gICAgdHJhbnNmb3JtUHJvcGVydGllcyhwcm9wcyk7XG5cbiAgICBpZiAoY2hpbGRyZW4gIT09IHVuZGVmaW5lZCAmJiBjaGlsZHJlbiAhPT0gbnVsbCkge1xuICAgICAgICBhZGRDaGlsZChjaGlsZHJlbiwgY2hpbGROb2RlcywgdGFnLCBwcm9wcyk7XG4gICAgfVxuXG5cbiAgICByZXR1cm4gbmV3IFZOb2RlKHRhZywgcHJvcHMsIGNoaWxkTm9kZXMsIGtleSwgbmFtZXNwYWNlKTtcbn1cblxuZnVuY3Rpb24gYWRkQ2hpbGQoYywgY2hpbGROb2RlcywgdGFnLCBwcm9wcykge1xuICAgIGlmICh0eXBlb2YgYyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgY2hpbGROb2Rlcy5wdXNoKG5ldyBWVGV4dChjKSk7XG4gICAgfSBlbHNlIGlmIChpc0NoaWxkKGMpKSB7XG4gICAgICAgIGNoaWxkTm9kZXMucHVzaChjKTtcbiAgICB9IGVsc2UgaWYgKGlzQXJyYXkoYykpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhZGRDaGlsZChjW2ldLCBjaGlsZE5vZGVzLCB0YWcsIHByb3BzKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYyA9PT0gbnVsbCB8fCBjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IFVuZXhwZWN0ZWRWaXJ0dWFsRWxlbWVudCh7XG4gICAgICAgICAgICBmb3JlaWduT2JqZWN0OiBjLFxuICAgICAgICAgICAgcGFyZW50Vm5vZGU6IHtcbiAgICAgICAgICAgICAgICB0YWdOYW1lOiB0YWcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczogcHJvcHNcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1Qcm9wZXJ0aWVzKHByb3BzKSB7XG4gICAgZm9yICh2YXIgcHJvcE5hbWUgaW4gcHJvcHMpIHtcbiAgICAgICAgaWYgKHByb3BzLmhhc093blByb3BlcnR5KHByb3BOYW1lKSkge1xuICAgICAgICAgICAgdmFyIHZhbHVlID0gcHJvcHNbcHJvcE5hbWVdO1xuXG4gICAgICAgICAgICBpZiAoaXNIb29rKHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocHJvcE5hbWUuc3Vic3RyKDAsIDMpID09PSAnZXYtJykge1xuICAgICAgICAgICAgICAgIC8vIGFkZCBldi1mb28gc3VwcG9ydFxuICAgICAgICAgICAgICAgIHByb3BzW3Byb3BOYW1lXSA9IGV2SG9vayh2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGlzQ2hpbGQoeCkge1xuICAgIHJldHVybiBpc1ZOb2RlKHgpIHx8IGlzVlRleHQoeCkgfHwgaXNXaWRnZXQoeCkgfHwgaXNWVGh1bmsoeCk7XG59XG5cbmZ1bmN0aW9uIGlzQ2hpbGRyZW4oeCkge1xuICAgIHJldHVybiB0eXBlb2YgeCA9PT0gJ3N0cmluZycgfHwgaXNBcnJheSh4KSB8fCBpc0NoaWxkKHgpO1xufVxuXG5mdW5jdGlvbiBVbmV4cGVjdGVkVmlydHVhbEVsZW1lbnQoZGF0YSkge1xuICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoKTtcblxuICAgIGVyci50eXBlID0gJ3ZpcnR1YWwtaHlwZXJzY3JpcHQudW5leHBlY3RlZC52aXJ0dWFsLWVsZW1lbnQnO1xuICAgIGVyci5tZXNzYWdlID0gJ1VuZXhwZWN0ZWQgdmlydHVhbCBjaGlsZCBwYXNzZWQgdG8gaCgpLlxcbicgK1xuICAgICAgICAnRXhwZWN0ZWQgYSBWTm9kZSAvIFZ0aHVuayAvIFZXaWRnZXQgLyBzdHJpbmcgYnV0OlxcbicgK1xuICAgICAgICAnZ290OlxcbicgK1xuICAgICAgICBlcnJvclN0cmluZyhkYXRhLmZvcmVpZ25PYmplY3QpICtcbiAgICAgICAgJy5cXG4nICtcbiAgICAgICAgJ1RoZSBwYXJlbnQgdm5vZGUgaXM6XFxuJyArXG4gICAgICAgIGVycm9yU3RyaW5nKGRhdGEucGFyZW50Vm5vZGUpXG4gICAgICAgICdcXG4nICtcbiAgICAgICAgJ1N1Z2dlc3RlZCBmaXg6IGNoYW5nZSB5b3VyIGBoKC4uLiwgWyAuLi4gXSlgIGNhbGxzaXRlLic7XG4gICAgZXJyLmZvcmVpZ25PYmplY3QgPSBkYXRhLmZvcmVpZ25PYmplY3Q7XG4gICAgZXJyLnBhcmVudFZub2RlID0gZGF0YS5wYXJlbnRWbm9kZTtcblxuICAgIHJldHVybiBlcnI7XG59XG5cbmZ1bmN0aW9uIGVycm9yU3RyaW5nKG9iaikge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShvYmosIG51bGwsICcgICAgJyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gU3RyaW5nKG9iaik7XG4gICAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3BsaXQgPSByZXF1aXJlKCdicm93c2VyLXNwbGl0Jyk7XG5cbnZhciBjbGFzc0lkU3BsaXQgPSAvKFtcXC4jXT9bYS16QS1aMC05XzotXSspLztcbnZhciBub3RDbGFzc0lkID0gL15cXC58Iy87XG5cbm1vZHVsZS5leHBvcnRzID0gcGFyc2VUYWc7XG5cbmZ1bmN0aW9uIHBhcnNlVGFnKHRhZywgcHJvcHMpIHtcbiAgICBpZiAoIXRhZykge1xuICAgICAgICByZXR1cm4gJ0RJVic7XG4gICAgfVxuXG4gICAgdmFyIG5vSWQgPSAhKHByb3BzLmhhc093blByb3BlcnR5KCdpZCcpKTtcblxuICAgIHZhciB0YWdQYXJ0cyA9IHNwbGl0KHRhZywgY2xhc3NJZFNwbGl0KTtcbiAgICB2YXIgdGFnTmFtZSA9IG51bGw7XG5cbiAgICBpZiAobm90Q2xhc3NJZC50ZXN0KHRhZ1BhcnRzWzFdKSkge1xuICAgICAgICB0YWdOYW1lID0gJ0RJVic7XG4gICAgfVxuXG4gICAgdmFyIGNsYXNzZXMsIHBhcnQsIHR5cGUsIGk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgdGFnUGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcGFydCA9IHRhZ1BhcnRzW2ldO1xuXG4gICAgICAgIGlmICghcGFydCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICB0eXBlID0gcGFydC5jaGFyQXQoMCk7XG5cbiAgICAgICAgaWYgKCF0YWdOYW1lKSB7XG4gICAgICAgICAgICB0YWdOYW1lID0gcGFydDtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSAnLicpIHtcbiAgICAgICAgICAgIGNsYXNzZXMgPSBjbGFzc2VzIHx8IFtdO1xuICAgICAgICAgICAgY2xhc3Nlcy5wdXNoKHBhcnQuc3Vic3RyaW5nKDEsIHBhcnQubGVuZ3RoKSk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJyMnICYmIG5vSWQpIHtcbiAgICAgICAgICAgIHByb3BzLmlkID0gcGFydC5zdWJzdHJpbmcoMSwgcGFydC5sZW5ndGgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNsYXNzZXMpIHtcbiAgICAgICAgaWYgKHByb3BzLmNsYXNzTmFtZSkge1xuICAgICAgICAgICAgY2xhc3Nlcy5wdXNoKHByb3BzLmNsYXNzTmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9wcy5jbGFzc05hbWUgPSBjbGFzc2VzLmpvaW4oJyAnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvcHMubmFtZXNwYWNlID8gdGFnTmFtZSA6IHRhZ05hbWUudG9VcHBlckNhc2UoKTtcbn1cbiIsInZhciBpc1ZOb2RlID0gcmVxdWlyZShcIi4vaXMtdm5vZGVcIilcbnZhciBpc1ZUZXh0ID0gcmVxdWlyZShcIi4vaXMtdnRleHRcIilcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuL2lzLXdpZGdldFwiKVxudmFyIGlzVGh1bmsgPSByZXF1aXJlKFwiLi9pcy10aHVua1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZVRodW5rXG5cbmZ1bmN0aW9uIGhhbmRsZVRodW5rKGEsIGIpIHtcbiAgICB2YXIgcmVuZGVyZWRBID0gYVxuICAgIHZhciByZW5kZXJlZEIgPSBiXG5cbiAgICBpZiAoaXNUaHVuayhiKSkge1xuICAgICAgICByZW5kZXJlZEIgPSByZW5kZXJUaHVuayhiLCBhKVxuICAgIH1cblxuICAgIGlmIChpc1RodW5rKGEpKSB7XG4gICAgICAgIHJlbmRlcmVkQSA9IHJlbmRlclRodW5rKGEsIG51bGwpXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgYTogcmVuZGVyZWRBLFxuICAgICAgICBiOiByZW5kZXJlZEJcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbmRlclRodW5rKHRodW5rLCBwcmV2aW91cykge1xuICAgIHZhciByZW5kZXJlZFRodW5rID0gdGh1bmsudm5vZGVcblxuICAgIGlmICghcmVuZGVyZWRUaHVuaykge1xuICAgICAgICByZW5kZXJlZFRodW5rID0gdGh1bmsudm5vZGUgPSB0aHVuay5yZW5kZXIocHJldmlvdXMpXG4gICAgfVxuXG4gICAgaWYgKCEoaXNWTm9kZShyZW5kZXJlZFRodW5rKSB8fFxuICAgICAgICAgICAgaXNWVGV4dChyZW5kZXJlZFRodW5rKSB8fFxuICAgICAgICAgICAgaXNXaWRnZXQocmVuZGVyZWRUaHVuaykpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInRodW5rIGRpZCBub3QgcmV0dXJuIGEgdmFsaWQgbm9kZVwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVuZGVyZWRUaHVua1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBpc1RodW5rXHJcblxyXG5mdW5jdGlvbiBpc1RodW5rKHQpIHtcclxuICAgIHJldHVybiB0ICYmIHQudHlwZSA9PT0gXCJUaHVua1wiXHJcbn1cclxuIiwibW9kdWxlLmV4cG9ydHMgPSBpc0hvb2tcblxuZnVuY3Rpb24gaXNIb29rKGhvb2spIHtcbiAgICByZXR1cm4gaG9vayAmJlxuICAgICAgKHR5cGVvZiBob29rLmhvb2sgPT09IFwiZnVuY3Rpb25cIiAmJiAhaG9vay5oYXNPd25Qcm9wZXJ0eShcImhvb2tcIikgfHxcbiAgICAgICB0eXBlb2YgaG9vay51bmhvb2sgPT09IFwiZnVuY3Rpb25cIiAmJiAhaG9vay5oYXNPd25Qcm9wZXJ0eShcInVuaG9va1wiKSlcbn1cbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzVmlydHVhbE5vZGVcblxuZnVuY3Rpb24gaXNWaXJ0dWFsTm9kZSh4KSB7XG4gICAgcmV0dXJuIHggJiYgeC50eXBlID09PSBcIlZpcnR1YWxOb2RlXCIgJiYgeC52ZXJzaW9uID09PSB2ZXJzaW9uXG59XG4iLCJ2YXIgdmVyc2lvbiA9IHJlcXVpcmUoXCIuL3ZlcnNpb25cIilcblxubW9kdWxlLmV4cG9ydHMgPSBpc1ZpcnR1YWxUZXh0XG5cbmZ1bmN0aW9uIGlzVmlydHVhbFRleHQoeCkge1xuICAgIHJldHVybiB4ICYmIHgudHlwZSA9PT0gXCJWaXJ0dWFsVGV4dFwiICYmIHgudmVyc2lvbiA9PT0gdmVyc2lvblxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBpc1dpZGdldFxuXG5mdW5jdGlvbiBpc1dpZGdldCh3KSB7XG4gICAgcmV0dXJuIHcgJiYgdy50eXBlID09PSBcIldpZGdldFwiXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFwiMlwiXG4iLCJ2YXIgdmVyc2lvbiA9IHJlcXVpcmUoXCIuL3ZlcnNpb25cIilcbnZhciBpc1ZOb2RlID0gcmVxdWlyZShcIi4vaXMtdm5vZGVcIilcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuL2lzLXdpZGdldFwiKVxudmFyIGlzVGh1bmsgPSByZXF1aXJlKFwiLi9pcy10aHVua1wiKVxudmFyIGlzVkhvb2sgPSByZXF1aXJlKFwiLi9pcy12aG9va1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IFZpcnR1YWxOb2RlXG5cbnZhciBub1Byb3BlcnRpZXMgPSB7fVxudmFyIG5vQ2hpbGRyZW4gPSBbXVxuXG5mdW5jdGlvbiBWaXJ0dWFsTm9kZSh0YWdOYW1lLCBwcm9wZXJ0aWVzLCBjaGlsZHJlbiwga2V5LCBuYW1lc3BhY2UpIHtcbiAgICB0aGlzLnRhZ05hbWUgPSB0YWdOYW1lXG4gICAgdGhpcy5wcm9wZXJ0aWVzID0gcHJvcGVydGllcyB8fCBub1Byb3BlcnRpZXNcbiAgICB0aGlzLmNoaWxkcmVuID0gY2hpbGRyZW4gfHwgbm9DaGlsZHJlblxuICAgIHRoaXMua2V5ID0ga2V5ICE9IG51bGwgPyBTdHJpbmcoa2V5KSA6IHVuZGVmaW5lZFxuICAgIHRoaXMubmFtZXNwYWNlID0gKHR5cGVvZiBuYW1lc3BhY2UgPT09IFwic3RyaW5nXCIpID8gbmFtZXNwYWNlIDogbnVsbFxuXG4gICAgdmFyIGNvdW50ID0gKGNoaWxkcmVuICYmIGNoaWxkcmVuLmxlbmd0aCkgfHwgMFxuICAgIHZhciBkZXNjZW5kYW50cyA9IDBcbiAgICB2YXIgaGFzV2lkZ2V0cyA9IGZhbHNlXG4gICAgdmFyIGhhc1RodW5rcyA9IGZhbHNlXG4gICAgdmFyIGRlc2NlbmRhbnRIb29rcyA9IGZhbHNlXG4gICAgdmFyIGhvb2tzXG5cbiAgICBmb3IgKHZhciBwcm9wTmFtZSBpbiBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KHByb3BOYW1lKSkge1xuICAgICAgICAgICAgdmFyIHByb3BlcnR5ID0gcHJvcGVydGllc1twcm9wTmFtZV1cbiAgICAgICAgICAgIGlmIChpc1ZIb29rKHByb3BlcnR5KSAmJiBwcm9wZXJ0eS51bmhvb2spIHtcbiAgICAgICAgICAgICAgICBpZiAoIWhvb2tzKSB7XG4gICAgICAgICAgICAgICAgICAgIGhvb2tzID0ge31cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBob29rc1twcm9wTmFtZV0gPSBwcm9wZXJ0eVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG4gICAgICAgIGlmIChpc1ZOb2RlKGNoaWxkKSkge1xuICAgICAgICAgICAgZGVzY2VuZGFudHMgKz0gY2hpbGQuY291bnQgfHwgMFxuXG4gICAgICAgICAgICBpZiAoIWhhc1dpZGdldHMgJiYgY2hpbGQuaGFzV2lkZ2V0cykge1xuICAgICAgICAgICAgICAgIGhhc1dpZGdldHMgPSB0cnVlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghaGFzVGh1bmtzICYmIGNoaWxkLmhhc1RodW5rcykge1xuICAgICAgICAgICAgICAgIGhhc1RodW5rcyA9IHRydWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFkZXNjZW5kYW50SG9va3MgJiYgKGNoaWxkLmhvb2tzIHx8IGNoaWxkLmRlc2NlbmRhbnRIb29rcykpIHtcbiAgICAgICAgICAgICAgICBkZXNjZW5kYW50SG9va3MgPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoIWhhc1dpZGdldHMgJiYgaXNXaWRnZXQoY2hpbGQpKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGNoaWxkLmRlc3Ryb3kgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIGhhc1dpZGdldHMgPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoIWhhc1RodW5rcyAmJiBpc1RodW5rKGNoaWxkKSkge1xuICAgICAgICAgICAgaGFzVGh1bmtzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuY291bnQgPSBjb3VudCArIGRlc2NlbmRhbnRzXG4gICAgdGhpcy5oYXNXaWRnZXRzID0gaGFzV2lkZ2V0c1xuICAgIHRoaXMuaGFzVGh1bmtzID0gaGFzVGh1bmtzXG4gICAgdGhpcy5ob29rcyA9IGhvb2tzXG4gICAgdGhpcy5kZXNjZW5kYW50SG9va3MgPSBkZXNjZW5kYW50SG9va3Ncbn1cblxuVmlydHVhbE5vZGUucHJvdG90eXBlLnZlcnNpb24gPSB2ZXJzaW9uXG5WaXJ0dWFsTm9kZS5wcm90b3R5cGUudHlwZSA9IFwiVmlydHVhbE5vZGVcIlxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG5cblZpcnR1YWxQYXRjaC5OT05FID0gMFxuVmlydHVhbFBhdGNoLlZURVhUID0gMVxuVmlydHVhbFBhdGNoLlZOT0RFID0gMlxuVmlydHVhbFBhdGNoLldJREdFVCA9IDNcblZpcnR1YWxQYXRjaC5QUk9QUyA9IDRcblZpcnR1YWxQYXRjaC5PUkRFUiA9IDVcblZpcnR1YWxQYXRjaC5JTlNFUlQgPSA2XG5WaXJ0dWFsUGF0Y2guUkVNT1ZFID0gN1xuVmlydHVhbFBhdGNoLlRIVU5LID0gOFxuXG5tb2R1bGUuZXhwb3J0cyA9IFZpcnR1YWxQYXRjaFxuXG5mdW5jdGlvbiBWaXJ0dWFsUGF0Y2godHlwZSwgdk5vZGUsIHBhdGNoKSB7XG4gICAgdGhpcy50eXBlID0gTnVtYmVyKHR5cGUpXG4gICAgdGhpcy52Tm9kZSA9IHZOb2RlXG4gICAgdGhpcy5wYXRjaCA9IHBhdGNoXG59XG5cblZpcnR1YWxQYXRjaC5wcm90b3R5cGUudmVyc2lvbiA9IHZlcnNpb25cblZpcnR1YWxQYXRjaC5wcm90b3R5cGUudHlwZSA9IFwiVmlydHVhbFBhdGNoXCJcbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IFZpcnR1YWxUZXh0XG5cbmZ1bmN0aW9uIFZpcnR1YWxUZXh0KHRleHQpIHtcbiAgICB0aGlzLnRleHQgPSBTdHJpbmcodGV4dClcbn1cblxuVmlydHVhbFRleHQucHJvdG90eXBlLnZlcnNpb24gPSB2ZXJzaW9uXG5WaXJ0dWFsVGV4dC5wcm90b3R5cGUudHlwZSA9IFwiVmlydHVhbFRleHRcIlxuIiwidmFyIGlzT2JqZWN0ID0gcmVxdWlyZShcImlzLW9iamVjdFwiKVxudmFyIGlzSG9vayA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12aG9va1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRpZmZQcm9wc1xuXG5mdW5jdGlvbiBkaWZmUHJvcHMoYSwgYikge1xuICAgIHZhciBkaWZmXG5cbiAgICBmb3IgKHZhciBhS2V5IGluIGEpIHtcbiAgICAgICAgaWYgKCEoYUtleSBpbiBiKSkge1xuICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgIGRpZmZbYUtleV0gPSB1bmRlZmluZWRcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBhVmFsdWUgPSBhW2FLZXldXG4gICAgICAgIHZhciBiVmFsdWUgPSBiW2FLZXldXG5cbiAgICAgICAgaWYgKGFWYWx1ZSA9PT0gYlZhbHVlKSB7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGlzT2JqZWN0KGFWYWx1ZSkgJiYgaXNPYmplY3QoYlZhbHVlKSkge1xuICAgICAgICAgICAgaWYgKGdldFByb3RvdHlwZShiVmFsdWUpICE9PSBnZXRQcm90b3R5cGUoYVZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICAgICAgZGlmZlthS2V5XSA9IGJWYWx1ZVxuICAgICAgICAgICAgfSBlbHNlIGlmIChpc0hvb2soYlZhbHVlKSkge1xuICAgICAgICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgICAgICBkaWZmW2FLZXldID0gYlZhbHVlXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBvYmplY3REaWZmID0gZGlmZlByb3BzKGFWYWx1ZSwgYlZhbHVlKVxuICAgICAgICAgICAgICAgIGlmIChvYmplY3REaWZmKSB7XG4gICAgICAgICAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICAgICAgICAgIGRpZmZbYUtleV0gPSBvYmplY3REaWZmXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgIGRpZmZbYUtleV0gPSBiVmFsdWVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIGJLZXkgaW4gYikge1xuICAgICAgICBpZiAoIShiS2V5IGluIGEpKSB7XG4gICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgZGlmZltiS2V5XSA9IGJbYktleV1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkaWZmXG59XG5cbmZ1bmN0aW9uIGdldFByb3RvdHlwZSh2YWx1ZSkge1xuICBpZiAoT2JqZWN0LmdldFByb3RvdHlwZU9mKSB7XG4gICAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSlcbiAgfSBlbHNlIGlmICh2YWx1ZS5fX3Byb3RvX18pIHtcbiAgICByZXR1cm4gdmFsdWUuX19wcm90b19fXG4gIH0gZWxzZSBpZiAodmFsdWUuY29uc3RydWN0b3IpIHtcbiAgICByZXR1cm4gdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlXG4gIH1cbn1cbiIsInZhciBpc0FycmF5ID0gcmVxdWlyZShcIngtaXMtYXJyYXlcIilcblxudmFyIFZQYXRjaCA9IHJlcXVpcmUoXCIuLi92bm9kZS92cGF0Y2hcIilcbnZhciBpc1ZOb2RlID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZub2RlXCIpXG52YXIgaXNWVGV4dCA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12dGV4dFwiKVxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXdpZGdldFwiKVxudmFyIGlzVGh1bmsgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdGh1bmtcIilcbnZhciBoYW5kbGVUaHVuayA9IHJlcXVpcmUoXCIuLi92bm9kZS9oYW5kbGUtdGh1bmtcIilcblxudmFyIGRpZmZQcm9wcyA9IHJlcXVpcmUoXCIuL2RpZmYtcHJvcHNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBkaWZmXG5cbmZ1bmN0aW9uIGRpZmYoYSwgYikge1xuICAgIHZhciBwYXRjaCA9IHsgYTogYSB9XG4gICAgd2FsayhhLCBiLCBwYXRjaCwgMClcbiAgICByZXR1cm4gcGF0Y2hcbn1cblxuZnVuY3Rpb24gd2FsayhhLCBiLCBwYXRjaCwgaW5kZXgpIHtcbiAgICBpZiAoYSA9PT0gYikge1xuICAgICAgICByZXR1cm5cbiAgICB9XG5cbiAgICB2YXIgYXBwbHkgPSBwYXRjaFtpbmRleF1cbiAgICB2YXIgYXBwbHlDbGVhciA9IGZhbHNlXG5cbiAgICBpZiAoaXNUaHVuayhhKSB8fCBpc1RodW5rKGIpKSB7XG4gICAgICAgIHRodW5rcyhhLCBiLCBwYXRjaCwgaW5kZXgpXG4gICAgfSBlbHNlIGlmIChiID09IG51bGwpIHtcblxuICAgICAgICAvLyBJZiBhIGlzIGEgd2lkZ2V0IHdlIHdpbGwgYWRkIGEgcmVtb3ZlIHBhdGNoIGZvciBpdFxuICAgICAgICAvLyBPdGhlcndpc2UgYW55IGNoaWxkIHdpZGdldHMvaG9va3MgbXVzdCBiZSBkZXN0cm95ZWQuXG4gICAgICAgIC8vIFRoaXMgcHJldmVudHMgYWRkaW5nIHR3byByZW1vdmUgcGF0Y2hlcyBmb3IgYSB3aWRnZXQuXG4gICAgICAgIGlmICghaXNXaWRnZXQoYSkpIHtcbiAgICAgICAgICAgIGNsZWFyU3RhdGUoYSwgcGF0Y2gsIGluZGV4KVxuICAgICAgICAgICAgYXBwbHkgPSBwYXRjaFtpbmRleF1cbiAgICAgICAgfVxuXG4gICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlJFTU9WRSwgYSwgYikpXG4gICAgfSBlbHNlIGlmIChpc1ZOb2RlKGIpKSB7XG4gICAgICAgIGlmIChpc1ZOb2RlKGEpKSB7XG4gICAgICAgICAgICBpZiAoYS50YWdOYW1lID09PSBiLnRhZ05hbWUgJiZcbiAgICAgICAgICAgICAgICBhLm5hbWVzcGFjZSA9PT0gYi5uYW1lc3BhY2UgJiZcbiAgICAgICAgICAgICAgICBhLmtleSA9PT0gYi5rZXkpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvcHNQYXRjaCA9IGRpZmZQcm9wcyhhLnByb3BlcnRpZXMsIGIucHJvcGVydGllcylcbiAgICAgICAgICAgICAgICBpZiAocHJvcHNQYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFZQYXRjaChWUGF0Y2guUFJPUFMsIGEsIHByb3BzUGF0Y2gpKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBhcHBseSA9IGRpZmZDaGlsZHJlbihhLCBiLCBwYXRjaCwgYXBwbHksIGluZGV4KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5WTk9ERSwgYSwgYikpXG4gICAgICAgICAgICAgICAgYXBwbHlDbGVhciA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZOT0RFLCBhLCBiKSlcbiAgICAgICAgICAgIGFwcGx5Q2xlYXIgPSB0cnVlXG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzVlRleHQoYikpIHtcbiAgICAgICAgaWYgKCFpc1ZUZXh0KGEpKSB7XG4gICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5WVEVYVCwgYSwgYikpXG4gICAgICAgICAgICBhcHBseUNsZWFyID0gdHJ1ZVxuICAgICAgICB9IGVsc2UgaWYgKGEudGV4dCAhPT0gYi50ZXh0KSB7XG4gICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5WVEVYVCwgYSwgYikpXG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzV2lkZ2V0KGIpKSB7XG4gICAgICAgIGlmICghaXNXaWRnZXQoYSkpIHtcbiAgICAgICAgICAgIGFwcGx5Q2xlYXIgPSB0cnVlXG4gICAgICAgIH1cblxuICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5XSURHRVQsIGEsIGIpKVxuICAgIH1cblxuICAgIGlmIChhcHBseSkge1xuICAgICAgICBwYXRjaFtpbmRleF0gPSBhcHBseVxuICAgIH1cblxuICAgIGlmIChhcHBseUNsZWFyKSB7XG4gICAgICAgIGNsZWFyU3RhdGUoYSwgcGF0Y2gsIGluZGV4KVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZGlmZkNoaWxkcmVuKGEsIGIsIHBhdGNoLCBhcHBseSwgaW5kZXgpIHtcbiAgICB2YXIgYUNoaWxkcmVuID0gYS5jaGlsZHJlblxuICAgIHZhciBvcmRlcmVkU2V0ID0gcmVvcmRlcihhQ2hpbGRyZW4sIGIuY2hpbGRyZW4pXG4gICAgdmFyIGJDaGlsZHJlbiA9IG9yZGVyZWRTZXQuY2hpbGRyZW5cblxuICAgIHZhciBhTGVuID0gYUNoaWxkcmVuLmxlbmd0aFxuICAgIHZhciBiTGVuID0gYkNoaWxkcmVuLmxlbmd0aFxuICAgIHZhciBsZW4gPSBhTGVuID4gYkxlbiA/IGFMZW4gOiBiTGVuXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHZhciBsZWZ0Tm9kZSA9IGFDaGlsZHJlbltpXVxuICAgICAgICB2YXIgcmlnaHROb2RlID0gYkNoaWxkcmVuW2ldXG4gICAgICAgIGluZGV4ICs9IDFcblxuICAgICAgICBpZiAoIWxlZnROb2RlKSB7XG4gICAgICAgICAgICBpZiAocmlnaHROb2RlKSB7XG4gICAgICAgICAgICAgICAgLy8gRXhjZXNzIG5vZGVzIGluIGIgbmVlZCB0byBiZSBhZGRlZFxuICAgICAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBWUGF0Y2goVlBhdGNoLklOU0VSVCwgbnVsbCwgcmlnaHROb2RlKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdhbGsobGVmdE5vZGUsIHJpZ2h0Tm9kZSwgcGF0Y2gsIGluZGV4KVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzVk5vZGUobGVmdE5vZGUpICYmIGxlZnROb2RlLmNvdW50KSB7XG4gICAgICAgICAgICBpbmRleCArPSBsZWZ0Tm9kZS5jb3VudFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9yZGVyZWRTZXQubW92ZXMpIHtcbiAgICAgICAgLy8gUmVvcmRlciBub2RlcyBsYXN0XG4gICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goXG4gICAgICAgICAgICBWUGF0Y2guT1JERVIsXG4gICAgICAgICAgICBhLFxuICAgICAgICAgICAgb3JkZXJlZFNldC5tb3Zlc1xuICAgICAgICApKVxuICAgIH1cblxuICAgIHJldHVybiBhcHBseVxufVxuXG5mdW5jdGlvbiBjbGVhclN0YXRlKHZOb2RlLCBwYXRjaCwgaW5kZXgpIHtcbiAgICAvLyBUT0RPOiBNYWtlIHRoaXMgYSBzaW5nbGUgd2Fsaywgbm90IHR3b1xuICAgIHVuaG9vayh2Tm9kZSwgcGF0Y2gsIGluZGV4KVxuICAgIGRlc3Ryb3lXaWRnZXRzKHZOb2RlLCBwYXRjaCwgaW5kZXgpXG59XG5cbi8vIFBhdGNoIHJlY29yZHMgZm9yIGFsbCBkZXN0cm95ZWQgd2lkZ2V0cyBtdXN0IGJlIGFkZGVkIGJlY2F1c2Ugd2UgbmVlZFxuLy8gYSBET00gbm9kZSByZWZlcmVuY2UgZm9yIHRoZSBkZXN0cm95IGZ1bmN0aW9uXG5mdW5jdGlvbiBkZXN0cm95V2lkZ2V0cyh2Tm9kZSwgcGF0Y2gsIGluZGV4KSB7XG4gICAgaWYgKGlzV2lkZ2V0KHZOb2RlKSkge1xuICAgICAgICBpZiAodHlwZW9mIHZOb2RlLmRlc3Ryb3kgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgcGF0Y2hbaW5kZXhdID0gYXBwZW5kUGF0Y2goXG4gICAgICAgICAgICAgICAgcGF0Y2hbaW5kZXhdLFxuICAgICAgICAgICAgICAgIG5ldyBWUGF0Y2goVlBhdGNoLlJFTU9WRSwgdk5vZGUsIG51bGwpXG4gICAgICAgICAgICApXG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzVk5vZGUodk5vZGUpICYmICh2Tm9kZS5oYXNXaWRnZXRzIHx8IHZOb2RlLmhhc1RodW5rcykpIHtcbiAgICAgICAgdmFyIGNoaWxkcmVuID0gdk5vZGUuY2hpbGRyZW5cbiAgICAgICAgdmFyIGxlbiA9IGNoaWxkcmVuLmxlbmd0aFxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXVxuICAgICAgICAgICAgaW5kZXggKz0gMVxuXG4gICAgICAgICAgICBkZXN0cm95V2lkZ2V0cyhjaGlsZCwgcGF0Y2gsIGluZGV4KVxuXG4gICAgICAgICAgICBpZiAoaXNWTm9kZShjaGlsZCkgJiYgY2hpbGQuY291bnQpIHtcbiAgICAgICAgICAgICAgICBpbmRleCArPSBjaGlsZC5jb3VudFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChpc1RodW5rKHZOb2RlKSkge1xuICAgICAgICB0aHVua3Modk5vZGUsIG51bGwsIHBhdGNoLCBpbmRleClcbiAgICB9XG59XG5cbi8vIENyZWF0ZSBhIHN1Yi1wYXRjaCBmb3IgdGh1bmtzXG5mdW5jdGlvbiB0aHVua3MoYSwgYiwgcGF0Y2gsIGluZGV4KSB7XG4gICAgdmFyIG5vZGVzID0gaGFuZGxlVGh1bmsoYSwgYilcbiAgICB2YXIgdGh1bmtQYXRjaCA9IGRpZmYobm9kZXMuYSwgbm9kZXMuYilcbiAgICBpZiAoaGFzUGF0Y2hlcyh0aHVua1BhdGNoKSkge1xuICAgICAgICBwYXRjaFtpbmRleF0gPSBuZXcgVlBhdGNoKFZQYXRjaC5USFVOSywgbnVsbCwgdGh1bmtQYXRjaClcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGhhc1BhdGNoZXMocGF0Y2gpIHtcbiAgICBmb3IgKHZhciBpbmRleCBpbiBwYXRjaCkge1xuICAgICAgICBpZiAoaW5kZXggIT09IFwiYVwiKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG59XG5cbi8vIEV4ZWN1dGUgaG9va3Mgd2hlbiB0d28gbm9kZXMgYXJlIGlkZW50aWNhbFxuZnVuY3Rpb24gdW5ob29rKHZOb2RlLCBwYXRjaCwgaW5kZXgpIHtcbiAgICBpZiAoaXNWTm9kZSh2Tm9kZSkpIHtcbiAgICAgICAgaWYgKHZOb2RlLmhvb2tzKSB7XG4gICAgICAgICAgICBwYXRjaFtpbmRleF0gPSBhcHBlbmRQYXRjaChcbiAgICAgICAgICAgICAgICBwYXRjaFtpbmRleF0sXG4gICAgICAgICAgICAgICAgbmV3IFZQYXRjaChcbiAgICAgICAgICAgICAgICAgICAgVlBhdGNoLlBST1BTLFxuICAgICAgICAgICAgICAgICAgICB2Tm9kZSxcbiAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkS2V5cyh2Tm9kZS5ob29rcylcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodk5vZGUuZGVzY2VuZGFudEhvb2tzIHx8IHZOb2RlLmhhc1RodW5rcykge1xuICAgICAgICAgICAgdmFyIGNoaWxkcmVuID0gdk5vZGUuY2hpbGRyZW5cbiAgICAgICAgICAgIHZhciBsZW4gPSBjaGlsZHJlbi5sZW5ndGhcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXVxuICAgICAgICAgICAgICAgIGluZGV4ICs9IDFcblxuICAgICAgICAgICAgICAgIHVuaG9vayhjaGlsZCwgcGF0Y2gsIGluZGV4KVxuXG4gICAgICAgICAgICAgICAgaWYgKGlzVk5vZGUoY2hpbGQpICYmIGNoaWxkLmNvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ICs9IGNoaWxkLmNvdW50XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChpc1RodW5rKHZOb2RlKSkge1xuICAgICAgICB0aHVua3Modk5vZGUsIG51bGwsIHBhdGNoLCBpbmRleClcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHVuZGVmaW5lZEtleXMob2JqKSB7XG4gICAgdmFyIHJlc3VsdCA9IHt9XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gdW5kZWZpbmVkXG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdFxufVxuXG4vLyBMaXN0IGRpZmYsIG5haXZlIGxlZnQgdG8gcmlnaHQgcmVvcmRlcmluZ1xuZnVuY3Rpb24gcmVvcmRlcihhQ2hpbGRyZW4sIGJDaGlsZHJlbikge1xuICAgIC8vIE8oTSkgdGltZSwgTyhNKSBtZW1vcnlcbiAgICB2YXIgYkNoaWxkSW5kZXggPSBrZXlJbmRleChiQ2hpbGRyZW4pXG4gICAgdmFyIGJLZXlzID0gYkNoaWxkSW5kZXgua2V5c1xuICAgIHZhciBiRnJlZSA9IGJDaGlsZEluZGV4LmZyZWVcblxuICAgIGlmIChiRnJlZS5sZW5ndGggPT09IGJDaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNoaWxkcmVuOiBiQ2hpbGRyZW4sXG4gICAgICAgICAgICBtb3ZlczogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTyhOKSB0aW1lLCBPKE4pIG1lbW9yeVxuICAgIHZhciBhQ2hpbGRJbmRleCA9IGtleUluZGV4KGFDaGlsZHJlbilcbiAgICB2YXIgYUtleXMgPSBhQ2hpbGRJbmRleC5rZXlzXG4gICAgdmFyIGFGcmVlID0gYUNoaWxkSW5kZXguZnJlZVxuXG4gICAgaWYgKGFGcmVlLmxlbmd0aCA9PT0gYUNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY2hpbGRyZW46IGJDaGlsZHJlbixcbiAgICAgICAgICAgIG1vdmVzOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPKE1BWChOLCBNKSkgbWVtb3J5XG4gICAgdmFyIG5ld0NoaWxkcmVuID0gW11cblxuICAgIHZhciBmcmVlSW5kZXggPSAwXG4gICAgdmFyIGZyZWVDb3VudCA9IGJGcmVlLmxlbmd0aFxuICAgIHZhciBkZWxldGVkSXRlbXMgPSAwXG5cbiAgICAvLyBJdGVyYXRlIHRocm91Z2ggYSBhbmQgbWF0Y2ggYSBub2RlIGluIGJcbiAgICAvLyBPKE4pIHRpbWUsXG4gICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgYUNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBhSXRlbSA9IGFDaGlsZHJlbltpXVxuICAgICAgICB2YXIgaXRlbUluZGV4XG5cbiAgICAgICAgaWYgKGFJdGVtLmtleSkge1xuICAgICAgICAgICAgaWYgKGJLZXlzLmhhc093blByb3BlcnR5KGFJdGVtLmtleSkpIHtcbiAgICAgICAgICAgICAgICAvLyBNYXRjaCB1cCB0aGUgb2xkIGtleXNcbiAgICAgICAgICAgICAgICBpdGVtSW5kZXggPSBiS2V5c1thSXRlbS5rZXldXG4gICAgICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChiQ2hpbGRyZW5baXRlbUluZGV4XSlcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgb2xkIGtleWVkIGl0ZW1zXG4gICAgICAgICAgICAgICAgaXRlbUluZGV4ID0gaSAtIGRlbGV0ZWRJdGVtcysrXG4gICAgICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChudWxsKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gTWF0Y2ggdGhlIGl0ZW0gaW4gYSB3aXRoIHRoZSBuZXh0IGZyZWUgaXRlbSBpbiBiXG4gICAgICAgICAgICBpZiAoZnJlZUluZGV4IDwgZnJlZUNvdW50KSB7XG4gICAgICAgICAgICAgICAgaXRlbUluZGV4ID0gYkZyZWVbZnJlZUluZGV4KytdXG4gICAgICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChiQ2hpbGRyZW5baXRlbUluZGV4XSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gVGhlcmUgYXJlIG5vIGZyZWUgaXRlbXMgaW4gYiB0byBtYXRjaCB3aXRoXG4gICAgICAgICAgICAgICAgLy8gdGhlIGZyZWUgaXRlbXMgaW4gYSwgc28gdGhlIGV4dHJhIGZyZWUgbm9kZXNcbiAgICAgICAgICAgICAgICAvLyBhcmUgZGVsZXRlZC5cbiAgICAgICAgICAgICAgICBpdGVtSW5kZXggPSBpIC0gZGVsZXRlZEl0ZW1zKytcbiAgICAgICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKG51bGwpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbGFzdEZyZWVJbmRleCA9IGZyZWVJbmRleCA+PSBiRnJlZS5sZW5ndGggP1xuICAgICAgICBiQ2hpbGRyZW4ubGVuZ3RoIDpcbiAgICAgICAgYkZyZWVbZnJlZUluZGV4XVxuXG4gICAgLy8gSXRlcmF0ZSB0aHJvdWdoIGIgYW5kIGFwcGVuZCBhbnkgbmV3IGtleXNcbiAgICAvLyBPKE0pIHRpbWVcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGJDaGlsZHJlbi5sZW5ndGg7IGorKykge1xuICAgICAgICB2YXIgbmV3SXRlbSA9IGJDaGlsZHJlbltqXVxuXG4gICAgICAgIGlmIChuZXdJdGVtLmtleSkge1xuICAgICAgICAgICAgaWYgKCFhS2V5cy5oYXNPd25Qcm9wZXJ0eShuZXdJdGVtLmtleSkpIHtcbiAgICAgICAgICAgICAgICAvLyBBZGQgYW55IG5ldyBrZXllZCBpdGVtc1xuICAgICAgICAgICAgICAgIC8vIFdlIGFyZSBhZGRpbmcgbmV3IGl0ZW1zIHRvIHRoZSBlbmQgYW5kIHRoZW4gc29ydGluZyB0aGVtXG4gICAgICAgICAgICAgICAgLy8gaW4gcGxhY2UuIEluIGZ1dHVyZSB3ZSBzaG91bGQgaW5zZXJ0IG5ldyBpdGVtcyBpbiBwbGFjZS5cbiAgICAgICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKG5ld0l0ZW0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoaiA+PSBsYXN0RnJlZUluZGV4KSB7XG4gICAgICAgICAgICAvLyBBZGQgYW55IGxlZnRvdmVyIG5vbi1rZXllZCBpdGVtc1xuICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChuZXdJdGVtKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHNpbXVsYXRlID0gbmV3Q2hpbGRyZW4uc2xpY2UoKVxuICAgIHZhciBzaW11bGF0ZUluZGV4ID0gMFxuICAgIHZhciByZW1vdmVzID0gW11cbiAgICB2YXIgaW5zZXJ0cyA9IFtdXG4gICAgdmFyIHNpbXVsYXRlSXRlbVxuXG4gICAgZm9yICh2YXIgayA9IDA7IGsgPCBiQ2hpbGRyZW4ubGVuZ3RoOykge1xuICAgICAgICB2YXIgd2FudGVkSXRlbSA9IGJDaGlsZHJlbltrXVxuICAgICAgICBzaW11bGF0ZUl0ZW0gPSBzaW11bGF0ZVtzaW11bGF0ZUluZGV4XVxuXG4gICAgICAgIC8vIHJlbW92ZSBpdGVtc1xuICAgICAgICB3aGlsZSAoc2ltdWxhdGVJdGVtID09PSBudWxsICYmIHNpbXVsYXRlLmxlbmd0aCkge1xuICAgICAgICAgICAgcmVtb3Zlcy5wdXNoKHJlbW92ZShzaW11bGF0ZSwgc2ltdWxhdGVJbmRleCwgbnVsbCkpXG4gICAgICAgICAgICBzaW11bGF0ZUl0ZW0gPSBzaW11bGF0ZVtzaW11bGF0ZUluZGV4XVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFzaW11bGF0ZUl0ZW0gfHwgc2ltdWxhdGVJdGVtLmtleSAhPT0gd2FudGVkSXRlbS5rZXkpIHtcbiAgICAgICAgICAgIC8vIGlmIHdlIG5lZWQgYSBrZXkgaW4gdGhpcyBwb3NpdGlvbi4uLlxuICAgICAgICAgICAgaWYgKHdhbnRlZEl0ZW0ua2V5KSB7XG4gICAgICAgICAgICAgICAgaWYgKHNpbXVsYXRlSXRlbSAmJiBzaW11bGF0ZUl0ZW0ua2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIGFuIGluc2VydCBkb2Vzbid0IHB1dCB0aGlzIGtleSBpbiBwbGFjZSwgaXQgbmVlZHMgdG8gbW92ZVxuICAgICAgICAgICAgICAgICAgICBpZiAoYktleXNbc2ltdWxhdGVJdGVtLmtleV0gIT09IGsgKyAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVzLnB1c2gocmVtb3ZlKHNpbXVsYXRlLCBzaW11bGF0ZUluZGV4LCBzaW11bGF0ZUl0ZW0ua2V5KSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpbXVsYXRlSXRlbSA9IHNpbXVsYXRlW3NpbXVsYXRlSW5kZXhdXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgcmVtb3ZlIGRpZG4ndCBwdXQgdGhlIHdhbnRlZCBpdGVtIGluIHBsYWNlLCB3ZSBuZWVkIHRvIGluc2VydCBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzaW11bGF0ZUl0ZW0gfHwgc2ltdWxhdGVJdGVtLmtleSAhPT0gd2FudGVkSXRlbS5rZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnNlcnRzLnB1c2goe2tleTogd2FudGVkSXRlbS5rZXksIHRvOiBrfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGl0ZW1zIGFyZSBtYXRjaGluZywgc28gc2tpcCBhaGVhZFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2ltdWxhdGVJbmRleCsrXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnNlcnRzLnB1c2goe2tleTogd2FudGVkSXRlbS5rZXksIHRvOiBrfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaW5zZXJ0cy5wdXNoKHtrZXk6IHdhbnRlZEl0ZW0ua2V5LCB0bzoga30pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGsrK1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gYSBrZXkgaW4gc2ltdWxhdGUgaGFzIG5vIG1hdGNoaW5nIHdhbnRlZCBrZXksIHJlbW92ZSBpdFxuICAgICAgICAgICAgZWxzZSBpZiAoc2ltdWxhdGVJdGVtICYmIHNpbXVsYXRlSXRlbS5rZXkpIHtcbiAgICAgICAgICAgICAgICByZW1vdmVzLnB1c2gocmVtb3ZlKHNpbXVsYXRlLCBzaW11bGF0ZUluZGV4LCBzaW11bGF0ZUl0ZW0ua2V5KSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNpbXVsYXRlSW5kZXgrK1xuICAgICAgICAgICAgaysrXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZW1vdmUgYWxsIHRoZSByZW1haW5pbmcgbm9kZXMgZnJvbSBzaW11bGF0ZVxuICAgIHdoaWxlKHNpbXVsYXRlSW5kZXggPCBzaW11bGF0ZS5sZW5ndGgpIHtcbiAgICAgICAgc2ltdWxhdGVJdGVtID0gc2ltdWxhdGVbc2ltdWxhdGVJbmRleF1cbiAgICAgICAgcmVtb3Zlcy5wdXNoKHJlbW92ZShzaW11bGF0ZSwgc2ltdWxhdGVJbmRleCwgc2ltdWxhdGVJdGVtICYmIHNpbXVsYXRlSXRlbS5rZXkpKVxuICAgIH1cblxuICAgIC8vIElmIHRoZSBvbmx5IG1vdmVzIHdlIGhhdmUgYXJlIGRlbGV0ZXMgdGhlbiB3ZSBjYW4ganVzdFxuICAgIC8vIGxldCB0aGUgZGVsZXRlIHBhdGNoIHJlbW92ZSB0aGVzZSBpdGVtcy5cbiAgICBpZiAocmVtb3Zlcy5sZW5ndGggPT09IGRlbGV0ZWRJdGVtcyAmJiAhaW5zZXJ0cy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNoaWxkcmVuOiBuZXdDaGlsZHJlbixcbiAgICAgICAgICAgIG1vdmVzOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBjaGlsZHJlbjogbmV3Q2hpbGRyZW4sXG4gICAgICAgIG1vdmVzOiB7XG4gICAgICAgICAgICByZW1vdmVzOiByZW1vdmVzLFxuICAgICAgICAgICAgaW5zZXJ0czogaW5zZXJ0c1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmUoYXJyLCBpbmRleCwga2V5KSB7XG4gICAgYXJyLnNwbGljZShpbmRleCwgMSlcblxuICAgIHJldHVybiB7XG4gICAgICAgIGZyb206IGluZGV4LFxuICAgICAgICBrZXk6IGtleVxuICAgIH1cbn1cblxuZnVuY3Rpb24ga2V5SW5kZXgoY2hpbGRyZW4pIHtcbiAgICB2YXIga2V5cyA9IHt9XG4gICAgdmFyIGZyZWUgPSBbXVxuICAgIHZhciBsZW5ndGggPSBjaGlsZHJlbi5sZW5ndGhcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5baV1cblxuICAgICAgICBpZiAoY2hpbGQua2V5KSB7XG4gICAgICAgICAgICBrZXlzW2NoaWxkLmtleV0gPSBpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmcmVlLnB1c2goaSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGtleXM6IGtleXMsICAgICAvLyBBIGhhc2ggb2Yga2V5IG5hbWUgdG8gaW5kZXhcbiAgICAgICAgZnJlZTogZnJlZSwgICAgIC8vIEFuIGFycmF5IG9mIHVua2V5ZWQgaXRlbSBpbmRpY2VzXG4gICAgfVxufVxuXG5mdW5jdGlvbiBhcHBlbmRQYXRjaChhcHBseSwgcGF0Y2gpIHtcbiAgICBpZiAoYXBwbHkpIHtcbiAgICAgICAgaWYgKGlzQXJyYXkoYXBwbHkpKSB7XG4gICAgICAgICAgICBhcHBseS5wdXNoKHBhdGNoKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXBwbHkgPSBbYXBwbHksIHBhdGNoXVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFwcGx5XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHBhdGNoXG4gICAgfVxufVxuIiwiaW1wb3J0IHsgRGlzcGF0Y2hlciB9IGZyb20gJy4uL2Rpc3BhdGNoZXInO1xuXG52YXIgU2hpcEFjdGlvbnMgPSB7XG5cbiAgaW5jcmVtZW50OiBmdW5jdGlvbihwYXlsb2FkKSB7XG4gICAgRGlzcGF0Y2hlci5kaXNwYXRjaCgnaW5jcmVtZW50JywgcGF5bG9hZCk7XG4gIH0sXG5cbiAgdXBkYXRlOiBmdW5jdGlvbihwYXlsb2FkKSB7XG4gICAgRGlzcGF0Y2hlci5kaXNwYXRjaCgndXBkYXRlJywgcGF5bG9hZCk7XG4gIH1cblxufTtcblxuZXhwb3J0IHsgU2hpcEFjdGlvbnMgfVxuIiwiaW1wb3J0IHsgRmx1eCB9IGZyb20gJ2RlbG9yZWFuJztcbmltcG9ydCB7IFNoaXBTdG9yZSB9IGZyb20gJy4vc3RvcmVzL3NoaXBfc3RvcmUnO1xuXG52YXIgRGlzcGF0Y2hlciA9IEZsdXguY3JlYXRlRGlzcGF0Y2hlcih7XG5cbiAgZ2V0U3RvcmVzOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc2hpcFN0b3JlOiBTaGlwU3RvcmVcbiAgICB9O1xuICB9XG5cbn0pO1xuXG5leHBvcnQgeyBEaXNwYXRjaGVyIH1cbiIsImltcG9ydCBmbGlnaHQgZnJvbSAnZmxpZ2h0anMnO1xuaW1wb3J0IHsgd2l0aFZET00gfSBmcm9tICcuL21peGluL3dpdGhfdmRvbSc7XG5cbi8vIEZsdXhcbmltcG9ydCB7IERpc3BhdGNoZXIgfSBmcm9tICcuL2Rpc3BhdGNoZXInO1xuaW1wb3J0IHsgU2hpcEFjdGlvbnMgfSBmcm9tICcuL2FjdGlvbnMvc2hpcF9hY3Rpb25zJztcblxuLy8gVGVtcGxhdGVzIGFuZCBwYXJ0aWFsc1xuaW1wb3J0IHRlbXBsYXRlIGZyb20gJy4uL3RlbXBsYXRlcy9pbmRleC5ob2dhbic7XG5pbXBvcnQgZmllbGRQYXJ0aWFsIGZyb20gJy4uL3RlbXBsYXRlcy9fZmllbGQuaG9nYW4nO1xuaW1wb3J0IGluY3JlbWVudFBhcnRpYWwgZnJvbSAnLi4vdGVtcGxhdGVzL19pbmNyZW1lbnQuaG9nYW4nO1xuXG52YXIgZG9jdW1lbnRVSSA9IGZsaWdodC5jb21wb25lbnQod2l0aFZET00sIGZ1bmN0aW9uKCkge1xuICB0aGlzLmF0dHJpYnV0ZXMoe1xuICAgICdpbmNyZW1lbnRCeU9uZSc6ICdbZGF0YS1pbmNyZW1lbnRdJyxcbiAgICAnaW5wdXRGaWVsZCc6ICdbdHlwZT1cInRleHRcIl0nLFxuICB9KTtcblxuICB0aGlzLnVwZGF0ZUF0dHJpYnV0ZXMgPSBmdW5jdGlvbihlKSB7XG4gICAgdmFyIGF0dHIgPSB7fVxuICAgIGF0dHJbZS50YXJnZXQubmFtZV0gPSBlLnRhcmdldC52YWx1ZTtcblxuICAgIFNoaXBBY3Rpb25zLnVwZGF0ZShhdHRyKTtcbiAgfTtcblxuICB0aGlzLmluY3JlbWVudCA9IGZ1bmN0aW9uKGUpIHtcbiAgICBTaGlwQWN0aW9ucy5pbmNyZW1lbnQoe1xuICAgICAga2V5OiBlLnRhcmdldC5uYW1lLFxuICAgICAgZGlyZWN0aW9uOiBlLnRhcmdldC5kYXRhc2V0LmluY3JlbWVudFxuICAgIH0pO1xuICB9O1xuXG4gIHRoaXMucmVuZGVyID0gZnVuY3Rpb24oc2hpcCkge1xuICAgIHZhciBzaGlwID0gRGlzcGF0Y2hlci5nZXRTdG9yZSgnc2hpcFN0b3JlJyk7XG4gICAgdmFyIHBhcnRpYWxzID0ge1xuICAgICAgZmllbGQ6IGZpZWxkUGFydGlhbCxcbiAgICAgIGluY3JlbWVudDogaW5jcmVtZW50UGFydGlhbFxuICAgIH07XG5cbiAgICByZXR1cm4gdGVtcGxhdGUucmVuZGVyKHtcbiAgICAgICAgbmFtZTogc2hpcC5uYW1lIHx8ICdVbnRpdGxlZCcsXG4gICAgICAgIHNoaXA6IHNoaXAsXG4gICAgICAgIGF0dHJpYnV0ZXM6IE9iamVjdC5rZXlzKHNoaXApLnJlZHVjZShmdW5jdGlvbihtZW1vLCBrZXkpIHtcbiAgICAgICAgICBpZiAoIWlzTmFOKHNoaXBba2V5XSkpIHtcbiAgICAgICAgICAgIG1lbW8ucHVzaCh7XG4gICAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgICB2YWx1ZTogc2hpcFtrZXldXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSwgW10pXG4gICAgfSwgcGFydGlhbHMpO1xuICB9O1xuXG4gIHRoaXMudXBkYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGh0bWwgPSB0aGlzLnJlbmRlcigpO1xuICAgIHRoaXMudXBkYXRlVUkoaHRtbCk7XG4gIH07XG5cbiAgdGhpcy5hZnRlcignaW5pdGlhbGl6ZScsIGZ1bmN0aW9uKCkge1xuICAgIC8vIFVJIEV2ZW50c1xuICAgIHRoaXMub24oJ2NsaWNrJywge1xuICAgICAgJ2luY3JlbWVudEJ5T25lJzogdGhpcy5pbmNyZW1lbnRcbiAgICB9KTtcbiAgICB0aGlzLm9uKCdpbnB1dCcsIHtcbiAgICAgICdpbnB1dEZpZWxkJzogdGhpcy51cGRhdGVBdHRyaWJ1dGVzXG4gICAgfSk7XG5cbiAgICAvLyBEb2N1bWVudCBFdmVudHNcbiAgICBEaXNwYXRjaGVyLm9uKCdjaGFuZ2U6YWxsJywgdGhpcy51cGRhdGUuYmluZCh0aGlzKSk7XG4gIH0pO1xufSk7XG5cbmV4cG9ydCB7IGRvY3VtZW50VUkgfVxuIiwiaW1wb3J0IGggZnJvbSAndmlydHVhbC1kb20vaCc7XG5pbXBvcnQgZGlmZiBmcm9tICd2aXJ0dWFsLWRvbS9kaWZmJztcbmltcG9ydCBwYXRjaCBmcm9tICd2aXJ0dWFsLWRvbS9wYXRjaCc7XG5pbXBvcnQgY3JlYXRlRWxlbWVudCBmcm9tICd2aXJ0dWFsLWRvbS9jcmVhdGUtZWxlbWVudCc7XG5cbmltcG9ydCB2aXJ0dWFsaXplIGZyb20gJ3Zkb20tdmlydHVhbGl6ZSc7XG5cbid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gd2l0aFZET00oKSB7XG5cbiAgdGhpcy5hdHRyaWJ1dGVzKHtcbiAgICB2VHJlZTogdW5kZWZpbmVkXG4gIH0pO1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIHRoZSBET00gdHJlZVxuICAgKi9cbiAgdGhpcy5hZnRlcignaW5pdGlhbGl6ZScsIGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuYXR0ci52VHJlZSA9IHZpcnR1YWxpemUuZnJvbUhUTUwodGhpcy5yZW5kZXIoKSk7XG4gICAgdGhpcy5ub2RlID0gY3JlYXRlRWxlbWVudCh0aGlzLmF0dHIudlRyZWUpO1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLm5vZGUpO1xuICB9KTtcblxuICAvKipcbiAgICogVGhpcyBkb2VzIHRoZSBhY3R1YWwgZGlmZmluZyBhbmQgdXBkYXRpbmdcbiAgICovXG4gIHRoaXMudXBkYXRlVUkgPSBmdW5jdGlvbihodG1sKSB7XG4gICAgdmFyIG5ld1RyZWUgPSB2aXJ0dWFsaXplLmZyb21IVE1MKGh0bWwpO1xuICAgIHZhciBwYXRjaGVzID0gZGlmZih0aGlzLmF0dHIudlRyZWUsIG5ld1RyZWUpO1xuXG4gICAgdGhpcy5ub2RlID0gcGF0Y2godGhpcy5ub2RlLCBwYXRjaGVzKTtcbiAgICB0aGlzLmF0dHIudlRyZWUgPSBuZXdUcmVlO1xuICB9O1xuXG59XG5cbmV4cG9ydCB7IHdpdGhWRE9NIH1cbiIsImltcG9ydCB7IEZsdXggfSBmcm9tICdkZWxvcmVhbic7XG5cbnZhciBTaGlwU3RvcmUgPSBGbHV4LmNyZWF0ZVN0b3JlKHtcblxuICBhY3Rpb25zOiB7XG4gICAgJ2luY3JlbWVudCc6ICdpbmNyZWFzZUF0dHJpYnV0ZScsXG4gICAgJ3VwZGF0ZSc6ICd1cGRhdGVBdHRyaWJ1dGVzJ1xuICB9LFxuXG4gIHNjaGVtZToge1xuICAgIG5hbWU6IHVuZGVmaW5lZCxcbiAgICB0b25uYWdlOiAwLFxuICAgIGZ0bDogMCxcbiAgICB0aHJ1c3Q6IDAsXG4gICAgcmVhY3RvcjogMFxuICB9LFxuXG4gIGluY3JlYXNlQXR0cmlidXRlOiBmdW5jdGlvbihwYXlsb2FkKSB7XG4gICAgdmFyIGluY3JlbWVudCA9IHBheWxvYWQuZGlyZWN0aW9uID09ICd1cCcgPyAxIDogLTE7XG4gICAgdGhpcy5zZXQocGF5bG9hZC5rZXksIHRoaXMuc3RhdGVbcGF5bG9hZC5rZXldICsgaW5jcmVtZW50KTtcbiAgICB0aGlzLnZhbGlkYXRlKCk7XG4gIH0sXG5cbiAgdXBkYXRlQXR0cmlidXRlczogZnVuY3Rpb24ocGF5bG9hZCkge1xuICAgIE9iamVjdC5rZXlzKHBheWxvYWQpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgICB0aGlzLnNldChrZXksIHBheWxvYWRba2V5XSk7XG4gICAgfSwgdGhpcyk7XG4gICAgdGhpcy52YWxpZGF0ZSgpO1xuICB9LFxuXG4gIHZhbGlkYXRlOiBmdW5jdGlvbigpIHtcbiAgICBPYmplY3Qua2V5cyh0aGlzLnN0YXRlKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgICAgaWYgKCFpc05hTih0aGlzLnN0YXRlW2tleV0pICYmIHRoaXMuc3RhdGVba2V5XSA8IDApIHtcbiAgICAgICAgdGhpcy5zZXQoa2V5LCAwKTtcbiAgICAgIH1cbiAgICB9LCB0aGlzKTtcbiAgfVxuXG59KTtcblxuZXhwb3J0IHsgU2hpcFN0b3JlIH1cbiIsInZhciBIb2dhbiA9IHJlcXVpcmUoJ2hvZ2FuLmpzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBIb2dhbi5UZW1wbGF0ZSh7Y29kZTogZnVuY3Rpb24gKGMscCxpKSB7IHZhciB0PXRoaXM7dC5iKGk9aXx8XCJcIik7dC5iKFwiPGRpdiBjbGFzcz1cXFwiZmllbGRcXFwiPlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgPGRpdiBjbGFzcz1cXFwibGFiZWxcXFwiPlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgICAgIDxsYWJlbCBmb3I9XFxcInNoaXBuYW1lXFxcIj5cIik7dC5iKHQudih0LmYoXCJrZXlcIixjLHAsMCkpKTt0LmIoXCI8L2xhYmVsPlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgPC9kaXY+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICA8ZGl2IGNsYXNzPVxcXCJpbnB1dFxcXCI+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICAgICAgPGlucHV0IG5hbWU9XFxcIlwiKTt0LmIodC52KHQuZihcImtleVwiLGMscCwwKSkpO3QuYihcIlxcXCJcIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgICAgICAgICAgICAgdmFsdWU9XFxcIlwiKTt0LmIodC52KHQuZihcInZhbHVlXCIsYyxwLDApKSk7dC5iKFwiXFxcIlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cXFwiUGxlYXNlIGVudGVyIGEgXCIpO3QuYih0LnYodC5mKFwia2V5XCIsYyxwLDApKSk7dC5iKFwiXFxcIlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgICAgICAgICAgICBpZD1cXFwic2hpcFwiKTt0LmIodC52KHQuZihcImtleVwiLGMscCwwKSkpO3QuYihcIlxcXCI+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICA8L2Rpdj5cIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCI8L2Rpdj5cIik7dC5iKFwiXFxuXCIpO3JldHVybiB0LmZsKCk7IH0scGFydGlhbHM6IHt9LCBzdWJzOiB7ICB9fSwgXCI8ZGl2IGNsYXNzPVxcXCJmaWVsZFxcXCI+XFxuICA8ZGl2IGNsYXNzPVxcXCJsYWJlbFxcXCI+XFxuICAgICAgPGxhYmVsIGZvcj1cXFwic2hpcG5hbWVcXFwiPnt7IGtleSB9fTwvbGFiZWw+XFxuICA8L2Rpdj5cXG4gIDxkaXYgY2xhc3M9XFxcImlucHV0XFxcIj5cXG4gICAgICA8aW5wdXQgbmFtZT1cXFwie3sga2V5IH19XFxcIlxcbiAgICAgICAgICAgICB2YWx1ZT1cXFwie3sgdmFsdWUgfX1cXFwiXFxuICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVxcXCJQbGVhc2UgZW50ZXIgYSB7eyBrZXkgfX1cXFwiXFxuICAgICAgICAgICAgIGlkPVxcXCJzaGlwe3sga2V5IH19XFxcIj5cXG4gIDwvZGl2PlxcbjwvZGl2PlxcblwiLCBIb2dhbik7IiwidmFyIEhvZ2FuID0gcmVxdWlyZSgnaG9nYW4uanMnKTtcbm1vZHVsZS5leHBvcnRzID0gbmV3IEhvZ2FuLlRlbXBsYXRlKHtjb2RlOiBmdW5jdGlvbiAoYyxwLGkpIHsgdmFyIHQ9dGhpczt0LmIoaT1pfHxcIlwiKTt0LmIoXCI8ZGl2IGNsYXNzPVxcXCJjb250cm9sc1xcXCI+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICA8bGFiZWwgZm9yPVxcXCJcIik7dC5iKHQudih0LmYoXCJrZXlcIixjLHAsMCkpKTt0LmIoXCJcXFwiPlwiKTt0LmIodC52KHQuZihcImtleVwiLGMscCwwKSkpO3QuYihcIjwvbGFiZWw+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICA8c3BhbiBjbGFzcz1cXFwidmFsdWVcXFwiPlwiKTt0LmIodC52KHQuZihcInZhbHVlXCIsYyxwLDApKSk7dC5iKFwiPC9zcGFuPlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgPGJ1dHRvbiBjbGFzcz1cXFwiaW5jcmVtZW50XFxcIiBuYW1lPVxcXCJcIik7dC5iKHQudih0LmYoXCJrZXlcIixjLHAsMCkpKTt0LmIoXCJcXFwiIGRhdGEtaW5jcmVtZW50PVxcXCJ1cFxcXCI+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICAgICZ1YXJyO1wiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgPC9idXR0b24+XCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICA8YnV0dG9uIGNsYXNzPVxcXCJpbmNyZW1lbnRcXFwiIG5hbWU9XFxcIlwiKTt0LmIodC52KHQuZihcImtleVwiLGMscCwwKSkpO3QuYihcIlxcXCIgZGF0YS1pbmNyZW1lbnQ9XFxcImRvd25cXFwiPlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgICAmZGFycjtcIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgIDwvYnV0dG9uPlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIjwvZGl2PlwiKTt0LmIoXCJcXG5cIik7cmV0dXJuIHQuZmwoKTsgfSxwYXJ0aWFsczoge30sIHN1YnM6IHsgIH19LCBcIjxkaXYgY2xhc3M9XFxcImNvbnRyb2xzXFxcIj5cXG4gIDxsYWJlbCBmb3I9XFxcInt7IGtleSB9fVxcXCI+e3sga2V5IH19PC9sYWJlbD5cXG4gIDxzcGFuIGNsYXNzPVxcXCJ2YWx1ZVxcXCI+e3sgdmFsdWUgfX08L3NwYW4+XFxuICA8YnV0dG9uIGNsYXNzPVxcXCJpbmNyZW1lbnRcXFwiIG5hbWU9XFxcInt7IGtleSB9fVxcXCIgZGF0YS1pbmNyZW1lbnQ9XFxcInVwXFxcIj5cXG4gICAgJnVhcnI7XFxuICA8L2J1dHRvbj5cXG4gIDxidXR0b24gY2xhc3M9XFxcImluY3JlbWVudFxcXCIgbmFtZT1cXFwie3sga2V5IH19XFxcIiBkYXRhLWluY3JlbWVudD1cXFwiZG93blxcXCI+XFxuICAgICZkYXJyO1xcbiAgPC9idXR0b24+XFxuPC9kaXY+XFxuXCIsIEhvZ2FuKTsiLCJ2YXIgSG9nYW4gPSByZXF1aXJlKCdob2dhbi5qcycpO1xubW9kdWxlLmV4cG9ydHMgPSBuZXcgSG9nYW4uVGVtcGxhdGUoe2NvZGU6IGZ1bmN0aW9uIChjLHAsaSkgeyB2YXIgdD10aGlzO3QuYihpPWl8fFwiXCIpO3QuYihcIjxkaXYgZGF0YS1jb250YWluZXI+XCIpO3QuYihcIlxcblwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgPGgxPlwiKTt0LmIodC52KHQuZihcIm5hbWVcIixjLHAsMCkpKTt0LmIoXCI8L2gxPlwiKTt0LmIoXCJcXG5cIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgIDxkaXYgY2xhc3M9XFxcImZpZWxkXFxcIj5cIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgICAgPGRpdiBjbGFzcz1cXFwibGFiZWxcXFwiPlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgICAgICAgPGxhYmVsIGZvcj1cXFwic2hpcG5hbWVcXFwiPk5hbWU8L2xhYmVsPlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgICA8L2Rpdj5cIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgICAgPGRpdiBjbGFzcz1cXFwiaW5wdXRcXFwiPlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgICAgICAgPGlucHV0IG5hbWU9XFxcIm5hbWVcXFwiXCIpO3QuYihcIlxcblwiICsgaSk7dC5iKFwiICAgICAgICAgICAgICAgdmFsdWU9XFxcIlwiKTt0LmIodC52KHQuZChcInNoaXAubmFtZVwiLGMscCwwKSkpO3QuYihcIlxcXCJcIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cXFwiUGxlYXNlIGVudGVyIGEgbmFtZVxcXCJcIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgICAgICAgICAgICAgICBpZD1cXFwic2hpcG5hbWVcXFwiPlwiKTt0LmIoXCJcXG5cIiArIGkpO3QuYihcIiAgICA8L2Rpdj5cIik7dC5iKFwiXFxuXCIgKyBpKTt0LmIoXCIgIDwvZGl2PlwiKTt0LmIoXCJcXG5cIik7dC5iKFwiXFxuXCIgKyBpKTtpZih0LnModC5mKFwiYXR0cmlidXRlc1wiLGMscCwxKSxjLHAsMCwzNTQsMzc2LFwie3sgfX1cIikpe3QucnMoYyxwLGZ1bmN0aW9uKGMscCx0KXt0LmIodC5ycChcIjxpbmNyZW1lbnQwXCIsYyxwLFwiICBcIikpO30pO2MucG9wKCk7fXQuYihcIlxcblwiICsgaSk7dC5iKFwiPC9kaXY+XCIpO3QuYihcIlxcblwiKTtyZXR1cm4gdC5mbCgpOyB9LHBhcnRpYWxzOiB7XCI8aW5jcmVtZW50MFwiOntuYW1lOlwiaW5jcmVtZW50XCIsIHBhcnRpYWxzOiB7fSwgc3ViczogeyAgfX19LCBzdWJzOiB7ICB9fSwgXCI8ZGl2IGRhdGEtY29udGFpbmVyPlxcblxcbiAgPGgxPnt7IG5hbWUgfX08L2gxPlxcblxcbiAgPGRpdiBjbGFzcz1cXFwiZmllbGRcXFwiPlxcbiAgICA8ZGl2IGNsYXNzPVxcXCJsYWJlbFxcXCI+XFxuICAgICAgICA8bGFiZWwgZm9yPVxcXCJzaGlwbmFtZVxcXCI+TmFtZTwvbGFiZWw+XFxuICAgIDwvZGl2PlxcbiAgICA8ZGl2IGNsYXNzPVxcXCJpbnB1dFxcXCI+XFxuICAgICAgICA8aW5wdXQgbmFtZT1cXFwibmFtZVxcXCJcXG4gICAgICAgICAgICAgICB2YWx1ZT1cXFwie3sgc2hpcC5uYW1lIH19XFxcIlxcbiAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVxcXCJQbGVhc2UgZW50ZXIgYSBuYW1lXFxcIlxcbiAgICAgICAgICAgICAgIGlkPVxcXCJzaGlwbmFtZVxcXCI+XFxuICAgIDwvZGl2PlxcbiAgPC9kaXY+XFxuXFxuICB7eyMgYXR0cmlidXRlcyB9fVxcbiAge3s+IGluY3JlbWVudCB9fVxcbiAge3svIGF0dHJpYnV0ZXMgfX1cXG5cXG48L2Rpdj5cXG5cIiwgSG9nYW4pOyIsImltcG9ydCB7IGRvY3VtZW50VUkgfSBmcm9tICcuL2RvY3VtZW50X3VpJztcblxuLy8gaW5pdGlhbGl6ZSBGbGlnaHQgY29tcG9uZW50c1xuZG9jdW1lbnRVSS5hdHRhY2hUbyhkb2N1bWVudC5ib2R5KTtcbiJdfQ==
