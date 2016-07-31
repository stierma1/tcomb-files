var t = require("tcomb-form");

var alias = t.struct({
  hostName: t.Str
}, "host");

var hostEntry = t.struct({
  address: t.String,
  hostNames: t.list(alias)
}, "host-entry")

var hosts = t.struct({
  hosts: t.maybe(t.list(hostEntry))
}, "hosts");

function transformToFileContents(hostsConfig){
  var file = "";
  var hosts = hostsConfig.hosts;
  hosts.map(function(hostEntry){
    file += address + "      " + hostEntry.hostNames.map(hostObj => {return hostObj.hostName}).join(" ") + "\n"; 
  });

  return file;
}

module.exports = {
  schema:hosts,
  transformToFileContents:transformToFileContents
};
