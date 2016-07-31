var t = require("tcomb-form");

var watchConfig = t.struct({
  interval: t.maybe(t.Num),
  onChange: t.Boolean,
  debounce: t.maybe(t.Num),
  notify: t.maybe(t.String)
})

module.exports = {schema:watchConfig, transformToFileContents:function(config){return JSON.stringify(config,null,2)}};
