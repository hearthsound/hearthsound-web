/**
 * Playwright's global teardown for the end-to-end suite.
 *
 * The suite's server and its temporary directory are owned by
 * `scripts/e2e-server.mjs`, which starts them; this module hands the same
 * process's cleanup to Playwright, which takes a path rather than a function.
 */
export { teardown as default } from './e2e-server.mjs';
