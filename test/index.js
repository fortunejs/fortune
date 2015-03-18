import * as Unit from './unit';
import * as Integration from './integration';

const tests = { Unit, Integration };

for (let test in tests)
  for (let suite in tests[test])
    tests[test][suite]();
