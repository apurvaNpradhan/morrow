type Searchable = {
  title: string;
  number: number;
};

/**
 * Whether a task matches a search: its title contains the text, or the text
 * names its ticket (`MOR-12`, `#12` or `12`).
 */
export function matchesSearch(
  task: Searchable,
  projectKey: string,
  query: string,
) {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  if (task.title.toLowerCase().includes(text)) return true;
  if (text === `${projectKey}-${task.number}`.toLowerCase()) return true;
  const number = /^#?(\d+)$/.exec(text)?.[1];
  return number !== undefined && Number(number) === task.number;
}
