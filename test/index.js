import * as Suites from './suites';

for (let suite in Suites) {
  if (typeof Suites[suite] === 'function')
    Suites[suite]();
}
