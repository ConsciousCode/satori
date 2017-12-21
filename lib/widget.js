'use strict';

const 
	{EventEmitter} = require("events");

const
	{NotImplemented, ViewTreeError} = require("./error"),
	{native, NATIVE, defineNative} = require("./native"),
	{Frame} = require("./frame"),
	common = require("./common"),
	events = require("./events");

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
			fontSize: new Pixel(11),
			tabSize: new Pixel(24),
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

class Unit {
	constructor(value) {
		this.value = value;
	}
	
	eval(size) {
		throw new NotImplemented(this, Unit, 'eval');
	}
}

class Pixel extends Unit {
	eval(size) {
		return this.value;
	}
}

class Scale extends Unit {
	eval(size) {
		return size*this.value
	}
}

/**
 * Base class for all renderable elements which can be added to the
 *  view tree.
**/
class Widget extends EventEmitter {
	constructor(config={}) {
		super(config);
		
		this.frame = null;
		this.layout = new Layout(config.layout || config);
		this.style = new Style(config.style || {});
	}
	
	// We need to tell the native library that we're listening for
	//  new events. Override both .on() and .addListener() just in
	//  case.
	on(type, listener) {
		return this.addListener(type, listener);
	}
	addListener(type, listener) {
		if(type in events.CODES) {
			this.frame.root.listenEvent(events.CODES[type]);
		}
		return super.on(type, listener);
	}
	
	_reparent(parent) {
		if(parent && this.parent) {
			throw ViewTreeError(
				"Attempted to add widget to view tree twice"
			);
		}
		
		this.parent = parent;
		
		if(this.parent.frame) {
			this.frame = new Frame({
				x: 0, y: 0, w: 0, h: 0,
				borderWidth: this.style.borderWidth,
				bg: this.style.bg 
			});
			this.emit('root');
		}
	}
	
	reflow(size) {
		this.frame.setPosition(this.parent.x, this.parent.y);
		this.frame.setSize(size.w, size.h);
	}
	
	/**
	 * Add this widget to the given parent.
	**/
	addTo(parent) {
		this._reparent(parent);
		parent._add(this);
		return this;
	}
	
	/**
	 * Horizontal offset wrt the root window.
	**/
	get x() {
		if(this.parent) {
			return this.parent.x + this.style.offsetX;
		}
		else {
			return this.style.offsetX;
		}
	}
	set x(x) {
		if(this.parent) {
			this.style.offsetX = x - this.parent.x;
		}
		else {
			this.style.offsetX = x;
		}
	}
	/**
	 * Vertical offset wrt the root window.
	**/
	get y() {
		if(this.parent) {
			return this.parent.y + this.style.offsetY;
		}
		else {
			return this.style.offsetY;
		}
	}
	set y(y) {
		if(this.parent) {
			this.style.offsetY = y - this.parent.y;
		}
		else {
			this.style.offsetY = y;
		}
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
	
	/// Utility methods
	
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
	
	/**
	 * Remove the element from the view tree, returning whether or
	 *  not anything actually changed.
	**/
	remove() {
		return this.parent? this.parent.removeChild(this) : false;
	}
	
	/**
	 * Register a new widget class for convenient access.
	**/
	static register(name, widget) {
		Widget.registry[name] = widget;
	}
	
	/**
	 * Create an instance of a widget class.
	**/
	static create(name, ...args) {
		let w = Widget.registry[name];
		if(w) {
			return new w(...args);
		}
		
		throw new ReferenceError(`Unknown widget class "${name}"`);
	}
	
	get root() {
		if(this.frame) {
			return this.frame.root;
		}
		else {
			return null;
		}
	}
}
Widget.registry = {};

/**
 * An empty area.
**/
class Span extends Widget {
	/**
	 * @override
	**/
	draw(g) {
	}
}
Widget.register('span', Span);

/**
 * A widget which simply draws its text.
**/
class Label extends Widget {
	constructor(text) {
		this.text = text;
	}
	/*
	[FlowOrder.wrap](x, y, lineheight, size) {
		
	}
	*/
	/**
	 * @override
	**/
	draw(g) {
		g.drawText(0, 0, this.text);
	}
}
Widget.register('label', Label);

module.exports = {
	Widget, Span, Label
};

