import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { getDb } from './db.js';
import { getEmbedding, cosineSimilarity } from './embeddingService.js';
import { broadcast } from './sseService.js';

const execAsync = promisify(exec);
const REPOS_DIR = process.env.REPOS_DIR || path.join(process.cwd(), '.repos');

// Supported extensions for embedding
const SUPPORTED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.php', '.html', '.css', '.scss', '.json', '.md', '.yml', '.yaml', '.toml', '.sh'
]);

function getRepoPath(owner, repo) {
  return path.join(REPOS_DIR, `${owner}-${repo}.git`);
}

/**
 * Split text into chunks of roughly maxChunkSize characters, trying to split on newlines
 */
function chunkText(text, maxChunkSize = 1000) {
  const chunks = [];
  let currentChunk = '';
  
  const lines = text.split('\n');
  for (const line of lines) {
    if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
    currentChunk += line + '\n';
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk);
  }
  return chunks;
}

/**
 * Index a repository's codebase into the vector database
 */
export async function indexCodebase(owner, repo) {
  const repoPath = getRepoPath(owner, repo);
  const repoId = `${owner}/${repo}`;
  const db = await getDb();
  
  try {
    console.log(`[RAG] Starting codebase indexing for ${repoId}`);
    broadcast(owner, repo, 'rag_indexing_status', { status: 'started', message: 'Indexing codebase...' });
    
    // 1. Get all files in the HEAD tree
    const { stdout: treeOut } = await execAsync('git ls-tree -r HEAD --name-only', { cwd: repoPath });
    const allFiles = treeOut.split('\n').filter(Boolean);
    
    // 2. Filter for supported source files
    const sourceFiles = allFiles.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return SUPPORTED_EXTENSIONS.has(ext) && !file.includes('node_modules/') && !file.includes('package-lock.json');
    });
    
    console.log(`[RAG] Found ${sourceFiles.length} indexable files for ${repoId}`);
    
    // 3. Clear existing file embeddings for this repo
    await db.run('DELETE FROM file_embeddings WHERE repo_id = ?', repoId);
    
    let processedFiles = 0;
    
    // 4. Process each file
    for (const filepath of sourceFiles) {
      try {
        const { stdout: content } = await execAsync(`git show HEAD:"${filepath}"`, { cwd: repoPath, maxBuffer: 1024 * 1024 * 10 });
        
        // Skip huge files
        if (content.length > 100000) {
          console.log(`[RAG] Skipping large file: ${filepath}`);
          continue;
        }
        
        const chunks = chunkText(content);
        
        for (let i = 0; i < chunks.length; i++) {
          const chunkContent = chunks[i];
          const chunkId = `${repoId}:${filepath}:${i}`;
          
          // Contextualize the chunk for better embedding
          const textToEmbed = `File: ${filepath}\n\n${chunkContent}`;
          const vector = await getEmbedding(textToEmbed);
          
          if (vector) {
            await db.run(
              'INSERT INTO file_embeddings (id, repo_id, filepath, content, vector_json) VALUES (?, ?, ?, ?, ?)',
              chunkId,
              repoId,
              filepath,
              textToEmbed,
              JSON.stringify(vector)
            );
          }
        }
        
        processedFiles++;
        
        if (processedFiles % 10 === 0) {
          broadcast(owner, repo, 'rag_indexing_status', { 
            status: 'progress', 
            progress: Math.round((processedFiles / sourceFiles.length) * 100),
            message: `Indexed ${processedFiles}/${sourceFiles.length} files`
          });
        }
        
      } catch (err) {
        console.warn(`[RAG] Failed to index ${filepath}:`, err.message);
      }
    }
    
    console.log(`[RAG] Finished indexing ${repoId}`);
    broadcast(owner, repo, 'rag_indexing_status', { status: 'completed', message: 'Codebase fully indexed for AI.' });
    
  } catch (error) {
    console.error(`[RAG] Fatal error indexing ${repoId}:`, error.message);
    broadcast(owner, repo, 'rag_indexing_status', { status: 'error', message: 'Failed to index codebase' });
  }
}

/**
 * Search the codebase for relevant file chunks
 */
export async function searchFiles(owner, repo, queryText, k = 3) {
  const db = await getDb();
  const repoId = `${owner}/${repo}`;
  
  const queryVector = await getEmbedding(queryText);
  if (!queryVector) return [];
  
  const rows = await db.all('SELECT filepath, content, vector_json FROM file_embeddings WHERE repo_id = ?', repoId);
  
  const results = [];
  for (const row of rows) {
    const vector = JSON.parse(row.vector_json);
    const similarity = cosineSimilarity(queryVector, vector);
    results.push({
      filepath: row.filepath,
      content: row.content,
      similarity
    });
  }
  
  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, k);
}
