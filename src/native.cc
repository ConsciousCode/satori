#include <xcb/xcb.h>
#include <xcb/xcb_ewmh.h>

#include "native-interface.hpp"
#include "x11error.hpp"

#include <cstdio>
#include <vector>
#include <string>
#include <stdexcept>
#include <sstream>
#include <iomanip>
#include <set>

#define GC_STYLE_LEN 8
#define WIN_ATTR_LEN 8

// Styleguide exception: everything is in this namespace, so it's
//  all given 0-indentation.
namespace satori {
namespace native {

typedef uint32_t uint;

// We only really need to manage one connection to xorg no matter
//  how many frames we create.
static xcb_connection_t* conn = nullptr;
static xcb_screen_t* screen = nullptr;

static xcb_ewmh_connection_t ewmh;

#include "keysym.cc"

static struct _Janitor {
	~_Janitor() {
		// screen doesn't need to be freed (TODO: verify this)
		xcb_disconnect(conn);
		deinit_keysym();
	}
} _janitor;

// Makes it easy to keep track of what's dirty and what's not
//  so we can batch x server messages
template<typename T>
struct Dirty {
	bool dirty;
	T value;
	
	void set(T v) {
		dirty = true;
		value = v;
	}
	
	void clean(int& mask, int*& cur, int bit) {
		if(dirty) {
			mask |= bit;
			*(cur++) = (int)value;
			dirty = false;
		}
	}
};

// colormap, cursor, drawable, font, gc, id, pixmap, window
// atom errors return atom
std::string xcb_describeError(xcb_generic_error_t* error) {
	const char* desc;
	
	switch(error->error_code) {
		case XERR_SUCCESS: return "success";
		case XERR_BAD_REQUEST: return "bad request";
		case XERR_BAD_VALUE: return "bad value";
		
		case XERR_BAD_WINDOW: desc = "bad window "; break;
		case XERR_BAD_PIXMAP: desc = "bad pixmap "; break;
		case XERR_BAD_ATOM: desc = "bad atom "; break;
		case XERR_BAD_CURSOR: desc = "bad cursor "; break;
		case XERR_BAD_FONT: desc = "bad font "; break;
		
		case XERR_BAD_MATCH: return "bad match";
		
		case XERR_BAD_DRAWABLE: desc = "bad drawable "; break;
		
		case XERR_BAD_ACCESS: return "bad access";
		case XERR_BAD_ALLOC: return "bad alloc";
		
		case XERR_BAD_COLORMAP: desc = "bad colormap "; break;
		case XERR_BAD_GC: desc = "bad gc "; break;
		case XERR_BAD_ID_CHOICE: desc = "bad id choice "; break;
		
		case XERR_BAD_NAME: return "bad name";
		case XERR_BAD_LENGTH: return "bad length";
		case XERR_BAD_IMPL: return "server error";
	}
	
	return desc + std::to_string(error->minor_code);
}

std::runtime_error buildError(const std::string& what, xcb_generic_error_t* error) {
	return std::runtime_error(
		what + " (" + xcb_describeError(error) + ")"
	);
}

void init_xcb() {
	conn = xcb_connect(nullptr, nullptr);
	screen = xcb_setup_roots_iterator(xcb_get_setup(conn)).data;
	
	auto* cookies = xcb_ewmh_init_atoms(conn, &ewmh);
	xcb_generic_error_t* error;
	xcb_ewmh_init_atoms_replies(&ewmh, cookies, &error);
	if(error) {
		throw buildError("Initialization failed", error);
	}
	
	init_keysym();
}

event::mouse::Button xcb2satori_mousebutton(xcb_button_t code) {
	switch(code) {
		//case XCB_BUTTON_INDEX*: ?
		
		case 0: return event::mouse::LEFT;
		case 1: return event::mouse::MIDDLE;
		case 2: return event::mouse::RIGHT;
		
		// 3 and 4 shouldn't be given to this function.
		case 3:
		case 4:
			return event::mouse::UNKNOWN;
	}
	
	return event::mouse::UNKNOWN;
}

/**
 * 1010 -> 11001100 (but with 8 bits -> 16 bits)
 * Adapted from Interleave bits by Binary Magic Numbers from
 *  https://graphics.stanford.edu/~seander/bithacks.html
 *
 * This is necessary because 
**/
int double_bits(int x) {
	// Colors have been behaving weirdly, maybe it's because this
	//  algorithm was wrong?
	return x*257;
	
	x = (x | (x << 4)) & 0x0F0F;
	x = (x | (x << 2)) & 0x3333;
	x = (x | (x << 1)) & 0x5555;
	
	return x | (x << 1);
}

struct RenderTarget {
	xcb_colormap_t cmap;
	
	int maxColorMappings() {
		return 1;
	}
	
	uint allocColor(uint rgba) {
		uint
			r = rgba>>24,
			g = (rgba>>16)&0xff,
			b = (rgba>>8)&0xff,
			a = rgba&0xff;
		
		// Alpha is ignored for now, see the XRender extension
		auto cookie = xcb_alloc_color(
			conn, cmap,
			double_bits(r), double_bits(g), double_bits(b)
		);
		
		xcb_generic_error_t* error;
		auto reply = xcb_alloc_color_reply(conn, cookie, &error);
		if(error) {
			std::stringstream ss;
			ss.width(2);
			ss << "Allocation of color #" <<
				std::hex << std::setfill('0') <<
				std::setw(2) << r <<
				std::setw(2) << g <<
				std::setw(2) << b <<
				std::setw(2) << a << " failed";
			throw buildError(ss.str(), error);
		}
		return reply->pixel;
	}
	
	void deallocColors(const std::vector<uint>& ids) {
		xcb_free_colors(conn, cmap, 0, ids.size(), ids.data());
	}
};

struct Frame : public RenderTarget {
	static std::set<Frame*> toflush;
	
	xcb_window_t frame;
	int event_mask;
	bool visible;
	
	struct ConfigureCache {
		Dirty<int> x, y;
		Dirty<uint> w, h, bw;
		
		void flush(Frame* self) {
			int values[7], *cur = &values[0], mask = 0;
			
			x.clean(mask, cur, XCB_CONFIG_WINDOW_X);
			y.clean(mask, cur, XCB_CONFIG_WINDOW_Y);
			w.clean(mask, cur, XCB_CONFIG_WINDOW_WIDTH);
			h.clean(mask, cur, XCB_CONFIG_WINDOW_HEIGHT);
			bw.clean(mask, cur, XCB_CONFIG_WINDOW_BORDER_WIDTH);
			
			if(mask) {
				xcb_configure_window(conn, self->frame, mask, values);
			}
		}
	} configure_cache;
	
	struct AttributeCache {
		//back pixmap
		Dirty<color_id_t> back_color;
		//border pixmap
		Dirty<color_id_t> border_color;
		//"bit gravity"
		//window gravity
		//backing planes
		//backing color/pixel
		//override redirect
		//save under
		//event mask
		//dont propagate
		
		//Colormap isn't included because it's changed too rarely
		// to be of any benefit
		//Dirty<xcb_colormap_t> colormap;
		//cursor
		
		void flush(Frame* self) {
			int values[14], *cur = &values[0], mask = 0;
			
			back_color.clean(mask, cur, XCB_CW_BACK_PIXEL);
			border_color.clean(mask, cur, XCB_CW_BORDER_PIXEL);
			
			if(mask) {
				xcb_change_window_attributes(
					conn, self->frame, mask, values
				);
			}
		}
	} attribute_cache;
	
	static void init() {
	}
	
	Frame(frame_id_t parent, int x, int y, uint w, uint h, uint bw, color_id_t bg) {
		if(!conn) {
			init_xcb();
		}
		
		if(parent == 0) {
			parent = screen->root;
		}
		
		event_mask = 0;
		
		int mask = 0;
		int values[WIN_ATTR_LEN], *cur = &values[0];
		
		if(bg == 0) {
			bg = screen->white_pixel;
		}
		
		if(bg) {
			mask |= XCB_CW_BACK_PIXEL;
			*(cur++) = bg;
		}
		
		mask |= XCB_CW_EVENT_MASK;
		*(cur++) = event_mask;
		
		// Gives weird behavior with 0 sizes
		if(w < 1) w = 1;
		if(h < 1) h = 1;
		
		frame = xcb_generate_id(conn);
		
		auto cookie = xcb_create_window(
			conn, XCB_COPY_FROM_PARENT, frame, parent,
			// x, y, w, h (ignore for now)
			x, y, w, h, bw,
			XCB_WINDOW_CLASS_INPUT_OUTPUT,
			screen->root_visual,
			
			mask, values
		);
		visible = false;
		
		auto* error = xcb_request_check(conn, cookie);
		if(error) {
			throw buildError("Frame creation failed", error);
		}
		
		cmap = xcb_generate_id(conn);
		cookie = xcb_create_colormap(
			conn, XCB_COLORMAP_ALLOC_NONE,
			cmap, frame, screen->root_visual
		);
		
		error = xcb_request_check(conn, cookie);
		if(error) {
			throw buildError("Colormap allocation failed", error);
		}
		
		xcb_flush(conn);
	}
	
	~Frame() {
		close();
		toflush.erase(this);
	}
	
	void flush() {
		configure_cache.flush(this);
		attribute_cache.flush(this);
	}
	
	void setParent(frame_id_t parent) {
		xcb_reparent_window(conn, frame, parent, 0, 0);
	}
	
	frame_id_t getID() {
		return frame;
	}
	
	void close() {
		if(frame) {
			xcb_destroy_window(conn, frame);
			frame = 0;
		}
	}
	
	void setBG(color_id_t bg) {
		attribute_cache.back_color.set(bg);
		toflush.insert(this);
	}
	
	bool getVisible() {
		return visible;
	}
	void setVisible(bool v) {
		if(v) {
			xcb_map_window(conn, frame);
		}
		else {
			xcb_unmap_window(conn, frame);
		}
	}
	
	int getPosition() {
		auto cookie = xcb_get_geometry(conn, frame);
		xcb_generic_error_t* error;
		auto reply = xcb_get_geometry_reply(conn, cookie, &error);
		if(error) {
			throw buildError("Frame.getPosition()", error);
		}
		
		return (reply->x<<16)|reply->y;
	}
	void setPosition(int p) {
		configure_cache.x.set(p>>16);
		configure_cache.y.set(p&0xffff);
		toflush.insert(this);
	}
	
	uint getSize() {
		auto cookie = xcb_get_geometry(conn, frame);
		xcb_generic_error_t* error;
		auto reply = xcb_get_geometry_reply(conn, cookie, &error);
		if(error) {
			throw buildError("Frame.getSize()", error);
		}
		
		return (reply->width<<16)|reply->height;
	}
	void setSize(int s) {
		configure_cache.w.set(s>>16);
		configure_cache.h.set(s&0xffff);
		toflush.insert(this);
	}
	
	std::string getTitle() {
		auto cookie = xcb_ewmh_get_wm_name(&ewmh, frame);
		
		xcb_generic_error_t* error;
		xcb_ewmh_get_utf8_strings_reply_t reply;
		xcb_ewmh_get_wm_name_reply(
			&ewmh, cookie, &reply, &error
		);
		if(error) {
			throw buildError("Frame.getTitle()", error);
		}
		
		return std::string(reply.strings, reply.strings_len);
	}
	void setTitle(const std::string& s) {
		xcb_ewmh_set_wm_name(&ewmh, frame, s.size(), s.c_str());
	}
	
	void listenEvent(event::Code code) {
		auto old = event_mask;
		
		switch(code) {
			case event::MOUSE_MOVE:
				event_mask |= XCB_EVENT_MASK_POINTER_MOTION;
				break;
			case event::MOUSE_WHEEL:
				event_mask |= XCB_EVENT_MASK_BUTTON_MOTION;
				break;
			case event::MOUSE_PRESS:
				event_mask |= XCB_EVENT_MASK_BUTTON_PRESS;
				event_mask |= XCB_EVENT_MASK_BUTTON_RELEASE;
				break;
			case event::MOUSE_HOVER:
				event_mask |= XCB_EVENT_MASK_ENTER_WINDOW;
				event_mask |= XCB_EVENT_MASK_LEAVE_WINDOW;
				break;
			
			case event::KEY_PRESS:
				event_mask |= XCB_EVENT_MASK_KEY_PRESS;
				event_mask |= XCB_EVENT_MASK_KEY_RELEASE;
				break;
			
			case event::WINDOW_MOVE:
			case event::WINDOW_RESIZE:
				event_mask |= XCB_EVENT_MASK_PROPERTY_CHANGE;
				break;
			case event::WINDOW_FOCUS:
				event_mask |= XCB_EVENT_MASK_FOCUS_CHANGE;
				break;
			
			case event::WINDOW_DRAW:
				event_mask |= XCB_EVENT_MASK_EXPOSURE;
				break;
			
			case event::WINDOW_OPEN:
				//event_mask |= XCB_EVENT_MASK_CREATE_NOTIFY;
				break;
			case event::WINDOW_CLOSE:
				//event_mask |= XCB_EVENT_MASK_DESTROY_NOTIFY;
				break;
			
			case event::UNKNOWN:
				return;
		}
		
		if(event_mask != old) {
			int values[] = {event_mask};
			
			xcb_change_window_attributes(
				conn, frame, XCB_CW_EVENT_MASK, values
			);
		}
	}
	
	void redraw() {
		int size = getSize();
		xcb_clear_area(conn, 1, frame, 0, 0, size>>16, size&0xffff);
	}
};
std::set<Frame*> Frame::toflush;

int build_gc_style(display::Style style, int* cur) {
	int mask = 0;
	
	if(style.fg) {
		*(cur++) = style.fg;
		mask |= XCB_GC_FOREGROUND;
	}
	if(style.bg) {
		*(cur++) = style.bg;
		mask |= XCB_GC_BACKGROUND;
	}
	if(style.line_width != -1) {
		*(cur++) = style.line_width;
		mask |= XCB_GC_LINE_WIDTH;
	}
	if(style.font) {
		*(cur++) = style.font;
		mask |= XCB_GC_FONT;
	}
	
	return mask;
}

struct GraphicsContext {
	static std::set<GraphicsContext*> toflush;
	
	xcb_gcontext_t gc;
	xcb_drawable_t target;
	
	struct StyleCache {
		//foreground
		//background
		
		Dirty<color_id_t> fg, bg;
		Dirty<uint> lw;
		
		//line width
		//line style
		//cap style
		//join style
		//fill style
		//fill rule
		//tile
		//stipple
		//stipple origin x
		//stipple origin y
		
		Dirty<font_id_t> font;
		
		//subwindow mode
		//graphics exposure
		//clip origin x
		//clip origin y
		//clip mask
		//dash offset
		//dash list
		//arc mode
		
		void flush(GraphicsContext* self) {
			int values[24], *cur = &values[0], mask = 0;
			
			fg.clean(mask, cur, XCB_GC_FOREGROUND);
			bg.clean(mask, cur, XCB_GC_BACKGROUND);
			lw.clean(mask, cur, XCB_GC_LINE_WIDTH);
			font.clean(mask, cur, XCB_GC_FONT);
			
			xcb_create_gc(conn, self->gc, self->target, mask, values);
		}
	} style_cache;
	
	static void init() {
	
	}
	
	//GraphicsContext(target, fg, bg, lw, ls, cap, join, fill_style, fill_rule, font, clip, ...)
	GraphicsContext(Frame* w, display::Style style) {
		gc = xcb_generate_id(conn);
		target = w->frame;
		
		int values[GC_STYLE_LEN];
		xcb_create_gc(
			conn, gc, target, build_gc_style(style, values), values
		);
	}
	
	~GraphicsContext() {
		toflush.erase(this);
	}
	
	void flush() {
		style_cache.flush(this);
	}
	
	void setFG(color_id_t fg) {
		style_cache.fg.set(fg);
		toflush.insert(this);
	}
	void setBG(color_id_t bg) {
		style_cache.bg.set(bg);
		toflush.insert(this);
	}
	void setLineWidth(uint lw) {
		style_cache.lw.set(lw);
		toflush.insert(this);
	}
	void setFont(font_id_t font) {
		style_cache.font.set(font);
		toflush.insert(this);
	}
	
	void drawPoints(bool rel, const std::vector<display::Point>& points) {
		std::vector<xcb_point_t> xpoints(points.size());
		auto cur = xpoints.begin();
		
		for(uint i = 0; i < xpoints.size(); ++i) {
			cur->x = points[i].x;
			cur->y = points[i].y;
			++cur;
		}
		
		xcb_poly_point(conn,
			rel? XCB_COORD_MODE_PREVIOUS : XCB_COORD_MODE_ORIGIN,
			target, gc, xpoints.size(), xpoints.data()
		);
	}
	
	void drawLines(bool rel, const std::vector<display::Line>& lines) {
		std::vector<xcb_point_t> points(2*lines.size());
		auto cur = points.begin();
		
		for(uint i = 0; i < lines.size(); ++i) {
			cur->x = lines[i].x1;
			cur->y = lines[i].y1;
			++cur;
			cur->x = lines[i].x2;
			cur->y = lines[i].y2;
			++cur;
		}
		
		xcb_poly_line(conn, 
			rel? XCB_COORD_MODE_PREVIOUS : XCB_COORD_MODE_ORIGIN,
			target, gc, 2*points.size(), points.data()
		);
	}
	
	void drawRects(bool fill, const std::vector<display::Rect>& rects) {
		std::vector<xcb_rectangle_t> xrects(rects.size());
		auto cur = xrects.begin();
		
		for(uint i = 0; i < xrects.size(); ++i) {
			cur->x = rects[i].x;
			cur->y = rects[i].y;
			cur->width = rects[i].w;
			cur->height = rects[i].h;
		}
		
		(fill? xcb_poly_fill_rectangle : xcb_poly_rectangle)(
			conn, target, gc, xrects.size(), xrects.data()
		);
	}
	
	void drawOvals(bool fill, std::vector<display::Ellipse>& ellipses) {
		/* TODO */
	}
	
	void drawPolygons(
		bool close, bool fill, std::vector<display::Point>& verts
	) {
		/* TODO */
	}
	
	void drawText(int x, int y, const std::string& text) {
		/*
		 * TODO: This uses the old API, we want to use Xft
		 */
		printf("Target: %d, GC: %d\n", target, gc);
		auto cookie = xcb_image_text_8_checked(
			conn, text.size(), target, gc,
			x, y, text.c_str()
		);
		
		auto* error = xcb_request_check(conn, cookie);
		if(error) {
			throw buildError("Frame.drawText()", error);
		}
	}
};
std::set<GraphicsContext*> GraphicsContext::toflush;

uint openFont(const std::string& name) {
	uint id = xcb_generate_id(conn);
	auto cookie = xcb_open_font_checked(conn, id, name.size(), name.c_str());
	
	auto* error = xcb_request_check(conn, cookie);
	if(error) {
		throw buildError("openFont()", error);
	}
	return id;
}

void closeFont(xcb_font_t font) {
	xcb_close_font(conn, font);
}
	
bool pollEvent(event::Any* ev) {
	xcb_generic_event_t* xcb_ev = xcb_poll_for_event(conn);
	
	if(!xcb_ev) {
		return false;
	}
	
	switch(xcb_ev->response_type & ~0x80) {
		case XCB_EXPOSE:
			ev->code = event::WINDOW_DRAW;
			break;
		
		/*** BEGIN: Mouse press event handling ***/
		{
			// Note: while xcb_button_press/release_event_t may
			//  seem structurally compatible, C/++ makes no such
			//  guarantee. Thus for type safety, extract detail
			xcb_button_t button;
			frame_id_t target;
			
			case XCB_BUTTON_PRESS: {
				auto* xev = (xcb_button_press_event_t*)xcb_ev;
				ev->mouse.press.state = true;
				
				button = xev->detail;
				target = xev->child || xev->event || xev->root;
				
				goto LABEL_mouse_event;
			}
			case XCB_BUTTON_RELEASE: {
				auto* xev = (xcb_button_release_event_t*)xcb_ev;
				ev->mouse.press.state = false;
				
				button = xev->detail;
				target = xev->child || xev->event || xev->root;
				
				goto LABEL_mouse_event;
			}
			LABEL_mouse_event: {
				ev->target = target;
				
				// 3 and 4 are the mouse wheel "buttons"
				if(button == 3 || button == 4) {
					ev->code = event::MOUSE_WHEEL;
					ev->mouse.wheel.delta = button;
				}
				else {
					ev->code = event::MOUSE_PRESS;
					ev->mouse.press.button =
						xcb2satori_mousebutton(button);
					ev->mouse.press.dragging = false;
				}
				break;
			}
		}
		/*** END Mouse press event handling ***/
		
		case XCB_MOTION_NOTIFY: {
			auto* xev = (xcb_motion_notify_event_t*)xcb_ev;
			
			ev->code = event::MOUSE_MOVE;
			ev->target = xev->child || xev->event || xev->root;
			
			ev->mouse.move.x = xev->event_x;
			ev->mouse.move.y = xev->event_y;
			
			break;
		}
		
		/*** BEGIN: Mouse hover event handling ***/
		{
			int x, y, target;
			
			case XCB_ENTER_NOTIFY: {
				auto* xev = (xcb_enter_notify_event_t*)xcb_ev;
				ev->mouse.hover.state = true;
				
				target = xev->child || xev->event || xev->root;
				x = xev->event_x;
				y = xev->event_y;
				
				goto LABEL_hover_event;
			}
			case XCB_LEAVE_NOTIFY: {
				auto* xev = (xcb_leave_notify_event_t*)xcb_ev;
				ev->mouse.hover.state = false;
				
				target = xev->child || xev->event || xev->root;
				x = xev->event_x;
				y = xev->event_y;
				
				goto LABEL_hover_event;
			}
			LABEL_hover_event: {
				ev->code = event::MOUSE_HOVER;
				ev->target = target;
				
				ev->mouse.hover.x = x;
				ev->mouse.hover.y = y;
				
				break;
			}
		}
		/*** END: Mouse hover event handling ***/
		
		/*** BEGIN: Key press event handling ***/
		{
			xcb_keycode_t key;
			xcb_mod_mask_t mods;
			frame_id_t target;
			
			case XCB_KEY_PRESS: {
				auto* xev = (xcb_key_press_event_t*)xcb_ev;
				ev->key.press.state = true;
				
				target = xev->child || xev->event || xev->root;
				key = xev->detail;
				mods = (xcb_mod_mask_t)xev->state;
				
				goto LABEL_key_event;
			}
			case XCB_KEY_RELEASE: {
				auto* xev = (xcb_key_release_event_t*)xcb_ev;
				ev->key.press.state = false;
				
				target = xev->child || xev->event || xev->root;
				key = xev->detail;
				mods = (xcb_mod_mask_t)xev->state;
				
				goto LABEL_key_event;
			}
			LABEL_key_event: {
				xcb_keycode_t code = key;
				
				ev->code = event::KEY_PRESS;
				ev->target = target;
				
				ev->key.press.key = event::key::UNKNOWN;
				xcb2satori_keycode(
					code, mods,
					&ev->key.press.button,
					&ev->key.press.key
				);
				
				ev->key.press.shift = mods&XCB_MOD_MASK_SHIFT;
				ev->key.press.ctrl = mods&XCB_MOD_MASK_CONTROL;
				// lock?
				ev->key.press.alt = mods&XCB_MOD_MASK_1;
				
				break;
			}
		}
		/*** END: Key press event handling ***/
			
		case XCB_CREATE_NOTIFY: {
			auto* xev = (xcb_create_notify_event_t*)xcb_ev;
			
			ev->code = event::WINDOW_OPEN;
			ev->target = xev->window;
			
			break;
		}
		case XCB_DESTROY_NOTIFY: {
			auto* xev = (xcb_destroy_notify_event_t*)xcb_ev;
			
			ev->code = event::WINDOW_CLOSE;
			ev->target = xev->window;
			
			break;
		}
		
		case XCB_FOCUS_IN:
		case XCB_FOCUS_OUT:
		case XCB_KEYMAP_NOTIFY:
		case XCB_GRAPHICS_EXPOSURE:
		case XCB_NO_EXPOSURE:
		case XCB_VISIBILITY_NOTIFY:
		case XCB_UNMAP_NOTIFY:
		case XCB_MAP_NOTIFY:
		case XCB_MAP_REQUEST:
		case XCB_REPARENT_NOTIFY:
		case XCB_CONFIGURE_NOTIFY:
		case XCB_CONFIGURE_REQUEST:
		case XCB_GRAVITY_NOTIFY:
		case XCB_RESIZE_REQUEST:
		case XCB_CIRCULATE_NOTIFY:
		case XCB_CIRCULATE_REQUEST:
		case XCB_PROPERTY_NOTIFY:
		case XCB_SELECTION_CLEAR:
		case XCB_SELECTION_REQUEST:
		case XCB_SELECTION_NOTIFY:
		case XCB_CLIENT_MESSAGE:
		case XCB_MAPPING_NOTIFY:
		case XCB_GE_GENERIC:
		default: goto LABEL_no_impl;
	}
	
	LABEL_done:
		free(xcb_ev);
		return true;
	
	// Handle any events that we've listed but not implemented
	LABEL_no_impl:
		ev->code = event::UNKNOWN;
		goto LABEL_done;
}

void dispatchEvent() {
	
}

void globalFlush() {
	for(auto* f : Frame::toflush) {
		f->flush();
	}
	for(auto* gc : GraphicsContext::toflush) {
		gc->flush();
	}
	xcb_flush(conn);
}

}}

