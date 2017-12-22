'use strict';

const TAB = /^(\t*)(\s*\S+.+?)$/gm;
function normalize_indent(x) {
	let mintab = Infinity, m;
	
	TAB.lastIndex = 0;
	while(m = TAB.exec(x)) {
		mintab = Math.min(mintab, m[1].length);
	}
	
	if(Number.isFinite(mintab)) {
		return x.replace(
			new RegExp(`^\t{${mintab}}`, 'gm'), ""
		);
	}
	else {
		return x;
	}
}

function indent(x, ind) {
	return x.replace(/^/gm, '\t'.repeat(ind));
} 

function strip_outer_empty(x) {
	return x.
		replace(/^\s*\n/g, "").
		replace(/\n\s*$/g, "");
}

function cleanup(x) {
	x = normalize(x);
	return x.
		//replace(/\t/gm, '    ').
		// We liberally added semicolons, so remove the excess
		replace(/;[;\s]*;/gm, ';').
		// Condense empty lines
		replace(/^(\s+)\n\s+$/gm, "$1");
}

function normalize(x) {
	return normalize_indent(strip_outer_empty(x));
}

const head = normalize(`
#include <node.h>
#include <node_object_wrap.h>
#include <cstring>
#include <map>

#include "native.cc"

#include "wrapping.hpp"

namespace satori {
`);

const THROWERR = indent(normalize(`
isolate->ThrowException(Exception::Error(JS(error.what())));
`), 2);
const EXCEPTIONS = normalize(`
	catch(std::runtime_error error) {
		${THROWERR}
	}
	catch(std::logic_error error) {
		${THROWERR}
	}
	catch(std::exception error) {
		${THROWERR}
	}
	catch(...) {
		isolate->ThrowException(
			Exception::Error(JS("Unknown error"))
		);
	}
`)

const tail = "}\n";

function makefun(name) {
	return `void ${name}(Args args)`;
}

function method_register(name) {
	return `NODE_SET_PROTOTYPE_METHOD(tpl, "${name}", ${name});`;
}

function method_declare(klass, name, body) {
	return `static ${makefun(name)};`;
}

function method_implement(klass, name, body) {
	return normalize(`
		${makefun(klass + "::" + name)} {
			auto* isolate = args.GetIsolate();
			auto* wrapper = ${klass}::unwrap(args.Holder());
			auto& self = wrapper->native;
			try {
				${'\n' + indent(body, 4)};
			}
			${indent(EXCEPTIONS, 3)}
		}`);
}

class Fun {
	constructor(body) {
		this.body = normalize(body);
	}
	
	generate(name) {
		return [normalize(`
			${makefun("_wrap_" + name)};
		`), normalize(`
			${makefun("_wrap_" + name)} {
				[[maybe_unused]] auto* isolate = args.GetIsolate();
				try {
					${indent(this.body, 5)};
				}
				${indent(EXCEPTIONS, 4)}
			}
			
			void _init_${name}(Local<Object> exports) {
				auto* isolate = exports->GetIsolate();
				auto wrap = FunctionTemplate::New(isolate, _wrap_${name});
				
				exports->SET("${this.name}", wrap->GetFunction());
			}
		`), normalize(`
			_init_${name}(exports);
		`)];
	}
}

class Class {
	constructor(native, methods, stat) {
		this.native = native;
		this.static = stat;
		
		for(let m in methods) {
			methods[m] = normalize(methods[m]);
		}
		
		this.cons = methods['new'] || "";
		delete methods['new'];
		
		if(typeof methods.constructor === 'string') {
			this.cc = methods.constructor;
			delete methods.constructor;
		}
		else {
			this.cc = "";
		}
		
		if(typeof methods.destructor === 'string') {
			this.cd = methods.destructor;
			delete methods.destructor;
		}
		else {
			this.cd = "";
		}
		
		this.methods = methods;
	}
	
	genstatic() {
		let out = [];
		for(let name in this.static) {
			out.push(`static ${this.static[name]} ${name};`);
		}
		return out.join('\n');
	}
	
	endstatic(wrap) {
		let out = [];
		for(let name in this.static) {
			out.push(`${this.static[name]} ${wrap}::${name};`);
		}
		return out.join('\n');
	}
	
	generate(name) {
		return [
		// Declarations
		normalize(`
			struct ${name} : public ObjectWrap {
				static Persistent<Function> constructor;
				
				${indent(this.genstatic(), 4)}
				
				${this.native} native;
				
				static ${name}* unwrap(Var v) {
					return ObjectWrap::Unwrap<${name}>(v->ToObject());
				}
				
				static void init(Local<Object> exports) {
					Isolate* isolate = exports->GetIsolate();
					
					${this.native}::init();
					
					// Constructor
					
					auto tpl = FunctionTemplate::New(isolate, jsnew);
					tpl->SetClassName(JS("${name}"));
					tpl->InstanceTemplate()->SetInternalFieldCount(1);
					
					// Prototype
					
					${(() => {
						let out = [];
						for(let k in this.methods) {
							out.push(method_register(k));
						}
						return out.join('\n' + '\t'.repeat(5));
					})()}
					
					// Export it
					
					constructor.Reset(isolate, tpl->GetFunction());
					exports->SET("${name}", tpl->GetFunction());
				}
				${'\n' + indent(method_declare(name, 'jsnew', this.cons), 4)}
				
				${(() => {
					let out = [];
					for(let k in this.methods) {
						out.push(
							method_declare(name, k, this.methods[k])
						);
					}
					return out.join('\n' + '\t'.repeat(4));
				})()}
				${indent(this.cc, 4)}
				
				~${name}() {
					${indent(this.cd, 5)}
				}
			};
			Persistent<Function> ${name}::constructor;
			${indent(this.endstatic(name), 4)}
		`),
		// Implementations
		normalize(`
			${makefun(name + "::jsnew")} {
				[[maybe_unused]] auto* isolate = args.GetIsolate();
				${'\n' + indent(this.cons, 4)};
			}
			
			${(() => {
				let out = [];
				for(let k in this.methods) {
					out.push(
						method_implement(name, k, this.methods[k])
					);
				}
				return '\n' + out.join('\n\n');
			})()}
		`),
		// Module init
		normalize(`
			${name}::init(exports);
		`)];
	}
}

function generate_str(kv) {
	let decl = [], impl = [], init = [];
	for(let kn in kv) {
		let [dec, imp, ini] = kv[kn].generate(kn);
		decl.push(dec);
		impl.push(imp);
		init.push(ini);
	}
	
	return cleanup([
		// The indents are mismatched so normalize them separately
		head,
		"// Forward declarations", "",
		decl.join('\n\n'),
		"", "// Implementations", "",
		impl.join('\n\n'), "", 
		`
			void init_mod(Local<Object> exports) {
				[[maybe_unused]] auto* isolate = exports->GetIsolate();
				${'\n' + indent(init.join("\n"), 4)};
			}
			NODE_MODULE(satori, init_mod)
		`,
		tail
	].map(normalize).join('\n'));
}

const fs = require("fs");

function generate(x){
	fs.writeFileSync(process.argv[2], generate_str(x));
}

module.exports = {
	Fun, Class, generate
};
