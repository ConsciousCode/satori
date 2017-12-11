'use strict';

const
	satori = require("./satori");

var w = new satori.Window();

w.addListener('keypress', console.log);
w.on('mousepress', console.log);
w.on('windowfocus', console.log);
