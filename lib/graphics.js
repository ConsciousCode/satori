'use strict';

const
	{colormaps, Window} = require("./window"),
	{native, NATIVE, defineNative} = require("./native");

/**
 * Manage a local font:id map
**/
const fontmap = {
	fonts: {},
	get: function(name) {
		name = (name + "").toLowerCase();
		let f = this.fonts[name];
		if(typeof f === 'number') {
			return f;
		}
		else {
			return this.fonts[name] = native.openFont(name);
		}
	}
};

class GraphicsContext {
	constructor(w, config) {
		this.target = w;
		
		let map = colormaps[w];
		defineNative(this, new native.NativeGraphicsContext(
			w[NATIVE],
			map.get(this, config.fg), map.get(this, config.bg),
			config.lineWidth|0, fontmap.get(config.font)
		));
	}
	
	setStyle(config) {
		let map = colormaps[this.target];
		this[NATIVE].setStyle(
			map.get(this, config.fg), map.get(this, config.bg),
			config.lineWidth|0, fontmap.get(config.font)
		);
		return this;
	}
	
	/**
	 * Draw the given points using the foreground color.
	 *
	 * @param rel True if the points are relative to each other.
	**/
	drawPoints(rel, ...points) {
		this[NATIVE].drawPoints(
			!!rel, ...points.map(v => ({x: v.x|0, y: v.y|0}))
		);
		return this;
	}
	drawPoint(x, y) {
		this.drawPoints(false, {x, y});
		return this;
	}
	
	/**
	 * Draw the given lines using the foreground color.
	 *
	 * @param rel True if the points are relative to each other.
	**/
	drawLines(rel, ...lines) {
		this[NATIVE].drawLines(!!rel, ...lines.map(v => ({
			x1: v.x1|0, y1: v.y1|0,
			x2: v.x2|0, y2: v.y2|0
		})));
		return this;
	}
	drawLine(x1, y1, x2, y2) {
		return this.drawLines(false, ({x1, y1, x2, y2}));
	}
	
	/**
	 * Draw a bunch of rectangles using the foreground color.
	 *
	 * @param fill Switch between stroking and filling.
	**/
	drawRects(fill, ...rects) {
		this[NATIVE].drawRects(!!fill, ...rects.map(v => ({
			x: v.x|0, y: v.y|0,
			w: v.w|0, h: v.h|0
		})));
		return this;
	}
	drawRect(fill, x, y, w, h) {
		return this.drawRects(fill, ({x, y, w, h}));
	}
	strokeRect(x, y, w, h) {
		return this.drawRect(false, x, y, w, h);
	}
	strokeRects(...rects) {
		return this.drawRects(false, ...rects);
	}
	fillRect(x, y, w, h) {
		return this.drawRect(true, x, y, w, h);
	}
	fillRects(...rects) {
		return this.drawRects(true, ...rects);
	}
	
	//drawOvals
	//drawPolygon
	
	/**
	 * Draw text.
	**/
	drawText(x, y, text) {
		this[NATIVE].drawText(x|0, y|0, text + "");
		return this;
	}
}

module.exports = {
	GraphicsContext
};
