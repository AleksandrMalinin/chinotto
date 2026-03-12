type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchInput({ value, onChange, placeholder = "Search entries…" }: Props) {
  return (
    <input
      type="search"
      className="search-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Search entries"
    />
  );
}
