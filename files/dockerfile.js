var t = require("tcomb");

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

var InstructionBase = t.struct({
  context: t.maybe(context),
  onBuild: t.maybe(t.enums({"false":"false", "true":"true"}, "on-build")),
  instructionType: t.enums({
    "RUN": "RUN",
    "CMD": "CMD",
    "ENTRYPOINT":"ENTRYPOINT",
    "LABEL": "LABEL",
    "ENV": "ENV",
    "ARG": "ARG",
    "EXPOSE": "EXPOSE",
    "VOLUME": "VOLUME",
    "ADD":"ADD",
    "COPY":"COPY",
    "VOLUME":"VOLUME",
    "HEALTHCHECK": "HEALTHCHECK",
    "STOPSIGNAL":"STOPSIGNAL"
  }, "InstructionType")
});

var VolumeInstruction = InstructionBase.extend({
  path: t.String
})

var ExposeInstruction = InstructionBase.extend({
  port: t.Number
})

var HealthcheckInstruction = InstructionBase.extend({
  interval: t.maybe(t.String),
  timeout:t.maybe(t.String),
  retries: t.maybe(t.Num),
  none: t.maybe(t.String),
  commandConfig: t.maybe(runCmd)
})

var StopsignalInstruction = InstructionBase.extend({
  signal: t.Num
})

var GlobalsAndMetaInstruction = InstructionBase.extend({
  key:t.String,
  value: t.String
})

var RunCmdInstruction = InstructionBase.extend({
  shell: t.maybe(runCmd),
  commandConfig: runCmd
})

var AddFileInstruction = InstructionBase.extend({
  srcs: t.list(value),
  dest: t.String
});

var Instruction = t.union([InstructionBase, RunCmdInstruction,
  GlobalsAndMetaInstruction,AddFileInstruction, ExposeInstruction,
  VolumeInstruction, HealthcheckInstruction, StopsignalInstruction], "Instruction");

Instruction.dispatch = function(instructionBase){
  if(!instructionBase){
      return InstructionBase;
  }

  switch(instructionBase.instructionType){
    case "RUN":
    case "CMD":
    case "ENTRYPOINT": return RunCmdInstruction
    case "LABEL":
    case "ENV":
    case "ARG": return GlobalsAndMetaInstruction
    case "ADD":
    case "COPY": return AddFileInstruction
    case "EXPOSE": return ExposeInstruction
    case "VOLUME": return VolumeInstruction
    case "HEALTHCHECK": return HealthcheckInstruction
    case "STOPSIGNAL": return StopsignalInstruction
    default: return InstructionBase
  }
}

var DockerFile = t.struct({
  directives: t.maybe(t.list(keyValue)),
  from: fromStruct,
  maintainer: t.String,
  instructions: t.maybe(t.list(Instruction))
}, "dockerfile")

function buildRunCMD(instruction){
   var file = (instruction.onBuild === "true" ? "ONBUILD " : "");
    if(instruction.shell){
      let args = [instruction.shell.executable]
        .concat((instruction.shell.options || []).map((obj) => {
          return obj.value;
        }));
      file += "SHELL " + JSON.stringify(args) + "\n"
      file += (instruction.onBuild ? "ONBUILD " : "");
    }
    file += instruction.instructionType + " "
    let args = [instruction.commandConfig.executable]
      .concat((instruction.commandConfig.options || []).map((obj) => {
        return obj.value;
      }));
    file += JSON.stringify(args) + "\n"
    return file;
}

function buildAddFile(instruction){
   var file = (instruction.onBuild === "true" ? "ONBUILD " : "");
   file += instruction.instructionType + " "
   var args = (instruction.srcs || []).map((obj) => {return obj.value}).concat([instruction.dest]);
   file += JSON.stringify(args) + "\n"
  return file;
}

function buildLabel(instruction){
   var file = (instruction.onBuild === "true" ? "ONBUILD " : "");

  file += instruction.instructionType + " "
  file += instruction.key + "=" + instruction.value + "\n"
  return file
}

function buildHealthCheck(instruction){
   var file = (instruction.onBuild === "true" ? "ONBUILD " : "");

  file += instruction.instructionType + " "
  if(!instruction.commandConfig){
    file += "NONE" + "\n";
    return file;
  } else {
    if(instruction.interval){
      file += "--interval=" + instruction.interval +" ";
    }
    if(instruction.timeout){
      file += "--timeout=" + instruction.timeout + " "
    }
    if(instruction.retries){
      file += "--retry=" + instruction.retries + " "
    }
    if(instruction.commandConfig){
      file += "CMD ";
      var args = [instruction.commandConfig.executable]
        .concat((instruction.commandConfig.options || []).map((obj) => {
          return obj.value;
        }));
      file += JSON.stringify(args);
    }
    file += "\n"
  }
  return file;
}

function buildVolume(instruction){
  var file = (instruction.onBuild === "true" ? "ONBUILD " : "");

  file += instruction.instructionType + " ";
  file += JSON.stringify([instruction.path]) + "\n";
  return file;
}

function buildExpose(instruction){
  var file = (instruction.onBuild === "true" ? "ONBUILD " : "");

  file += instruction.instructionType + " ";
  file += instruction.port + "\n";
  return file;
}

function buildStopSignal(instruction){
  var file = (instruction.onBuild === "true" ? "ONBUILD " : "");

  file += instruction.instructionType + " ";
  file += instruction.signal + "\n";
  return file;
}


function transformToFileContents(config){
  var file = "";
  for(var directive of config.directives || []){
    file += "# " + directive.key + "=" + directive.value +"\n"
  }
  file += "FROM " + config.from.image +
    (config.from.tag ? ":" + config.from.tag : "") +
    (config.from.digest ? "@" + config.from.digest : "") + "\n"

  file += "MAINTAINER " + config.maintainer + "\n";

  for(var instruction of config.instructions || []){
    if(instruction.context){
      if(instruction.context.user){
        file += (instruction.onBuild === "true" ? "ONBUILD " : "") +  "USER " + instruction.context.user + "\n"
      }
      if(instruction.context.workDir){
        file += (instruction.onBuild === "true" ? "ONBUILD " : "") + "WORKDIR " + instruction.context.workDir + "\n"
      }
    }

    switch(instruction.instructionType){
      case "RUN":
      case "CMD":
      case "ENTRYPOINT": file += buildRunCMD(instruction); break;
      case "LABEL":
      case "ENV":
      case "ARG":  file += buildLabel(instruction); break;
      case "ADD":
      case "COPY": file += buildAddFile(instruction); break;
      case "EXPOSE": file += buildExpose(instruction); break;
      case "VOLUME": file += buildVolume(instruction); break;
      case "HEALTHCHECK": file += buildHealthCheck(instruction); break;
      case "STOPSIGNAL": file += buildStopSignal(instruction); break;
    }
  }

  return file;
}

module.exports = {schema:DockerFile, transformToFileContents:transformToFileContents};
