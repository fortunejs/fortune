/* RESOURCE ACTION MODULE */

'use strict';

var _ = require('underscore');

/**
	Our "que" of actions. We store all the stuff here
*/
var resourceActions = {};

/**
	Our main Action module. We export this.
*/
var ActionModule = {
		registerAction: registerAction,
		handleAction: handleAction,
		_actions: resourceActions
};

// HERE BE FUNCTIONS

/**
	This method registers a new action

	@param resourceName string The name of the resource to attach the action to
	@param actions object the object of actions containing our callback function to execute
*/
function registerAction(resourceName, actions) {
	/*
		actions: {
			action: {
				callback: function(req){}
			},
			anotherAction: {
				callback: function(req){}
			}
		}
	*/

	_.each(actions, function(value, key){
		resourceActions[resourceName] = {};
		resourceActions[resourceName][key] = value.callback;
	});
}

/**
	This method handles our action call. This is what we execute as part of our middleware logic.

	@params params object Contains our resource name, action name, resource ID, raw request object
	@params cb function Our callback function
*/
function handleAction(params, cb) {
	/*
		get the resource name
		get the action name
		execute the action callback passing it the request
	*/

		resourceActions[params.resource][params.action]({
			id: params.id,
			req: params.req
		}, cb);
}

module.exports = ActionModule;