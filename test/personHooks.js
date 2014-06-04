
function Hook(hookConfig, fortuneConfig){
  return function(req, res){
    res.setHeader(hookConfig.header, hookConfig.value);
    return this;
  }
}

module.exports = {
  readFirst: {
    name: 'readFirst',
    config: {
      header: 'defaultReadFirst',
      value: 'one'
    },
    init: Hook
  },
  readSecond: {
    name: 'readSecond',
    config: {
      header: 'defaultReadSecond',
      value: 'two'
    },
    init: Hook
  },
  beforeWrite: {
    name: 'beforeWrite',
    config: {
      header: 'beforeWrite',
      value: 'ok'
    },
    init: Hook
  },
  afterRead: {
    name: 'afterRead',
    config: {
      header: 'afterRead',
      value: 'ok'
    },
    init: Hook
  },
  afterWrite: {
    name: 'afterWrite',
    config: {
      header: 'afterWritePerson',
      value: 'ok'
    },
    init: Hook
  }
};
