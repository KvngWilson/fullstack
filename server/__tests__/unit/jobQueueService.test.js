/**
 * JobQueueService Unit Tests
 * 
 * Tests job queue operations:
 * - Enqueueing jobs
 * - Processing jobs with handlers
 * - Retry logic with exponential backoff
 * - Dead-letter queue (DLQ) for permanent failures
 * - Job status tracking
 */

const JobQueueService = require('../../infrastructure/jobs/JobQueueService');

describe('JobQueueService', () => {
  let service;
  let mockRedis;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      hset: jest.fn().mockResolvedValue(1),
      hget: jest.fn(),
      zadd: jest.fn().mockResolvedValue(1),
      zrangebyscore: jest.fn(),
      zrem: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      lpush: jest.fn().mockResolvedValue(1),
      lrange: jest.fn(),
      lrem: jest.fn().mockResolvedValue(1),
    };

    service = new JobQueueService(mockRedis, {
      maxRetries: 3,
      baseDelayMs: 100,
      backoffMultiplier: 2,
    });
  });

  describe('Enqueueing jobs', () => {
    it('enqueues job successfully', async () => {
      const jobId = await service.enqueueJob(
        'test:job',
        { data: 'test' },
        { vendorId: 1 }
      );

      expect(jobId).toMatch(/^job:/);
      expect(mockRedis.hset).toHaveBeenCalled();
      expect(mockRedis.zadd).toHaveBeenCalled();
    });

    it('stores job data in Redis', async () => {
      const jobData = { orderId: 123, action: 'create_shipment' };

      await service.enqueueJob('shipment:create', jobData, { vendorId: 1 });

      const hsetCalls = mockRedis.hset.mock.calls;
      const payloadCall = hsetCalls.find((call) => call[1] === 'payload');
      const payload = JSON.parse(payloadCall[2]);

      expect(payload.data).toEqual(jobData);
      expect(payload.status).toBe('pending');
      expect(payload.retryCount).toBe(0);
    });

    it('handles job delay', async () => {
      const delayMs = 5000;

      await service.enqueueJob('test:job', { data: 'test' }, {
        vendorId: 1,
        delayMs,
      });

      const zaddCall = mockRedis.zadd.mock.calls[0];
      const scheduledTime = zaddCall[1];

      // Scheduled time should be approximately now + delayMs
      expect(scheduledTime).toBeGreaterThanOrEqual(Date.now() + delayMs - 100);
      expect(scheduledTime).toBeLessThanOrEqual(Date.now() + delayMs + 100);
    });

    it('includes vendor ID for isolation', async () => {
      const jobData = { test: 'data' };
      const vendorId = 42;

      await service.enqueueJob('test:job', jobData, { vendorId });

      const hsetCalls = mockRedis.hset.mock.calls;
      const payloadCall = hsetCalls.find((call) => call[1] === 'payload');
      const payload = JSON.parse(payloadCall[2]);

      expect(payload.vendorId).toBe(vendorId);
    });
  });

  describe('Processing jobs', () => {
    it('processes job successfully', async () => {
      const jobData = { orderId: 123 };
      const job = {
        id: 'job:test:123:abc',
        type: 'test:job',
        vendorId: 1,
        data: jobData,
        status: 'pending',
        retryCount: 0,
      };

      mockRedis.zrangebyscore.mockResolvedValue(['job:test:123:abc']);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.hget.mockResolvedValue(JSON.stringify(job));

      const handler = jest.fn().mockResolvedValue({ result: 'success' });

      const result = await service.processJob('test:job', 1, handler);

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledWith(jobData, 'job:test:123:abc');
      expect(mockRedis.zrem).toHaveBeenCalled();
    });

    it('returns no_jobs when queue empty', async () => {
      mockRedis.zrangebyscore.mockResolvedValue([]);

      const handler = jest.fn();
      const result = await service.processJob('test:job', 1, handler);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_jobs');
      expect(handler).not.toHaveBeenCalled();
    });

    it('locks job during processing', async () => {
      mockRedis.zrangebyscore.mockResolvedValue(['job:123']);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.hget.mockResolvedValue(
        JSON.stringify({
          id: 'job:123',
          type: 'test:job',
          vendorId: 1,
          data: {},
          status: 'pending',
          retryCount: 0,
        })
      );

      const handler = jest.fn().mockResolvedValue('success');

      await service.processJob('test:job', 1, handler);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:job:123',
        '1',
        'EX',
        30,
        'NX'
      );
      expect(mockRedis.del).toHaveBeenCalledWith('lock:job:123');
    });

    it('skips locked job', async () => {
      mockRedis.zrangebyscore.mockResolvedValue(['job:123']);
      mockRedis.set.mockResolvedValue(null); // NX failed - already locked

      const handler = jest.fn();
      const result = await service.processJob('test:job', 1, handler);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('locked');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Retry logic', () => {
    it('schedules retry on handler error', async () => {
      mockRedis.zrangebyscore.mockResolvedValue(['job:123']);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.hget.mockResolvedValue(
        JSON.stringify({
          id: 'job:123',
          type: 'test:job',
          vendorId: 1,
          data: {},
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
        })
      );

      const handler = jest.fn().mockRejectedValue(new Error('temporary failure'));

      const result = await service.processJob('test:job', 1, handler);

      expect(result.success).toBe(false);
      expect(result.retryScheduled).toBe(true);
      expect(result.retryIn).toBeGreaterThan(0);
    });

    it('implements exponential backoff', async () => {
      mockRedis.zrangebyscore.mockResolvedValue(['job:123']);
      mockRedis.set.mockResolvedValue('OK');

      const handler = jest.fn().mockRejectedValue(new Error('fail'));

      // First retry
      mockRedis.hget.mockResolvedValueOnce(
        JSON.stringify({
          id: 'job:123',
          type: 'test:job',
          vendorId: 1,
          data: {},
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
        })
      );

      const result1 = await service.processJob('test:job', 1, handler);
      const delay1 = result1.retryIn;

      // Second retry (increase retryCount in mock)
      mockRedis.hget.mockResolvedValueOnce(
        JSON.stringify({
          id: 'job:123',
          type: 'test:job',
          vendorId: 1,
          data: {},
          status: 'pending',
          retryCount: 1,
          maxRetries: 3,
        })
      );

      const result2 = await service.processJob('test:job', 1, handler);
      const delay2 = result2.retryIn;

      // Exponential backoff: delay2 should be ~2x delay1
      expect(delay2).toBeGreaterThan(delay1);
    });

    it('moves to DLQ after max retries', async () => {
      mockRedis.zrangebyscore.mockResolvedValue(['job:123']);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.hget.mockResolvedValue(
        JSON.stringify({
          id: 'job:123',
          type: 'test:job',
          vendorId: 1,
          data: {},
          status: 'pending',
          retryCount: 2, // Already retried twice
          maxRetries: 3,
        })
      );

      const handler = jest.fn().mockRejectedValue(new Error('permanent failure'));

      const result = await service.processJob('test:job', 1, handler);

      expect(result.success).toBe(false);
      expect(result.movedToDLQ).toBe(true);
      expect(mockRedis.lpush).toHaveBeenCalledWith('dlq:test:job', 'job:123');
    });
  });

  describe('Dead-letter queue', () => {
    it('retrieves failed jobs from DLQ', async () => {
      mockRedis.lrange.mockResolvedValue(['job:123', 'job:456']);
      mockRedis.hget
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 'job:123',
            status: 'failed',
            error: 'permanent failure',
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 'job:456',
            status: 'failed',
            error: 'permanent failure',
          })
        );

      const dlq = await service.getDeadLetterQueue('test:job');

      expect(dlq).toHaveLength(2);
      expect(dlq[0].id).toBe('job:123');
      expect(mockRedis.lrange).toHaveBeenCalledWith('dlq:test:job', 0, 99);
    });

    it('retries failed job from DLQ', async () => {
      const failedJob = {
        id: 'job:123',
        type: 'test:job',
        vendorId: 1,
        status: 'failed',
        retryCount: 3,
        error: 'previous error',
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(failedJob));
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.lrem.mockResolvedValue(1);

      const result = await service.retryFailedJob('job:123');

      expect(result).toBe(true);
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.lrem).toHaveBeenCalledWith('dlq:test:job', 1, 'job:123');
    });
  });

  describe('Job status', () => {
    it('retrieves job status', async () => {
      const job = {
        id: 'job:123',
        type: 'test:job',
        status: 'processing',
        retryCount: 1,
      };

      mockRedis.hget.mockResolvedValue(JSON.stringify(job));

      const status = await service.getJobStatus('job:123');

      expect(status).toEqual(job);
    });

    it('returns null for non-existent job', async () => {
      mockRedis.hget.mockResolvedValue(null);

      const status = await service.getJobStatus('job:nonexistent');

      expect(status).toBeNull();
    });
  });

  describe('Integration scenarios', () => {
    it('completes full job lifecycle', async () => {
      const jobData = { orderId: 123 };

      // Enqueue
      const jobId = await service.enqueueJob('test:job', jobData, {
        vendorId: 1,
      });

      expect(jobId).toMatch(/^job:/);

      // Process - success
      const job = {
        id: jobId,
        type: 'test:job',
        vendorId: 1,
        data: jobData,
        status: 'pending',
        retryCount: 0,
      };

      mockRedis.zrangebyscore.mockResolvedValue([jobId]);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.hget.mockResolvedValue(JSON.stringify(job));

      const handler = jest.fn().mockResolvedValue('completed');
      const result = await service.processJob('test:job', 1, handler);

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });
  });
});
