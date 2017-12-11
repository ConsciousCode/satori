/**
 * This file is intended to be included into native.cpp
**/

#include "keysymdef.h"

static xcb_keysym_t* keysym_table;
static int keysym_len, keysym_per;

#define FIRST_KEYCODE 8
#define KEYCODE_COUNT 247

void init_keysym() {
	xcb_generic_error_t* error;
	
	auto cookie = xcb_get_keyboard_mapping(
		conn, FIRST_KEYCODE, KEYCODE_COUNT
	);
	auto reply = xcb_get_keyboard_mapping_reply(conn, cookie, &error);
	
	keysym_len = xcb_get_keyboard_mapping_keysyms_length(reply);
	keysym_per = reply->keysyms_per_keycode;
	
	keysym_table = new xcb_keysym_t[keysym_len*keysym_per];
	
	auto it = xcb_get_keyboard_mapping_keysyms(reply);
	auto end = xcb_get_keyboard_mapping_keysyms_end(reply).data;
	for(int i = 0; it != end; ++it, ++i) {
		keysym_table[i] = *it;
	}
}

void deinit_keysym() {
	delete[] keysym_table;
}

xcb_keysym_t lookup_keysym(xcb_keycode_t code, xcb_mod_mask_t mods) {
	// The first 8 codes are unused for some reason
	code -= 8;
	
	int column = mods&(
		XCB_MOD_MASK_SHIFT|XCB_MOD_MASK_LOCK|XCB_MOD_MASK_CONTROL
	);
	
	if(column > keysym_per) {
		return XK_VoidSymbol;
	}
	else {
		return keysym_table[code*keysym_per + column];
	}
}

event::key::Button keysym2button(xcb_keysym_t sym) {
	using namespace event::key;
	
	switch(sym) {
		case XK_BackSpace: return BACK;
		case XK_Tab: return TAB;
		case XK_Linefeed: return ENTER;
		//Clear
		//Return
		case XK_Pause: return PAUSE;
		//Scroll lock
		//Sys req
		case XK_Escape: return ESC;
		case XK_Delete: return DEL;
		case XK_space: return SPACE;
		
		case XK_Home: return HOME;
		case XK_Left: return LEFT;
		case XK_Up: return UP;
		case XK_Right: return RIGHT;
		case XK_Down: return DOWN;
		//Prior
		case XK_Page_Up: return PAGEUP;
		//Next
		case XK_Page_Down: return PAGEDOWN;
		case XK_End: return END;
		//Begin
		
		/// Type: keypad
		//Space, Tab, Enter
		//F1, F2, F3, F4
		//Home, 
		/*
		case XK_
				SHIFT = 16, CTRL = 17, ALT = 18,
				CAPS = 20,
				INS = 45,
				
				LMETA = 91, RMETA = 92, SELECT = 93,
				NUM0 = 96, NUM1 = 97, NUM2 = 98, NUM3 = 99, NUM4 = 100,
				NUM5 = 101, NUM6 = 102, NUM7 = 103, NUM8 = 104, NUM9 = 105,
				MULTIPLY = 106, ADD = 107, SUBTRACT = 109, DECIMAL = 110,
				DIVIDE = 111,
				
				F1 = 112, F2 = 113, F3 = 114, F4 = 115, F5 = 116,
				F6 = 117, F7 = 118, F8 = 119, F9 = 120, F10 = 121,
				F11 = 122, F12 = 123,
				
				NUMLOCK = 144, SCROLL_LOCK = 145, SEMICOLON = 146,
				EQUAL = 187, COMMA = 188, DASH = 189, PERIOD = 190,
				FORWARD_SLASH = 191, GRAVE = 192, OPEN_BRACKET = 219,
				BACK_SLASH = 220, CLOSE_BRACKET = 221, SINGLE = 222,
				
				A = 'A', B = 'B', C = 'C', D = 'D', E = 'E', F = 'F',
				G = 'G', H = 'H', I = 'I', J = 'J', K = 'K', L = 'L',
				M = 'M', N = 'N', O = 'O', P = 'P', Q = 'Q', R = 'R',
				S = 'S', T = 'T', U = 'U', V = 'V', W = 'W', X = 'X',
				Y = 'Y', Z = 'Z',
				
				N1 = '1', N2 = '2', N3 = '3', N4 = '4', N5 = '5',
				N6 = '6', N7 = '7', N8 = '8', N9 = '9', N0 = '0'
		//case XK_A:
		*/
	}
	
	return event::key::UNKNOWN;
}

/**
 * Look up the value of a key. We want both the code of the
 *  unmodifid button (return) and the key symbol it's modified to
**/
void satori_keymap(
	xcb_keycode_t code, xcb_mod_mask_t mods,
	event::key::Button* button,
	event::key::Button* key
) {
	*button = keysym2button(lookup_keysym(code, (xcb_mod_mask_t)0));
	*key = keysym2button(lookup_keysym(code, mods));
}

