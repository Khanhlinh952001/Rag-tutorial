export class CreateDocumentDto {
  title?: string;
  originalName?: string;
  filePath!: string;
  mimeType!: string;
  fileSize?: number;
  uploadedById?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}
