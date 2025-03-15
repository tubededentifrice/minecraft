use super::Chunk;
use minecraft_core::math::{BlockVector, ChunkVector, block_to_chunk};
use minecraft_core::block::Block;
use dashmap::DashMap;
use std::sync::Arc;
use std::collections::HashSet;

/// A collection of chunks with thread-safe access
#[derive(Debug, Clone)]
pub struct ChunkCollection {
    /// The chunks in the collection, keyed by their positions
    chunks: Arc<DashMap<i64, Arc<Chunk>>>,
}

impl ChunkCollection {
    /// Creates a new empty chunk collection
    pub fn new() -> Self {
        Self {
            chunks: Arc::new(DashMap::new()),
        }
    }
    
    /// Gets a chunk at the specified position
    pub fn get_chunk(&self, position: ChunkVector) -> Option<Arc<Chunk>> {
        let key = position.to_key();
        self.chunks.get(&key).map(|chunk| chunk.clone())
    }
    
    /// Gets chunks within the specified radius of the center position
    pub fn get_chunks_in_radius(&self, center: ChunkVector, radius: i32) -> Vec<Arc<Chunk>> {
        let mut result = Vec::new();
        
        for x in (center.x - radius)..=(center.x + radius) {
            for y in (center.y - radius)..=(center.y + radius) {
                for z in (center.z - radius)..=(center.z + radius) {
                    let pos = ChunkVector::new(x, y, z);
                    if let Some(chunk) = self.get_chunk(pos) {
                        result.push(chunk);
                    }
                }
            }
        }
        
        result
    }
    
    /// Inserts a chunk into the collection
    pub fn insert_chunk(&self, chunk: Chunk) {
        let key = chunk.position.to_key();
        let chunk_arc = Arc::new(chunk);
        self.chunks.insert(key, chunk_arc);
    }
    
    /// Removes a chunk from the collection
    pub fn remove_chunk(&self, position: ChunkVector) -> Option<Arc<Chunk>> {
        let key = position.to_key();
        self.chunks.remove(&key).map(|(_, chunk)| chunk)
    }
    
    /// Checks if a chunk exists in the collection
    pub fn contains_chunk(&self, position: ChunkVector) -> bool {
        let key = position.to_key();
        self.chunks.contains_key(&key)
    }
    
    /// Gets the block at the specified world position
    pub fn get_block(&self, position: &BlockVector) -> Option<Block> {
        let chunk_pos = position.to_chunk();
        let chunk = self.get_chunk(chunk_pos)?;
        chunk.get_block_at(position)
    }
    
    /// Gets a list of all chunks in this collection
    pub fn get_all_chunks(&self) -> Vec<Arc<Chunk>> {
        self.chunks.iter().map(|entry| entry.value().clone()).collect()
    }
    
    /// Gets the number of chunks in this collection
    pub fn chunk_count(&self) -> usize {
        self.chunks.len()
    }
    
    /// Gets a list of all chunk positions in this collection
    pub fn get_chunk_positions(&self) -> Vec<ChunkVector> {
        self.chunks
            .iter()
            .map(|entry| entry.value().position)
            .collect()
    }
    
    /// Clears the collection, removing all chunks
    pub fn clear(&self) {
        self.chunks.clear();
    }
    
    /// Returns a set of all dirty chunks that need to be saved
    pub fn get_dirty_chunks(&self) -> HashSet<ChunkVector> {
        self.chunks
            .iter()
            .filter(|entry| entry.value().is_dirty)
            .map(|entry| entry.value().position)
            .collect()
    }
}

impl Default for ChunkCollection {
    fn default() -> Self {
        Self::new()
    }
} 