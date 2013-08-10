var CCU_HOSTNAME = 'homematic.fritz.box',
    USERNAME     = 'pi',
    PASSWORD     = 'nopassword';

var http         = require('http'),
    session;

getSensorData('KEQ0053713', function gotResult(data) {
  console.log(data);
});

function getSensorData(address, callback) {
  ccuMethod('Interface.getParamset', {
    interface: 'BidCos-RF',
    address: address + ':1',
    paramsetKey: 'VALUES'
  }, callback);
}

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
        callback(JSON.parse(body));
      }
    });
  });
  req.end(query);
}
