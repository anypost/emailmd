import { configure } from '@testing-library/react';

// waitFor's own 1s default is far too tight here: builder tests run full mjml
// renders in jsdom, and lint adds a minified render that is ~4x slower on
// Node 20's V8 (10s+ on a loaded CI runner). Keep this shorter than
// testTimeout so a genuine hang still reports the waitFor assertion (with its
// DOM dump), not the blunter test timeout.
configure({ asyncUtilTimeout: 30_000 });
