var Joi = require('joi');

var payload = { cats: [ { name: 'Spot', age: 1 } ] }

var schema = {
    name: Joi.string().required(),
    age: Joi.number().required()
}

var validation = Joi.object({})
    .pattern(/.*/,  Joi.array().items(
        Joi.object().keys(schema)
    ));

Joi.validate(payload, validation, function (err, value) {
 console.log('err', err);
 console.log('value', value);
});
