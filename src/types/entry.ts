export type Entry = {
  id: string;
  text: string;
  created_at: string;
  /** FTS5 highlight placeholder wrap (U+0001 / U+0002) when from search */
  highlighted?: string;
};
