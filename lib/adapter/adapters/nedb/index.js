import stderr from '../../../common/stderr';
import Store from 'nedb';


export default Adapter => class nedbAdapter extends Adapter {

  initialize () {
    this.db = Object.keys(this.schemas).reduce((db, type) => {
      db[type] = new Store((this.options || {})[type]);
      return db;
    }, {});

    return Promise.all(Object.keys(this.db).map(type =>
      new Promise((resolve, reject) =>
        this.db[type].loadDatabase(error => error ? reject(error) : resolve())
    )));
  }


  find (type) {
    stderr.info('Find', ...arguments);
    let types = {
      user: [
        {[this.primaryKey]: 4, pets: [1, 2, 3]}
      ],
      animal: [
        {[this.primaryKey]: 3, owner: 4}
      ]
    };
    return Promise.resolve(types[type] || []);
  }


  create (type, records) {
    return new Promise((resolve, reject) =>
      this.db[type].insert(records.map(inputRecord.bind(this, type)),
        (error, createdRecords) => error ? reject(error) :
        resolve(createdRecords.map(outputRecord.bind(this, type)))
      ));
  }


  update () {
    stderr.info('Update', ...arguments);
    return super.update(...arguments);
  }

}


function inputRecord (type, record) {

  // ID business.
  let id = record[this.primaryKey];
  delete record[this.primaryKey];
  if (id) record._id = id;

  // Non-native types.
  for (let key in record) {
    if (this.schemas[type].hasOwnProperty(key)) {
      let valueType = this.schemas[type][key].type;

      // NeDB lacks native support for buffer types.
      if (valueType === Buffer)
        record[key] = record[key].toString();
    }
  }

  return record;
}


function outputRecord (type, record) {

  // ID business.
  let id = record._id;
  delete record._id;
  record[this.primaryKey] = id;

  // Non-native types.
  for (let key in record) {
    if (this.schemas[type].hasOwnProperty(key)) {
      let valueType = this.schemas[type][key].type;

      // NeDB lacks native support for buffer types.
      if (valueType === Buffer)
        record[key] = new Buffer(record[key]);
    }
  }

  return record;
}
