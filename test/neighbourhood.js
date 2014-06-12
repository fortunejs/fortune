var RSVP = require('rsvp');

module.exports = function(adapter, ids){
    //Housing
  return adapter.update('house', ids.houses[0], {owners: [ids.people[0]]})
    .then(function(){
      return adapter.update('house', ids.houses[1], {owners: [ids.people[1]]});
    })
    .then(function(){
      return adapter.update('house', ids.houses[2], {owners: [ids.people[2]]});
    })
    .then(function(){
      return adapter.update('house', ids.houses[3], {owners: [ids.people[3]]});
    })

  //Lovers and haters
    .then(function(){
      return adapter.update('person', ids.people[0], {soulmate: ids.people[1]});
    })
    .then(function(){
      return adapter.update('person', ids.people[3], {soulmate: ids.people[2]});
    })
    .then(function(){
      return adapter.update('person', ids.people[0], {lovers: [ids.people[1], ids.people[2], ids.people[3]]});
    })

  //Pets
    .then(function(){
      return adapter.update('pet', ids.pets[0], {owner: ids.people[1]});
    })
    .then(function(){
      return adapter.update('pet', ids.pets[1], {owner: ids.people[3]});
    })

  //Cars
    .then(function(){
      return adapter.update('car', ids.cars[0], {owner: ids.people[0]});
    })
    .then(function(){
      return adapter.update('car', ids.cars[1], {owner: ids.people[1]});
    });
};

/* This fails to reference docs properly
module.exports = function(adapter, ids){
  return RSVP.all([
    //Housing
    adapter.update('house', ids.houses[0], {owners: [ids.people[0]]}),
    adapter.update('house', ids.houses[1], {owners: [ids.people[1]]}),
    adapter.update('house', ids.houses[2], {owners: [ids.people[2]]}),

    //Lovers and haters
    adapter.update('person', ids.people[0], {soulmate: ids.people[1]}),
    adapter.update('person', ids.people[2], {lovers: [ids.people[0]]}),
    adapter.update('person', ids.people[1], {lovers: [ids.people[2]]}),

    //Pets
    adapter.update('pet', ids.pets[0], {owner: ids.people[0]}),
    adapter.update('pet', ids.pets[1], {owner: ids.people[2]}),

    //Cars
    adapter.update('car', ids.cars[0], {owner: ids.people[0]}),
    adapter.update('car', ids.cars[1], {owner: ids.people[1]})
  ]);
};
*/
