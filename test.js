'use strict';

const
	satori = require("./satori");

var w = new satori.Window();

w.on('keypress', console.log);
w.on('mousepress', console.log);
w.on('mousehover', console.log);
w.on('windowfocus', console.log);
w.on('mousewheel', console.log);
w.on('windowfocus', console.log);

console.log(w._native.getSize());
