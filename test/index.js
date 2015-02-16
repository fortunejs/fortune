import * as Suites from './suites';

for (let suite in Suites) {
  Suites[suite]();
}
