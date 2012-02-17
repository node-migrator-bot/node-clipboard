var path = require('path');
var util = require('util');
var exists = require('fs').existsSync || path.existsSync;
if (!exists(path.resolve(__dirname, process.platform+'.js'))) {
  throw new Error("This platform isn't supported yet.");
}
var platform = require('./'+process.platform);



var clipboard = module.exports = {
  /**
   * Iterate through the formats in the clipboard raising a callback for each
   * @param  {Function} callback  callback(format, formatName, isCustom)
   * @return {Array}              the collected return values from the callbacks
   */
  iterate: function iterate(callback){
    var iterator = platform.formatIterator();
    var format;
    var ret = [];

    platform.ref();
    while (format = iterator.next()) {
      var builtin = platform.formats[format];
      ret.push(callback(format, platform.formatName(format), !builtin));
    }
    platform.unref();

    return ret;
  },

  /**
   * Clear the clipboard of all data
   */
  clear: function clear(){
    platform.ref();
    var result = platform.clear();
    platform.unref();
  },

  /**
   * Write a value or values to the clipboard.
   * @param  {Array}  values  Organized as [{ format: formatName, value: valueToWrite }, ...]
   *                                    or [[formatName, valueToWrite], ...]
   * @param  {String} values  A single string will be written to the primary plaintext clipboard field
   */
  write: function write(values){
    values = Array.isArray(values) ? values : [values];

    platform.ref();
    platform.clear();

    values.forEach(function(item){
      var type;
      if (Array.isArray(item)) {
        type = item[0];
        item = item[1]
      } else {
        if (typeof item === 'string') {
          type = 'ascii';
        } else if (Object(item) === item) {
          type = 'jsobject';
        } else {
          type = 'jsobject';
          item = [item];
        }
      }
      platform.write(type, item);
      if (type === 'jsobject') {
        platform.write('ascii', util.inspect(item));
      }
    });

    platform.unref();
  },
  
  /**
   * Read a value from the clipboard based on format type
   * @param  {String} format   Specific clipboard format field to read from
   * @return {Buffer|String}   Resolved clipboard value
   */
  read: function read(format){
    if (!format) return read('jsobject') || read('ascii');
    platform.ref();
    var result = platform.read(format);
    platform.unref();

    switch (platform.formatName(format)) {
      case 'jsobject':
        return result.toObject();
      case 'ascii':
        return result.toString();
      case 'unicode':
        result = Buffer.isBuffer(result) ? result : result.toBuffer();
        var unicode = '';
        var size = result.length - 2;
        for (var i=0; i < size; i+=2) {
          unicode += String.fromCharCode(result.readUInt16LE(i));
        }
        return unicode;
      default:
        return Buffer.isBuffer(result) ? result : result.toBuffer();
    }
  },

  /**
   * Read all fields from the clipboard
   * @return {Object[]} [{format: formatName, value: stringOrBuffer, custom: booleanIsCustomFieldType }]
   */
  readAll: function readAll(){
    return clipboard.iterate(function(format, formatName, isCustom){
      return {
        format: formatName,
        value: clipboard.read(format),
        custom: isCustom
      };
    }); 
  },

  /**
   * Get an array of the format names for the data currently in the clipboard
   * @return {String[]}
   */
  formats: function formats(){
    return clipboard.iterate(function(format, formatName, isCustom){
      return formatName;
    });
  }
};
