'use strict';

const
	satori = require("./lib/satori");

var w = new satori.Window();

let
	red = w.native.allocColor(255, 0, 0, 0),
	blue = w.native.allocColor(0, 0, 255, 0),
	font = satori.native.openFont("fixed");

console.log("red:", red);
console.log("blue:", blue);
console.log("font:", font);

w.on('paint', function(ev) {
	console.log("paint");
	let g = this.createGC({
		fg: blue, bg: red, lineWidth: 4, font: font
	});
	console.log("A");
	g.strokeRect(0, 0, 32, 32);
	console.log("B");
	g.drawText(40, 40, "Hello world");
	console.log("C");
});
//w.on('keypress', console.log);

