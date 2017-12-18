'use strict';

const
	native = require("bindings")("addon.node")

const NATIVE = "native"; //Symbol("native");

function defineNative(obj, value) {
	Object.defineProperty(obj, NATIVE, {
		enumerable: false,
		writable: false,
		value
	});
}

module.exports = {
	native, NATIVE, defineNative
};

