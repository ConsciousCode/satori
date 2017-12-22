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
struct _cpp_return {
	typedef T type;
};

template<>
struct _cpp_return<Object> {
	typedef Handle<Object> type;
};

template<typename T>
using cpp_return = typename _cpp_return<T>::type;

template<typename T>
cpp_return<T> cpp(Var v);

template<>
inline bool cpp<bool>(Var v) {
	#ifdef DEBUG
		if(!v->IsBoolean()) {
			throw std::logic_error("cpp<bool> got " + js_typeof(v));
		}
	#endif
	return v->BooleanValue();
}

template<>
inline int cpp<int>(Var v) {
	#ifdef DEBUG
		if(!v->IsNumber()) {
			throw std::logic_error("cpp<int> got " + js_typeof(v));
		}
	#endif
	return v->IntegerValue();
}

template<>
inline uint cpp<uint>(Var v) {
	#ifdef DEBUG
		if(!v->IsNumber()) {
			throw std::logic_error("cpp<uint> got " + js_typeof(v));
		}
	#endif
	return v->IntegerValue();
}

template<>
inline string cpp<string>(Var v) {
	#ifdef DEBUG
		if(!v->IsString()) {
			throw std::logic_error("cpp<string> got " + js_typeof(v));
		}
	#endif
	return *String::Utf8Value(v->ToString());
}

template<>
inline Local<Object> cpp<Object>(Var v) {
	#ifdef DEBUG
		if(!v->IsObject()) {
			throw std::logic_error("cpp<Object> got " + js_typeof(v));
		}
	#endif
	
	return v->ToObject();
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


