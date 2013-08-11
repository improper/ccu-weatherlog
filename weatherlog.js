var CCU_HOSTNAME = 'homematic.fritz.box',
    USERNAME     = 'pi',
    PASSWORD     = 'nopassword',
    DEBUG        = true,
    
    SENSORS      = [
      { address: 'KEQ0048734', name: 'innen' },
      { address: 'KEQ0053713', name: 'aussen' },
      { address: 'KEQ0053703', name: 'Dachboden' }
    ],
    
    CSV_FILENAME = '/home/pi/weather.csv';

// main

var async   = require('async'),
    fs      = require('fs'),
    http    = require('http'),
    moment  = require('moment'),
    csvStream,
    session;

var writeCsvHeader = ! fs.existsSync(CSV_FILENAME),
    csvStream      = fs.createWriteStream(CSV_FILENAME, { flags: 'a' }),
    sensorCount    = SENSORS.length;

if (writeCsvHeader) {
  var fields = 'Zeit';
  for (var i = 0; i < sensorCount; i++) {
    var sensor = SENSORS[i];
    fields += ',Temperatur ' + sensor.name + ',Luftfeuchte ' + sensor.name;
  }
  csvStream.write(fields + "\r\n");
}

var funs    = [],
    fields  = [ moment().format() ],
    running = sensorCount;
for (var i = 0; i < sensorCount; i++) {
  funs[i] = function(f) {
    return function(callback) {
      getSensorData(SENSORS[f].address, function gotResult(data) {
        fields[f * 2 + 1] = parseFloat(data.TEMPERATURE);
        fields[f * 2 + 2] = parseInt(data.HUMIDITY);
        callback();
      });
    };
  }(i);
}

async.series(funs, function allDone() { // allow only one request at a time
  csvStream.write(fields.join(',') + "\r\n");
  ccuLogout(); // function() {});
});

// CCU API

function getSensorData(address, callback) {
  ccuMethod('Interface.getParamset', {
    interface: 'BidCos-RF',
    address: address + ':1',
    paramsetKey: 'VALUES'
  }, callback);
}

// CCU RPC

function ccuMethod(method, params, callback) {
  if (! session) {
    ccuRpc('Session.login',
      { username: USERNAME, password: PASSWORD }, 
      function loginResult(response) {
        session = response.result;
        ccuMethod(method, params, callback);
      });
  } else {
    var sessionParams = {};
    for (var key in params) {
      sessionParams[key] = params[key];
    }
    sessionParams['_session_id_'] = session;
    ccuRpc(method, sessionParams, function onSuccess(response) {
      callback(response.result);
    });
  }
}

function ccuRpc(method, params, callback) {
  var query = {
    method: method,
    params: params
  };
  query = JSON.stringify(query);

  var req = http.request({
    hostname: CCU_HOSTNAME,
    path:     "/api/homematic.cgi",
    method:   "POST",
    headers: { 
      "Accept": "*/*",
      "Content-Type": "application/json-rpc; charset=utf-8",
      "Content-Length": query.length
    }
  }, function (res) {
    var body = "";
    res.addListener('data', function(chunk) {
      body += chunk.toString();
    });
    res.addListener('end', function() {
      var result = JSON.parse(body);
      if (result.error) {
        throw 'CCU RPC error ' + result.error.code + ': ' + result.error.message;
      } else {
        if (DEBUG) {
          console.log('<= ' + body);
        }
        callback(JSON.parse(body));
      }
    });
  });
  if (DEBUG) {
    console.log('=> ' + query);
  }
  req.end(query);
}

function ccuLogout(callback) {
  ccuMethod('Session.logout', {}, callback !== undefined ? callback : function() {});
}
