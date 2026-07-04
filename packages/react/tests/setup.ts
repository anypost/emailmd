import { configure } from '@testing-library/react';

// waitFor's own 1s default is too tight for full mjml renders on a cold CI
// runner; give it the same headroom philosophy as testTimeout (but shorter,
// so a genuine hang still reports the waitFor assertion, not a test timeout).
configure({ asyncUtilTimeout: 10_000 });
