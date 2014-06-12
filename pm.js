#!/usr/local/bin/node

var spawn = require('child_process').spawn;
var fs = require('fs');
var program = require('commander');
var path = require('path');
var colors = require('colors');
var shellParse = require('shell-quote').parse;
var keypress = require('keypress');
var tty = require('tty');

program
    .option('-p, --process [name]', 'Start only this process')
    .option('-c, --cmd [name]', 'Only write the command to stdout')
    .option('-g, --group [name]', 'Only start processes that belond to this group')
    .option('-i, --info', 'Get list of processes')
    .parse(process.argv);

var config = JSON.parse(fs.readFileSync('./pm.json'));
var processes = config.processes;

var maxLengths = {};

function addLength(name, str) {
    maxLengths[name] = Math.max((str || "").length, (maxLengths[name] || 0));
}

processes.forEach(function(process) {
    if (process.cmd) {
        var tokens = shellParse(process.cmd);
        process.exec = tokens[0];
        var argsArray = tokens.splice(1);
        process.args = argsArray.join(" ");
        process.argsArray = argsArray;
    }
    addLength("name", process.name);
    addLength("exec", process.exec);
    addLength("args", process.args);
    addLength("cmd", process.cmd);
    addLength("cwd", process.cwd);
    addLength("group", process.group);
});


function addPadding(str, length, ch) {
    str = str || "";
    while (str.length<length) {
        str = str + (ch || " ");
    }
    return str;
}

if (program.info) {
    processes.forEach(function(p) {
        writeOut(addPadding(p.name, maxLengths.name+2).green);
        writeOut("  "+addPadding(p.group, maxLengths.group+3));
        writeOut(addPadding(p.cwd, maxLengths.cwd+3).blue);
        writeOut(addPadding(p.exec, maxLengths.exec+1).red);
        writeOut(addPadding(p.args, maxLengths.args+1).white);
        writeOut(" ");
        writeOut(addPadding((p.disabled || (p.enabled === false)) ? "Disabled" : "", "Disabled".length+1));
        writeOut("\n");
    });
    process.exit(0);
}


function checkWorkingDirectory(wd) {

}

if (program.cmd) {
    var p = processes.filter(function(process) {
        return process.name == program.cmd;
    })[0];
    if (!p) {
        throw new Error("Can't find " + program.cmd + " in process definitions");
    }
    console.log(p.exec + " " + p.args);
    process.exit(0);
}

if (program.process) {
    console.log("Starting only:", program.process);
    processes = processes.filter(function(process) {
        return process.name == program.process;
    });
    if (processes.length == 0) {
        throw new Error("Can't find " + program.process + " in process definitions");
    }
}

if (program.group) {
    console.log("Starting only group:", program.group);
    var names = [];
    processes = processes.filter(function(process) {
        var belongsToGroup = (process.group == program.group || (Array.isArray(process.group) && (process.group.indexOf(programGroup) !== -1)));
        if (belongsToGroup) {
            names.push(process.name);
        }
        return belongsToGroup;
    });
    console.log("That is: ", names.join(", "), " - ", processes.length, " processes.");
}

processes = processes.filter(function(process) {
    var enabled = process.disabled != true && process.enabled != false;
    if ((process.name == program.process) || (process.name == program.cmd)) {
        enabled = true;
    }
    if (program.cmd || program.process) {
        enabled = true;
    }
    if (!enabled) {
        console.log("Process", process.name, "is not enabled, skipping.");
    }
    return enabled;
});

var
    exiting = false,
    lastEndedWithEnter = true,
    lastProcess = null,
    reEndsWithEnter = /\n$/,
    reBeginsWithEnter = /^\n/;

function times(ch, n) {
    return Array(n+1).join(ch);
}

function stdoutLinesFormatter(str) {
    str = str.replace(/\n/g, "\n");
    return str;
}

var markers = {
    error : "✖ ERROR ".red + "  ",
    errorSpace : "          "
};

function stderrLinesFormatter(str) {
    str = str.replace(/\n/g, "\n");
    var append = "";
    var marker = "_ERROR_";
    if (/\n\s*/.test(str)) {
        append = "\n";
    }
    var result =  marker + str.replace(/\n\s*$/, "").replace(/^\n/, "").replace(/\n/g, "\n"+"_ERRORSPACE_");
    return result + append;
}

function isSomeProcessRunning() {
    return !!processes.filter(function(p) { return !!p.running; }).length;
}

function startsWithMarker(str) {
    return /\s*_/.test(str);
}

function addHeaders(name, output, changed, linesFormatter) {
    var header = "";
    var formattedOutput = linesFormatter(output);
    if (changed) {
        var padding = ""
        var ch = "━";
        var width = 25
        for (i=name.length; i<maxLengths.name; i++) {
            padding = padding + ch;
        }
        header = "\n" + times(ch, 2).blue + " " + (" " + name + " ").white  + times(ch, maxLengths.name - name.length + width).blue + (reBeginsWithEnter.test(formattedOutput) ? "" : "\n");
        if (startsWithMarker(formattedOutput)) {
            header = header + "\n";
        }
    }
    return header + formattedOutput;
}

function writeOut(str) {
    process.stdout.write(str);
}

function fail(message) {
    writeOut(addHeaders("ERROR".red, message.white, true, stdoutLinesFormatter));
    killProcesses();
    process.exit(1);
}

var lastStdType = "stdout";

function addEnterBefore(str) {
    return "\n" + str.replace(/^\n/, "");
}

function isWhitespace(str) {
    return !!str.replace(/\s+/g, "");
}

function run(spec) {

    if (spec.cwd && !fs.existsSync(spec.cwd)) {
        fail("Failed starting process '"+spec.name+"', directory '"+spec.cwd+"' does not exist (current wd is '"+process.cwd()+"').");
    }

    var prc = spawn(spec.exec, spec.args.split(" "), {cwd: spec.cwd});
    spec.running = true;
    spec.process = prc;
    prc.stdout.setEncoding('utf8');

    function onData(data, linesFormatter, stdType) {
        var str = data.toString();
        var principalChange = (lastProcess != prc) || (stdType != lastStdType);
        var blankLineAlreadyPresented = isWhitespace(str) || lastEndedWithEnter || reBeginsWithEnter.test(str);
        if (principalChange && blankLineAlreadyPresented) {
            str = addEnterBefore(str);
        }
        if ((stdType != lastStdType) && (stdType != "stdout")) {
            writeOut("\n");
        }
        lastStdType = stdType;
        var thisOutput = addHeaders(spec.name, str, lastProcess != prc, linesFormatter);
        thisOutput = thisOutput.replace(/_ERROR_/g, markers.error);
        thisOutput = thisOutput.replace(/_ERRORSPACE_/g, markers.errorSpace);
        writeOut(thisOutput);
        lastEndedWithEnter = reEndsWithEnter.test(str);
        lastProcess = prc;
    }

    prc.stdout.on('data', function(data) {
        onData(data, stdoutLinesFormatter, "stdout");
    });

    prc.stderr.on('data', function(data) {
        onData(data, stderrLinesFormatter, "stderr");
        writeOut('\u0007');
    });

    prc.on('close', function(code, signal) {
        if (!exiting && (code != 0)) {
            console.log("Process " + spec.name + " failed with code " + code + " (signal: " + signal + ").");
        } else {
            console.log("Process " + spec.name + " was terminated. (Code: " + code + ", signal: " + signal + ")");
        }
        spec.running = false;
        if (!isSomeProcessRunning()) {
            writeOut("Nothing to do.");        
            process.exit(0);
        }
    });

    prc.on('error', function(error) {
        console.log(spec.name, "error", error);
    });

    prc.on('disconnect', function(error) {
        console.log(spec.name, "disconnect", error);
    });


}

processes.forEach(run);

function killProcesses() {
    exiting = true;
    writeOut("\n\nExiting: ".white);
    processes.forEach(function(spec) {
        writeOut(spec.name+ " ");
        try {
            process.kill(spec.process.pid);
        } catch (e) {
        }
        spec.running = false;
    });
    writeOut("Done.".green);
}

process.on('SIGINT', function() {
    killProcesses();
});

var keypress = require('keypress')
  , tty = require('tty');

keypress(process.stdin);

process.stdin.on('keypress', function (ch, key) {
    if (key && key.ctrl && key.name == 'c') {
        killProcesses();
        process.exit(0);
    }
});

if (typeof process.stdin.setRawMode == 'function') {
    process.stdin.setRawMode(true);
} else {
    tty.setRawMode(true);
}
process.stdin.resume();