#include <xcb/xcb.h>

#include "native.hpp"

#include <cstdio>
#include <vector>

// Styleguide exception: everything is in this namespace, so it's
//  all given 0-indentation.
namespace satori {
namespace native {

typedef uint32_t uint;

// We only really need to manage one connection to xorg no matter
//  how many windows we create.
static xcb_connection_t* conn = nullptr;
static xcb_screen_t* screen = nullptr;

#include "keysym.cc"

static struct _Janitor {
	~_Janitor() {
		// screen doesn't need to be freed (TODO: verify this)
		xcb_disconnect(conn);
		deinit_keysym();
	}
} _janitor;

void init_xcb() {
	conn = xcb_connect(NULL, NULL);
	screen = xcb_setup_roots_iterator(xcb_get_setup(conn)).data;
	
	init_keysym();
}

#define WIN_ATTR_MASK (XCB_CW_BACK_PIXEL | XCB_CW_EVENT_MASK)

void global_flush() {
	xcb_flush(conn);
}

event::mouse::Button xcb2satori_mousebutton(xcb_button_index_t code) {
	switch(code) {
		case XCB_BUTTON_INDEX_1: return event::mouse::LEFT;
		case XCB_BUTTON_INDEX_3: return event::mouse::RIGHT;
		case XCB_BUTTON_INDEX_2: return event::mouse::MIDDLE;
		
		// 4 and 5 shouldn't be given to this function.
		case XCB_BUTTON_INDEX_4:
		case XCB_BUTTON_INDEX_5:
		case XCB_BUTTON_INDEX_ANY:
			return event::mouse::UNKNOWN;
	}
	
	return event::mouse::UNKNOWN;
}

/**
 * 1010 -> 11001100 (but with 8 bits -> 16 bits)
 * Adapted from Interleave bits by Binary Magic Numbers from
 *  https://graphics.stanford.edu/~seander/bithacks.html
**/
int double_bits(int x) {
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
	
	uint allocColor(uint r, uint g, uint b, uint a) {
		// Alpha is ignored for now, see the XRender extension
		auto cookie = xcb_alloc_color(
			conn, cmap,
			double_bits(r), double_bits(g), double_bits(b)
		);
		
		// Trailing NULL is error
		xcb_generic_error_t* error;
		auto reply = xcb_alloc_color_reply(conn, cookie, &error);
		if(error) {
			printf("Error: %d\n", error->error_code);
		}
		return reply->pixel;
	}
	
	void deallocColors(const std::vector<uint>& ids) {
		xcb_free_colors(conn, cmap, 0, ids.size(), ids.data());
	}
};

struct Window : public RenderTarget {
	xcb_window_t win;
	int event_mask;
	
	static void init() {
		init_xcb();
	}
	
	Window() {
		if(!conn) {
			init_xcb();
		}
		
		event_mask = XCB_EVENT_MASK_EXPOSURE;
		int values[2] = {(int)screen->white_pixel, event_mask};
		
		win = xcb_generate_id(conn);
		xcb_create_window(
			conn, XCB_COPY_FROM_PARENT, win, screen->root,
			// x, y, w, h (ignore for now)
			0, 0, 400, 400,
			1,
			XCB_WINDOW_CLASS_INPUT_OUTPUT,
			screen->root_visual,
			WIN_ATTR_MASK, values
		);
		xcb_map_window(conn, win);
		
		cmap = xcb_generate_id(conn);
		auto cookie = xcb_create_colormap(
			conn, XCB_COLORMAP_ALLOC_NONE,
			cmap, win, screen->root_visual
		);
		auto* error = xcb_request_check(conn, cookie);
		if(error) {
			printf("Error2: %d\n", error->error_code);
		}
		printf("Colormap: %d\n", cmap);
		
		xcb_flush(conn);
	}
	
	~Window() {
		//close()
	}
	
	bool getVisible() {
		return false;
	}
	void setVisible(bool v) {
	
	}
	
	int getPosition() {
		return 0;
	}
	void setPosition(int p) {
	}
	
	int getSize() {
		return 0;
	}
	void setSize(int s) {
	}
	
	std::string getTitle() {
		return "";
	}
	void setTitle(const std::string& s) {
	}
	
	bool pollEvent(event::Any* ev) {
		xcb_generic_event_t* xcb_ev = xcb_poll_for_event(conn);
		
		if(!xcb_ev) {
			return false;
		}
		
		switch(xcb_ev->response_type & ~0x80) {
			case XCB_EXPOSE:
				ev->code = event::WINDOW_PAINT;
				break;
			
			/*** BEGIN: Mouse press event handling ***/
			{
				// Note: while xcb_button_press/release_event_t may
				//  seem structurally compatible, C/++ makes no such
				//  guarantee. Thus for type safety, extract detail
				int rawdetail;
				
				case XCB_BUTTON_PRESS:
					ev->mouse.press.state = true;
					rawdetail =
						((xcb_button_press_event_t*)xcb_ev)->detail;
					goto mouse_ev;
				case XCB_BUTTON_RELEASE:
					ev->mouse.press.state = false;
					rawdetail =
						((xcb_button_release_event_t*)xcb_ev)->detail;
					goto mouse_ev;
				mouse_ev: {
					xcb_button_index_t detail =
						(xcb_button_index_t)rawdetail;
					
					// 4 and 5 are the mouse wheel "buttons"
					if(detail == XCB_BUTTON_INDEX_4 || detail == XCB_BUTTON_INDEX_5) {
						ev->code = event::MOUSE_WHEEL;
						ev->mouse.wheel.delta = detail;
					}
					else {
						ev->code = event::MOUSE_PRESS;
						ev->mouse.press.button =
							xcb2satori_mousebutton(
								(xcb_button_index_t)detail
							);
						ev->mouse.press.dragging = false;
					}
					break;
				}
			}
			/*** END Mouse press event handling ***/
			
			case XCB_MOTION_NOTIFY: {
				auto* xev = (xcb_motion_notify_event_t*)xcb_ev;
				
				ev->code = event::MOUSE_MOVE;
				ev->mouse.move.x = xev->event_x;
				ev->mouse.move.y = xev->event_y;
				break;
			}
			
			/*** BEGIN: Mouse hover event handling ***/
			{
				int x, y;
				
				case XCB_ENTER_NOTIFY:
					ev->mouse.hover.state = true;
					x = ((xcb_enter_notify_event_t*)xcb_ev)->event_x;
					y = ((xcb_enter_notify_event_t*)xcb_ev)->event_y;
					goto hover_ev;
				case XCB_LEAVE_NOTIFY:
					ev->mouse.hover.state = false;
					x = ((xcb_leave_notify_event_t*)xcb_ev)->event_x;
					y = ((xcb_leave_notify_event_t*)xcb_ev)->event_y;
					goto hover_ev;
				hover_ev: {
					ev->code = event::MOUSE_HOVER;
					ev->mouse.hover.x = x;
					ev->mouse.hover.y = y;
					break;
				}
			}
			/*** END: Mouse hover event handling ***/
			
			/*** BEGIN: Key press event handling ***/
			{
				int detail, state;
				
				case XCB_KEY_PRESS:
					ev->key.press.state = true;
					detail = ((xcb_key_press_event_t*)xcb_ev)->detail;
					state = ((xcb_key_press_event_t*)xcb_ev)->state;
					goto key_ev;
				case XCB_KEY_RELEASE:
					ev->key.press.state = false;
					detail = ((xcb_key_release_event_t*)xcb_ev)->detail;
					state = ((xcb_key_release_event_t*)xcb_ev)->state;
					goto key_ev;
				key_ev: {
					xcb_keycode_t code = (xcb_keycode_t)detail;
					xcb_mod_mask_t mods = (xcb_mod_mask_t)state;
					
					ev->code = event::KEY_PRESS;
					
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
			
			case event::WINDOW_PAINT:
				event_mask |= XCB_EVENT_MASK_EXPOSURE;
				break;
			//MouseOver, MouseOut
			
			case event::UNKNOWN:
				return;
		}
		
		if(event_mask != old) {
			int values[2] = {(int)screen->white_pixel, event_mask};
			
			xcb_change_window_attributes(
				conn, win, WIN_ATTR_MASK, values
			);
		}
	}
};

#define GC_STYLE_LEN 8
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
	if(style.line_width) {
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
	xcb_gcontext_t gc;
	xcb_drawable_t target;
	
	static void init() {
	
	}
	
	//GraphicsContext(target, fg, bg, lw, ls, cap, join, fill_style, fill_rule, font, clip, ...)
	GraphicsContext(Window* w, display::Style style) {
		gc = xcb_generate_id(conn);
		target = w->win;
		
		int values[GC_STYLE_LEN];
		xcb_create_gc(
			conn, gc, target, build_gc_style(style, values), values
		);
	}
	
	void setStyle(display::Style style) {
		std::vector<int> values(GC_STYLE_LEN);
		xcb_change_gc(
			conn, gc, build_gc_style(style, values.data()), values.data()
		);
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
		xcb_poly_text_8(
			conn, target, gc,
			x, y, text.size(), (const uint8_t*)text.c_str()
		);
	}
};

struct Font {
	xcb_font_t font;
	
	Font(const std::string& name) {
		
	}
	
	~Font() {
		xcb_close_font(conn, font);
	}
	
	
};

}}

