'use strict';

const
	common = require("./common"),
	Color = require("./color"),
	{Frame} = require("./frame"),
	{Container} = require("./container"),
	timers = require("timers"),
	{native, NATIVE, COLORMAP, defineNative} = require("./native"),
	events = require("./events");

// Make a function so the event timer can be restarted if all
//  windows are closed, then a new window is created.
let rootwindows = new Set();
function startloop() {
	timers.setImmediate(function() {
		// Only continue the event loop if there's windows
		//  This will make the program exit if all windows are closed
		//  and no other events are scheduled in Node
		if(rootwindows.size) {
			for(let w of rootwindows) {
				w._processEvents();
			}
			
			// Flush the event queue
			native.globalFlush();
			
			startloop();
		}
	});
}

class Window extends Container {
	constructor(config={}, children=[]) {
		super(config, children);
		
		this.frame = new Frame(config.parent || null, config);
		
		if(!config.parent) {
			rootwindows.add(this);
			// This was the first new window, we need to restart the
			//  event timer.
			if(rootwindows.size == 1) {
				startloop();
			}
		}
		
		this.on('draw', ev => {
			let g = new GraphicsContext(this, config);
			this.draw(g);
		});
	}
	
	/**
	 * Grab all the currently queued events without processing them.
	**/
	*pollEvents() {
		let ev;
		while(ev = this.frame.pollEvent()) {
			yield events.prettify(ev);
		}
	}
	
	/**
	 * Process all the currently queued events.
	**/
	_processEvents() {
		for(let ev of this.pollEvents()) {
			let pev = events.prettify(ev);
			this.emit(pev.name, pev);
		}
		
		return this;
	}
	
	close() {
		rootwindows.delete(this);
		this[NATIVE].close();
		//this[COLORMAP].close();
		return this;
	}
	
	getTitle() {
		return this.frame.getTitle();
	}
	setTitle(title) {
		this.frame.setTitle(title);
		return this;
	}
	get title() {
		return this.getTitle();
	}
	set title(title) {
		return this.setTitle(title);
	}
	
	getVisible() {
		return this.frame.getVisible();
	}
	setVisible(v) {
		this.frame.setVisible(v);
		return this;
	}
	show() {
		return this.setVisible(true);
	}
	hide() {
		return this.setVisible(false);
	}
	
	redraw() {
		this.frame.redraw();
		return this;
	}
	
	getRoot() {
		if(this.parent) {
			return this.parent.getRoot();
		}
		else {
			return this;
		}
	}
}

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
		
		let map = w[COLORMAP];
		defineNative(this, new native.NativeGraphicsContext(
			w[NATIVE],
			config.fg? map.get(config.fg) : 0,
			config.bg? map.get(config.bg) : 0,
			
			typeof config.lineWidth === 'number'?
				config.lineWidth : -1,
			
			config.font? fontmap.get(config.font) : 0
		));
	}
	
	setStyle(config) {
		let map = this.target[COLORMAP];
		this[NATIVE].setStyle(
			map.get(config.fg), map.get(config.bg),
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

class Canvas extends GraphicsContext {
	constructor(target, config) {
		super(target, config);
		
		this.x = config.x;
		this.y = config.y;
	}
	
	drawPoints(rel, ...points) {
		for(let p of points) {
			p.x += this.x;
			p.y += this.y;
		}
		
		return super.drawPoints(rel, ...points);
	}
	
	drawLines(rel, ...lines) {
		for(let line of lines) {
			line.x1 += this.x;
			line.x2 += this.x;
			
			line.y1 += this.y;
			line.y2 += this.y;
		}
		
		return super.drawLines(rel, lines);
	}
	
	drawRects(fill, ...rects) {
		for(let rect of rects) {
			rect.x += this.x;
			rect.y += this.y;
		}
		
		return super.drawRects(fill, ...rects);
	}
	
	drawText(x, y, text) {
		return super.drawText(x + this.x, y + this.y, text);
	}
	
	pushView(view) {
		this._viewstack.push(view);
		this.x += view.x;
		this.y += view.y;
	}
	
	popView() {
		let view = this._viewstack.pop();
		this.x -= view.x;
		this.y -= view.y;
		
		return this;
	}
}

module.exports = {
	Window, GraphicsContext, Canvas
};
