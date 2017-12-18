'use strict';

class Position {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}
}

class Size {
	constructor(w, h) {
		this.w = w;
		this.h = h;
	}
}

/**
 * For API convenience, define method aliases.
**/
function alias(klass, to_alias) {
	let proto = klass.prototype;
	for(let name in to_alias) {
		let real = proto[name];
		
		for(let alias in to_alias[name]) {
			proto[alias] = real;
		}
	}
}

module.exports = {
	Position, Size, alias
};
