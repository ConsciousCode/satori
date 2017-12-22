'use strict';

const
	{Fun, Class, generate} = require("./generate");

generate({
	globalFlush: new Fun("native::globalFlush()"),
	openFont: new Fun(
		"RETURN(native::openFont(cpp<string>(args[0])))"
	),
	closeFont: new Fun(
		"native::closeFont(cpp<uint>(args[0]))"
	),
		
	pollEvent: new Fun(`
		event::Any aev;
		memset(&aev, 0, sizeof(aev));
		
		if(native::pollEvent(&aev)) {
			Local<Object> obj = OBJECT();
			
			obj->SET("code", (uint)aev.code);
			obj->SET("target", (uint)aev.target);
			
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
				
				case event::WINDOW_DRAW: 
					/* Nothing to add */
					break;
				
				case event::WINDOW_OPEN:
					/* Nothing to add */
					break;
				case event::WINDOW_CLOSE:
					/* Nothing to add */
					break;
				
				case event::UNKNOWN:
					break;
			}
			
			RETURN(obj);
		}
	`),
	
	NativeFrame: new Class("native::Frame", {
		new: (`
			//IsConstructCall check not included because it's extra
			
			auto* nw = new NativeFrame(
				// parent id
				cpp<uint>(args[0]),
				// x, y
				cpp<int>(args[1]), cpp<int>(args[2]),
				// w, h
				cpp<uint>(args[3]), cpp<uint>(args[4]),
				// border width
				cpp<uint>(args[5]), cpp<uint>(args[6])
			);
			nw->Wrap(THIS);
			
			// We don't really need to set this ahead of time
			//nw->SET("ondestroy", Null());
			
			RETURN(THIS);
		`),
		constructor: (`
			NativeFrame(
				frame_id_t parent,
				int x, int y, uint w, uint h, uint bw, uint bg
			):native(parent, x, y, w, h, bw, bg) {}
		`),
		
		close: "self.close()",
		setBG: "self.setBG(cpp<uint>(args[0]))",
		getID: "RETURN(self.getID())",
		setParent: "self.setParent(cpp<uint>(args[0]))",
		
		getVisible: "RETURN(self.getVisible())",
		setVisible: "self.setVisible(cpp<bool>(args[0]))",
		
		getPosition: "RETURN(self.getPosition())",
		setPosition: "self.setVisible(cpp<uint>(args[0]))",
		
		getSize: "RETURN(self.getSize())",
		setSize: "self.setSize(cpp<uint>(args[0]))",
		
		getTitle: "RETURN(self.getTitle())",
		setTitle: "self.setTitle(cpp<string>(args[0]))",
		
		listenEvent:
			"self.listenEvent((event::Code)cpp<int>(args[0]))",
		
		maxColorMappings: "RETURN(self.maxColorMappings())",
		
		redraw: "self.redraw()",
		
		allocColor: (`
			RETURN(self.allocColor(cpp<uint>(args[0])));
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
			
			auto* ww = NativeFrame::unwrap(args[0]);
			
			auto* jsgc = new NativeGraphicsContext(
				&ww->native, display::Style(
					(color_id_t)cpp<int>(args[1]),
					(color_id_t)cpp<int>(args[2]),
					cpp<int>(args[3]),
					(font_id_t)cpp<int>(args[4])
				)
			);
			jsgc->Wrap(THIS);
			
			RETURN(THIS);
		`),
		
		constructor: (`
			NativeGraphicsContext(
				native::Frame* ww, display::Style style
			):native(ww, style) {}
		`),
		
		setFG: "self.setFG(cpp<uint>(args[0]))",
		setBG: "self.setBG(cpp<uint>(args[0]))",
		setLineWidth: "self.setLineWidth(cpp<uint>(args[0]))",
		setFont: "self.setFont(cpp<uint>(args[0]))",
		
		drawPoints: (`
			std::vector<display::Point> points(args.Length() - 1);
			bool rel = cpp<bool>(args[0]);
			
			for(int i = 1; i < args.Length(); ++i) {
				Local<Object> obj = cpp<Object>(args[i]);
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
				Local<Object> obj = cpp<Object>(args[i]);
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
				Local<Object> obj = cpp<Object>(args[i]);
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
	}, {
	
	})
});
