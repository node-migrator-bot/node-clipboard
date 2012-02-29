var xm = require('xml-mapping');
var dbus = require('./node-dbus');

var SYNC = require('./constants').TYPE.SYNC_METHOD;
var SIGNAL = require('./constants').TYPE.SIGNAL;



introspect = function(){
  var member = dbus.createMethod({
    path:'/org/freedesktop/DBus/Introspectable' ,
    iface: 'org.freedesktop.DBus.Introspectable',
    member: 'Introspect'
  });
  return function introspect(dest) {
    member.destination = dest ? 'org.freedesktop.DBus.' + dest : 'org.freedesktop.DBus';

    try { var json = xm.load(member.send()) }
    catch (e) { member.destination = 'org.freedesktop.DBus'; return e; }

    return [].concat(json.node.interface).reduce(function(ret, json){
      var iface = dbus.createInterface({
        iface: json.name,
        path: '/' + json.name.replace(/\./g, '/')
      });

      if (json.method) {
        [].concat(json.method).forEach(iface.addMethod.bind(iface));
      }

      if (json.signal) {
        [].concat(json.signal).forEach(iface.addSignal.bind(iface));
      }

      ret[json.name.replace(member.destination, '').slice(1) || 'root'] = iface;
      return ret;
    }, {});
  }
}();


var root = introspect().root;

console.log(Object.keys(root).map(function(s){ return root[s]+''}).join('\n'))
//var Introspectable = dbus.createService('Introspectable');
//(connection, *service_name, *object_path, "org.freedesktop.DBus.Introspectable");
//org.freedesktop.DBus.Properties.GetAll (in STRING interface_name, out DICT<STRING,VARIANT> props);

