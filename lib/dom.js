'use strict';

const events = require("events");

const
	{NotImplemented, ViewTreeError} = require("./error");

/**
 * For API convenience, define method aliases.
**/
function alias(klass, to_alias) {
	let proto = klass.prototype;
	for(let name in to_alias) {
		let real = proto[name];
		
		for(let alias in to_alias[name]) {
			proto[alias] = real;
		}
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
		if(this.parent && parent) {
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
}
Widget.registry = {};

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
	
	static register(name, order) {
		Order.registry[name] = order;
	}
}
// Allow accessing common order implementations by name
Order.registry = {};

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
class StackOrder extends Order {
	*order(container) {
		let
			{w, h} = container.getDisplaySize(),
			padding = container.getPadding();
		
		for(let c of container) {
			yield new View(padding.left, padding.top, w, h);
		}
	}
}
Order.register('stack', StackOrder);

/**
 * Arrange the children into equal rows.
**/
class RowOrder extends Order {
	*order(container) {
		let
			{w, h} = container.getDisplaySize(),
			padding = container.getPadding(),
			x = padding.left;
		
		w /= container.children.length;
		
		for(let c of container) {
			yield new View(x, padding.top, w, h);
			x += h;
		}
	}
}
Order.register('row', RowOrder);

/**
 * Arrange the children into equal columns.
**/
class ColumnOrder extends Order {
	*order(container) {
		let
			{w, h} = container.getDisplaySize(),
			padding = container.getPadding(),
			y = padding.top;
		
		h /= container.children.length;
		
		for(let c of container) {
			yield new View(padding.left, y, w, h);
			y += h;
		}
	}
}
Order.register('column', ColumnOrder);

/**
 * Order elements in lines from left to right, top to bottom,
 *  wrapping when a line's length exceeds the display width (unless
 *  that line has only one element).
**/
class FlowOrder extends Order {
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
			c._reparent(this);
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
		for(let c of children) {
			c._reparent(this);
		}
		for(let i = x, n = 0; i < children.length; ++i) {
			if(n++ < del) {
				this.children[i]._reparent(null);
			}
			else {
				break;
			}
		}
		Array.splice.call(this.children, x, del, ...children);
	}
	
	/**
	 * Add the given children.
	 *
	 * @hasAlias add
	 * @hasAlias addChild
	 * @hasAlias addChildren
	 * @hasAlias append
	 * @hasAlias appendChild
	**/
	appendChildren(...children) {
		this._spliceChildren(this.length, 0, children);
		return this;
	}
	
	/**
	 * Add the given children to the beginning of the children list.
	 *
	 * @hasAlias prepend
	 * @hasAlias prependChild
	**/
	prependChildren(...children) {
		this._spliceChildren(0, 0, children);
		return this;
	}
	
	/**
	 * Insert the given children into the given position.
	 *
	 * @hasAlias insert
	 * @hasAlias insertChild
	**/
	insertChildren(x, ...children) {
		this._spliceChildren(x, 0, children);
		return this;
	}
	
	/**
	 * Remove the given children.
	**/
	removeChildren(...child) {
		for(let c of child) {
			let x = this.children.indexOf(c);
			if(x !== -1) {
				this._spliceChildren(x, 1, []);
			}
		}
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
	
	/**
	 * @override
	**/
	draw(g) {
		let
			pos = this.layout.getPosition(),
			size = this.layout.getLogicalView();
		
		for(let c of this.children) {
			g.drawChild(pos, size, c);
		}
	}
}
alias(Container, {
	appendChildren: [
		"add", "addChild", "addChildren",
		"append", "appendChild"
	],
	removeChildren: ["removeChild"],
	insertChildren: ["insertChild"]
});

/**
 * An empty area.
**/
class Span extends Widget {
	/**
	 * @override
	**/
	draw(g) {}
}
Widget.register('span', Span);

/**
 * A widget which simply draws its text.
**/
class Label extends Widget {
	constructor(text) {
		this.text = text;
	}
	
	[FlowOrder.wrap](x, y, lineheight, size) {
		
	}
	
	/**
	 * @override
	**/
	draw(g) {
		g.drawText(0, 0, this.text);
	}
}
Widget.register('label', Label);

module.exports = {
	NotImplemented, ViewTreeError,
	Widget,
	
	Order, FlowOrder
};

