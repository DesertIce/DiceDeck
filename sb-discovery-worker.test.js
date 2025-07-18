const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const SbDiscoveryWorker = require('./sb-discovery-worker');

describe('SbDiscoveryWorker', () => {
  let worker;
  let mockLogger;
  let mockConfig;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    // Mock configuration
    mockConfig = {
      discoveryInterval: 30000,
      maxRetries: 3,
      timeout: 10000,
      endpoints: ['http://localhost:8080'],
      enableHealthCheck: true
    };

    // Create worker instance
    worker = new SbDiscoveryWorker(mockConfig, mockLogger);
  });

  afterEach(() => {
    if (worker) {
      worker.stop();
    }
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration when no config provided', () => {
      const defaultWorker = new SbDiscoveryWorker();
      expect(defaultWorker.config).toBeDefined();
      expect(defaultWorker.config.discoveryInterval).toBe(30000);
      expect(defaultWorker.config.maxRetries).toBe(3);
    });

    it('should merge provided config with defaults', () => {
      const customConfig = { discoveryInterval: 60000 };
      const customWorker = new SbDiscoveryWorker(customConfig);
      expect(customWorker.config.discoveryInterval).toBe(60000);
      expect(customWorker.config.maxRetries).toBe(3); // default value
    });

    it('should initialize with provided logger', () => {
      expect(worker.logger).toBe(mockLogger);
    });

    it('should create default logger when none provided', () => {
      const defaultWorker = new SbDiscoveryWorker();
      expect(defaultWorker.logger).toBeDefined();
      expect(typeof defaultWorker.logger.info).toBe('function');
    });

    it('should initialize discovery state', () => {
      expect(worker.isRunning).toBe(false);
      expect(worker.discoveredServices).toEqual([]);
      expect(worker.lastDiscoveryTime).toBeNull();
    });
  });

  describe('start()', () => {
    it('should start discovery process', async () => {
      const spy = jest.spyOn(worker, 'performDiscovery').mockResolvedValue([]);
      
      await worker.start();
      
      expect(worker.isRunning).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Starting service discovery worker');
      expect(spy).toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      worker.isRunning = true;
      
      await worker.start();
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Discovery worker is already running');
    });

    it('should handle startup errors gracefully', async () => {
      const error = new Error('Startup failed');
      jest.spyOn(worker, 'performDiscovery').mockRejectedValue(error);
      
      await worker.start();
      
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to start discovery worker', error);
      expect(worker.isRunning).toBe(false);
    });

    it('should schedule periodic discovery', async () => {
      jest.spyOn(worker, 'performDiscovery').mockResolvedValue([]);
      jest.spyOn(worker, 'scheduleNextDiscovery');
      
      await worker.start();
      
      expect(worker.scheduleNextDiscovery).toHaveBeenCalled();
    });
  });

  describe('stop()', () => {
    it('should stop discovery process', () => {
      worker.isRunning = true;
      worker.discoveryTimer = setTimeout(() => {}, 1000);
      
      worker.stop();
      
      expect(worker.isRunning).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping service discovery worker');
    });

    it('should clear discovery timer', () => {
      worker.discoveryTimer = setTimeout(() => {}, 1000);
      const timerId = worker.discoveryTimer;
      
      worker.stop();
      
      expect(worker.discoveryTimer).toBeNull();
    });

    it('should handle stop when not running', () => {
      worker.isRunning = false;
      
      worker.stop();
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Discovery worker is not running');
    });
  });

  describe('performDiscovery()', () => {
    it('should discover services from configured endpoints', async () => {
      const mockServices = [
        { name: 'service1', endpoint: 'http://service1:8080', healthy: true },
        { name: 'service2', endpoint: 'http://service2:8080', healthy: true }
      ];
      
      jest.spyOn(worker, 'discoverFromEndpoint').mockResolvedValue(mockServices);
      
      const result = await worker.performDiscovery();
      
      expect(result).toEqual(mockServices);
      expect(worker.discoverFromEndpoint).toHaveBeenCalledWith('http://localhost:8080');
    });

    it('should handle empty discovery results', async () => {
      jest.spyOn(worker, 'discoverFromEndpoint').mockResolvedValue([]);
      
      const result = await worker.performDiscovery();
      
      expect(result).toEqual([]);
      expect(worker.discoveredServices).toEqual([]);
    });

    it('should update last discovery time', async () => {
      const beforeTime = Date.now();
      jest.spyOn(worker, 'discoverFromEndpoint').mockResolvedValue([]);
      
      await worker.performDiscovery();
      
      expect(worker.lastDiscoveryTime).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should handle discovery errors with retries', async () => {
      const error = new Error('Discovery failed');
      jest.spyOn(worker, 'discoverFromEndpoint')
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue([]);
      
      await worker.performDiscovery();
      
      expect(worker.discoverFromEndpoint).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledWith('Discovery attempt failed, retrying...', error);
    });

    it('should fail after max retries exceeded', async () => {
      const error = new Error('Discovery failed');
      jest.spyOn(worker, 'discoverFromEndpoint').mockRejectedValue(error);
      
      await expect(worker.performDiscovery()).rejects.toThrow('Discovery failed');
      expect(worker.discoverFromEndpoint).toHaveBeenCalledTimes(3);
    });
  });

  describe('discoverFromEndpoint()', () => {
    let mockFetch;

    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
    });

    it('should fetch services from endpoint', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          services: [
            { name: 'service1', endpoint: 'http://service1:8080' }
          ]
        })
      };
      mockFetch.mockResolvedValue(mockResponse);
      
      const result = await worker.discoverFromEndpoint('http://discovery:8080');
      
      expect(mockFetch).toHaveBeenCalledWith('http://discovery:8080/services', {
        method: 'GET',
        timeout: 10000,
        headers: { 'Accept': 'application/json' }
      });
      expect(result).toEqual([{ name: 'service1', endpoint: 'http://service1:8080' }]);
    });

    it('should handle HTTP errors', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };
      mockFetch.mockResolvedValue(mockResponse);
      
      await expect(worker.discoverFromEndpoint('http://discovery:8080'))
        .rejects.toThrow('HTTP error! status: 404');
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      mockFetch.mockRejectedValue(error);
      
      await expect(worker.discoverFromEndpoint('http://discovery:8080'))
        .rejects.toThrow('Network error');
    });

    it('should handle invalid JSON response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      };
      mockFetch.mockResolvedValue(mockResponse);
      
      await expect(worker.discoverFromEndpoint('http://discovery:8080'))
        .rejects.toThrow('Invalid JSON');
    });

    it('should handle missing services in response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockResponse);
      
      const result = await worker.discoverFromEndpoint('http://discovery:8080');
      
      expect(result).toEqual([]);
    });
  });

  describe('scheduleNextDiscovery()', () => {
    it('should schedule next discovery after interval', () => {
      jest.spyOn(global, 'setTimeout');
      
      worker.scheduleNextDiscovery();
      
      expect(setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        mockConfig.discoveryInterval
      );
    });

    it('should not schedule if worker is stopped', () => {
      worker.isRunning = false;
      jest.spyOn(global, 'setTimeout');
      
      worker.scheduleNextDiscovery();
      
      expect(setTimeout).not.toHaveBeenCalled();
    });
  });

  describe('healthCheck()', () => {
    it('should perform health check on discovered services', async () => {
      const mockServices = [
        { name: 'service1', endpoint: 'http://service1:8080', healthy: true },
        { name: 'service2', endpoint: 'http://service2:8080', healthy: false }
      ];
      worker.discoveredServices = mockServices;
      
      jest.spyOn(worker, 'checkServiceHealth')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      
      await worker.healthCheck();
      
      expect(worker.checkServiceHealth).toHaveBeenCalledWith('http://service1:8080');
      expect(worker.checkServiceHealth).toHaveBeenCalledWith('http://service2:8080');
    });

    it('should skip health check when disabled', async () => {
      worker.config.enableHealthCheck = false;
      worker.discoveredServices = [{ name: 'service1', endpoint: 'http://service1:8080' }];
      
      jest.spyOn(worker, 'checkServiceHealth');
      
      await worker.healthCheck();
      
      expect(worker.checkServiceHealth).not.toHaveBeenCalled();
    });

    it('should handle health check errors gracefully', async () => {
      const error = new Error('Health check failed');
      worker.discoveredServices = [{ name: 'service1', endpoint: 'http://service1:8080' }];
      
      jest.spyOn(worker, 'checkServiceHealth').mockRejectedValue(error);
      
      await worker.healthCheck();
      
      expect(mockLogger.error).toHaveBeenCalledWith('Health check failed for service1', error);
    });
  });

  describe('checkServiceHealth()', () => {
    let mockFetch;

    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
    });

    it('should return true for healthy service', async () => {
      const mockResponse = {
        ok: true,
        status: 200
      };
      mockFetch.mockResolvedValue(mockResponse);
      
      const result = await worker.checkServiceHealth('http://service1:8080');
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('http://service1:8080/health', {
        method: 'GET',
        timeout: 5000
      });
    });

    it('should return false for unhealthy service', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      };
      mockFetch.mockResolvedValue(mockResponse);
      
      const result = await worker.checkServiceHealth('http://service1:8080');
      
      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      const error = new Error('Network error');
      mockFetch.mockRejectedValue(error);
      
      const result = await worker.checkServiceHealth('http://service1:8080');
      
      expect(result).toBe(false);
    });

    it('should use custom health endpoint path', async () => {
      worker.config.healthEndpoint = '/status';
      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockResolvedValue(mockResponse);
      
      await worker.checkServiceHealth('http://service1:8080');
      
      expect(mockFetch).toHaveBeenCalledWith('http://service1:8080/status', expect.any(Object));
    });
  });

  describe('getDiscoveredServices()', () => {
    it('should return copy of discovered services', () => {
      const mockServices = [
        { name: 'service1', endpoint: 'http://service1:8080', healthy: true }
      ];
      worker.discoveredServices = mockServices;
      
      const result = worker.getDiscoveredServices();
      
      expect(result).toEqual(mockServices);
      expect(result).not.toBe(mockServices); // Should be a copy
    });

    it('should return empty array when no services discovered', () => {
      const result = worker.getDiscoveredServices();
      
      expect(result).toEqual([]);
    });
  });

  describe('getHealthyServices()', () => {
    it('should return only healthy services', () => {
      const mockServices = [
        { name: 'service1', endpoint: 'http://service1:8080', healthy: true },
        { name: 'service2', endpoint: 'http://service2:8080', healthy: false },
        { name: 'service3', endpoint: 'http://service3:8080', healthy: true }
      ];
      worker.discoveredServices = mockServices;
      
      const result = worker.getHealthyServices();
      
      expect(result).toEqual([
        { name: 'service1', endpoint: 'http://service1:8080', healthy: true },
        { name: 'service3', endpoint: 'http://service3:8080', healthy: true }
      ]);
    });

    it('should return empty array when no healthy services', () => {
      const mockServices = [
        { name: 'service1', endpoint: 'http://service1:8080', healthy: false }
      ];
      worker.discoveredServices = mockServices;
      
      const result = worker.getHealthyServices();
      
      expect(result).toEqual([]);
    });
  });

  describe('updateServiceHealth()', () => {
    it('should update health status of specific service', () => {
      const mockServices = [
        { name: 'service1', endpoint: 'http://service1:8080', healthy: true },
        { name: 'service2', endpoint: 'http://service2:8080', healthy: true }
      ];
      worker.discoveredServices = mockServices;
      
      worker.updateServiceHealth('service1', false);
      
      expect(worker.discoveredServices[0].healthy).toBe(false);
      expect(worker.discoveredServices[1].healthy).toBe(true);
    });

    it('should handle non-existent service gracefully', () => {
      const mockServices = [
        { name: 'service1', endpoint: 'http://service1:8080', healthy: true }
      ];
      worker.discoveredServices = mockServices;
      
      worker.updateServiceHealth('nonexistent', false);
      
      expect(worker.discoveredServices[0].healthy).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith('Service not found: nonexistent');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined configuration gracefully', () => {
      const worker1 = new SbDiscoveryWorker(null);
      const worker2 = new SbDiscoveryWorker(undefined);
      
      expect(worker1.config).toBeDefined();
      expect(worker2.config).toBeDefined();
    });

    it('should handle empty endpoints array', async () => {
      worker.config.endpoints = [];
      jest.spyOn(worker, 'discoverFromEndpoint');
      
      const result = await worker.performDiscovery();
      
      expect(result).toEqual([]);
      expect(worker.discoverFromEndpoint).not.toHaveBeenCalled();
    });

    it('should handle invalid endpoint URLs', async () => {
      worker.config.endpoints = ['invalid-url'];
      
      await expect(worker.performDiscovery()).rejects.toThrow();
    });

    it('should handle concurrent start/stop operations', async () => {
      const startPromise1 = worker.start();
      const startPromise2 = worker.start();
      
      await Promise.all([startPromise1, startPromise2]);
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Discovery worker is already running');
    });

    it('should handle memory cleanup on stop', () => {
      worker.discoveredServices = [{ name: 'service1', endpoint: 'http://service1:8080' }];
      worker.lastDiscoveryTime = Date.now();
      
      worker.stop();
      
      expect(worker.discoveredServices).toEqual([]);
      expect(worker.lastDiscoveryTime).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    it('should perform complete discovery cycle', async () => {
      const mockServices = [
        { name: 'service1', endpoint: 'http://service1:8080' }
      ];
      
      jest.spyOn(worker, 'discoverFromEndpoint').mockResolvedValue(mockServices);
      jest.spyOn(worker, 'checkServiceHealth').mockResolvedValue(true);
      
      await worker.start();
      await worker.performDiscovery();
      await worker.healthCheck();
      
      expect(worker.discoveredServices).toEqual([
        { name: 'service1', endpoint: 'http://service1:8080', healthy: true }
      ]);
      expect(worker.getHealthyServices()).toHaveLength(1);
    });

    it('should handle service failures and recovery', async () => {
      const mockServices = [
        { name: 'service1', endpoint: 'http://service1:8080' }
      ];
      
      jest.spyOn(worker, 'discoverFromEndpoint').mockResolvedValue(mockServices);
      jest.spyOn(worker, 'checkServiceHealth')
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      
      await worker.start();
      await worker.performDiscovery();
      await worker.healthCheck();
      
      expect(worker.discoveredServices[0].healthy).toBe(false);
      
      await worker.healthCheck();
      
      expect(worker.discoveredServices[0].healthy).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate discovery interval bounds', () => {
      const invalidConfig = { discoveryInterval: -1 };
      const worker = new SbDiscoveryWorker(invalidConfig);
      
      expect(worker.config.discoveryInterval).toBeGreaterThan(0);
    });

    it('should validate max retries bounds', () => {
      const invalidConfig = { maxRetries: -1 };
      const worker = new SbDiscoveryWorker(invalidConfig);
      
      expect(worker.config.maxRetries).toBeGreaterThanOrEqual(0);
    });

    it('should validate timeout bounds', () => {
      const invalidConfig = { timeout: -1 };
      const worker = new SbDiscoveryWorker(invalidConfig);
      
      expect(worker.config.timeout).toBeGreaterThan(0);
    });

    it('should handle malformed endpoint URLs', () => {
      const invalidConfig = { endpoints: ['not-a-url', 'http://valid.com'] };
      const worker = new SbDiscoveryWorker(invalidConfig);
      
      expect(worker.config.endpoints).toContain('http://valid.com');
    });
  });
});