#ifndef NODE_SATORI_NATIVE_HPP
#define NODE_SATORI_NATIVE_HPP

#include <utility>
#include <stdexcept>

namespace satori {
	typedef uint font_id_t;
	typedef uint color_id_t;
	typedef uint window_id_t;
	
	// Event handling
	namespace event {
		enum Code {
			UNKNOWN = 0,
			MOUSE_MOVE = 1, MOUSE_WHEEL = 2, MOUSE_PRESS = 3,
			MOUSE_HOVER = 4,
			KEY_PRESS = 5,
			WINDOW_MOVE = 6, WINDOW_RESIZE = 7, WINDOW_FOCUS = 8,
			WINDOW_DRAW = 9, WINDOW_OPEN = 10, WINDOW_CLOSE = 11
		};
		
		struct Input {
			window_id_t root, child;
		};
		
		namespace mouse {
			enum Button {
				UNKNOWN = 0,
				LEFT = 1, MIDDLE = 2, RIGHT = 3
			};
			
			struct Move : public Input {
				int x, y;
				bool dragging;
			};
			
			struct Wheel : public Input {
				int delta;
			};
			
			struct Press : public Input {
				Button button;
				bool state, dragging;
			};
			
			struct Hover : public Input {
				int x, y;
				bool state;
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
			
			struct Press : public Input {
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
			
			struct Draw {
			
			};
			
			struct Open {
			
			};
			
			struct Close {
			
			};
		}
		
		// Combine all the events into one
		struct Any {
			Code code;
			
			union {
				union {
					mouse::Move move;
					mouse::Wheel wheel;
					mouse::Press press;
					mouse::Hover hover;
				} mouse;
				
				union {
					key::Press press;
				} key;
				
				union {
					window::Move move;
					window::Resize resize;
					window::Focus focus;
					window::Draw draw;
					window::Open open;
					window::Close close;
				} window;
			};
		};
	}
	
	namespace display {
		struct Color {
			uint8_t r, g, b, a;
		};
		
		struct Line {
			int x1, y1, x2, y2;
		};
		
		struct Rect {
			int x, y;
			uint w, h;
		};
		
		struct Ellipse {
			int cx, cy;
			uint rx, ry;
		};
		
		struct Point {
			int x, y;
		};
		
		struct Style {
			color_id_t fg, bg;
			uint line_width;
			
			font_id_t font;
			
			/**
			 * TODO:
			 *  Composition function (GX)
			 *  line style
			 *  cap style
			 *  join style
			 *  fill style
			 *  tiling/stipling
			 *  subwindow mode
			 *  clipping
			 *  arc mode
			 *  generate exposure events
			**/
			
			Style(
				color_id_t fg, color_id_t bg,
				uint lw, font_id_t font
			):fg(fg), bg(bg), line_width(lw), font(font) {}
		};
	}
	
	/**
	 * Forward declarations of native interfaces to be implemented
	 *  by the native library.
	**/
	namespace native {
		/*
		struct WMError;
		struct RenderTarget;
		struct Window;
		struct Graphics;
		*/
		
		/**
		// Flush any pending events (may be no-op)
		void global_flush();
		
		struct RenderTarget {
			uint maxColorMappings();
			
			unsigned allocColor(uint r, uint g, uint b, uint a);
			void deallocColors(uint size, uint* ids);
		};
		
		struct Window : public RenderTarget {
			Window();
			~Window();
			
			bool getVisible();
			void setVisible(bool v);
			
			int getPosition();
			void setPosition(int p);
			
			int getSize();
			void setSize(int p);
			
			std::string getTitle();
			void setTitle(const std::string& s);
			
			bool pollEvent(event::Any* ev);
			
			// Alert the native API of a new event to use
			void listenEvent(event::Code code);
		};
		
		// Handle for rendering graphics
		struct GraphicsContext {
			GraphicsContext(target, display::Style)
			
			setStyle(display::Style)
			
			drawPoints(rel, Point...)
			drawLines(rel, Line...)
			drawRects(fill, Rect...)
			drawEllipses(fill, Ellipse...)
			drawPolygons(close, fill, Point...)
			
			drawText(x, y, str...)
		};
		
		uint openFont(const std::string& name);
		
		void closeFont(xcb_font_t font);
		**/
	}
}

#endif

