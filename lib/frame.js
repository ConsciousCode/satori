'use strict';

const
	timers = require("timers"),
	{native, NATIVE, COLORMAP} = require("./native"),
	common = require("./common"),
	Color = require("./color");

// Make sure there's only one running at any given time
let running = false;
function loop() {
	if(running) {
		return;
	}
	else {
		running = true;
	}
	
	timers.setImmediate(function() {
		// Only continue the event loop if there's frames.
		//  This will make the program exit if all frames are closed
		//  and no other events are scheduled in Node
		if(native.frameCount()) {
			for(let ev of native.pollEvents()) {
				let pev = events.prettify(ev);
				
				native.dispatchEvent(ev.target, pev);
			}
			
			// Flush the event queue
			native.globalFlush();
			
			loop();
		}
		else {
			running = false;
		}
	});
}

/**
 * Manage a local color:id map.
**/
class ColorMap {
	constructor(target) {
		this.target = target;
		this.colors = new Map();
	}
	
	get(color) {
		color = Color(color);
		let cv = color.value(), id = this.colors.get(cv);
		if(typeof id === 'number') {
			return id;
		}
		else {
			id = this.target[NATIVE].allocColor(cv);
			this.colors.set(cv, id);
			return id;
		}
	}
}

/**
 * Wrapper around the objects maintained by the window manager.
**/
class Frame {
	constructor(parent, config={}) {
		this.parent = parent;
		
		let pid = 0, bg = 0, root = this;
		
		if(parent) {
			pid = parent.id;
			
			if(config.bg) {
				bg = parent.root[COLORMAP].get(config.bg);
			}
			
			root = parent.root;
		}
		
		this.root = root;
		
		common.private(
			this, NATIVE, new native.NativeFrame(
				pid,
				config.x|0, config.y|0,
				config.w|0, config.h|0,
				config.borderWidth|0,
				
				bg
			)
		);
		
		// Callback for native.dispatchEvent, which refers to this
		//  via an internal id:frame map so as to avoid making
		//  leaky references.
		this[NATIVE].onEvent = ev => {
			this.emit(ev.name, ev);
		};
		
		if(parent) {
			common.private(this, COLORMAP, this.root.colormap);
			
			this[NATIVE].setParent(parent.id);
		}
		else {
			common.private(this, COLORMAP, new ColorMap(this));
			
			// Colors require a window for allocation, so we need to
			//  delay setting the background until after creation.
			if(config.bg) {
				this[NATIVE].setBG(this.colormap.get(config.bg));
			}
		}
		
		// Restart the event loop if needed
		loop();
	}
	
	get id() {
		return this[NATIVE].getID();
	}
	
	getVisible() {
		return this[NATIVE].getVisible();
	}
	setVisible(v) {
		this[NATIVE].setVisible(!!v);
	}
	
	getPosition() {
		let p = this[NATIVE].getPosition();
		return new common.Position(p>>16, p&0xffff);
	}
	setPosition(x, y) {
		if(typeof x === 'number') {
			this[NATIVE].setPosition((x<<16)|y);
		}
		else {
			this[NATIVE].setPosition((x.x<<16)|x.y);
		}
	}
	
	setBG(bg) {
		this[NATIVE].setBG(this.colormap.get(bg));
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
	}
	
	listenEvent(type) {
		this.root[NATIVE].listenEvent(type|0);
	}
	
	getTitle() {
		return this[NATIVE].getTitle();
	}
	setTitle(title) {
		this[NATIVE].setTitle(title + "");
	}
	
	pollEvent() {
		return this[NATIVE].pollEvent();
	}
}

module.exports = {
	Frame
};
