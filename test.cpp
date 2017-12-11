
#include "cpp_magic.h"

// There's a lot of macros here to reduce crazy boilerplate

#define SATORI_PROTO(x) NODE_SET_PROTOTYPE_METHOD(tpl, #x, x)
#define JS_BOOL(x) v8::Boolean::New(isolate, x)
#define JS_INT(x) v8::Integer::New(isolate, x)
#define JS_S(x) v8::String::NewFromUtf8(isolate, x)
#define JS_STR(x) v8::String::NewFromUtf8(isolate, x.c_str())
#define JS_OBJ() v8::Object::New(isolate)

#define JS_SET(k, v) Set(JS_S(#k), v)
#define JS_RETURN(x) args.GetReturnValue().Set(x)

#define SATORI_METHOD(x, body, ...) static void x(const v8::FunctionCallbackInfo<v8::Value>& args) { \
	JSWindow* wrapper = \
		node::ObjectWrap::Unwrap<JSWindow>(args.Holder()); \
	native::Window& self = wrapper->native; \
	body \
}

SATORI_METHOD(pollEvent, {
	v8::Isolate* isolate = args.GetIsolate();
	event::Any aev = {(event::Code::UNKNOWN), 0};
	
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
			
			case event::KEY_PRESS: {
				event::key::Press& ev = aev.key.press;
				
				obj->JS_SET(button, JS_INT(ev.button));
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
			default:
				break;
		}
		
		JS_RETURN(obj);
	}
	
	// Return undefined
})
