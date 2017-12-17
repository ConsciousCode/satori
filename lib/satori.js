'use strict';

const
	native = require("bindings")("addon.node"),
	timers = require("timers"),
	events = require("events");

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

const NATIVE = "native"; //Symbol("native");

const EVENT_CODES = {
	unknown: 0,
	mousemove: 1, scroll: 2, click: 3, hover: 4,
	keypress: 5,
	move: 6, resize: 7, focus: 8,
	paint: 9
};

function isInputEvent(ev) {
	return [1, 2, 3, 4, 5].indexOf(ev.code) !== -1;
}

class Event {}
Event.prototype.name = 'event';

class UnknownEvent extends Event {
	constructor(ev) {
		super();
		this.raw = ev;
	}
}
UnknownEvent.prototype.name = 'unknown';

class MouseMoveEvent extends Event {
	constructor(ev) {
		super();
		
		this.x = ev.x;
		this.y = ev.y;
		this.dragging = ev.dragging;
	}
}
MouseMoveEvent.prototype.name = 'mousemove';

class ScrollEvent extends Event {
	constructor(ev) {
		super();
		
		this.delta = ev.delta;
	}
}
ScrollEvent.prototype.name = 'scroll';

const MOUSE_NAMES = ['unknown', 'left', 'middle', 'right'];

class ClickEvent extends Event {
	constructor(ev) {
		super();
		
		this.button = MOUSE_NAMES[ev.button];
		this.state = ev.state;
		this.dragging = ev.dragging;
	}
}
ClickEvent.prototype.name = 'click';

class HoverEvent extends Event {
	constructor(ev) {
		super();
		this.state = ev.state;
		this.x = ev.x;
		this.y = ev.y;
	}
}
HoverEvent.prototype.name = 'hover';

const KEY_NAMES = [
	0, 1, 2, 3, 4, 5, 6, 7,
	'\b', '\t',
	10, 11, 12,
	'\r',
	14, 15,
	"shift", "ctrl", "alt", "pause", "capslock",
	21, 22, 23, 24, 25, 26,
	"esc",
	28, 29, 30, 31, ' ',
	"pageup", "pagedown", "end", "home",
	"left", "up", "right", "down",
	41, 42, 43, 44,
	"ins", "del",
	47,
	"0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
	58, 59, 60, 61, 62, 63, 64,
	"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
	"N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
	"lmeta", "rmeta", "select",
	94, 95,
	"num0", "num1", "num2", "num3", "num4",
	"num5", "num6", "num7", "num8", "num9",
	"num*", "num+", 108, "num-", "num.", "num/",
	"F1", "F2", "F3", "F4", "F5", "F6",
	"F7", "F8", "F9", "F10", "F11", "F12",
	124, 125, 126, 127, 128, 129, 130, 131, 132,
	133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143,
	"numlock", "scrolllock", ";",
	147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157,
	158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168,
	169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179,
	180, 181, 182, 183, 184, 185, 186,
	"=", ",", "-", ".", "/", "`",
	193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203,
	204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214,
	215, 216, 217, 218,
	"[", "\\", "]", "'"
];

/**
 * Bindings between printable	 keys and what they print
**/
const PRINTABLE = {
	'\r': '\r', '\t': '\t', ' ': ' ',
	
	'1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
	'6': '6', '7': '7', '8': '8', '9': '9', '0': '0',
	
	"A": "A", "B": "B", "C": "C", "D": "D", "E": "E", "F": "F",
	"G": "G", "H": "H", "I": "I", "J": "J", "K": "K", "L": "L",
	"M": "M", "N": "N", "O": "O", "P": "P", "Q": "Q", "R": "R",
	"S": "S", "T": "T", "U": "U", "V": "V", "W": "W", "X": "X",
	"Y": "Y", "Z": "Z",
	
	'-': '-', '=': '=', '[': '[', '\\': '\\', ']': ']', ';': ';',
	"'": "'", ',': ",", '.': '.', '/': '/', '`': '`',
	
	"num0": '0', "num1": '1', "num2": '2', "num3": '3', "num4": '4',
	"num5": '5', "num6": '6', "num7": '7', "num8": '8', "num9": '9',
	"num*": "*", "num+": "+", /* 108, */
	"num-": '-', "num.": '.', "num/": '/'
};

/**
 * Shift modifier bindings
**/
const SHIFTABLE = {
	"1": "!", "2": "@", "3": "#", "4": "$", "5": "%",
	"6": "^", "7": "&", "8": "*", "9": "(", "0": ")",
	
	"a": "A", "b": "B", "c": "C", "d": "D", "e": "E", "f": "F",
	"g": "G", "h": "H", "i": "I", "j": "J", "k": "K", "l": "L",
	"m": "M", "n": "N", "o": "O", "p": "P", "q": "Q", "r": "R",
	"s": "S", "t": "T", "u": "U", "v": "V", "w": "W", "x": "X",
	"y": "Y", "z": "Z",
	
	"num0": "ins", "num1": "end", "num2": "down", "num3": "pagedown",
	"num4": "left", /* num5, */ "num6": "right", "num7": "home",
	"num8": "up", "num9": "pageup",
	
	"num.": "del", ';': ":",
	"=": "+", ",": "<", "-": "_", ".": ">", "/": "?", "`": "~",
	"[": "{", "\\": "|", "]": "}", "'": '"'
};

class KeyPressEvent extends Event {
	constructor(ev) {
		super();
		
		this.shift = ev.shift;
		this.ctrl = ev.ctrl;
		this.alt = ev.alt;
		this.meta = ev.meta;
		
		this.key = KEY_NAMES[ev.button];
		this.button = ev.button;
		this.state = ev.state;
		
		let k = PRINTABLE[this.key];
		if(k) {
			if(this.shift) {
				this.char = SHIFTABLE[k];
			}
			else {
				this.char = k;
			}
		}
		else {
			this.char = null;
		}
	}
}
KeyPressEvent.prototype.name = 'keypress';

class WindowMoveEvent extends Event {
	constructor(ev) {
		super();
		
		this.x = ev.x;
		this.y = ev.y;
	}
}
WindowMoveEvent.prototype.name = 'move';

class ResizeEvent extends Event {
	constructor(ev) {
		super();
		
		this.w = ev.w;
		this.h = ev.h;
	}
}
ResizeEvent.prototype.name = 'resize';

class FocusEvent extends Event {
	constructor(ev) {
		super();
		
		this.state = ev.state;
	}
}
FocusEvent.prototype.name = 'focus';

class PaintEvent extends Event {
	constructor(ev) {
		super();
		this.raw = ev;
	}
}
PaintEvent.prototype.name = "paint";

const EVENTS = [
	UnknownEvent, MouseMoveEvent, ScrollEvent, ClickEvent,
	HoverEvent, KeyPressEvent,
	WindowMoveEvent, ResizeEvent, FocusEvent,
	PaintEvent
];

function prettifyEvent(ev) {
	let pretty = new (EVENTS[ev.code] || UnknownEvent)(ev);
	pretty.raw = ev;
	return pretty;
}

function defineNative(obj, value) {
	Object.defineProperty(obj, NATIVE, {
		enumerable: false,
		writable: false,
		value
	});
}

/**
 * Procedural type checking for development only, production code
 *  should have its own type checking.
**/
function typeCheck(types, ov) {
	for(let i = 0; i < types.length; ++i) {
		let type = types[i], v = ov[i];
		
		if(typeof type === 'string') {
			if(typeof v !== type) {
				throw new TypeError();
			}
		}
		else {
			if(v instanceof type) {
				throw new TypeError();
			}
		}
	}
}

class Color {
	constructor(r, g, b, a=0xff) {
		if(typeof r === 'string') {
			//if(r in COLORS) {
				let color = COLORS[r];
				this.r = color.r;
				this.g = color.g;
				this.b = color.b;
				this.a = color.a;
			/*
			}
			else {
				
			}*/
		}
		else {
			this.r = r;
			this.g = g;
			this.b = b;
			this.a = a;
		}
		/*
		else {
			throw new TypeError("new Color(" +
				`${typeof r}, ${typeof g}, ${typeof b}, ${typeof a}` +
			")");
		}
		*/
	}
}

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

class Window extends events.EventEmitter {
	constructor(config={}) {
		super();
		
		defineNative(this, new native.NativeWindow(
			config.parent instanceof Window? config.parent[NATIVE].getID() : 0,
			config.x|0, config.y|0, config.w|0, config.h|0,
			config.borderWidth|0, config.bg|0
		));
		
		widgets[this[NATIVE].getID().toString(36)] = this;
		if(!(config.parent instanceof Window)) {
			windows.add(this);
			// This was the first new window, we need to restart the
			//  event timer.
			if(windows.size == 1) {
				startloop();
			}
		}
	}
	
	// We need to tell the native library that we're listening for
	//  new events. Override both .on() and .addListener() just in
	//  case.
	
	on(type, listener) {
		if(type in EVENT_CODES) {
			this[NATIVE].listenEvent(EVENT_CODES[type]);
		}
		return super.on(type, listener);
	}
	
	addListener(type, listener) {
		if(type in EVENT_CODES) {
			this[NATIVE].listenEvent(EVENT_CODES[type]);
		}
		return super.addListener(type, listener);
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
			v.push(prettifyEvent(ev));
		}
		
		return v;
	}
	
	/**
	 * Process a single event.
	**/
	_processEvent(ev) {
		this.emit(ev.name, ev);
		return this;
	}
	
	/**
	 * Process all the currently queued events.
	**/
	_processEvents() {
		let ev;
		while(ev = this[NATIVE].pollEvent()) {
			let target = isInputEvent(ev) && ev.child?
				widgets[ev.child.toString(36)] : this;
			
			target._processEvent(prettifyEvent(ev));
		}
		
		return this;
	}
	
	close() {
		windows.delete(this);
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

class GraphicsContext {
	constructor(w, config) {
		this.target = w;
		defineNative(this, new native.NativeGraphicsContext(
			w[NATIVE], config.fg|0, config.bg|0,
			config.lineWidth|0, config.font|0
		));
	}
	
	setStyle(config) {
		this[NATIVE].setStyle(
			config.fg|0, config.bg|0,
			config.lineWidth|0, config.font|0
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
	drawLines(rel, lines) {
		this[NATIVE].drawLines(!!rel, ...points.map(v => ({
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
	native,
	
	Event, UnknownEvent,
	MouseMoveEvent, ScrollEvent, ClickEvent,
	KeyPressEvent,
	WindowMoveEvent, ResizeEvent, FocusEvent,
	
	Window
};

