/**
 * Batch database operations
 * Optimize bulk inserts, updates, and deletes
 */

class BatchOperations {
  /**
   * Bulk insert records
   * @param {Object} model - Sequelize model
   * @param {Array} records - Records to insert
   * @param {number} batchSize - Records per batch
   * @returns {Promise} Bulk insert result
   */
  static async insertBatch(model, records, batchSize = 1000) {
    if (!records || records.length === 0) {
      return [];
    }
    
    const batches = [];
    
    // Split into batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      batches.push(batch);
    }
    
    console.log(`📦 Inserting ${records.length} records in ${batches.length} batch(es)...`);
    
    const results = [];
    
    // Execute batches
    for (const batch of batches) {
      try {
        const result = await model.bulkCreate(batch, {
          individualHooks: false, // Faster without hooks
          validate: false, // Skip validation for speed
        });
        results.push(...result);
      } catch (error) {
        console.error(`❌ Batch insert failed: ${error.message}`);
        throw error;
      }
    }
    
    console.log(`✅ Successfully inserted ${results.length} records`);
    
    return results;
  }
  
  /**
   * Bulk update records
   * @param {Object} model - Sequelize model
   * @param {Array} updates - Array of { id, data } objects
   * @param {number} batchSize - Records per batch
   * @returns {Promise} Update count
   */
  static async updateBatch(model, updates, batchSize = 1000) {
    if (!updates || updates.length === 0) {
      return 0;
    }
    
    const batches = [];
    
    // Split into batches
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      batches.push(batch);
    }
    
    console.log(`📦 Updating ${updates.length} records in ${batches.length} batch(es)...`);
    
    let totalUpdated = 0;
    
    // Execute batches
    for (const batch of batches) {
      try {
        const updatePromises = batch.map(({ id, data }) =>
          model.update(data, {
            where: { id },
            individualHooks: false,
          })
        );
        
        const results = await Promise.all(updatePromises);
        totalUpdated += results.reduce((sum, result) => sum + (result[0] || 0), 0);
      } catch (error) {
        console.error(`❌ Batch update failed: ${error.message}`);
        throw error;
      }
    }
    
    console.log(`✅ Successfully updated ${totalUpdated} records`);
    
    return totalUpdated;
  }
  
  /**
   * Bulk delete records
   * @param {Object} model - Sequelize model
   * @param {Array} ids - IDs to delete
   * @param {number} batchSize - Records per batch
   * @returns {Promise} Delete count
   */
  static async deleteBatch(model, ids, batchSize = 1000) {
    if (!ids || ids.length === 0) {
      return 0;
    }
    
    const batches = [];
    
    // Split into batches
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      batches.push(batch);
    }
    
    console.log(`📦 Deleting ${ids.length} records in ${batches.length} batch(es)...`);
    
    let totalDeleted = 0;
    
    // Execute batches
    for (const batch of batches) {
      try {
        const deleted = await model.destroy({
          where: { id: batch },
        });
        totalDeleted += deleted;
      } catch (error) {
        console.error(`❌ Batch delete failed: ${error.message}`);
        throw error;
      }
    }
    
    console.log(`✅ Successfully deleted ${totalDeleted} records`);
    
    return totalDeleted;
  }
  
  /**
   * Bulk upsert (insert or update)
   * @param {Object} model - Sequelize model
   * @param {Array} records - Records to upsert
   * @param {Array} uniqueKeys - Fields that identify uniqueness
   * @param {number} batchSize - Records per batch
   * @returns {Promise} Upsert results
   */
  static async upsertBatch(model, records, uniqueKeys, batchSize = 1000) {
    if (!records || records.length === 0) {
      return [];
    }
    
    const batches = [];
    
    // Split into batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      batches.push(batch);
    }
    
    console.log(`📦 Upserting ${records.length} records in ${batches.length} batch(es)...`);
    
    const results = [];
    
    // Execute batches
    for (const batch of batches) {
      try {
        const batchResults = await Promise.all(
          batch.map(record =>
            model.upsert(record, {
              conflictFields: uniqueKeys,
            })
          )
        );
        results.push(...batchResults);
      } catch (error) {
        console.error(`❌ Batch upsert failed: ${error.message}`);
        throw error;
      }
    }
    
    console.log(`✅ Successfully upserted ${results.length} records`);
    
    return results;
  }
  
  /**
   * Transaction with rollback support
   * Wraps multiple batch operations in a transaction
   * @param {Object} sequelize - Sequelize instance
   * @param {Function} callback - Function with batch operations
   * @returns {Promise} Result from callback
   */
  static async withTransaction(sequelize, callback) {
    const transaction = await sequelize.transaction();
    
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      console.error(`❌ Transaction rolled back: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Stream large result set
   * Process records in chunks without loading all into memory
   * @param {Object} model - Sequelize model
   * @param {Function} processor - Function to process each chunk
   * @param {number} chunkSize - Chunk size
   * @param {Object} options - Query options (where, include, etc)
   * @returns {Promise}
   */
  static async streamRecords(model, processor, chunkSize = 1000, options = {}) {
    let offset = 0;
    let processed = 0;
    
    while (true) {
      const records = await model.findAll({
        ...options,
        limit: chunkSize,
        offset,
        raw: true,
      });
      
      if (records.length === 0) {
        break;
      }
      
      // Process chunk
      await processor(records);
      processed += records.length;
      offset += chunkSize;
      
      console.log(`Processed ${processed} records...`);
    }
    
    console.log(`✅ Finished processing ${processed} records`);
    
    return processed;
  }
}

module.exports = BatchOperations;
