'use strict';

const
	satori = require("./lib/satori"),
	a=0//dom = require("./lib/dom");

var w = new satori.Window({
	borderWidth: 1
});

let
	red = w.native.allocColor(255, 0, 0, 0),
	blue = w.native.allocColor(0, 0, 255, 0),
	font = satori.native.openFont("fixed");

w.native.setBG(red);
w.show();

