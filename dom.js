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

class Style {
	
}

class StyledGraphicContext {
	
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
 * Order elements in lines from left to right, top to bottom,
 *  wrapping when a line's length exceeds the display width (unless
 *  that line has only one element).
**/
class FlowOrder {
	*order(container) {
		let
			size = container.getDisplaySize(),
			padding = container.layout.padding,
			left = padding.left, top = padding.top, height = 0;
		
		size.width -= 2*padding.width;
		size.height -= 2*padding.height;
		
		for(let c of container) {
			let view = c.getLogicalView(size);
			
			// Right side reaches past the display, move to the next
			//  row.
			if(view.right > size.width - left) {
				yield new View(
					padding.left, view.right,
					padding.top, view.bottom
				);
				
				// It needs its own row.
				if(view.right > size.width) {
					left = padding.left;
					top += view.bottom;
				}
				else {
					left += view.right;
					height = Math.max(height, view.bottom);
				}
			}
			else {
				
			}
		}
		
		if(nposx > 
	}
}
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

module.exports = {
	NotImplemented, ViewTreeError,
	Widget,
	
	Order, FlowOrder
};

