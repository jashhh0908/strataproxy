export interface ProxyConfig {
    port: number;
    host: string; 
    upstreams: string[];
    cache: {
        maxItems: number; // once limit is reached items are evicted through LRU algo
        maxSizeBytes: number; // cap the items to 1 MB limit
        defaultTtlMs: number; // when a request is hit the backend fecthed response is stored in the cache for the time specified 
                                // to make access of frequently used routes easier than to query the backend again and again 
    };
    rateLimiter: {
        maxReq: number; // max requests an IP can make to a specific route else show 429 "too amny requests"
        windowMS: number; // time after which the IP can make the requests again
    };
    healthCheck: {
        intervalMS: number; // repeatedly check if the server is on
        path: string; // path to check
        timeoutMS: number; // time to wait before categorizing as failure to reach the server 
        failureThreshold: number; // no of checks after which if all failure, declare server as DOWN.
        successThreshold: number; // if server is DOWN, perform these many checks before declaring as UP.
    };
}

export const CONFIG: ProxyConfig = {
    port: 8080,
    host: '127.0.0.1',
    upstreams: ['http://127.0.0.1:4001', 'http://127.0.0.1:4002'],
    cache: {
        maxItems: 100,
        maxSizeBytes: 1024 * 1024, // 1 MB hard ceiling
        defaultTtlMs: 60 * 1000   // 60 seconds
    },
    rateLimiter: {
        maxReq: 10,
        windowMS: 10 * 1000 // 10 requests per 10 seconds
    },
    healthCheck: {
        intervalMS: 5000,
        path: '/health',
        failureThreshold: 3,
        successThreshold: 2,
        timeoutMS: 2000
    }
};