var t = require("tcomb");

var filePath = t.struct({
  filePath: t.String
}, "file-path")

var remoteSendConfig = t.struct({
    url: t.String,
    additionalFiles: t.maybe(t.list(filePath)),
    tags: t.maybe(t.list(t.String)),
    tagLatest: t.maybe(t.enums({"false":"false", "true": "true"}, "tag-latest"))
}, "remote-send-config")


module.exports = {schema:remoteSendConfig};
