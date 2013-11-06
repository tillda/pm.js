
var spawn = require('child_process').spawn;
var fs = require('fs');
var program = require('commander');
var path = require('path');
var colors = require('colors');

program
    .option('-p, --process [name]', 'Start only this process')
    .option('-g, --get [name]', 'Only write the command to stdout')
    .parse(process.argv);


/****/ throw new Error("It works fine but update tasks list below and remove this error in pm.js.") /****/

var processes = [
    /*

    Example tasks:

    {name: "clj-tdd",       exec: "lein",   args: "with-profile bleeding midje :autotest", cwd:"editor"},
    {name: "cljs-build",    exec: "lein",   args: "cljsbuild auto dev", cwd:"editor"},
    {name: "cljx",          exec: "lein",   args: "cljx auto", cwd: "editor"},
    {name: "devserver",     exec: "node",   args: "app.js", cwd:"devserver"},
    {name: "grunt",         exec: "grunt",  args: "watch", cwd : "client"},
    {name: "livereload",    exec: "grunt",  args: "watch --gruntfile Gruntfile-LiveReload.js", cwd : "client"},
    {name: "api-server",    exec: "npm",    args: "start", cwd : "server"}
    */
];

var nameMaxLength = 0;
processes.forEach(function(process) {
    nameMaxLength = Math.max(process.name.length, nameMaxLength);
});

if (program.get) {
    var p = processes.filter(function(process) {
        return process.name == program.get;
    })[0];
    console.log(p.exec + " " + p.args);
    process.exit(0);
}

if (program.process) {
    console.log("Starting only:", program.process);
    processes = processes.filter(function(process) {
        return process.name == program.process;
    });
}

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