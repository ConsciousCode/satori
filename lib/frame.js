'use strict';

const
	timers = require("timers"),
	{EventEmitter} = require("events"),
	{native, NATIVE, COLORMAP} = require("./native"),
	common = require("./common"),
	Color = require("./color"),
	events = require("./events");

const frames = new Map();
function loop() {
	// Only continue the event loop if there's frames.
	//  This will make the program exit if all frames are closed
	//  and no other events are scheduled in Node
	if(frames.size === 0) {
		return;
	}
	
	timers.setImmediate(function() {
		let ev;
		while(ev = native.pollEvent()) {
			let pev = events.prettify(ev);
			
			let frame = frames.get(ev.target);
			if(frame) {
				frame.emit(pev.name, pev);
			}
			else {
				console.log("No target for", pev.name);
				console.log(pev);
			}
		}
		
		// Flush the event queue
		native.globalFlush();
		
		loop();
	});
}

class Edge {
	constructor(config={}) {
		this.left = config.left || 0;
		this.top = config.top || 0;
		this.right = config.right || 0;
		this.bottom = config.bottom || 0;
	}
}

class Style {
	constructor(config) {
		Object.assign(this, {
			visibility: true,
			background: null,
			cursor: null,
			
			font: null,
			textDecoration: null,
			fontColor: null,
			fontSize: 11,
			tabSize: 24,
			textAlign: null,
			wordSpacing: 0,
			wordWrapping: true,
			justifyContent: false,
			//lineHeight: 1em
		}, config);
	}
}

class Layout {
	constructor(config) {
		this.offsetX = config.x || config.offsetX || 0;
		this.offsetY = config.y || config.offsetY || 0;
		
		this.width = config.w || config.width || null;
		this.height = config.h || config.height || null;
		
		this.minWidth = config.minWidth || config.minW || 0;
		this.minHeight = config.minHeight || config.minH || 0;
		this.maxWidth = config.maxWidth || config.maxW || 0;
		this.maxHeight = config.maxHeight || config.maxH || 0;
		
		this.padding = config.padding || new Edge(config);
		this.margin = config.margin || new Edge(config);
	}
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
class Frame extends EventEmitter {
	constructor(config={}) {
		super();
		
		let layout = this.layout = new Layout(config.layout || config);
		let style = this.style = new Style(config.style || {});
		
		let parent = this.parent = config.parent || null;
		
		let pid = 0, bg = 0;
		
		if(parent) {
			pid = parent.id;
			
			if(config.bg) {
				bg = parent[COLORMAP].get(config.bg);
			}
		}
		
		common.private(
			this, NATIVE, new native.NativeFrame(
				pid,
				layout.offsetX|0, layout.offsetY|0,
				layout.width|0, layout.height|0,
				style.borderWidth|0,
				
				bg
			)
		);
		
		if(this.root) {
			common.private(this, COLORMAP, root.colormap);
		}
		else {
			common.private(this, COLORMAP, new ColorMap(this));
			
			// Colors require a window for allocation, so we need to
			//  delay setting the background until after creation.
			if(config.bg) {
				this[NATIVE].setBG(this[COLORMAP].get(config.bg));
			}
		}
		
		// Restart the event loop if needed
		frames.set(this[NATIVE].getID(), this);
		loop();
	}
	
	/*** BEGIN: native wrapping methods ***/
	
	// We need to tell the native library that we're listening for
	//  new events. Override both .on() and .addListener() just in
	//  case.
	on(type, listener) {
		return this.addListener(type, listener);
	}
	addListener(type, listener) {
		if(type in events.CODES) {
			this[NATIVE].listenEvent(type|0);
		}
		return super.addListener(type, listener);
	}
	
	destroy() {
		this[NATIVE].destroy();
		frames.delete(this.getID());
		return this;
	}
	
	get id() {
		return this[NATIVE].getID();
	}
	
	get visible() {
		return this[NATIVE].getVisible();
	}
	set visible(v) {
		this[NATIVE].setVisible(!!v);
	}
	setVisible(v) {
		this.visible = v;
		return this;
	}
	show() {
		return this.setVisible(true);
	}
	hide() {
		return this.setVisible(false);
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
	
	/*** END: native wrapping methods ***/
	
	/*** BEGIN: utility methods ***/
	
	/**
	 * Horizontal offset wrt the root window.
	**/
	get x() {
		if(this.parent) {
			return this.parent.x + this.layout.offsetX;
		}
		else {
			return this.layout.offsetX;
		}
	}
	set x(x) {
		if(this.parent) {
			this.layout.offsetX = x - this.parent.x;
		}
		else {
			this.layout.offsetX = x;
		}
	}
	/**
	 * Vertical offset wrt the root window.
	**/
	get y() {
		if(this.parent) {
			return this.parent.y + this.layout.offsetY;
		}
		else {
			return this.layout.offsetY;
		}
	}
	set y(y) {
		if(this.parent) {
			this.layout.offsetY = y - this.parent.y;
		}
		else {
			this.layout.offsetY = y;
		}
	}
	
	reparent(parent) {
		if(parent) {
			let oldroot = this.root, newroot = parent.root;
			this.parent = parent;
			
			if(newroot && newroot !== oldroot) {
				this.emit('root');
			}
		}
		else {
			this.parent = null;
			this.emit('unroot');
		}
		return this;
	}
	
	/**
	 * Remove the element from the view tree, returning whether or
	 *  not anything actually changed.
	**/
	remove() {
		return this.parent? this.parent.removeChild(this) : false;
	}
	
	/**
	 * Add this frame to the given parent.
	**/
	addTo(parent) {
		if(this.parent) {
			throw ViewTreeError(
				"Attempted to add frame to view tree twice"
			);
		}
		this.reparent(parent);
		parent._appendChildren(this);
		return this;
	}
	
	/**
	 * Remove this frame from its current parent (if any) and
	 *  add it to the given parent.
	**/
	moveTo(parent) {
		this.remove();
		this.addTo(parent);
		return this;
	}
	
	/**
	 * Get the closest ancestor node which satisfies the given
	 *  selector.
	**/
	closest(sel) {
		if(sel(this)) {
			return this;
		}
		else if(this.parent) {
			return this.parent.closest(sel);
		}
		else {
			return null;
		}
	}
	
	find(sel) {
		return sel(this)? this : null;
	}
	
	get root() {
		if(this.frame) {
			return this.frame.root;
		}
		else {
			return null;
		}
	}
	
	/*** END: utility methods ***/
	
	/*** BEGIN: static methods ***/
	
	/**
	 * Register a new frame class for convenient access.
	**/
	static register(name, frame) {
		Widget.registry[name] = frame;
	}
	
	/**
	 * Create an instance of a frame class.
	**/
	static create(name, ...args) {
		let w = Frame.registry[name];
		if(w) {
			return new w(...args);
		}
		
		throw new ReferenceError(`Unknown frame class "${name}"`);
	}
	
	/*** END: static methods ***/
	
	/*** BEGIN: abstract methods ***/
	
	reflow(size) {
		this.frame.setPosition(this.parent.x, this.parent.y);
		this.frame.setSize(size.w, size.h);
	}
	
	/**
	 * Get the size of the area in which the widget is actually
	 *  displayed.
	**/
	getDisplaySize() {
		return new NotImplemented(this, Widget, 'getDisplaySize');
	}
	
	/**
	 * Get the size that the widget would like to have.
	**/
	getLogicalView(dsize) {
		return new NotImplemented(this, Widget, 'getLogicalView');
	}
	
	/**
	 * Draw the widget using the given graphics context.
	**/
	draw(g) {
		throw new NotImplemented(this, Widget, 'draw');
	}
	
	/*** END: abstract methods ***/
}
Frame.registry = {};

module.exports = {
	Frame
};
