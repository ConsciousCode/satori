'use strict';

const events = require("events");

const
	{NotImplemented, ViewTreeError} = require("./error");

function arrayWrap(x) {
	return Array.isArray(x)? x : [x];
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

class Canvas extends core.GraphicsContext {
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

class View {
	constructor(left, right, top, bottom) {
		this.left = left;
		this.right = right;
		this.top = top;
		this.bottom = bottom;
	}
	
	get width() {
		return this.right - this.left;
	}
	set width(x) {
		this.right = this.left + x;
	}
	
	get height() {
		return this.bottom - this.top;
	}
	set height(x) {
		this.bottom = this.top + x;
	}
}

/**
 * Base class for all renderable elements which can be added to the
 *  view tree.
**/
class Widget extends events.EventEmitter {
	constructor() {
		this.parent = null;
	}
	
	/**
	 * Change the parent.
	**/
	_reparent(parent) {
		if(this.parent && parent !== null) {
			throw new ViewTreeError(
				"Attempted to add a widget to the view tree twice"
			);
		}
		
		this.parent = parent;
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
	 * Get the position of the child wrt the given element, or null
	 *  if there's no defined position (e.g. a widget that isn't in
	 *  the VT).
	**/
	getPosition() {
		if(this.parent) {
			return this.parent.getPositionOf(this, this);
		}
		return null;
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
	
	draw(g) {
		throw new NotImplemented(this, Widget, 'draw');
	}
}
Widget.registry = {};
Widget.register = function(name, widget) {
	Widget.registry[name] = widget;
}
Widget.create = function(name, ...args) {
	let w = Widget.registry[name];
	if(w) {
		return new w(...args);
	}
	
	throw new ReferenceError(`Unknown widget class "${name}"`);
}

/**
 * A policy for ordering container children.
**/
class Order {
	/**
	 * Iterate over the children of the container, yielding the
	 *  display rectangle to use relative to the container.
	**/
	*order(container) {
		throw new NotImplemented(this, Ordering, 'next');
	}
}
// Allow accessing common order implementations by name
Order.registry = {};
Order.register = function (name, order) {
	Order.registry[name] = order;
	return Order;
}

function selectOrder(order) {
	if(typeof order === 'string') {
		return new (Order.registry[order] || Order.registry.default);
	}
	else {
		return order;
	}
}

/**
 * Not much of an "order", returns the upper left position,
    effectively telling children to draw on top of each other.
**/
class StackOrder {
	*order(container) {
		let
			{w, h} = container.getDisplaySize(),
			padding = container.getPadding();
		
		for(let c of container) {
			yield new View(padding.left, padding.top, w, h);
		}
	}
}

/**
 * Order elements in lines from left to right, top to bottom,
 *  wrapping when a line's length exceeds the display width (unless
 *  that line has only one element).
**/
class FlowOrder {
	*order(container) {
		let
			size = container.getDisplaySize(),
			padding = container.getPadding(),
			x = padding.left, y = padding.top,
			lineheight = 0;
		
		for(let c of container) {
			yield new Position(x, y);
			
			// Defer to the child if it has special wrapping support
			if(typeof c[FlowOrder.wrap] === 'function') {
				({x, y, lineheight} = c[FlowOrder.wrap](
					x, y, lineheight, size
				));
			}
			else {
				let
					{w, h} = c.getLogicalSize(size),
					margin = c.getMargin(),
					ww = margin.left + w + margin.right;
				
				if(x + ww > size.w - padding.right) {
					x = padding.left;
					y += lineheight;
					lineheight = 0;
				}
				else {
					x += ww;
					lineheight = Math.max(lineheight, h);
				}
			}
		}
	}
}
FlowOrder.wrap = Symbol("FlowOrder.wrap");
Order.register('default', FlowOrder);
Order.register('flow', FlowOrder);

class Container extends Widget {
	constructor(order, children=[], layout=null, style=null) {
		super();
		
		this.order = selectOrder(order);
		this.children = children;
		this.layout = layout;
		this.style = style;
		
		this._order_cache = [];
		
		for(let c of children) {
			c._addTo(this);
		}
	}
	
	[Symbol.iterator]() {
		return this.order[Symbol.iterator]();
	}
	
	/**
	 * This method is used to perform any mutation on the child list,
	 *  allowing for easy interception for eg an observer pattern.
	 *  This shouldn't cause any performance hit because it'll mostly
	 *  be inlined.
	**/
	_spliceChildren(x, del, children) {
		Array.splice.call(this.children, x, del, ...children);
	}
	
	/**
	 * Add a given child without alerting it.
	 *
	 * Assumption: children is an iterable.
	**/
	_add(children) {
		this._spliceChildren(this.length, 0, children);
	}
	
	/**
	 * Add a given child.
	**/
	add(child) {
		child = arrayWrap(child);
		
		for(let c of child) {
			c._addTo(this);
		}
		this._add(child);
		
		return this;
	}
	
	/**
	 * Get the position of a child wrt an ancestor node, or null if
	 *  inapplicable.
	**/
	getPositionOf(child, wrt=null) {
		let cx = this.children.indexOf(child);
		if(cx === -1) {
			return null;
		}
		
		let pos = this._order_ache[cx];
		pos.x += layout.
		let order = this.order.order(this);
		for(let i = 0; i < cx; ++i) {
			let pos = order.next();
		}
		
		if(wrt === this) {
			return pos;
		}
		else if(this.parent) {
			return this.parent.getPositionOf(child, wrt);
		}
		else {
			return null;
		}
	}
	
	getLogicalView(dsize) {
		// Calculated by finding which children are furthest
		//  left/right/top/bottom
		
		let left = Infinity, right = 0, top = Infinity, bottom = 0;
		
		for(let c of this._order_cache) {
			left = Math.min(c.x, left);
			right = Math.max(c.x + c.width, right);
			top = Math.min(c.y, top);
			bottom = Math.max(c.y + c.height, bottom);
		}
		
		return new View(left, right, top, bottom);
	}
	
	/**
	 * Update the order cache in response to a change in the layout.
	**/
	reflow() {
		this._order_cache = Array.from(this.order.order(this));
		this.emit('reflow');
		if(this.parent) {
			this.parent.reflow();
		}
		
		return this;
	}
	
	draw(g) {
		let
			pos = this.layout.getPosition(),
			size = this.layout.getLogicalView();
		
		for(let c of this.children) {
			g.drawChild(pos, size, c);
		}
	}
}

/**
 * A widget which simply draws its text.
**/
class Label extends Widget {
	constructor(text) {
		this.text = text;
	}
	
	[FlowOrder.wrap](x, y, lineheight, size) {
		
	}
	
	draw(g) {
		g.drawText(0, 0, this.text);
	}
}

/**
 * Behaves like a container with flow, except it 
**/
class Markup extends Widget {
	constructor(children=[]) {
		this.children = children.map(v => {
			if(typeof v === 'string') {
				return new Label(v);
			}
			else {
				return v;
			}
		});
	}
}

module.exports = {
	NotImplemented, ViewTreeError,
	Widget,
	
	Order, FlowOrder
};

