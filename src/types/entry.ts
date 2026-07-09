export type Entry = {
  id: string;
  text: string;
  created_at: string;
  /** ISO 8601 UTC; last text edit */
  updated_at?: string;
  /** UTF-16 offset where a later continuation starts */
  continuation_from?: number;
  /** ISO 8601 UTC; when continuation was first marked */
  continuation_at?: string;
  /** FTS5 highlight placeholder wrap (U+0001 / U+0002) when from search */
  highlighted?: string;
  /** Micro topics extracted from the entry (keyword-based) */
  topics?: string[];
  /** `spaces.id`; absent or unset means Inbox */
  space_id?: string;
  /** Shared keywords with the current thought (thought trail neighbors only). */
  trail_shared?: string[];
};
