/** Browser and Vite load failures, excluding ordinary application exceptions. */
export function isModuleLoadError(error: unknown): boolean {
  return error instanceof Error && /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS for/i.test(error.message)
}
