/**
 * The web app manifest, carrying the approved installed-app icons (spec
 * identity 3.3, E3): the 192 and 512 px light app-icon exports. It is
 * prerendered into the static build so the server answers it like any asset.
 */
import icon192 from '@hearthsound/design/identity/icons/app-icon-light-192.png?url';
import icon512 from '@hearthsound/design/identity/icons/app-icon-light-512.png?url';

export const prerender = true;

/**
 * Answers the manifest.
 *
 * @returns The manifest as `application/manifest+json`.
 */
export function GET(): Response {
  const manifest = {
    name: 'Hearthsound',
    icons: [
      { src: icon192, sizes: '192x192', type: 'image/png' },
      { src: icon512, sizes: '512x512', type: 'image/png' }
    ]
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'content-type': 'application/manifest+json' }
  });
}
