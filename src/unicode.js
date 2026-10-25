// Match Rust str::chars(): count Unicode scalar values, not UTF-16 code units.
export const characterCount = value => Array.from(String(value)).length;
