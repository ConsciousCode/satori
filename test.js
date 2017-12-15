'use strict';

const
	satori = require("./lib/satori");

var w = new satori.Window();

let
	red = w.native.allocColor(255, 0, 0, 0),
	blue = w.native.allocColor(0, 0, 255, 0),
	font = satori.native.openFont("arial");

console.log("red:", red);
console.log("blue:", blue);
console.log("font:", font);

w.on('paint', function(ev) {
	console.log("paint");
	let g = new satori.native.NativeGraphicsContext(
		this.native, blue, red, 4, font
	);
	g.drawRects(false, {x: 0, y: 0, w: 32, h: 32});
	g.drawText(40, 40, "Hello world");
});
//w.on('keypress', console.log);

