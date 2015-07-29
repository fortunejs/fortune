/* RESOURCE ACTION MODULE */

'use strict';

var _ = require('lodash');
var RSVP = require('rsvp');
var Promise = RSVP.Promise;

/**
	Our main Action module. We export this.
*/
var Actions = function(){
	//Our "que" of actions. We store all the stuff here
	this._actions = {};
};

Actions.prototype.registerAction = registerAction;
Actions.prototype.handleAction = handleAction;
Actions.prototype.getAction = getAction;

/**
 * Looks up for registered action on provided resource and returns action metadata
 */
function getAction(resourceName, actionName, method){
	//get all actions for resource
	return this._actions[resourceName] &&
		this._actions[resourceName][actionName];
}

/**
	This method registers a new action

	@param resourceName string The name of the resource to attach the action to
	@param actions object the object of actions containing our callback function to execute

 Actions are defined on resources with objects like
 		actions: {
			action: {
				init: function(options){
					return function(req, res){}
				}
			},

			anotherAction: {
				init: function(options){
					return function(req, res){}
				}
			}
		}
*/
function registerAction(resourceName, actions) {

	var that = this;
	_.each(actions, function(value, key){
		that._actions[resourceName] = that._actions[resourceName] || {};
		that._actions[resourceName][key] = _.extend(value, {
			callback: value.init(value.config)
		});
	});
}

/**
	This method handles our action call. This is what we execute as part of our middleware logic.

	@params params object Contains our resource name, action name, resource ID, raw request object
	@params cb function Our callback function
*/
function handleAction(params, req, res, adapter) {
	/*
		get the resource name
		get the action name
		execute the action callback passing it the request, response and current document
	*/

	var that = this;
	var callback = that._actions[params.resource][params.action].callback;

  return new Promise(function(resolve, reject) {
    if (that._actions[params.resource][params.action].adapter_binding) {
      return adapter[that._actions[params.resource][params.action].adapter_binding](params.resource,
          that._actions[params.resource][params.action])
        .then(function(result) {
          resolve(result);
        })
        .catch(function(err) {
          reject(err);
        });
    }
    resolve(callback.call(params.doc, req, res));
  });
}

module.exports = function(){
	return new Actions();
};