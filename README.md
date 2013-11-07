# pm.js - your Project Manager!

This is basically a 3kb drop-in replacement for the "&" syntax in bash.

It **launches multiple commands in *background*** and **merges their standard output**.

## Example output

![ScreenShot](http://cl.ly/SKyK/1.%20node%20pm.js%20(node)%20(via%20Ember).png)

## Additional features

- Reliable Ctrl+C : it kills all the launched processes
- Visual separators between outputs
- Binary `pm` (instlled via npm) reads `pm.json` from a working directory
- `pm -p name` launches only process "name"
- `pm -g name` only shows the command

## Example process definition file

```json
{
    "processes" : [

    {"name": "clj-tdd",       "exec": "lein",   "args": "with-profile bleeding midje :autotest", "cwd":"editor"},
    {"name": "cljs-build",    "exec": "lein",   "args": "cljsbuild auto dev", "cwd":"editor"},
    {"name": "cljx",          "exec": "lein",   "args": "cljx auto", "cwd": "editor"},
    {"disabled": true, "name": "livereload",    "exec": "grunt",  "args": "watch --gruntfile Gruntfile-LiveReload.js", "cwd" : "client"},
    {"name": "devserver",     "exec": "node",   "args": "app.js", "cwd":"devserver"},
    {"name": "grunt",         "exec": "grunt",  "args": "watch", "cwd" : "client"},
    {"name": "api-server",    "exec": "npm",    "args": "start", "cwd" : "server"}

    ]
}

```

## Usage

It sucks because the tasks are hard-wired in the source for now. Check it out elsewhere, copy `pm.js` to your project, customize it and then `node pm.js`.

Or do what is written in TODO above :-).