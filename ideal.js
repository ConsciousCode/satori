'use strict';

/**
 * Give an example of what an ideal Satori hello world app would
 *  look like.
**/

const satori = require("./lib/satori");

let win = new satori.Window([
	new satori.Span().setStyle({bg: 'red'}),
	new satori.Span().setStyle({bg: 'green'}),
	new satori.Span().setStyle({bg: 'blue'}),
]);
