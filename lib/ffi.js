var ffi = require('node-ffi');

module.exports = {
  Library: Library,
  Pointer: ffi.Pointer,
  Constants: Constants,
  errno: ffi.errno,
  NULL: ffi.Pointer.NULL,
  POINTER_SIZE: ffi.Bindings.POINTER_SIZE,
};

function Library(name, functions) {
  this.name = name;
  this._lib = new ffi.DynamicLibrary(name ? name + Library.extension : null, ffi.DynamicLibrary.FLAGS.RTLD_NOW);
  if (functions) this.createFunction(functions);
}
Library.extension = ffi.PLATFORM_LIBRARY_EXTENSIONS[process.platform];

Library.prototype = {
  constructor: Library,
  createFunction: function createFunction(name, ret, params){
    if (typeof name === 'object') {
      var self = this;
      return Object.keys(name).reduce(function(fns, name){
        fns[name] = createFunction.apply(self, [name].concat(fns[name]));
        return fns;
      }, name);
    }
    var names = params ? Object.keys(params) : [];
    var types = names.map(function(param){ return params[param] });
    var func = this[name] = new ffi.ForeignFunction(this._lib.get(name), ret, types);
    delete func.getFunction;
    names.forEach(function(name,i){ Object.defineProperty(func, i, { value: name }) });
    return func;
  },
  set _lib(v){ Object.defineProperty(this, '_lib', { value: v }) },
};

function Constants(name, map){
  map = Object.keys(map).reduce(function(ret, key){
    var val = map[key];
    ret[key] = val;
    ret[val] = key;
    return ret;
  }, {});
  name += '_';
  var lookup = function(v){
    return map[v] || map[name+(v+'').toUpperCase()];
  };
  lookup.count = map.length / 2;
  return lookup;
}

