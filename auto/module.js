'use strict';

const
	{Fun, Class, generate} = require("./generate");

generate({
	globalFlush: new Fun(
		"globalFlush", "native::globalFlush()"
	),
	openFont: new Fun(
		"openFont", "RETURN(native::openFont(cpp<string>(args[0])))"
	),
	closeFont: new Fun(
		"closeFont", "native::closeFont(cpp<uint>(args[0]))"
	),
	NativeWindow: new Class("native::Window", {
		new: (`
			//IsConstructCall check not included because it's extra
			
			auto* nw = new NativeWindow();
			nw->Wrap(THIS);
			RETURN(THIS);
		`),
		
		getVisible: "RETURN(self.getVisible())",
		setVisible: "self.setVisible(cpp<bool>(args[0]))",
		
		getPosition: "RETURN(self.getPosition())",
		setPosition: "self.setVisible(cpp<bool>(args[0]))",
		
		getSize: "RETURN(self.getSize())",
		setSize: "self.setSize(cpp<int>(args[0]))",
		
		getTitle: "RETURN(self.getTitle())",
		setTitle: "self.setTitle(cpp<string>(args[0]))",
		
		pollEvent: (`
			event::Any aev;
			memset(&aev, 0, sizeof(aev));
			
			if(self.pollEvent(&aev)) {
				Local<Object> obj = OBJECT();
				obj->SET("code", (int)aev.code);
				
				switch(aev.code) {
					case event::MOUSE_MOVE: {
						event::mouse::Move& ev = aev.mouse.move;
						
						obj->SET("x", ev.x);
						obj->SET("y", ev.y);
						obj->SET("dragging", ev.dragging);
						break;
					}
					case event::MOUSE_WHEEL: {
						event::mouse::Wheel& ev = aev.mouse.wheel;
						
						obj->SET("delta", ev.delta);
						break;
					}
					case event::MOUSE_PRESS: {
						event::mouse::Press& ev = aev.mouse.press;
						
						obj->SET("button", (int)ev.button);
						obj->SET("state", ev.state);
						obj->SET("dragging", ev.dragging);
						break;
					}
					case event::MOUSE_HOVER: {
						event::mouse::Hover& ev = aev.mouse.hover;
						
						obj->SET("x", ev.x);
						obj->SET("y", ev.y);
						obj->SET("state", ev.state);
						break;
					}
					
					case event::KEY_PRESS: {
						event::key::Press& ev = aev.key.press;
						
						obj->SET("button", (int)ev.button);
						obj->SET("key", (int)ev.key);
						obj->SET("state", ev.state);
						obj->SET("shift", ev.shift);
						obj->SET("ctrl", ev.ctrl);
						obj->SET("alt", ev.alt);
						obj->SET("meta", ev.meta);
						break;
					}
					
					case event::WINDOW_MOVE: {
						event::window::Move ev = aev.window.move;
						
						obj->SET("x", ev.x);
						obj->SET("y", ev.y);
						break;
					}					
					case event::WINDOW_RESIZE: {
						event::window::Resize ev = aev.window.resize;
						
						obj->SET("w", ev.w);
						obj->SET("h", ev.h);
						break;
					}
					case event::WINDOW_FOCUS: {
						event::window::Focus ev = aev.window.focus;
						
						obj->SET("state", ev.state);
						break;
					}
					
					case event::WINDOW_PAINT: 
						/* Nothing to add */
						break;
					
					case event::UNKNOWN:
						break;
				}
				
				RETURN(obj);
			}
		`),
		listenEvent:
			"self.listenEvent((event::Code)cpp<int>(args[0]))",
		
		maxColorMappings:
			"RETURN(self.maxColorMappings())",
		
		allocColor: (`
			RETURN(self.allocColor(
				cpp<uint>(args[0]),
				cpp<uint>(args[1]),
				cpp<uint>(args[2]),
				cpp<uint>(args[3])
			));
		`),
		deallocColors: (`
			std::vector<uint> colors(args.Length());
			
			for(int i = 0; i < args.Length(); ++i) {
				colors[i] = cpp<uint>(args[i]);
			}
			
			self.deallocColors(colors);
		`)
	}),
	
	NativeGraphicsContext: new Class("native::GraphicsContext", {
		new: (`
			//IsConstructCall check not included because it's extra
			
			auto* ww = NativeWindow::unwrap(args[0]);
			
			auto* jsgc = new NativeGraphicsContext(
				&ww->native, display::Style(
					(display::color_id_t)cpp<int>(args[1]),
					(display::color_id_t)cpp<int>(args[2]),
					cpp<int>(args[3]),
					(display::font_id_t)cpp<int>(args[4])
				)
			);
			jsgc->Wrap(THIS);
			
			RETURN(THIS);
		`),
		
		constructor: (`
			NativeGraphicsContext(
				native::Window* ww, display::Style style
			):native(ww, style) {}
		`),
		
		setStyle: (`
			display::Style style(
				cpp<uint>(args[0]), // fg
				cpp<uint>(args[1]), // bg
				cpp<uint>(args[2]), // line_width
				cpp<uint>(args[3])  // font
			);
			
			self.setStyle(style);
		`),
		
		drawPoints: (`
			std::vector<display::Point> points(args.Length() - 1);
			bool rel = cpp<bool>(args[0]);
			
			for(int i = 1; i < args.Length(); ++i) {
				Local<Object> obj = cjs<Object>(args[i]);
				points[i - 1] = display::Point{
					cpp<int>(obj->GET("x")), cpp<int>(obj->GET("y"))
				};
			}
			
			self.drawPoints(rel, points);
		`),
		drawLines: (`
			std::vector<display::Line> lines(args.Length() - 1);
			bool rel = cpp<bool>(args[0]);
			
			for(int i = 1; i < args.Length(); ++i) {
				Local<Object> obj = cjs<Object>(args[i]);
				lines[i - 1] = display::Line{
					cpp<int>(obj->GET("x1")), cpp<int>(obj->GET("y1")),
					cpp<int>(obj->GET("x2")), cpp<int>(obj->GET("y2"))
				};
			}
			
			self.drawLines(rel, lines);
		`),
		drawRects: (`
			std::vector<display::Rect> rects(args.Length() - 1);
			bool fill = cpp<bool>(args[0]);
			
			for(int i = 1; i < args.Length(); ++i) {
				Local<Object> obj = cjs<Object>(args[i]);
				rects[i - 1] = display::Rect{
					cpp<int>(obj->GET("x")), cpp<int>(obj->GET("y")),
					cpp<uint>(obj->GET("w")), cpp<uint>(obj->GET("h"))
				};
			}
			
			self.drawRects(fill, rects);
		`),
		drawText: (`
			int x = cpp<int>(args[0]), y = cpp<int>(args[1]);
			string text = cpp<string>(args[2]);
			
			self.drawText(x, y, text);
		`)
	})
});
