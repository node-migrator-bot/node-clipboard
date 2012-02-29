
var utility = require('./utility');
var _ = utility.createDescriptor;
var constants = require('./constants');
var ROOT = constants.ROOT;
var BUS = constants.BUS;
var TYPE = constants.TYPE;
var IFACE = constants.IFACE;
var ERROR = constants.ERROR;
var TYPE = constants.TYPE;

module.exports = {
  createSignature: createSignature,
  createPath: createPath,
  Signature: Signature,
  Path: Path
}


function createSignature(input){
  return new Signature(input);
}

function createPath(input){
  return new Path(input);
}


function trim(str, char){
  trim[char] = trim[char] || new RegExp('^'+char+'|'+char+'$');
  return str.replace(trim[char], '');
}


function Path(path){
  if (!Path.isPath(path)) throw new Error('Invalid characters in path');
  path = trim(path, '/').replace(/\/{2,}/g, '/');
  this.components = path.split('/');
  this.path = '/' + path;
}

Path.isPath = function isPath(string){
  return string.match(/\/?[\w_]*(\/[\w_]*)*/);
}

Path.prototype = {
  append: function append(component){
    return new Path(this.path + '/' + trim(component, '/'));
  },
  toString: function toString(){
    return this.path ? this.base + '/' + this.path : this.base;
  },
  toName: function toName(){
    return this.path.replace(/\./g,'/').slice(1);
  },
  class: 'Path'
}



function Token(name, ctor){
  this.name = name;
  Object.defineProperty(this, 'constructor', _(ctor).PRIVATE);
}

Token.prototype = Object.create(Array.prototype, {
  toString: _(function(){ return this.name }).PRIVATE,
  valueOf: _(function(){ return this.name }).PRIVATE,
  inspect: _(function(){ return this.name }).PRIVATE,
  constructor: _(null).HIDDEN,
  create: _(function create(value){ return new this.constructor(value)}).HIDDEN,
});

function makeArray(proto){
  var array = [];
  array.__proto__ = proto;
  return array;
}

function ArrayToken(){
  return makeArray(ArrayToken.prototype);
}
ArrayToken.prototype = {
  __proto__: Token.prototype,
  constructor: Array,
  name: 'ARRAY',
  inspect: function(){
    return '[ '+this.map(function(s){ return s.inspect() }).join(', ')+' ]'
  }
}

function DictToken(){
  var dict = makeArray(DictToken.prototype);
  dict.names = [];
  return dict;
}
DictToken.prototype = {
  __proto__: Token.prototype,
  constructor: Object,
  name: 'DICT',
  inspect: function(){
    return '{ '+this.map(function(s,i){
      return (this.names[i] ? this.names[i] + ': ' : '') + s.inspect();
    }, this).join(', ')+' }'
  }
}

var tokens = {
  y: new Token('UINT8', Number),
  q: new Token('UINT16', Number),
  u: new Token('UINT32', Number),
  t: new Token('UINT64', Number),
  n: new Token('INT16', Number),
  i: new Token('INT32', Number),
  x: new Token('INT64', Number),
  d: new Token('DOUBLE', Number),
  b: new Token('BOOLEAN', Boolean),
  s: new Token('STRING', String),
  v: new Token('VARIANT', Buffer),
  h: new Token('UNIX_FD', Number),
  g: new Token('SIGNATURE', String),
  o: new Token('OBJECT_PATH', Path),
}




function Signature(signature){
  if (typeof signature === 'string') {
    this.description = signature;
    this.structure = this.fromSignature(signature);
  }
}

Signature.prototype.class = 'Signature';

Signature.prototype.fromSignature = function fromSignature(input, output){
  if (!output) {
    fromSignature.index = 0;
    output = [];
  }
  if (fromSignature.index >= input.length) return output;

  switch (input[fromSignature.index++]) {
    case 'a':
      fromSignature(input, output[output.push(new ArrayToken)]);
      break;

    case '{':
      output.push(fromSignature(input, new DictToken));
      break;

    case '}':
      return output;

    default:
      output.push(types[input[fromSignature.index]]);
  }

  return Object.getPrototypeOf(output) === ArrayToken.prototype ? output : fromSignature(input, output);
}

var brands = {
  Signature: 'g',
  Boolean:   'b',
  Number:    'i',
  String:    's',
  RegExp:    's',
  Path:      'o',
}

Signature.prototype.toSignature = function toSignature(v){
  if (1 in arguments) return slice(arguments).map(signature).join('');
  if (v == null) v = false;
  var brand = v.class || Object.prototype.toString.call(token).slice(8,-1);
  if (brand in brands) {
    var symbol = brands[brand];
  } else if (Array.isArray(v)) return 'a' + Array(v.length).join(toSignature(a[0]);
  if (Object(v) === v) {
    return '{' + Object.keys(v).map(function(s){
      return signature([v[s]]);
    }).join('') + '}';
  }
}
