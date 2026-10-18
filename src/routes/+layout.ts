/**
 * Root layout options.
 *
 * The application is a client-rendered single-page app: nothing is rendered on
 * the server (`ssr = false`) and no route is prerendered (`prerender = false`),
 * because every view reads live data from the server over the authenticated
 * APIs. adapter-static produces `build/index.html` as the fallback document.
 */
export const ssr = false;
export const prerender = false;
