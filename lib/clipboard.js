try {
  var platform = require('./'+process.arch+'/'+process.platform);
} catch (e){
  throw new Error("This platform isn't supported yet.");
}



var clipboard = module.exports = {
  iterate: function iterate(callback){
    var iterator = platform.formatIterator();
    var format;
    var ret = [];

    platform.ref();
    while (format = iterator.next()) {
      var builtin = platform.formats[format];
      ret.push(callback(format, builtin || platform.formatName(format), !builtin));
    }
    platform.unref();

    return ret;
  },

  clear: function clear(){
    platform.ref();
    var result = platform.clear();
    platform.unref();
    return result;
  },

  write: function write(values){
    if (typeof values === 'string') {
      values = [{ format: 'ascii', value: values }];
    }
    values = Array.isArray(values) ? values : [values];
    platform.ref();
    platform.clear();
    values.forEach(function(item){
      platform.write(item.format || item[0], item.value || item[1]);
    });
    platform.unref();
  },
  
  read: function read(format){
    format = format || 'ascii';
    platform.ref();
    var result = platform.read(format);
    platform.unref();

    switch (platform.formatName(format)) {
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

  readAll: function readAll(){
    return clipboard.iterate(function(format, formatName, isCustom){
      return {
        format: formatName,
        value: clipboard.read(format),
        custom: isCustom
      };
    }); 
  },

  formats: function formats(){
    return clipboard.iterate(function(format, formatName, isCustom){
      return formatName;
    });
  }
};
