import { getDb } from './db.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'mxbai-embed-large'; // default good embedding model

/**
 * Call Ollama to get vector embedding for text
 */
export async function getEmbedding(text) {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text
      })
    });
    
    if (!res.ok) {
      throw new Error(`Ollama embedding failed: ${res.statusText}`);
    }
    
    const data = await res.json();
    return data.embedding; // array of floats
  } catch (err) {
    console.error('[EmbeddingService] Error:', err.message);
    return null;
  }
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Save a commit embedding to the database
 */
export async function saveCommitEmbedding(owner, repo, commitId, commitData) {
  const db = await getDb();
  
  // Combine useful data into a single text block
  const text = `Commit: ${commitId}
Author: ${commitData.author}
Message: ${commitData.message}
Branch: ${commitData.branch}
Area: ${commitData.primaryArea}
Before: ${commitData.before}
Added: ${commitData.added}
Impact: ${commitData.impact}`;

  const vector = await getEmbedding(text);
  if (!vector) return;
  
  const repoId = `${owner}/${repo}`;
  await db.run(
    'INSERT OR REPLACE INTO embeddings (id, repo_id, text, vector_json) VALUES (?, ?, ?, ?)',
    commitId,
    repoId,
    text,
    JSON.stringify(vector)
  );
}

/**
 * Find top K most relevant commits for a query
 */
export async function searchCommits(owner, repo, queryText, k = 5) {
  const db = await getDb();
  const repoId = `${owner}/${repo}`;
  
  const queryVector = await getEmbedding(queryText);
  if (!queryVector) return [];
  
  const rows = await db.all('SELECT id, text, vector_json FROM embeddings WHERE repo_id = ?', repoId);
  
  const results = [];
  for (const row of rows) {
    const vector = JSON.parse(row.vector_json);
    const similarity = cosineSimilarity(queryVector, vector);
    results.push({
      commitId: row.id,
      text: row.text,
      similarity
    });
  }
  
  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, k);
}
