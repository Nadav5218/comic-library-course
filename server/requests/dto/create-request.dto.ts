export class CreateRequestDto {
  title?: string;
  author?: string;
  year?: string | number;
  category?: string;
  description?: string;
  partNumber?: string | number | null;
  partName?: string | null;
}
