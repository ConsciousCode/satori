'use strict';

const color = require("./lib/color");

function randomColor() {
	return new color(
		Math.random()*0xff,
		Math.random()*0xff,
		Math.random()*0xff
	);
}

function babel(x, n) {
	for(let i = 0; i < n; ++i) {
		x = new color(...color.hsv2rgb(x.h, x.s, x.v));
	}
	return x;
}

for(let i = 0; i < 100; ++i) {
	let color = randomColor();
	let corrupt = babel(color, 100);
	
	//console.log(color, corrupt);
	//continue;
	let error = Math.hypot(
		color.r - corrupt.r,
		color.g - corrupt.g,
		color.b - corrupt.b
	);
	
	console.log("Error:", error);
}
