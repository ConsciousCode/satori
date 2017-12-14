#include <string>
#include <node.h>
#include <node_object_wrap.h>

using namespace std;
using namespace v8;
using namespace node;

#define OBJECT() v8::Object::New(isolate)
#define RETURN(x) args.GetReturnValue().Set(JS(x))
#define THIS args.This()

typedef Local<Value> Var;
typedef const FunctionCallbackInfo<Value>& Args;

template<typename T>
T cpp(Var v);

template<>
inline bool cpp(Var v) {
	return v->BooleanValue();
}

template<>
inline int cpp(Var v) {
	return v->IntegerValue();
}

template<>
inline uint cpp(Var v) {
	return v->IntegerValue();
}

template<>
inline string cpp(Var v) {
	return string((const char*)*v->ToString());
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
