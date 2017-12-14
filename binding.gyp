{
	"variables": {
		"conditions": [
			['OS == "linux"', {
				"xclient": "xcb" # Or xlib
			}]
		]
	},
	
	"target_defaults": {
		"default_configuration": "Debug",
		"configurations": {
			"Debug": {
				"defines": ["DEBUG", "_DEBUG"],
				"cflags": [
					"-g", "-O0",
					"-Wpedantic", "-Werror",
					"-fmax-errors=1"
				],
				"cflags_cc!": ["-fno-rtti"]
			},
			"Release": {
				"cflags": ["-Ofast"]
			}
		},
		
		"conditions": [
			['OS == "linux"', {
				"defines": ["LINUX"],
				
				"conditions": [
					['xclient == "xcb"', {
						"libraries": ["-lxcb"]
					}],
					['xclient == "xlib"', {
						"libraries": ["-lX11"]
					}]
				]
			}],
			['OS == "win"', {
				"defines": ["WINDOWS"]
			}]
		]
	},
		
	"targets": [{
		"target_name": "addon",
		
		"sources": [
			"<(INTERMEDIATE_DIR)/module.cpp"
		],
		"cflags": [
			"-std=c++11", "-I../src", "-I../inc"
		],
		
		"include_dirs": [
			"../src", "../inc"
		],
		
		"actions": [{
			"action_name": "gen-module.cpp",
			"inputs": [
				"auto/module.js"
			],
			"outputs": [
				"<(INTERMEDIATE_DIR)/module.cpp"
			],
			"action": [
				"node", "<@(_inputs)", "<@(_outputs)"
			],
			"message": "Generating bindings"
		}]
	}]
}
