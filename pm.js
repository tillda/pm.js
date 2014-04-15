#!/usr/local/bin/node

var spawn = require('child_process').spawn;
var fs = require('fs');
var program = require('commander');
var path = require('path');
var colors = require('colors');

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
        var tokens = process.cmd.split(" ");
        process.exec = tokens[0];
        process.args = tokens.splice(1).join(" ");
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
    return str;
}

function stderrLinesFormatter(str) {
    str = str.replace(/\n\s*/, "");
    var marker = "  ERROR  ".redBG.black + " ";
    return marker + str.replace(/\n/g, "\n"+marker);
}

function addHeaders(name, output, changed, linesFormatter) {
    var header = "";
    if (changed) {
        var padding = ""
        var ch = "━";
        var width = 15
        for (i=name.length; i<maxLengths.name; i++) {
            padding = padding + ch;
        }
        header = "\n" + times(ch, 2).grey + "  " + name.white + " " + times(ch, maxLengths.name - name.length + width).grey + (reBeginsWithEnter.test(output) ? "" : "\n");
    }
    return header + linesFormatter(output.replace(/\n([^$])/g, "\n" + "$1"));
}

function writeOut(str) {
    process.stdout.write(str);
}

function fail(message) {
    writeOut(addHeaders("ERROR".red, message.white, true, stdoutLinesFormatter));
    killProcesses();
    process.exit(1);
}

function run(spec) {

    if (spec.cwd && !fs.existsSync(spec.cwd)) {
        fail("Failed starting process '"+spec.name+"', directory '"+spec.cwd+"' does not exist (current wd is '"+process.cwd()+"').");
    }

    var prc = spawn(spec.exec, spec.args.split(" "), {cwd: spec.cwd});
    spec.process = prc;
    prc.stdout.setEncoding('utf8');

    function onData(data, linesFormatter) {
        var str = data.toString();
        if ((lastProcess != prc) && !lastEndedWithEnter && !reBeginsWithEnter.test(str)) {
            str = "\n" + str;
        }
        writeOut(addHeaders(spec.name, str, lastProcess != prc, linesFormatter));
        lastEndedWithEnter = reEndsWithEnter.test(str);
        lastProcess = prc;
    }

    prc.stdout.on('data', function(data) {
        onData(data, stdoutLinesFormatter);
    });

    prc.stderr.on('data', function(data) {
        onData(data, stderrLinesFormatter);
        writeOut('\u0007');
    });

    prc.on('close', function(code) {
        if (!exiting && (code != 0)) {
            console.log(spec.name, 'failed with code:', code);
        }
    });
}

processes.forEach(run);

function killProcesses() {
    exiting = true;
    writeOut("\n\nExiting: ".white);
    processes.forEach(function(spec) {
        writeOut(spec.name+ " ");
        process.kill(spec.process.pid);
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
    //key = { name: 'c', ctrl: true, meta: false, shift: false, sequence: '\u0003' }
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