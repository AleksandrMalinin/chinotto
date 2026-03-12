import type { Entry } from "../../types/entry";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  entry: Entry;
  reason: string;
  onOpen: (entry: Entry) => void;
  onDismiss: () => void;
};

const MAX_PREVIEW = 100;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

export function ResurfacedCard({ entry, reason, onOpen, onDismiss }: Props) {
  return (
    <Card
      className="resurfaced-card mt-10 mb-5 pl-4 py-4"
      role="complementary"
      aria-label="Resurfaced thought"
    >
      <CardHeader>
        <CardTitle className="resurfaced-card-reason">{reason}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="resurfaced-card-text text-[var(--fg-dim)] leading-relaxed whitespace-pre-wrap break-words">
          {truncate(entry.text, MAX_PREVIEW)}
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="link" size="sm" onClick={() => onOpen(entry)}>
          Open
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-[var(--muted)] text-lg"
        >
          ×
        </Button>
      </CardFooter>
    </Card>
  );
}
