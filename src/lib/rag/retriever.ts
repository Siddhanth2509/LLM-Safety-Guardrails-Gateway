/**
 * TF-IDF based retriever for finding relevant chunks.
 * Uses a simple but effective keyword-based approach with term frequency scoring.
 */

export interface RetrievedChunk {
  id: string;
  text: string;
  documentId: string;
  score: number;
  chunkIndex: number;
}

interface DocumentFrequency {
  [term: string]: number; // number of docs containing this term
}

interface TermFrequency {
  [term: string]: number; // count of this term in a chunk
}

/**
 * Tokenize text into lowercase terms, removing common stop words and punctuation.
 */
function tokenize(text: string): string[] {
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "shall",
    "should", "may", "might", "can", "could", "must", "need", "dare",
    "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
    "from", "as", "into", "through", "during", "before", "after", "above",
    "below", "between", "out", "off", "over", "under", "again", "further",
    "then", "once", "here", "there", "when", "where", "why", "how", "all",
    "each", "every", "both", "few", "more", "most", "other", "some", "such",
    "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "just", "because", "but", "and", "or", "if", "while", "about", "up",
    "it", "its", "this", "that", "these", "those", "i", "me", "my", "we",
    "our", "you", "your", "he", "him", "his", "she", "her", "they", "them",
    "their", "what", "which", "who", "whom",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 1 && !stopWords.has(term));
}

/**
 * Compute TF-IDF scores for a query against all chunks.
 */
export function retrieve(
  query: string,
  chunks: { id: string; text: string; documentId: string; chunkIndex: number }[],
  topK: number = 5
): RetrievedChunk[] {
  if (chunks.length === 0) return [];

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  // Build document frequency map
  const df: DocumentFrequency = {};
  for (const chunk of chunks) {
    const terms = new Set(tokenize(chunk.text));
    for (const term of terms) {
      df[term] = (df[term] || 0) + 1;
    }
  }

  const totalDocs = chunks.length;

  // Score each chunk
  const scored = chunks.map((chunk) => {
    const chunkTerms = tokenize(chunk.text);
    const tf: TermFrequency = {};
    for (const term of chunkTerms) {
      tf[term] = (tf[term] || 0) + 1;
    }

    let score = 0;
    for (const qTerm of queryTerms) {
      const termFreq = tf[qTerm] || 0;
      const docFreq = df[qTerm] || 0;
      // TF-IDF: term frequency * inverse document frequency
      const idf = Math.log((totalDocs + 1) / (docFreq + 1)) + 1;
      score += (1 + Math.log(termFreq + 1)) * idf;
    }

    // Normalize by chunk length to avoid bias toward longer chunks
    score = score / (1 + Math.log(chunk.text.length));

    return {
      id: chunk.id,
      text: chunk.text,
      documentId: chunk.documentId,
      score,
      chunkIndex: chunk.chunkIndex,
    };
  });

  // Sort by score descending and return top K
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}