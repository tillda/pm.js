#!/usr/local/bin/node

var spawn = require('child_process').spawn;
var fs = require('fs');
var program = require('commander');
var path = require('path');
var colors = require('colors');

program
    .option('-p, --process [name]', 'Start only this process')
    .option('-c, --cmd [name]', 'Only write the command to stdout')
    .option('-g, --group [name]', 'Only start processes that belond to this group')
    .parse(process.argv);

var config = JSON.parse(fs.readFileSync('./pm.json'));
var processes = config.processes;


var nameMaxLength = 0;
processes.forEach(function(process) {
    nameMaxLength = Math.max(process.name.length, nameMaxLength);
});

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

function format(name, output, changed) {
    if (changed) {
        var padding = ""
        var ch = "━";
        var width = 15
        for (i=name.length; i<nameMaxLength; i++) {
            padding = padding + ch;
        }
        output = "\n" + times(ch, 2).blue + "  " + name.white + " " + times(ch, nameMaxLength - name.length + width).blue + (reBeginsWithEnter.test(output) ? "" : "\n") + output;
    }
    return output.replace(/\n([^$])/g, "\n" + "$1");
}

function run(spec) {
    var prc = spawn(spec.exec, spec.args.split(" "), {cwd: spec.cwd});
    spec.process = prc;
    prc.stdout.setEncoding('utf8');
    prc.stdout.on('data', function(data) {
        var str = data.toString();
        if ((lastProcess != prc) && !lastEndedWithEnter && !reBeginsWithEnter.test(str)) {
            str = "\n" + str;
        }
        process.stdout.write(format(spec.name, str, lastProcess != prc));
        lastEndedWithEnter = reEndsWithEnter.test(str);
        lastProcess = prc;
    });
    prc.on('close', function(code) {
        if (!exiting && (code != 0)) {
            console.log(spec.name, 'failed with code:', code);
        }
    });
}

processes.forEach(run);

process.on('SIGINT', function() {
    exiting = true;
    processes.forEach(function(spec) {
        process.kill(spec.process.pid);
    })
});