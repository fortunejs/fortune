import '6to5/polyfill';
import * as Suites from './suites';

for (let Suite in Suites) {
  if (Suite.indexOf('_') !== 0)
    Suites[Suite]();
}
