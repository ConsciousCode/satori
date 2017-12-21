'use strict';

const
	{native, NATIVE, COLORMAP} = require("./native"),
	common = require("./common"),
	Color = require("./color");

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
			this, NATIVE, new native.NativeWindow(
				pid,
				config.x|0, config.y|0,
				config.w|0, config.h|0,
				config.borderWidth|0,
				
				bg
			)
		);
		
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
