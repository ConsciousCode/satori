'use strict';

class NotImplemented extends Error {
	constructor(self, parent, method) {
		super(
			`${this.__proto__.constructor.name}.${method}` +
			` inherited from ${parent.constructor.name}`
		);
	}
}
NotImplemented.prototype.name = "NotImplemented";

class ViewTreeError extends Error {}
ViewTreeError.prototype.name = "ViewTreeError";

module.exports = {
	NotImplemented, ViewTreeError
};
