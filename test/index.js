import * as Unit from './unit';
import * as Integration from './integration';

const tests = { Unit, Integration };

Object.keys(tests).forEach(test => {
  test = tests[test];
  for (let suite in test) {
    test[suite]();
  }
});
