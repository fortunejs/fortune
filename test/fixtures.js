'use strict'

const buffer = Buffer.from ||
  ((input, encoding) => new Buffer(input, encoding))

exports.user = [
  {
    id: 1,
    name: 'John Doe',
    picture: buffer('deadbeef', 'hex'),
    createdAt: new Date(Date.UTC(2016, 3, 29)),
    lastModifiedAt: new Date(Date.UTC(2016, 3, 30)),
    birthday: new Date(Date.UTC(1992, 11, 7)),
    spouse: 2,
    ownedPets: [ 1 ],
    friends: [ 3 ]
  },
  {
    id: 2,
    name: 'Jane Doe',
    picture: buffer('cafebabe', 'hex'),
    createdAt: new Date(Date.UTC(2016, 3, 29)),
    lastModifiedAt: new Date(Date.UTC(2016, 3, 30)),
    birthday: new Date(Date.UTC(1997, 6, 30)),
    spouse: 1,
    likedAnimal: 1,
    ownedPets: [ 2, 3 ],
    friends: [ 3 ],
    enemies: [ 3 ]
  },
  {
    id: 3,
    name: 'Microsoft Bob',
    picture: buffer('babecafe', 'hex'),
    createdAt: new Date(Date.UTC(2016, 3, 29)),
    lastModifiedAt: new Date(Date.UTC(2016, 3, 30)),
    birthday: new Date(Date.UTC(1995, 3, 10)),
    nicknames: [ 'Idiot', 'Genius' ],
    friends: [ 1, 2 ],

    // Hidden denormalized field.
    '__user_enemies_inverse': [ 2 ]
  }
]

exports.animal = [
  {
    id: 1,
    name: 'Babby',
    type: 'Hamster',
    nicknames: [ 'Coroham', 'Coron' ],
    birthday: new Date(Date.UTC(2012, 12, 25)),
    createdAt: new Date(Date.UTC(2016, 3, 29)),
    lastModifiedAt: new Date(Date.UTC(2016, 3, 30)),
    isNeutered: true,
    likedBy: 2,
    owner: 1
  },
  {
    id: 2,
    name: 'Babbette',
    type: 'Hamster',
    birthday: new Date(Date.UTC(2014, 3, 1)),
    createdAt: new Date(Date.UTC(2016, 3, 29)),
    lastModifiedAt: new Date(Date.UTC(2016, 3, 30)),
    isNeutered: false,
    owner: 2
  },
  {
    id: 3,
    name: 'Lappy',
    type: 'Bunny',
    birthday: new Date(Date.UTC(2013, 5, 22)),
    createdAt: new Date(Date.UTC(2016, 3, 29)),
    lastModifiedAt: new Date(Date.UTC(2016, 3, 30)),
    isNeutered: true,
    owner: 2
  },
  {
    id: '/wtf',
    name: 'Kantorin',
    type: 'Bunny',
    birthday: new Date(Date.UTC(2020, 4, 20)),
    createdAt: new Date(Date.UTC(2016, 3, 29)),
    lastModifiedAt: new Date(Date.UTC(2016, 3, 30)),
    isNeutered: false
  }
]
