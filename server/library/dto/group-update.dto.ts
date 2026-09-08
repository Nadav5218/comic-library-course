export class GroupUpdateDto {
  category?: string;
  partName?: string | null;
  action?: "add" | "remove" | string;
}
