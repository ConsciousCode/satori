'use strict';

const CODES = {
	unknown: 0,
	mousemove: 1, scroll: 2, click: 3, hover: 4,
	keypress: 5,
	move: 6, resize: 7, focus: 8,
	draw: 9
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

class DrawEvent extends Event {
	constructor(ev) {
		super();
		this.raw = ev;
	}
}
DrawEvent.prototype.name = "draw";

const EVENTS = [
	UnknownEvent, MouseMoveEvent, ScrollEvent, ClickEvent,
	HoverEvent, KeyPressEvent,
	WindowMoveEvent, ResizeEvent, FocusEvent,
	DrawEvent
];

function prettify(ev) {
	return Object.freeze(new (EVENTS[ev.code] || UnknownEvent)(ev));
}

module.exports = {
	CODES, isInputEvent,
	
	Event, UnknownEvent,
	MouseMoveEvent, ScrollEvent, ClickEvent,
	HoverEvent, KeyPressEvent,
	WindowMoveEvent, ResizeEvent, FocusEvent,
	DrawEvent,
	
	prettify
};
