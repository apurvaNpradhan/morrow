/** Fills `{{name}}` placeholders in a copy string; unknown names become empty. */
export function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return values[key] ?? "";
  });
}
