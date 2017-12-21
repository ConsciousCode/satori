'use strict';

const
	{Widget} = require("./widget"),
	common = require("./common");

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
		
Pr
		w /= container.children.length;
		
		for(let c of container) {
			yield new View(x, padding.top, w, h);
			x += h;
		}
	}
}
Order.register('row', RowOrder);
Order.register('default', RowOrder);

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
Order.register('flow', FlowOrder);

class Container extends Widget {
	constructor(config={}, children=[]) {
		super(config);
		
		this.order = selectOrder(config.order || "default");
		this.children = children;
		
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
		Array.splice.call(this.children, x, del, ...children);
		return this;
	}
	
	spliceChildren(x, del, ...children) {
		children = common.flatten(children);
		
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
		
		return this._spliceChildren(x, del, children);
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
		return this.spliceChildren(this.length, 0, ...children);
	}
	
	/**
	 * Add the given children to the beginning of the children list.
	 *
	 * @hasAlias prepend
	 * @hasAlias prependChild
	**/
	prependChildren(...children) {
		return this.spliceChildren(0, 0, ...children);
	}
	
	/**
	 * Insert the given children into the given position.
	 *
	 * @hasAlias insert
	 * @hasAlias insertChild
	**/
	insertChildren(x, ...children) {
		return this.spliceChildren(x, 0, ...children);
	}
	
	/**
	 * Remove the given children.
	**/
	removeChildren(...children) {
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
		
		let pos = this._order_cache[cx];
		//zpos.x += layout.
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
			pos = this.getPosition(),
			size = this.getLogicalView();
		
		for(let c of this.children) {
			g.drawChild(pos, size, c);
		}
	}
}
common.alias(Container, {
	appendChildren: [
		"add", "addChild", "addChildren",
		"append", "appendChild"
	],
	removeChildren: ["removeChild"],
	insertChildren: ["insertChild"]
});

module.exports = {
	View,
	Order, StackOrder, RowOrder, ColumnOrder, FlowOrder,
	Container
};
