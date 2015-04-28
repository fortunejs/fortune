var fortune = require('../lib/fortune');

/**
 * Example application. Uses validate.js compatible constraints
 * to validate resource fields. Constraints can either defined
 * inline or by name, if previously added via addValidator method.
 * Supports POST, PUT and PATCH (replace only) methods.
 */

var app = fortune({
    db: 'fortunevalidation',
  })

  .resource('person', {
    name: {type: String, validation: {  presence: true,
                                        exclusion: {
                                          within: ["John","Peter"],
                                          message: "'%{value}' is not allowed"
                                        } 
                                      }
          },
    age: {type: Number, validation : ['onlyNumbers', 'moreThanZero'] },
    city: {type: String, validation : { presence: true }},
    pets: ['pet']
  })

  .resource('pet', {
    name: {type:String, validation: 'petName'},
    age: {type: Number, validation : ['onlyNumbers', 'moreThanZero', { numericality : { lessThan: 30 } } ] },
    owner: 'person'
  })


  .addValidator('petName', { length: { minimum: 2, maximum: 15 } })
  .addValidator('onlyNumbers', {numericality: true})
  .addValidator('moreThanZero', {numericality : { greaterThan: 0 }})


  .listen(1337);