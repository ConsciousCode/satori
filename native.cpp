#include <xcb/xcb.h>

#include "native.hpp"

#include <cstdio>

namespace {
	using namespace satori;
	using namespace satori::native;
}

namespace satori {
namespace native {

static xcb_connection_t* conn = nullptr;
static xcb_screen_t* screen = nullptr;

#include "keysym.cc"

static struct _Janitor {
	~_Janitor() {
		// screen doesn't need to be freed (TODO: verify this)
		xcb_disconnect(conn);
		deinit_keysym();
	}
} janitor;

void init_xcb() {
	conn = xcb_connect(NULL, NULL);
	screen = xcb_setup_roots_iterator(xcb_get_setup(conn)).data;
	
	init_keysym();
}

#define WIN_ATTR_MASK (XCB_CW_BACK_PIXEL | XCB_CW_EVENT_MASK)

void global_flush() {
	xcb_flush(conn);
}

struct Window {
	xcb_window_t win;
	int event_mask;
	
	static void Init() {
		init_xcb();
	}
	
	Window() {
		if(!conn) {
			init_xcb();
		}
		
		event_mask = XCB_EVENT_MASK_EXPOSURE;
		int values[2] = {screen->white_pixel, event_mask};
		
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
	void setTitle(std::string s) {
	}
	
	bool pollEvent(event::Any* ev) {
		xcb_generic_event_t* xcb_ev = xcb_poll_for_event(conn);
		
		if(!xcb_ev) {
			return false;
		}
		
		switch(xcb_ev->response_type & ~0x80) {
			case XCB_EXPOSE: goto no_impl;
			
			case XCB_BUTTON_PRESS:
				ev->mouse.press.state = true;
				goto mouse_ev;
			case XCB_BUTTON_RELEASE:
				ev->mouse.press.state = false;
				goto mouse_ev;
			mouse_ev: {
				auto* xev = (xcb_button_press_event_t*)xcb_ev;
				ev->code = event::MOUSE_PRESS;
				ev->mouse.press.button =
					(event::mouse::Button)
					xev->detail;
				ev->mouse.press.dragging = false;
				break;
			}
			
			case XCB_MOTION_NOTIFY: goto no_impl;
			case XCB_ENTER_NOTIFY: goto no_impl;
			case XCB_LEAVE_NOTIFY: goto no_impl;
			
			case XCB_KEY_PRESS:
				ev->key.press.state = true;
				goto key_ev;
			case XCB_KEY_RELEASE:
				ev->key.press.state = false;
				goto key_ev;
			key_ev: {
				auto* xev = (xcb_key_press_event_t*)xcb_ev;
				ev->code = event::KEY_PRESS;
				
				ev->key.press.key = event::key::UNKNOWN;
				satori_keymap(xev->detail, (xcb_mod_mask_t)xev->state,
					&ev->key.press.button,
					&ev->key.press.key
				);
				
				ev->key.press.shift = xev->state&XCB_MOD_MASK_SHIFT;
				ev->key.press.ctrl = xev->state&XCB_MOD_MASK_CONTROL;
				// lock?
				ev->key.press.alt = xev->state&XCB_MOD_MASK_1;
				break;
			}
			
			default: goto no_impl;
		}
		
		done:
			free(xcb_ev);
			return true;
		
		no_impl:
			ev->code = event::UNKNOWN;
			goto done;
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
			//MouseOver, MouseOut
			
			case event::UNKNOWN:
			default:
				return;
		}
		
		if(event_mask != old) {
			int values[2] = {screen->white_pixel, event_mask};
			
			xcb_change_window_attributes(
				conn, win, WIN_ATTR_MASK, values
			);
		}
	}
};

struct Graphics {
	
};

}}

