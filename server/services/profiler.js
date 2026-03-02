/**
 * Performance profiling utilities
 * Track function execution times and bottlenecks
 */

class Profiler {
  constructor() {
    this.marks = new Map();
    this.measures = [];
    this.profiles = new Map();
  }
  
  /**
   * Start a performance mark
   * @param {string} name - Mark name
   */
  mark(name) {
    this.marks.set(name, process.hrtime.bigint());
  }
  
  /**
   * Measure time between two marks
   * @param {string} name - Measure name
   * @param {string} startMark - Start mark name
   * @param {string} endMark - End mark name (optional)
   * @returns {number} Duration in milliseconds
   */
  measure(name, startMark, endMark = null) {
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : process.hrtime.bigint();
    
    if (!start) {
      console.warn(`⚠️  Mark not found: ${startMark}`);
      return null;
    }
    
    const duration = Number(end - start) / 1_000_000; // milliseconds
    
    const measure = {
      name,
      duration: parseFloat(duration.toFixed(2)),
      timestamp: Date.now(),
    };
    
    this.measures.push(measure);
    
    console.log(`⏱️  ${name}: ${duration.toFixed(2)}ms`);
    
    return duration;
  }
  
  /**
   * Profile an async function
   * Automatically measures execution time
   * @param {string} name - Function name
   * @param {Function} fn - Async function
   * @returns {Function} Wrapped function
   */
  profileAsync(name, fn) {
    return async (...args) => {
      const start = process.hrtime.bigint();
      
      try {
        const result = await fn(...args);
        const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
        
        console.log(`✅ ${name}: ${duration.toFixed(2)}ms`);
        
        this.recordProfile(name, duration, true);
        
        return result;
      } catch (error) {
        const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
        
        console.error(`❌ ${name}: ${duration.toFixed(2)}ms - ${error.message}`);
        
        this.recordProfile(name, duration, false, error.message);
        
        throw error;
      }
    };
  }
  
  /**
   * Profile a synchronous function
   */
  profileSync(name, fn) {
    return (...args) => {
      const start = process.hrtime.bigint();
      
      try {
        const result = fn(...args);
        const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
        
        console.log(`✅ ${name}: ${duration.toFixed(2)}ms`);
        
        this.recordProfile(name, duration, true);
        
        return result;
      } catch (error) {
        const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
        
        console.error(`❌ ${name}: ${duration.toFixed(2)}ms - ${error.message}`);
        
        this.recordProfile(name, duration, false, error.message);
        
        throw error;
      }
    };
  }
  
  /**
   * Record profile data
   */
  recordProfile(name, duration, success, error = null) {
    if (!this.profiles.has(name)) {
      this.profiles.set(name, {
        name,
        calls: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        errors: 0,
        lastError: null,
      });
    }
    
    const profile = this.profiles.get(name);
    profile.calls += 1;
    profile.totalDuration += duration;
    profile.minDuration = Math.min(profile.minDuration, duration);
    profile.maxDuration = Math.max(profile.maxDuration, duration);
    
    if (!success) {
      profile.errors += 1;
      profile.lastError = error;
    }
  }
  
  /**
   * Get profile statistics
   */
  getProfiles() {
    const result = {};
    
    this.profiles.forEach((profile, name) => {
      result[name] = {
        ...profile,
        avgDuration: (profile.totalDuration / profile.calls).toFixed(2),
        errorRate: ((profile.errors / profile.calls) * 100).toFixed(2),
      };
    });
    
    return result;
  }
  
  /**
   * Get profile for specific function
   */
  getProfile(name) {
    const profile = this.profiles.get(name);
    
    if (!profile) {
      return null;
    }
    
    return {
      ...profile,
      avgDuration: (profile.totalDuration / profile.calls).toFixed(2),
      errorRate: ((profile.errors / profile.calls) * 100).toFixed(2),
    };
  }
  
  /**
   * Get slowest functions
   */
  getSlowest(limit = 10) {
    return Array.from(this.profiles.values())
      .map(p => ({
        name: p.name,
        avgDuration: parseFloat((p.totalDuration / p.calls).toFixed(2)),
        maxDuration: p.maxDuration,
        calls: p.calls,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, limit);
  }
  
  /**
   * Get measures summary
   */
  getMeasures() {
    return {
      total: this.measures.length,
      byName: this.measures.reduce((acc, m) => {
        if (!acc[m.name]) {
          acc[m.name] = [];
        }
        acc[m.name].push(m.duration);
        return acc;
      }, {}),
    };
  }
  
  /**
   * Clear all profiling data
   */
  clear() {
    this.marks.clear();
    this.measures = [];
    this.profiles.clear();
  }
  
  /**
   * Clear specific profiler data
   */
  clearProfile(name) {
    this.profiles.delete(name);
  }
}

module.exports = new Profiler();
