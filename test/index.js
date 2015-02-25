import * as Unit from './unit';
import * as Integration from './integration';

[Unit, Integration].forEach(suites => {
  for (let suite in suites) {
    suites[suite]();
  }
});
