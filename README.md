# pm.js - your Project Manager!

This is basically a 3kb drop-in replacement for the "&" syntax in bash.

It **launches multiple commands in background** and **merges their standard output**.

## Example output

![ScreenShot](http://cl.ly/SKyK/1.%20node%20pm.js%20(node)%20(via%20Ember).png)

## Additional features

- Reliable Ctrl+C : it kills all the launched processes
- Visual separators between outputs

## TODO

- Node module should have a global `pm` binary
- that would read the tasks from pm.json

## Usage

It sucks because the tasks are hard-wired in the source for now. Check it out elsewhere, copy `pm.js` to your project, customize it and then `node pm.js`.

Or do what is written in TODO above :-).