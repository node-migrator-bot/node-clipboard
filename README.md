# node-clipboard

Easy to use utility for reading and writing to the system clipboard.

# usage

```
npm install node-clipboard
```

```javascript
var clipboard = require('node-clipboard');

// _Read_
var fromClipboard = clipboard.read();     // defaults to ascii
fromClipboard = clipboard.read('bitmap'); // buffer
fromClipboard = clipboard.readAll();      // all formats

// _Write_
clipboard.write('some text');
clipboard.write([
	{ format: 'ascii', value: 'some text' },
	{ format: 'unicode', value: '\u1059\u0000etc' },
	{ format: 'bitmap', value: someBuffer }
]);

// _Clear_
clipboard.clear();

// _Iterate_

// clipboard.formats() is a shortcut for:

var formats = clipboard.iterate(function(format, formatName, isCustom){
	return formatName;
});
```

