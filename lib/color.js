'use strict';

function checkColor(r, g, b, a) {
	if(r > 0xff || g > 0xff || b > 0xff || a > 0xff) {
		throw new Error(
			`Bad color value (${r}, ${g}, ${b}, ${a})`
		);
	}
}

/**
 * Create a color without testing the parameter values.
**/
function colorRGBA(r, g, b, a=0xff) {
	checkColor(r, g, b, a);
	
	let color = Object.create(Color.prototype);
	color.r = r|0;
	color.g = g|0;
	color.b = b|0;
	color.a = a|0;
	return color;
}

/**
 * Convert HSV to RGB
**/
function hsv2rgb(h, s, v) {
	if(s > 1) {
		throw new Error("Bad HSV.S");
	}
	if(v > 1) {
		throw new Error("Bad HSV.V");
	}
	
	h = (h%360)/360;
	h %= 360;
	v *= 0xff;
	let
		i = (h*6)|0, f = h*6 - i, p = Math.round(v*(1 - s)),
		qt = Math.round(v*(1 - (i%2? f : 1 - f)*s));
	
	v = Math.round(v);
	
	switch(i%6) {
		case 0: return [v, qt, p];
		case 1: return [qt, v, p];
		case 2: return [p, v, qt];
		case 3: return [p, qt, v];
		case 4: return [qt, p, v];
		case 5: return [v, p, qt];
	}
}

function Color(r, g, b, a=0xff) {
	let color = Color.parse(r, g, b, a);
	if(new.target) {
		({r, g, b, a} = color);
		checkColor(r, g, b, a);
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	}
	else {
		return color;
	}
}
Color.prototype = {
	constructor: Color,
	copy() {
		return colorRGBA(this.r, this.g, this.b, this.a);
	},
	
	get h() {
		let {r, g, b} = this;
		r /= 0xff; g /= 0xff; b /= 0xff;
		let
			mRGB = Math.min(r, g, b),
			MRGB = Math.max(r, g, b);
		
		if(mRGB === MRGB) {
			return 0;
		}
		
		let h, d = MRGB - mRGB;
		switch(MRGB) {
			case r: h = (g - b)/d + (g < b? 6 : 0); break;
			case g: h = (b - r)/d + 2; break;
			case b: h = (r - g)/d + 4; break;
		}
		
		return 360*h/6;
	},
	set h(h) {
		let {s, v} = this;
		[this.r, this.g, this.b] = hsv2rgb(h, s, v);
	},
	
	get s() {
		let {r, g, b} = this;
		r /= 0xff; g /= 0xff; b /= 0xff;
		let
			mRGB = Math.min(r, g, b),
			MRGB = Math.max(r, g, b);
		if(MRGB === 0) {
			return 0;
		}
		return (MRGB - mRGB)/MRGB;
	},
	set s(s) {
		let {h, v} = this;
		[this.r, this.g, this.b] = hsv2rgb(h, s, v);
	},
	
	get v() {
		let {r, g, b} = this;
		return Math.max(r, g, b)/0xff;
	},
	set v(v) {
		let {h, s} = this;
		[this.r, this.g, this.b] = hsv2rgb(h, s, v);
	},
	
	darken(by=0.1) {
		this.v *= by;
		return this;
	},
	lighten(by=0.5) {
		this.v += (1 - this.v)*by;
		return this;
	},
	
	saturate(by=0.1) {
		this.s += (1 - this.s)*by;
		return this;
	},
	desaturate(by=0.5) {
		this.s *= by;
		return this;
	},
	
	grayscale() {
		this.s = 0;
		return this;
	},
	
	complement() {
		this.h = (this.h + 180)%360;
		return this;
	},
	
	/**
	 * Get the integer value of the color, rgba
	**/
	value() {
		return (this.r<<24) | (this.g<<16) | (this.b<<8)  | this.a;
	},
	
	toString() {
		return "#" + this.value().toString(16);
	}
};

Color.register = function register(name, color) {
	Object.freeze(color);
	Color.registry[name] = color;
}
Color.registry = {};

Color.parseHex = function(c) {
	let m = /#?([\da-f]{3,8})/i.exec(c);
	if(m) {
		console.log(m);
		let i = parseInt(m[1], 16);
		switch(m[1].length) {
			case 3: // rgb
				i = (i<<4)|0xf;
				//[[fallthrough]]
			case 4: // rgba
				var
					r = (i>>12)&0xf, g = (i>>8)&0xf,
					b = (i>>4)&0xf, a = i&0xf;
				return colorRGBA(
					(r<<4)|r, (g<<4)|g, (b<<4)|b, (a<<4)|a
				);
			
			case 6: // rrggbb
				i = (i<<8)|0xff;
				//[[fallthrough]]
			case 8: // rrggbbaa
				var
					r = (i>>24)&0xff, g = (i>>16)&0xff,
					b = (i>>8)&0xff, a = i&0xff;
				return colorRGBA(r, g, b, a);
			
			default:
				break;
		}
	}
	
	throw new SyntaxError("Couldn't parse color hex " + c);
}

/**
 * Parse a color from a string using one of the following formats:
 *
 * [modifier] <color name> (eg red, green, blue)
 * [modifier] (#rgb, #rgba, #rrggbb, #rrggbbaa)
 *
 * Available modifiers:
 *  - dark (lower value/brightness)
 *  - light (higher value/brightness)
 *  - deep (saturated)
 *  - pale (desaturated)
 *  - neon (fully saturated)
**/
Color.parseString = function(c) {
	c = c.toLowerCase();
	
	if(c in Color.registry) {
		return Color.registry[c];
	}
	
	let m = /(dark|light|deep|pale|neon)\s*(.+)/.exec(c);
	if(m) {
		let color;
		if(m[2] in Color.registry) {
			color = Color.registry[m[2]].copy();
		}
		else {
			color = Color.parseHex(m[2]);
		}
		
		switch(m[1]) {
			case "dark":
				color.darken();
				break;
			case "light":
				color.lighten();
				break;
			case "deep":
				color.saturate();
				break;
			case "pale":
				color.desaturate();
				break;
			case "neon":
				color.s = 1;
				break;
		}
		
		Color.register(c, color);
		return color;
	}
	
	return Color.parseHex(c);
}

Color.parseNumber = function(c) {
	return colorRGBA(
		(c>>24)&0xff, (c>>16)&0xff, (c>>8)&0xff, c&0xff
	);
}

Color.parse = function(r, g, b, a=0xff) {
	if(typeof r === 'string') {
		return Color.parseString(r);
	}
	else if(
		typeof r.r === 'number' &&
		typeof r.g === 'number' &&
		typeof r.b === 'number'
	) {
		return r;
	}
	else if(typeof g !== 'number'){ 
		return Color.parseNumber(r);
	}
	else {
		return colorRGBA(r, g, b, a);
	}
}

Color.hsv2rgb = hsv2rgb;

const _COLORS = {
	black: colorRGBA(0, 0, 0),
	white: colorRGBA(255, 255, 255),
	
	red: colorRGBA(0xc4, 0x02, 0x33),
	green: colorRGBA(0x00, 0x9f, 0x6b),
	blue: colorRGBA(0x00, 0x87, 0xbd),
	
	yellow: colorRGBA(0xff, 0xd3, 0x00),
	magenta: colorRGBA(0xf6, 0x53, 0xa6),
	cyan: colorRGBA(0x7f, 0xff, 0xd4),
	
	pink: colorRGBA(0xff, 0xc0, 0xcb),
	cerulean: colorRGBA(0x00, 0x7b, 0xa7),
	"sea green": colorRGBA(0x00, 0x49, 0x53),
	"sky blue": colorRGBA(0x80, 0xda, 0xeb),
	teal: colorRGBA(0x00, 0x80, 0x80)
};
for(let c in _COLORS) {
	Color.register(c, _COLORS[c]);
}

module.exports = Color;
