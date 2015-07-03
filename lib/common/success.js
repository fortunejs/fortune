// Succcessful responses are successful.

export class OK {
  constructor () { setup.apply(this, arguments) }
}

export class Created {
  constructor () { setup.apply(this, arguments) }
}

export class Empty {
  constructor () { setup.apply(this, arguments) }
}

function setup (response) {
  Object.assign(this, response)
}
