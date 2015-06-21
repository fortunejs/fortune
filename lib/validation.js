var Joi = require('joi');
var _ = require('lodash');
var RSVP = require('rsvp');

var Validation = function() {
	this.abortEarly = false;
	this.toValidate = ['body', 'params', 'query', 'headers'];
	this.allowUnknown = { body: false, headers: true, query: true, params: true };
	this.status = 422;
	this.statusText = 'Unprocessable Entity.';
};

Validation.prototype.validate = function(request, body, query, params, headers) {

    var fullSchema = {
    	body : body,
    	query : query,
    	params : params,
    	headers : headers 
    };

	return this._execute(request, fullSchema);

};

Validation.prototype._execute = function(request, schema) {
	var _this = this;
	this.errors = [];

	return new RSVP.Promise(function (resolve, reject) {

		if (!request) return reject('Please provide a request to validate');
		if (!schema) return reject('Please provide a validation schema');

		_.each(_this.toValidate, function(item) {
			if ((request[item]) && (schema[item])) {
				_this._validate(request[item], schema[item], _this.allowUnknown[item], item);
			}
			return;
		});

	    if (_this.errors && _this.errors.length !== 0) {
			return resolve(_this.errors);
		}

		return resolve();
	});
};

Validation.prototype._validate = function(request, schema, allowUnknown, location) {
	var _this = this;
	
	Joi.validate(request, schema, { allowUnknown : allowUnknown, abortEarly : this.abortEarly }, function(errors, value) {
		if (!errors || errors.details.length === 0) {
		  return;
		}

		_.each(errors.details, function(error) {
			var isError = _.find(_this.errors, function(item) {
		    
			    if (item && item.field === error.path) {
			      item.messages.push(error.message);
			      return item;
			    }

			    return;
		  	});

			if (!isError) {
				_this.errors.push({ field : error.path, location : location, messages : [error.message] });
			}
		});
	});
};

module.exports = new Validation();
