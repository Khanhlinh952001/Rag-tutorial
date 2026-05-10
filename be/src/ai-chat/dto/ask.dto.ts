export class AskDto {
  question!: string;
  conversationId?: string;
  topK?: number;
  documentId?: string;
  scoreThreshold?: number;
}
