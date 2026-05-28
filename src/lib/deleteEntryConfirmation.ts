type AskOptions = {
  title?: string;
  kind?: "info" | "warning" | "error";
  okLabel?: string;
};

type AskFn = (message: string, options?: AskOptions) => Promise<boolean>;

export function deleteConfirmSnippet(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "this thought";
  const firstLine = trimmed.split("\n")[0] ?? trimmed;
  const clipped = firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
  return `"${clipped}"`;
}

export async function confirmDeleteThought(
  ask: AskFn,
  text: string
): Promise<boolean> {
  return ask(`Delete ${deleteConfirmSnippet(text)}? This cannot be undone.`, {
    title: "Delete thought",
    kind: "warning",
    okLabel: "Delete",
  });
}
