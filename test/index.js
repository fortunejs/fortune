import * as Suites from './suites';

for (let Suite in Suites) {
  if (Suite.indexOf('_') !== 0)
    Suites[Suite]();
}
