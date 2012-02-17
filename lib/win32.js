var ffi = require('./ffi');

// The clipboard is one of the few things that still uses global allocation
var kernel32 = new ffi.Library('kernel32', {
  GlobalSize:   ['ulong',   { hMem: 'ulong' }],
  GlobalLock:   ['pointer', { hMem: 'ulong' }],
  GlobalUnlock: ['int8',    { hMem: 'ulong' }],
  GlobalAlloc:  ['ulong',   { uFlags: 'uint', dwBytes: 'ulong' }],
});

var GMEM = ffi.constants('GMEM',{
  GMEM_FIXED:    0x0000,
  GMEM_MOVEABLE: 0x0002,
  GMEM_ZEROINIT: 0x0040,
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


var CF = ffi.constants('CF', {
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


/**
 * A wrapper class for dealing with these global handles the clipboard requires.
 * @param {HGLOBAL} handle   A global handle originating from a handful of win32 API calls
 */
function GlobalHandle(handle){
  if (!(this instanceof GlobalHandle)) return new GlobalHandle(handle);
  this._handle = handle;
}

/**
 * Allocate and set a completely new HGLOBAL
 * @param  {String|Buffer|number}  input   A string or Buffer which will be copied to the new global handle 
 * @param  {Number}                input   OR a byte size which simlpy allocates the handle
 * @param  {GMEM}                  [flags] Flags to pass to GlobalAlloc. GMEM_MOVEABLE is default
 * @return {GlobalHandle}                  An instantiated GlobalHandle wrapping the new handle.
 */
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
  var handle = new GlobalHandle(kernel32.GlobalAlloc(flags || GMEM('MOVEABLE'), size));
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

  /**
   * Write data to where the handle's pointer points to
   * @param  {String|Buffer} input data to write
   */
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

  /**
   * Copy the data from where the handle's pointer points. ffi.Pointer.toBuffer doesn't
   * work before we receive the size of the buffer via GlobalSize which ffi is unaware of.
   * @return {Buffer}
   */
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

  /**
   * Extract the data as a string using Pointer's getCString which reads until null termination
   * @return {String}
   */
  toString: function toString(){
    var string = kernel32.GlobalLock(this._handle).getCString();
    kernel32.GlobalUnlock(this._handle);
    return string;
  }
};



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

/**
 * Try to return the platform-neutral format name if possible
 * @param  {String|Number} format   Import format to look up which could be the platform neutral name, the 
 *                                  platform specific name, or the integer value of the platform constant.
 * @return {String}
 */
function translateFormat(format){
  if (isNaN(format) && format in formats) {
    format = formats[format];
  }
  return format;
}

var refCount = 0;

module.exports = {
  /**
   * Open the clipboard only if it's no already open, and keep track of it so we can close it when done.
   */
  ref: function ref(){
    if (!refCount++) user32.OpenClipboard(ffi.NULL);
  },

  /**
   * Decrement references and close if no one's using it anymore
   * @return {[type]}
   */
  unref: function unref(){
    if (!--refCount) user32.CloseClipboard();
  },

  /**
   * Empty the clipboard
   */
  clear: function clear(){
    return user32.EmptyClipboard();
  },

  /**
   * Initialize an iterator for the formats currently available in the clipboard
   * @return {Array}  An array with a `method` that self fills and returns the 
   *                  value each time its called, or null when depleted
   */
  formatIterator: function formatIterator(){
    var format = 0;
    var collected = [];
    collected.next = function(){
      format = user32.EnumClipboardFormats(format) || null;
      if (format) collected.push(format);
      else collected.next = function depleted(){};
      return format;
    }
    return collected;
  },

  /**
   * Obtain a format's name whether it's custom or standard
   * @param  {String|Number} format   Import format to look up which could be the platform neutral name, the 
   *                                  platform specific name, or the integer value of the platform constant.
   * @return {[type]}
   */
  formatName: function formatName(format){
    if (isNaN(format)) return format;
    if (format in formats) return formats[format];
    var out = new ffi.Pointer(ffi.POINTER_SIZE);
    user32.GetClipboardFormatNameA(translateFormat(format), out, 512);
    return out.getCString();
  },

  /**
   * Read a single format from the clipboard
   * @param  {String|Number} format Entry's format
   * @return {GlobalHandle}  Wrapper for the handle that knows how to get the data when asked
   */
  read: function read(format){
    return new GlobalHandle(user32.GetClipboardData(translateFormat(format)));
  },

  /**
   * Write a single format to the clipboard
   @param  {String|Number}    format Entry's format
   * @param  {String|Buffer}   value New entry's data
   */
  write: function write(format, value){
    var handle = GlobalHandle.create(value);
    return user32.SetClipboardData(translateFormat(format), handle._handle);
  },

  formats: formats,
}
