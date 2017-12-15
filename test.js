'use strict';

const
	satori = require("./lib/satori");

var w = new satori.Window();

let
	red = w.native.allocColor(255, 0, 0, 0),
	blue = w.native.allocColor(0, 0, 255, 0);

console.log("red:", red);
console.log("blue:", blue);

w.on('windowpaint', function(ev) {
	let g = new satori.native.NativeGraphicsContext(
		this.native, blue, red, 4, 0
	);
	g.drawRects(false, {x: 0, y: 0, w: 32, h: 32});
});
w.on('keypress', console.log);

console.log(w.native.getSize());
