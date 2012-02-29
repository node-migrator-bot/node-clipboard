var EventEmitter = require('events').EventEmitter;
var binding = require('../ndbus');


var utility = require('./utility');
var _ = utility.createDescriptor;
var copy = utility.copy;
var slice = utility.slice;

var constants = require('./constants');
var ROOT = constants.ROOT;
var BUS = constants.BUS;
var TYPE = constants.TYPE;
var IFACE = constants.IFACE;
var ERROR = constants.ERROR;
var TYPE = constants.TYPE;


module.exports = {
  createInterface: createInterface,
  createMethod: createMethod,
  createSignal: createMethod,
};



function createInterface(settings, members){
  return new DBusInterface(settings, members);
}

function createMethod(settings){
  return new DBusMethod(settings);
}

function createSignal(settings){
  return new DBusSignal(settings);
}




function DBusMessage(options){
  if ('name' in options) {
    'arg' in options && this.defineArgs(options.arg);
    delete options.arg;
  }
  copy(this, options);
}

DBusMessage.prototype = {
  __proto__: EventEmitter.prototype,
  _inputArgs: Object.freeze([]),
  _signature: null,
  bus: BUS.SYSTEM,
  type: TYPE.INVALID,
  path: ROOT.PATH,
  iface: ROOT.IFACE,
  destination: ROOT.IFACE,

  member: null,

  set name(v){
    Object.defineProperties(this, { member: _(v), name: _(v) });
  },

  closeConnection: function closeConnection(){
    process.nextTick(function(){ binding.deinit(this.bus) }.bind(this));
  },

  setSignature: function setSignature(sig){
    this._signature = typeof sig === 'string' ? sig : signature(sig);
  },

  defineArgs: function defineArgs(args){
    [].concat(args).forEach(function(arg){
      var set = 'direction' in arg ? arg.direction + 'put' : 'payload';
      if (arg.type[0] === 'a') {
        var type = types[arg.type[1]] + 'Array';
      } else {
        var type = types[arg.type];
      }
      console.log(arg.type)
      var name = arg.name || type + (this[set].filter(function(s){ return s.type === type }).length+1);
      this[set].push([name, type]);
    }, this);
  },
};




function DBusMethod(options){
  Object.defineProperties(this, {
    input: _([]),
    output: _([]),
  });
  DBusMessage.call(this, options);
  Object.defineProperties(this, {
    _signature: _(null).HIDDEN,
    _inputArgs: _([]).HIDDEN,
    type: _(options.async ? TYPE.ASYNC_METHOD : TYPE.SYNC_METHOD).HIDDEN,
  });
}

DBusMethod.prototype = {
  __proto__: DBusMessage.prototype,
  constructor: DBusMethod,
  timeout: -1,

  appendArgs: function appendArgs(){
    if (!arguments.length) return false;
    this._inputArgs = slice(arguments);
    this._signature = signature(this._inputArgs);
    return true;
  },

  clearArgs: function clearArgs(){
    this._inputArgs = [];
    this._signature = null;
  },

  send: function send(){
    binding.init.call(this);
    binding.invokeMethod.call(this);
    if (this.type === TYPE.SYNC_METHOD) {
      var ret = this._returnValue;
      delete this._returnValue;
      return ret;
    }
  }
};



function DBusSignal(options){
  Object.defineProperty(this, 'payload', _([]));
  DBusMessage.call(this, options);
}

DBusSignal.prototype = {
  __proto__: DBusMessage.prototype,
  constructor: DBusSignal,
  type: TYPE.SIGNAL,

  addMatch: function addMatch(){
    binding.init.call(this);
    binding.addMatch.call(this);
  },

  removeMatch: function removeMatch(){
    binding.removeMatch.call(this);
  },

  send: function send(){
    binding.init.call(this);
    binding.sendSignal.call(this);
  }
};






function DBusInterface(options, members){
  copy(this, options);
  Object.defineProperties(this, {
    _methodTemplate: _(new DBusMethod(this)).PRIVATE,
    _signalTemplate: _(new DBusSignal(this)).PRIVATE,
    events: _({}),
  });
  members && this.addMembers(members);
}


DBusInterface.prototype = {
  __proto__: EventEmitter.prototype,
  constructor: DBusInterface,

  set path(v){
    Object.defineProperty(this, 'path', _(v).PRIVATE);
  },

  addMethod: function addMethod(name, timeout, async){
    var method = Object.create(this._methodTemplate);
    if (typeof name === 'string') {
      DBusMethod.call(method, {
        member: name,
        async: async,
        timeout: timeout || -1
      });
    } else {
      var temp = name.name;
      DBusMethod.call(method, name);
      name = temp;
    }

    this[name] = eval([
      '(function '+name+'('+method.input.map(function(s){return s[0]})+'){',
      '  if (arguments.length) method.appendArgs.apply(method, arguments);',
      '  return method.send();',
      '})'
    ].join('\n'));
    Object.defineProperty(this[name], '_binding', _(method).HIDDEN);
  },

  //['function ','(','){','}']

  

  addSignal: function addSignal(name, sender){
    var emitter = Object.create(this._signalTemplate);

    if (typeof name === 'string') {
      DBusSignal.call(emitter, {
        member: name,
        sender: sender
      });
    } else {
      var temp = name.name;
      DBusSignal.call(emitter, name);
      name = temp;
    }

    var self = this;
    emitter.on('signalReceipt', function(){
      self.emit.apply(this, [name].concat(arguments));
    });

    this.events[name] = emitter;
  },

  addMembers: function addMethods(members){
    Object.keys(members).forEach(function(name){
      var type = members[name].shift();
      var params = [name].concat(members[name]);
      if (type !== TYPE.SIGNAL) {
        params.push(type === TYPE.ASYNC_METHOD);
        type = this.addMethod;
      } else {
        type = this.addSignal;
      }
      type.apply(this, params);
    }, this);
  },

  subscribe: function subscribe(name){
    binding.init.call(this.events[name]);
    binding.addMatch.call(this.events[name]);
  },

  unsubscribe: function unsubscribe(name){
    binding.removeMatch.call(this.events[name]);
  },
};




function DBusError(name, message){
  this.name = ROOT.IFACE + '.' + name;
  this.message = message;
  Error.captureStackTrace(this, DBusError.caller);
}

DBusError.prototype = Object.create(Error.prototype);





binding.onMethodResponse = function(args, error) {
  if (args && args.length === 1) args = args[0];
  if (this.type === TYPE.ASYNC_METHOD) {
    if (error) {
      this.emit('error', error);
    } else {
      args.unshift('methodResponse');
      this.emit.apply(this, args);
    }
  } else {
    if (error) throw error;
    this._returnValue = args;
  }
};

binding.onSignalReceipt = function(objectList, args) {
  if (Array.isArray(objectList)) {
    args.unshift('signalReceipt');
    objectList.forEach(function(caller){
      caller.emit.apply(caller, args);
    });
  }
};







var rootRegex = new RegExp('^'+ROOT.PATH);

//bindings.init
//bindings.deinit
//bindings.invokeMethod
//bindings.sendSignal
//bindings.addMatch
//bindings.removeMatch