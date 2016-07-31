var t = require("tcomb");

var filePath = t.struct({
  filePath: t.String
}, "file-path")

var remoteSendConfig = t.struct({
    url: t.String,
    additionalFiles: t.maybe(t.list(filePath)),
    dockerFile: t.Boolean,
    hosts: t.Boolean
}, "remote-send-config")


module.exports = {schema:remoteSendConfig};
