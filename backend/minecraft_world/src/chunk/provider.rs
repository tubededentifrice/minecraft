use super::Chunk;
use minecraft_core::math::ChunkVector;
use crate::generator::TerrainGenerator;
use std::sync::Arc;
use std::future::Future;
use anyhow::Result;

/// A trait for providing chunks, whether from generation or loading
pub trait ChunkProvider: Send + Sync {
    /// Checks if a chunk exists at the specified position
    fn chunk_exists(&self, position: ChunkVector) -> bool;
    
    /// Gets a chunk at the specified position, loading or generating it if necessary
    fn get_chunk(&self, position: ChunkVector) -> impl Future<Output = Result<Arc<Chunk>>> + Send;
    
    /// Gets a chunk if it's already loaded, without generating or loading from storage
    fn get_chunk_if_loaded(&self, position: ChunkVector) -> Option<Arc<Chunk>>;
    
    /// Unloads a chunk from memory
    fn unload_chunk(&self, position: ChunkVector) -> bool;
    
    /// Saves a chunk to storage
    fn save_chunk(&self, chunk: &Chunk) -> impl Future<Output = Result<()>> + Send;
    
    /// Forces a chunk to be generated, even if it already exists
    fn force_generate_chunk(&self, position: ChunkVector, generator: &dyn TerrainGenerator) 
        -> impl Future<Output = Result<Arc<Chunk>>> + Send;
}

/// A trait for a chunk provider that can be cloned
pub trait CloneableChunkProvider: ChunkProvider + Clone {}

// Implement CloneableChunkProvider for any T that implements ChunkProvider and Clone
impl<T> CloneableChunkProvider for T where T: ChunkProvider + Clone {}

/// A simple in-memory chunk provider for testing
#[derive(Clone)]
pub struct MemoryChunkProvider {
    chunks: Arc<dashmap::DashMap<i64, Arc<Chunk>>>,
    generator: Arc<dyn TerrainGenerator + Send + Sync>,
}

impl MemoryChunkProvider {
    /// Creates a new memory chunk provider with the specified generator
    pub fn new(generator: impl TerrainGenerator + Send + Sync + 'static) -> Self {
        Self {
            chunks: Arc::new(dashmap::DashMap::new()),
            generator: Arc::new(generator),
        }
    }
}

impl ChunkProvider for MemoryChunkProvider {
    fn chunk_exists(&self, position: ChunkVector) -> bool {
        self.chunks.contains_key(&position.to_key())
    }
    
    async fn get_chunk(&self, position: ChunkVector) -> Result<Arc<Chunk>> {
        let key = position.to_key();
        
        // Try to get an existing chunk
        if let Some(chunk) = self.chunks.get(&key) {
            return Ok(chunk.clone());
        }
        
        // Generate a new chunk
        let chunk = self.generator.generate_chunk(position).await?;
        let chunk_arc = Arc::new(chunk);
        
        // Store it in the map
        self.chunks.insert(key, chunk_arc.clone());
        
        Ok(chunk_arc)
    }
    
    fn get_chunk_if_loaded(&self, position: ChunkVector) -> Option<Arc<Chunk>> {
        let key = position.to_key();
        self.chunks.get(&key).map(|chunk| chunk.clone())
    }
    
    fn unload_chunk(&self, position: ChunkVector) -> bool {
        let key = position.to_key();
        self.chunks.remove(&key).is_some()
    }
    
    async fn save_chunk(&self, _chunk: &Chunk) -> Result<()> {
        // Memory provider doesn't actually save chunks
        Ok(())
    }
    
    async fn force_generate_chunk(&self, position: ChunkVector, generator: &dyn TerrainGenerator) -> Result<Arc<Chunk>> {
        let key = position.to_key();
        
        // Generate a new chunk
        let chunk = generator.generate_chunk(position).await?;
        let chunk_arc = Arc::new(chunk);
        
        // Store it in the map
        self.chunks.insert(key, chunk_arc.clone());
        
        Ok(chunk_arc)
    }
} 