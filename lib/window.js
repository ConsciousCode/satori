'use strict';

const
	{EventEmitter} = require("events"),
	timers = require("timers"),
	{native, NATIVE, defineNative} = require("./native"),
	Color = require("./color"),
	event = require("./events"),
	dom = require("./dom");

// Make a function so the event timer can be restarted if all
//  windows are closed, then a new window is created.
let windows = new Set(), widgets = {};
function startloop() {
	timers.setImmediate(function eventloop() {
		// Only continue the event loop if there's windows
		//  This will make the program exit if all windows are closed
		//  and no other events are scheduled in Node
		if(windows.size) {
			for(let w of windows) {
				w._processEvents();
			}
			
			// Flush the event queue
			native.globalFlush();
			
			timers.setImmediate(eventloop);
		}
	});
}

/**
 * Manage a local color:id map.
**/
class ColorMap {
	constructor() {
		this.colors = {};
	}
	
	get(win, color) {
		color = Color(color);
		let hex = color.toString(), id = this.colors[hex];
		if(typeof id === 'number') {
			return id;
		}
		else {
			return this.colors[hex] = win[NATIVE].allocColor(
				color.r, color.g, color.b, color.a
			);
		}
	}
}
const colormaps = new Map();

class Window extends dom.Widget {
	constructor(config={}) {
		super();
		
		if(config.parent instanceof Window) {
			this._reparent(config.parent);
			defineNative(this, new native.NativeWindow(
				config.parent[NATIVE].getID(),
				config.x|0, config.y|0, config.w|0, config.h|0,
				config.borderWidth|0,
				colormaps[config.parent].get(
					config.parent, config.bg
				)
			));
		}
		else {
			defineNative(this, new native.NativeWindow(
				0, config.x|0, config.y|0, config.w|0, config.h|0,
				config.borderWidth|0, 0
			));
			// We need a window to allocate a color, so if this is
			//  a root window, we need to set it after creation.
			if(config.bg) {
				this.setBG(config.bg);
			}
		}
		
		this.id = this[NATIVE].getID();
		widgets[this[NATIVE].getID().toString(36)] = this;
		if(!(config.parent instanceof Window)) {
			windows.add(this);
			// This was the first new window, we need to restart the
			//  event timer.
			if(windows.size == 1) {
				startloop();
			}
		}
		
		colormaps[this] = new ColorMap();
	}
	
	// We need to tell the native library that we're listening for
	//  new events. Override both .on() and .addListener() just in
	//  case.
	on(type, listener) {
		return this.addListener(type, listener);
	}
	
	addListener(type, listener) {
		if(type in event.CODES && !this.parent) {
			this[NATIVE].listenEvent(event.CODES[type]);
		}
		return super.on(type, listener);
	}
	
	createGC(config) {
		return new GraphicsContext(this, config);
	}
	
	/**
	 * Grab events without processing them.
	**/
	pollEvents() {
		let v = [], ev;
		
		while(ev = this[NATIVE].pollEvent()) {
			v.push(event.prettify(ev));
		}
		
		return v;
	}
	
	/**
	 * Process all the currently queued events.
	**/
	_processEvents() {
		let ev;
		while(ev = this[NATIVE].pollEvent()) {
			let target = event.isInputEvent(ev) && ev.child?
				widgets[ev.child.toString(36)] : this;
			
			// Bubble the event
			let pev = event.prettify(ev);
			while(target && target.listenerCount(pev.name) == 0) {
				target = target.parent;
			}
			
			if(target) {
				target.emit(pev.name, pev);
			}
		}
		
		return this;
	}
	
	close() {
		windows.delete(this);
		colormaps.delete(this);
		delete windows[this[NATIVE].getID()];
		this[NATIVE].close();
		return this;
	}
	
	getVisible() {
		return this[NATIVE].getVisible();
	}
	setVisible(v) {
		this[NATIVE].setVisible(!!v);
		return this;
	}
	show() {
		return this.setVisible(true);
	}
	hide() {
		return this.setVisible(false);
	}
	get visible() {
		return this.getVisible();
	}
	set visible(v) {
		return this.setVisible(v);
	}
	
	getTitle() {
		return this[NATIVE].getTitle();
	}
	setTitle(title) {
		this[NATIVE].setTitle(title);
		return this;
	}
	get title() {
		return this.getTitle();
	}
	set title(title) {
		return this.setTitle(title);
	}
	
	getPosition() {
		let p = this[NATIVE].getPosition();
		return new Position(p>>16, p&0xffff);
	}
	setPosition(x, y) {
		if(typeof x === 'number') {
			this[NATIVE].setPosition((x<<16)|y);
		}
		else {
			this[NATIVE].setPosition((x.x<<16)|x.y);
		}
		return this;
	}
	get position() {
		return this.getPosition();
	}
	set position(p) {
		return this.setPosition();
	}
	get x() {
		return this.getPosition().x;
	}
	set x(x) {
		return this.setPosition(x, this.getPosition().y);
	}
	get y() {
		return this.getPosition().y;
	}
	set y(y) {
		return this.setPosition(this.getPosition().x, y);
	}
	
	setBG(bg) {
		this[NATIVE].setBG(colormaps[this].get(this, bg));
		this.redraw();
	}
	
	redraw() {
		this[NATIVE].redraw();
	}
	
	getSize() {
		let s = this[NATIVE].getSize();
		return new Size(s>>16, s&0xffff);
	}
	setSize(x, y) {
		if(typeof x === 'number') {
			this[NATIVE].setSize((x<<16)|y);
		}
		else {
			this[NATIVE].setSize((x.x<<16)|x.y);
		}
		return this;
	}
	get size() {
		return this.getSize();
	}
	set size(size) {
		return this.setSize(size);
	}
	get w() {
		return this.getSize().w;
	}
	set w(w) {
		return this.setSize(w, this.getSize().h);
	}
	get h() {
		return this.getSize().h;
	}
	set h(h) {
		return this.setSize(this.getSize().w, h);
	}
}

module.exports = {
	colormaps, Window
};

