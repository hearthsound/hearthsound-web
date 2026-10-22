/**
 * The configuration objects the server's request bodies carry.
 *
 * The generated types of `hostConfig`, `serverConfig` and a settings batch are
 * empty objects, because the server's document describes those `Value` fields
 * without their contents. The forms edit what the fields hold, and this is
 * where that document turns back into the body the server expects.
 */

/**
 * Presents one configuration object as a request body field.
 *
 * @param value The object to send.
 * @returns The value as the request type names it.
 */
export function configObject(value: unknown): Record<string, never> {
  return value as Record<string, never>;
}
