import type { Comic } from "@shared/api";

export function sequenceNumber(comic: Comic): number {
  if (
    typeof comic.partNumber === "number" &&
    Number.isFinite(comic.partNumber)
  ) {
    return comic.partNumber;
  }

  for (const value of [comic.title, comic.partName || ""]) {
    const match = value.match(/\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }

  return Number.MAX_SAFE_INTEGER;
}

export function lectureOrder(a: Comic, b: Comic): number {
  const numberDifference = sequenceNumber(a) - sequenceNumber(b);
  if (numberDifference !== 0) return numberDifference;

  const partDifference =
    (a.partNumber ?? Number.MAX_SAFE_INTEGER) -
    (b.partNumber ?? Number.MAX_SAFE_INTEGER);
  if (partDifference !== 0) return partDifference;

  const createdDifference =
    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  if (createdDifference !== 0) return createdDifference;

  return a.title.localeCompare(b.title, "he", {
    numeric: true,
    sensitivity: "base",
  });
}
