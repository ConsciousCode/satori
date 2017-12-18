'use strict';

const
	satori = require("./lib/satori"),
	timers = require("timers"),
	dom = require("./lib/dom");

var w = new satori.Window({
	borderWidth: 1
}).on('click', ev => {if(ev.state) console.log("Parent")});

var
	a = new satori.Window({
		x: 0, y: 0, w: 32, h:32,
		bg: "red",
		parent: w,
		borderWidth: 1
	}).show(),
	b = new satori.Window({
		x: 32, y: 0, w: 32, h: 32,
		bg: "green",
		parent: w,
		borderWidth: 1
	}).show(),
	c = new satori.Window({
		x: 64, y: 0, w: 32, h: 32,
		bg: "blue",
		parent: w,
		borderWidth: 1
	}).show();//.on('click', ev => {if(ev.state) console.log("Child")});

c.on('click', ev => {if(ev.state) console.log("Child")});

a.a = true;
b.b = true;
c.c = true;

w.show();

console.log("a", a.id, "b", b.id, "c", c.id);
