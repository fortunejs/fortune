export default [
  {
    id: 1,
    name: 'John Doe',
    birthday: new Date(1992, 11, 7),
    spouse: 2,
    pets: [ 1 ],
    friends: [ 3 ]
  },
  {
    id: 2,
    name: 'Jane Doe',
    birthday: new Date(1997, 6, 30),
    spouse: 1,
    pets: [ 2, 3 ],
    friends: [ 3 ],
    enemies: [ 3 ]
  },
  {
    id: 3,
    name: 'Microsoft Bob',
    birthday: new Date(1995, 3, 10),
    friends: [ 1, 2 ],

    // Hidden denormalized field.
    '__user_enemies_inverse': [ 2 ]
  }
]
