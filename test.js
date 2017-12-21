'use strict';

const
	satori = require("./lib/satori"),
	timers = require("timers"),
	widget = require("./lib/widget");

var span = new satori.Span({borderWidth: 1, bg: 'blue'});
var w = new satori.Window(
	{borderWidth: 0, bg: 'red'}, [
		span
	]
);
span.frame.show();
w.show();
