var ffi = require('../ffi');

var kernel32 = new ffi.Library('kernel32', {
  GlobalSize:   ['ulong',   { hMem: 'ulong' }],
  GlobalLock:   ['pointer', { hMem: 'ulong' }],
  GlobalUnlock: ['int8',    { hMem: 'ulong' }],
  GlobalAlloc:  ['ulong',   { uFlags: 'uint', dwBytes: 'ulong' }],
});

var user32 = new ffi.Library('user32', {
  OpenClipboard:                 ['int8',  { hWndNewOwner: 'ulong'}],
  CloseClipboard:                ['int8'],
  EmptyClipboard:                ['int8'],
  SetClipboardData:              ['ulong', { uFormat: 'uint', hMem: 'ulong' }],
  GetClipboardData:              ['ulong', { uFormat: 'uint' }],
  EnumClipboardFormats:          ['uint',  { format: 'uint' }],
  CountClipboardFormats:         ['int'],
  GetClipboardFormatNameA:       ['int',   { format: 'uint', lpszFormatName: 'pointer', cchMaxCount: 'int'}],
  //RegisterClipboardFormatW:      ['uint',  { lpszFormat: 'string' }],
  //AddClipboardFormatListener:    ['int8',  { hwnd: 'ulong' }],
  //RemoveClipboardFormatListener: ['int8',  { hwnd: 'ulong' }],
  //SetClipboardViewer:            ['ulong', { hWndNewViewer: 'ulong' }],
  //ChangeClipboardChain:          ['int8',  { hWndRemove: 'ulong', hWndNewNext: 'ulong'}]
});


var GlobalMem = ffi.Constants('GMEM',{
  GMEM_FIXED:    0x0000,
  GMEM_MOVEABLE: 0x0002,
  GMEM_ZEROINIT: 0x0040,
});

var FormatMessage = ffi.Constants('FORMAT_MESSAGE', {
  FORMAT_MESSAGE_ALLOCATE_BUFFER: 0x0100,
  FORMAT_MESSAGE_ARGUMENT_ARRAY:  0x2000,
  FORMAT_MESSAGE_FROM_HMODULE:    0x0800,
  FORMAT_MESSAGE_FROM_STRING:     0x0400,
  FORMAT_MESSAGE_FROM_SYSTEM:     0x1000,
  FORMAT_MESSAGE_IGNORE_INSERTS:  0x0200,
  FORMAT_MESSAGE_MAX_WIDTH_MASK:  0x00FF,
});


var CF = ffi.Constants('CF', {
  CF_TEXT            : 1,
  CF_BITMAP          : 2,
  CF_METAFILEPICT    : 3,
  CF_SYLK            : 4,
  CF_DIF             : 5,
  CF_TIFF            : 6,
  CF_OEMTEXT         : 7,
  CF_DIB             : 8,
  CF_PALETTE         : 9,
  CF_PENDATA         : 10,
  CF_RIFF            : 11,
  CF_WAVE            : 12,
  CF_UNICODETEXT     : 13,
  CF_ENHMETAFILE     : 14,
  CF_HDROP           : 15,
  CF_LOCALE          : 16,
  CF_DIBV5           : 17,
  CF_MAX             : 18,
  CF_OWNERDISPLAY    : 0x0080,
  CF_DSPTEXT         : 0x0081,
  CF_DSPBITMAP       : 0x0082,
  CF_DSPMETAFILEPICT : 0x0083,
  CF_DSPENHMETAFILE  : 0x008E,
  CF_PRIVATEFIRST    : 0x0200,
  CF_PRIVATELAST     : 0x02FF,
  CF_GDIOBJFIRST     : 0x0300,
  CF_GDIOBJLAST      : 0x03FF,
});





function GlobalHandle(handle){
  if (!(this instanceof GlobalHandle)) return new GlobalHandle(handle);
  this._handle = handle;
}

GlobalHandle.create = function create(input, flags){
  if (typeof input === 'string') {
    input += '\0';
    var size = Buffer.byteLength(input, 'utf8');
  } else if (Buffer.isBuffer(input)) {
    var size = input.length;
  } else if (input > 0) {
    var size = input;
    input = null;
  }
  var handle = new GlobalHandle(kernel32.GlobalAlloc(flags || GlobalMem('MOVEABLE'), size));
  handle.size = size;
  if (input) {
    handle.write(input);
  }
  return handle;
}


GlobalHandle.prototype = {
  constructor: GlobalHandle,

  set _handle(v){ Object.defineProperty(this, '_handle', { value: v }) },

  get size(){ return this.size = kernel32.GlobalSize(this._handle) },
  set size(v){ Object.defineProperty(this, 'size', { value: v, enumerable: true }) },

  write: function write(input){
    var pointer = kernel32.GlobalLock(this._handle);
    var size = this.size;
    if (typeof input === 'string') {
      pointer.putCString(input);
    } else if (Buffer.isBuffer(input)) {
      for (var i=0; i < size; i++) {
        pointer.putInt8(buffer.readInt8(i), true);
      }
    }
    kernel32.GlobalUnlock(this._handle);
  },

  toBuffer: function toBuffer(){
    var size = this.size;
    var pointer = kernel32.GlobalLock(this._handle);
    var buffer = new Buffer(size);
    for (var i=0; i < size; i++) {
      buffer.writeInt8(pointer.getInt8(true), i);
    }
    kernel32.GlobalUnlock(this._handle);
    return buffer;
  },

  toString: function toString(encoding){
    var string = kernel32.GlobalLock(this._handle).getCString();
    kernel32.GlobalUnlock(this._handle);
    return string;
  }
};


var refCount = 0;


var formats = {
  ascii: CF('TEXT'),
  unicode: CF('UNICODETEXT'),
  bitmap: CF('BITMAP'),
  audio: CF('RIFF'),
  symlink: CF('SYLK'),
  dragdrop: CF('HDROP'),
  locale: CF('LOCALE')
};

Object.keys(formats).forEach(function(format){
  formats[formats[format]] = format;
});

formats[CF('OEMTEXT')] = 'ascii';


function translateFormat(format){
  if (isNaN(format) && format in formats) {
    format = formats[format];
  }
  return format;
}


module.exports = {
  ref: function(){ if (!refCount++) user32.OpenClipboard(ffi.NULL) },
  unref: function(){ if (!--refCount) user32.CloseClipboard() },
  clear: user32.EmptyClipboard,
  formats: formats,

  formatIterator: function formatIterator(format){
    format = format || 0;
    var collected = [];
    collected.next = function(){
      format = user32.EnumClipboardFormats(format) || null;
      if (format) collected.push(format);
      else collected.next = function exhausted(){};
      return format;
    }
    return collected;
  },

  formatName: function formatName(format){
    if (isNaN(format)) return format;
    if (format in formats) return formats[format];
    var out = new ffi.Pointer(ffi.POINTER_SIZE);
    user32.GetClipboardFormatNameA(translateFormat(format), out, 512);
    return out.getCString();
  },

  read: function read(format){
    return new GlobalHandle(user32.GetClipboardData(translateFormat(format)));
  },

  write: function write(format, value){
    var handle = GlobalHandle.create(value);
    return user32.SetClipboardData(translateFormat(format), handle._handle);
  }
}

// kernel32.createFunction('FormatMessageW', 'uint32' {
//   dwFlags: 'uint32',
//   lpSource: 'pointer',
//   dwMessageId: 'uint32',
//   dwLanguageId: 'uint32',
//   lpBuffer: 'pointer',
//   nSize: 'uint32',
//   args: 'pointer'
// });
// function formatMessage(messageId, flags, source){
//   var out = new ffi.Pointer(ffi.Bindings.POINTER_SIZE);
//   var length = kernel32.FormatMessageW(FormatMessage('ALLOCATE_BUFFER') | flags, source, messageId, 0, out, 0, NULL);
//   console.log(length)
//   return out//.getCString();
// }

// function lastErrorMessage(){
//   return formatMessage(ffi.errno(), FormatMessage('IGNORE_INSERTS') | FormatMessage('FROM_SYSTEM'), 0);
// }
