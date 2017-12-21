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

function flatten(x) {
	return x.reduce((a, b) => a.concat(b), []);
}

function definePrivate(self, name, value) {
	return Object.defineProperty(self, name, {
		enumerable: false,
		writable: false,
		value
	});
}

module.exports = {
	Position, Size, alias, flatten, private: definePrivate
};
