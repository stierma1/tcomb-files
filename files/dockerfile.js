var t = require("tcomb-form");

/*
directive,
user,
workdir,
maintainer,
from,
run,
cmd,
entrypoint,
add,
copy,
label,
arg,
env,
expose,
onbuild
*/
var keyValue = t.struct({
  key:t.String,
  value: t.String
},"key-value")

var value = t.struct({
  value: t.String
},"value")

var numValue = t.struct({
  value: t.Num
}, "num-value")

var fileCopyEntry = t.struct({
  srcs: t.list(value),
  dest: t.String
}, "copy-entry")

var runCmd = t.struct({
  executable: t.String,
  options: t.maybe(t.list(value))
}, "run-cmd")

var fromStruct = t.struct({
  image: t.String,
  tag: t.maybe(t.String),
  digest: t.maybe(t.String)
}, "from")

var context = t.struct({
  user: t.maybe(t.Str),
  workDir: t.maybe(t.Str)
}, "context");

var instruction = t.struct({
  context: context
}, "instruction")

var runCmdInstruction = t.struct({
  shell: t.maybe(runCmd),
  type: t.enums({
    "run": "RUN",
    "cmd": "CMD",
    "entrypoint": "ENTRYPOINT"
  }, "command-type"),
  commandConfig: runCmd
}, "run-cmd-instruction" )

var addFileInstruction = t.struct({
  type: t.enums({
    "add": "ADD",
    "copy": "COPY"
  }, "copy-type"),
  fileCopyConfig: fileCopyEntry
}, "add-file-instruction")

var keyValInstruction = t.struct({
  type: t.enums({
    "label": "LABEL",
    "arg": "ARG",
    "env": "ENV"
  }, "key-val-type"),
  keyValues: t.list(keyValue)
}, "key-value-instruction")

var healthcheck = t.struct({
  interval: t.maybe(t.String),
  timeout:t.maybe(t.String),
  retries: t.maybe(t.Num),
  none:t.Boolean,
  commandConfig: t.maybe(runCmd)
}, "healthcheck")

var instruction = t.struct({
  context: t.maybe(context),
  onBuild: t.Boolean,
  globalsAndMetaInstruction: t.maybe(keyValInstruction),
  addFileInstruction: t.maybe(addFileInstruction),
  runCmdInstruction: t.maybe(runCmdInstruction),
  expose: t.maybe(t.list(numValue)),
  healthcheck: t.maybe(healthcheck)
}, "instruction")

var DockerFile = t.struct({
  directives: t.maybe(t.list(keyValue)),
  from: fromStruct,
  maintainer: t.String,
  instructions: t.maybe(t.list(instruction))
}, "dockerfile")

function transformToFileContents(config){
  var file = "";
  for(var directive of config.directives || []){
    file += "# " + directive.key + "=" + directive.value +"\n"
  }

  file += "MAINTAINER " + config.maintainer + "\n";

  file += "FROM " + config.from.image +
    (config.from.tag ? ":" + config.from.tag : "") +
    (config.from.digest ? "@" + config.from.digest : "") + "\n"

  for(var instruction of config.instructions || []){
    if(instruction.context){
      if(instruction.context.user){
        file += (instruction.onBuild ? "ONBUILD " : "") +  "USER " + instruction.context.user + "\n"
      }
      if(instruction.context.workDir){
        file += (instruction.onBuild ? "ONBUILD " : "") + "WORKDIR " + instruction.context.workDir + "\n"
      }
    }

    if(instruction.globalsAndMetaInstruction){
      var ins = "";
      ins += (instruction.onBuild ? "ONBUILD " : "");
      switch(instruction.globalsAndMetaInstruction.type){
        case "arg" : ins += "ARG "; break;
        case "label" : ins += "LABEL "; break;
        case "env": ins += "ENV "; break;
      }

      instruction.globalsAndMetaInstruction.keyValues.map((obj) => {
        return obj.key + "=" + obj.value
      }).map((kvStr) => {
        file += ins + kvStr + "\n"
      })
    }

    if(instruction.addFileInstruction){
      file += (instruction.onBuild ? "ONBUILD " : "");
      switch(instruction.addFileInstruction.type){
        case "add" : file += "ADD "; break;
        case "copy" : file += "COPY "; break;
      }
      var args = instruction.addFileInstruction.fileCopyConfig.srcs.concat([instruction.addFileInstruction.fileCopyConfig.dest]);
      file += JSON.stringify(args) + "\n"
    }

    if(instruction.runCmdInstruction){
      file += (instruction.onBuild ? "ONBUILD " : "");
      if(instruction.runCmdInstruction.shell){
        let args = [instruction.runCmdInstruction.shell.executable]
          .concat(instruction.runCmdInstruction.shell.options || []);
        file += "SHELL " + JSON.stringify(args) + "\n"
        file += (instruction.onBuild ? "ONBUILD " : "");
      }
      switch(instruction.runCmdInstruction.type){
        case "run" : file += "RUN "; break;
        case "cmd" : file += "CMD "; break;
        case "entrypoint" : file += "ENTRYPOINT "; break;
      }
      let args = [instruction.runCmdInstruction.commandConfig.executable]
        .concat(instruction.runCmdInstruction.commandConfig.options || []);
      file += JSON.stringify(args) + "\n"
    }

    if(instruction.expose){
      file += (instruction.onBuild ? "ONBUILD " : "");
      file += "EXPOSE ";
      file += instruction.expose.map(obj => obj.value).join(" ") + "\n";
    }

    if(instruction.healthcheck){
      file += (instruction.onBuild ? "ONBUILD " : "");
      file += "HEALTCHECK ";
      if(instruction.healthcheck.none){
        file += "NONE" + "\n";
      } else {
        if(instruction.healthcheck.interval){
          file += "--interval=" + instruction.healthcheck.interval +" ";
        }
        if(instruction.healthcheck.timeout){
          file += "--timeout=" + instruction.healthcheck.timeout + " "
        }
        if(instruction.healthcheck.retries){
          file += "--retry=" + instruction.healthcheck.retries + " "
        }
        if(instruction.healthcheck.commandConfig){
          file += "CMD ";
          var args = [instruction.healthcheck.commandConfig.executable]
            .concat(instruction.healthcheck.commandConfig.options || []);
          file += JSON.stringify(args);
        }
        file += "\n"
      }
    }
  }
  return file;
}

module.exports = {schema:DockerFile, transformToFileContents:transformToFileContents};
