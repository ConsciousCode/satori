'use strict';

const
	satori = require("./lib/satori");

var w = new satori.Window();

let red = w.native.allocColor(255, 0, 0, 0);

w.on('windowpaint', function(ev) {
	let g = new satori.native.NativeGraphicsContext(
		this.native, red, red, 4
	);
	g.drawRects({x: 0, y: 0, width: 32, height: 32});
});
w.on('keypress', console.log);

console.log(w.native.getSize());
