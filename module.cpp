#include <node.h>
#include <node_object_wrap.h>
#include <cstring>

#include "native.cpp"

// Don't use using to ensure the namespaces are all crystal clear
// using namespace v8;
// using namespace node;

// There's a lot of macros here to reduce crazy boilerplate

#define SATORI_PROTO(x) NODE_SET_PROTOTYPE_METHOD(tpl, #x, x)
#define JS_BOOL(x) v8::Boolean::New(isolate, x)
#define JS_INT(x) v8::Integer::New(isolate, x)
#define JS_S(x) v8::String::NewFromUtf8(isolate, x)
#define JS_STR(x) v8::String::NewFromUtf8(isolate, x.c_str())
#define JS_OBJ() v8::Object::New(isolate)

#define JS_SET(k, v) Set(JS_S(#k), v)
#define JS_RETURN(x) args.GetReturnValue().Set(x)

#define SATORI_METHOD(x, body) static void x(const v8::FunctionCallbackInfo<v8::Value>& args) { \
	JSWindow* wrapper = \
		node::ObjectWrap::Unwrap<JSWindow>(args.Holder()); \
	native::Window& self = wrapper->native; \
	body \
}

namespace satori {
	struct JSWindow : public node::ObjectWrap {
		static v8::Persistent<v8::Function> constructor;
		
		native::Window native;
		
		static void init(v8::Local<v8::Object> exports) {
			native::Window::Init();
			
			v8::Isolate* isolate = exports->GetIsolate();
			
			// Constructor
			
			v8::Local<v8::FunctionTemplate> tpl =
				v8::FunctionTemplate::New(isolate, jsnew);
			
			tpl->SetClassName(JS_S("NativeWindow"));
			
			// Prototype
			
			SATORI_PROTO(getVisible);
			SATORI_PROTO(setVisible);
			
			SATORI_PROTO(getPosition);
			SATORI_PROTO(setPosition);
			
			SATORI_PROTO(getSize);
			SATORI_PROTO(setSize);
			
			SATORI_PROTO(getTitle);
			SATORI_PROTO(setTitle);
			
			SATORI_PROTO(pollEvent);
			
			SATORI_PROTO(listenEvent);
			
			// Export it
			
			constructor.Reset(isolate, tpl->GetFunction());
			exports->JS_SET(NativeWindow, tpl->GetFunction());
		}
		
		static void jsnew(const v8::FunctionCallbackInfo<v8::Value>& args) {
			//IsConstructCall check not included because it's extra
			
			JSWindow* jsw = new JSWindow();
			jsw->Wrap(args.This());
			
			JS_RETURN(args.This());
		}
		
		SATORI_METHOD(getVisible, {
			v8::Isolate* isolate = args.GetIsolate();
			args.GetReturnValue().Set(
				JS_BOOL(self.getVisible())
			);
		})
		SATORI_METHOD(setVisible, {
			self.setVisible(args[0]->BooleanValue());
		})
		
		SATORI_METHOD(getPosition, {
			v8::Isolate* isolate = args.GetIsolate();
			args.GetReturnValue().Set(
				JS_INT(self.getPosition())
			);
		})
		SATORI_METHOD(setPosition, {
			self.setVisible(args[0]->IntegerValue());
		})
		
		SATORI_METHOD(getSize, {
			v8::Isolate* isolate = args.GetIsolate();
			args.GetReturnValue().Set(
				JS_INT(self.getSize())
			);
		})
		SATORI_METHOD(setSize, {
			self.setSize(args[0]->IntegerValue());
		})
		
		SATORI_METHOD(getTitle, {
			v8::Isolate* isolate = args.GetIsolate();
			args.GetReturnValue().Set(
				JS_STR(self.getTitle())
			);
		})
		SATORI_METHOD(setTitle, {
			self.setTitle(std::string((const char*)*args[0]->ToString()));
		})
		
		SATORI_METHOD(pollEvent, {
			v8::Isolate* isolate = args.GetIsolate();
			event::Any aev;
			memset(&aev, 0, sizeof(aev));
			
			if(self.pollEvent(&aev)) {
				v8::Local<v8::Object> obj = JS_OBJ();
				obj->JS_SET(code, JS_INT(aev.code));
				
				switch(aev.code) {
					case event::MOUSE_MOVE: {
						event::mouse::Move& ev = aev.mouse.move;
						
						obj->JS_SET(x, JS_INT(ev.x));
						obj->JS_SET(y, JS_INT(ev.y));
						obj->JS_SET(dragging, JS_BOOL(ev.dragging));
						break;
					}
					case event::MOUSE_WHEEL: {
						event::mouse::Wheel& ev = aev.mouse.wheel;
						
						obj->JS_SET(delta, JS_INT(ev.delta));
						break;
					}
					case event::MOUSE_PRESS: {
						event::mouse::Press& ev = aev.mouse.press;
						
						obj->JS_SET(button, JS_INT(ev.button));
						obj->JS_SET(state, JS_BOOL(ev.state));
						obj->JS_SET(dragging, JS_BOOL(ev.dragging));
						break;
					}
					case event::MOUSE_HOVER: {
						event::mouse::Hover& ev = aev.mouse.hover;
						
						obj->JS_SET(x, JS_INT(ev.x));
						obj->JS_SET(y, JS_INT(ev.y));
						obj->JS_SET(state, JS_BOOL(ev.state));
						break;
					}
					
					case event::KEY_PRESS: {
						event::key::Press& ev = aev.key.press;
						
						obj->JS_SET(button, JS_INT(ev.button));
						obj->JS_SET(key, JS_INT(ev.key));
						obj->JS_SET(state, JS_BOOL(ev.state));
						obj->JS_SET(shift, JS_BOOL(ev.shift));
						obj->JS_SET(ctrl, JS_BOOL(ev.ctrl));
						obj->JS_SET(alt, JS_BOOL(ev.alt));
						obj->JS_SET(meta, JS_BOOL(ev.meta));
						break;
					}
					
					case event::WINDOW_MOVE: {
						event::window::Move ev = aev.window.move;
						
						obj->JS_SET(x, JS_INT(ev.x));
						obj->JS_SET(y, JS_INT(ev.y));
						break;
					}					
					case event::WINDOW_RESIZE: {
						event::window::Resize ev = aev.window.resize;
						
						obj->JS_SET(w, JS_INT(ev.w));
						obj->JS_SET(h, JS_INT(ev.h));
						break;
					}
					case event::WINDOW_FOCUS: {
						event::window::Focus ev = aev.window.focus;
						
						obj->JS_SET(state, JS_BOOL(ev.state));
						break;
					}
					
					case event::UNKNOWN:
						break;
				}
				
				JS_RETURN(obj);
			}
			
			// Return undefined
		})
		
		SATORI_METHOD(listenEvent, {
			self.listenEvent((event::Code)args[0]->IntegerValue());
		})
	};
	v8::Persistent<v8::Function> JSWindow::constructor;
	
	void wrap_global_flush(const v8::FunctionCallbackInfo<v8::Value>& args) {
		global_flush();
	}
	
	void init_global(v8::Local<v8::Object> exports) {
		v8::Isolate* isolate = exports->GetIsolate();
		v8::Local<v8::FunctionTemplate> wgf = v8::FunctionTemplate::New(isolate, wrap_global_flush);
		
		exports->JS_SET(flush, wgf->GetFunction());
	}
	
	void init(v8::Local<v8::Object> exports) {
		init_global(exports);
		JSWindow::init(exports);
	}
	
	NODE_MODULE(satori, init)
}
