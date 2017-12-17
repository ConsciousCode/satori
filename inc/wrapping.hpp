#include <string>
#include <node.h>
#include <node_object_wrap.h>
#include <stdexcept>

using namespace std;
using namespace v8;
using namespace node;

#define OBJECT() v8::Object::New(isolate)
#define RETURN(x) args.GetReturnValue().Set(JS(x))
#define THIS args.This()

typedef Local<Value> Var;
typedef const FunctionCallbackInfo<Value>& Args;

#ifdef DEBUG
string js_typeof(Var v) {
	if(v->IsUndefined()) {
		return "undefined";
	}
	else if(v->IsNull()) {
		return "null";
	}
	else if(v->IsString()) {
		return "string";
	}
	else if(v->IsObject()) {
		return "object";
	}
	else if(v->IsFunction()) {
		return "function";
	}
	else if(v->IsBoolean()) {
		return "boolean";
	}
	else if(v->IsNumber()) {
		return "number";
	}
	else if(v->IsExternal()) {
		return "<native>";
	}
	else {
		return "<unknown>";
	}
}
#endif

template<typename T>
T cpp(Var v);

template<>
inline bool cpp(Var v) {
	#ifdef DEBUG
		if(!v->IsBoolean()) {
			throw std::logic_error("cpp<bool> got " + js_typeof(v));
		}
	#endif
	return v->BooleanValue();
}

template<>
inline int cpp(Var v) {
	#ifdef DEBUG
		if(!v->IsNumber()) {
			throw std::logic_error("cpp<int> got " + js_typeof(v));
		}
	#endif
	return v->IntegerValue();
}

template<>
inline uint cpp(Var v) {
	#ifdef DEBUG
		if(!v->IsNumber()) {
			throw std::logic_error("cpp<uint> got " + js_typeof(v));
		}
	#endif
	return v->IntegerValue();
}

template<>
inline string cpp(Var v) {
	#ifdef DEBUG
		if(!v->IsString()) {
			throw std::logic_error("cpp<string> got " + js_typeof(v));
		}
	#endif
	return *String::Utf8Value(v->ToString());
}

#define JS(v) js(isolate, v)

inline Local<Boolean> js(Isolate* isolate, bool v) {
	return Boolean::New(isolate, v);
}

inline Local<Integer> js(Isolate* isolate, int v) {
	return Integer::New(isolate, v);
}

inline Local<Integer> js(Isolate* isolate, uint v) {
	return Integer::New(isolate, v);
}

inline Local<String> js(Isolate* isolate, const char* v) {
	return String::NewFromUtf8(isolate, v);
}

inline Local<String> js(Isolate* isolate, const string& v) {
	return String::NewFromUtf8(isolate, v.c_str());
}

template<typename T>
inline Local<T> js(Isolate* isolate, Local<T> v) {
	return v;
}

#define GET(x) Get(JS(x))
#define SET(k, v) Set(JS(k), JS(v))

template<typename T>
inline Local<T> cjs(Local<Value> v);

template<>
inline Local<Object> cjs(Local<Value> v) {
	#ifdef DEBUG
		if(!v->IsObject()) {
			throw std::logic_error("cpp<Object> got " + js_typeof(v));
		}
	#endif
	
	return v->ToObject();
}


