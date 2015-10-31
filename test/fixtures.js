exports.user = [
  {
    id: 1,
    name: 'John Doe',
    camelCaseField: 'Something with a camel case field.',
    birthday: new Date(Date.UTC(1992, 11, 7)),
    spouse: 2,
    ownedPets: [ 1 ],
    friends: [ 3 ]
  },
  {
    id: 2,
    name: 'Jane Doe',
    birthday: new Date(Date.UTC(1997, 6, 30)),
    spouse: 1,
    ownedPets: [ 2, 3 ],
    friends: [ 3 ],
    enemies: [ 3 ]
  },
  {
    id: 3,
    name: 'Microsoft Bob',
    birthday: new Date(Date.UTC(1995, 3, 10)),
    friends: [ 1, 2 ],

    // Hidden denormalized field.
    '__user_enemies_inverse': [ 2 ]
  }
]

exports.animal = [
  {
    id: 1,
    name: 'Fido',
    birthday: new Date(Date.UTC(2012, 12, 25)),
    owner: 1
  },
  {
    id: 2,
    name: 'Cuddles',
    birthday: new Date(Date.UTC(2014, 3, 1)),
    owner: 2
  },
  {
    id: 3,
    name: 'Sniffles',
    birthday: new Date(Date.UTC(2013, 5, 22)),
    owner: 2
  },
  {
    id: '/wtf',
    name: 'WTF',
    birthday: new Date(Date.UTC(2020, 4, 20)),
    type: 'Foobar'
  }
]
