var Joi = require('joi');
var _ = require('lodash');

module.exports = function (schema, options) {

    var abortEarly = (options && options.abortEarly) || false;
    var allowUnknown = (options && options.allowUnknown) || {body: false, headers: true, query: true, params: true};

    return {
        validate: function (request) {

            if (!request) throw new Error('Please provide a request to validate');
            if (!schema) throw new Error('Please provide a validation schema');

            var details = {};

            // for each schema type (body, headers, params, headers) validate the request
            _.each(_.keys(schema), function (schemaType) {
                if ((request[schemaType]) && (schema[schemaType])) {

                    var validationResult = Joi.validate(request[schemaType], schema[schemaType],
                        {allowUnknown: allowUnknown[schemaType], abortEarly: abortEarly});

                    if (validationResult.error) {
                        _.set(details, schemaType, validationResult.error.details);
                    }
                }
            });

            return details;

        }
    };

};



