/**
 * Text chunker - splits documents into overlapping chunks for RAG retrieval.
 */

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 100;

export interface TextChunk {
  text: string;
  index: number;
}

/**
 * Split text into overlapping chunks, respecting paragraph and sentence boundaries.
 */
export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP
): TextChunk[] {
  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  
  // Split into paragraphs first
  const paragraphs = normalized.split(/\n\n+/).filter((p) => p.trim().length > 0);
  
  const chunks: TextChunk[] = [];
  let buffer = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    // If adding this paragraph exceeds chunk size and buffer is not empty, flush
    if (buffer.length + paragraph.length > chunkSize && buffer.length > 0) {
      chunks.push({ text: buffer.trim(), index: chunkIndex++ });
      
      // Calculate overlap: take the last N characters from the buffer
      const overlapText = buffer.slice(-overlap);
      buffer = overlapText + "\n\n" + paragraph;
    } else {
      buffer += (buffer ? "\n\n" : "") + paragraph;
    }
  }

  // Flush remaining buffer
  if (buffer.trim().length > 0) {
    // If the remaining buffer is very long, split it further by sentences
    if (buffer.length > chunkSize * 1.5) {
      const sentenceChunks = splitBySentences(buffer, chunkSize, overlap, chunkIndex);
      chunks.push(...sentenceChunks);
    } else {
      chunks.push({ text: buffer.trim(), index: chunkIndex });
    }
  }

  return chunks;
}

/**
 * Split a long block of text by sentences when paragraph splitting isn't enough.
 */
function splitBySentences(
  text: string,
  chunkSize: number,
  overlap: number,
  startIndex: number
): TextChunk[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: TextChunk[] = [];
  let buffer = "";
  let idx = startIndex;

  for (const sentence of sentences) {
    if (buffer.length + sentence.length > chunkSize && buffer.length > 0) {
      chunks.push({ text: buffer.trim(), index: idx++ });
      const overlapText = buffer.slice(-overlap);
      buffer = overlapText + sentence;
    } else {
      buffer += sentence;
    }
  }

  if (buffer.trim().length > 0) {
    chunks.push({ text: buffer.trim(), index: idx });
  }

  return chunks;
}