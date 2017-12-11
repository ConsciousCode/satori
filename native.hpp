#ifndef NODE_SATORI_NATIVE_HPP
#define NODE_SATORI_NATIVE_HPP

#include <utility>

namespace satori {
	// Event handling
	namespace event {
		enum Code {
			UNKNOWN = 0,
			MOUSE_MOVE = 1, MOUSE_WHEEL = 2, MOUSE_PRESS = 3,
			KEY_PRESS = 4,
			WINDOW_MOVE = 5, WINDOW_RESIZE = 6, WINDOW_FOCUS = 7
		};
		
		namespace mouse {
			enum Button {
				LEFT = 0, MIDDLE = 1, RIGHT = 2
			};
			
			struct Move {
				int x, y;
				bool dragging;
			};
			
			struct Wheel {
				int delta;
			};
			
			struct Press {
				Button button;
				bool state, dragging;
			};
		}
		
		namespace key {
			enum Button {
				UNKNOWN = -1,
				
				BACK = '\b', TAB = '\t', ENTER = '\r',
				SHIFT = 16, CTRL = 17, ALT = 18, PAUSE = 19,
				CAPS = 20, ESC = 27, SPACE = ' ',
				PAGEUP = 33, PAGEDOWN = 34,
				END = 35, HOME = 36,
				LEFT = 37, UP = 38, RIGHT = 39, DOWN = 40,
				INS = 45, DEL = 46,
				
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
			};
			
			struct Press {
				Button button, key;
				bool state;
				bool shift, ctrl, alt, meta;
			};
		}
		
		namespace window {
			struct Move {
				int x, y;
			};
			
			struct Resize {
				int w, h;
			};
			
			struct Focus {
				bool state;
			};
		};
		
		// Combine all the events into one
		struct Any {
			Code code;
			
			union {
				union {
					mouse::Move move;
					mouse::Wheel wheel;
					mouse::Press press;
				} mouse;
				
				union {
					key::Press press;
				} key;
				
				union {
					window::Move move;
					window::Resize resize;
					window::Focus focus;
				} window;
			};
		};
	}
	
	/**
	 * Forward declarations of native interfaces to be implemented
	 *  by the native library.
	**/
	namespace native {
		/*
		struct Window;
		struct Graphics;
		*/
		
		/**
		// Flush any pending events (may be no-op)
		void glolba_flush();
			
		struct Window {
			Window();
			~Window();
			
			bool getVisible();
			void setVisible(bool v);
			
			int getPosition();
			void setPosition(int p);
			
			int getSize();
			void setSize(int p);
			
			std::string getTitle();
			void setTitle(std::string s);
			
			bool pollEvent(event::Any* ev);
			
			// Alert the native API of a new event to use
			void listenEvent(event::Code code);
		};
		
		struct Graphics {
		
		};
		**/
	}
}

#endif

