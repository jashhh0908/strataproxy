import http from "http";

import { HealthChecker } from "./balancer/HealthChecker";
import { UpstreamPool } from "./balancer/UpstreamPool";
import { Coalescer } from "./cache/Coalescer";
import { LruCache } from "./cache/LruCache";
import { CONFIG } from "./config";
import { RateLimiter } from "./limiter/RateLimiter";
import { HeaderParser } from "./proxy/HeaderParser";
import { StreamPipe } from "./proxy/StreamPipe";

const cache = new LruCache(CONFIG.cache.maxItems, CONFIG.cache.maxSizeBytes, CONFIG.cache.defaultTtlMs);
const coalescer = new Coalescer();
const rateLimiter = new RateLimiter(CONFIG.rateLimiter.maxReq, CONFIG.rateLimiter.windowMS);
const headerParser = new HeaderParser();
const streamPipe = new StreamPipe();

const pool = new UpstreamPool(CONFIG.upstreams);
const healthChecker = new HealthChecker(pool, CONFIG.healthCheck);

healthChecker.start();

function getClientIp(req: http.IncomingMessage): string {
    const rawIp = req.socket.remoteAddress || '127.0.0.1';
    // '/.../' - defines a regex pattern and '^' denotes start of the string
    return rawIp.replace(/^::ffff:/, '');
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const clientIp = getClientIp(req);

    // rate limit check for the incoming req from the client IP
    const rateCheck = rateLimiter.check(clientIp);
    if(!rateCheck.allowed) {
        res.writeHead(429, {
            'content-type': 'text/plain',
            'retry-after': String(rateCheck.retryAfterSec)
        });
        res.end('429 Too Many Requests\n');
        return;
    }

    const cacheKey = `${req.method}:${req.url}`;

    // caching and coalescing for GET reqs only 
    if(req.method === 'GET') {
        // cache hit
        const cached = cache.get(cacheKey);
        if(cached) {
            res.writeHead(cached.statusCode, {
                ...cached.header,
                'X-cache': 'HIT'
            });
            res.end(cached.body);
            return;
        }

        // cache miss
        const response = await coalescer.execute(cacheKey, async () => {
            await forwardUpstream(req, res, cacheKey);
            const newCache = cache.get(cacheKey);
            return newCache || {
                statusCode: 502, 
                header: {},
                body: Buffer.from('Bad Gateway'),
                timestamp: Date.now(),
                ttlms: 0
            };
        });

        if(!res.headersSent) {
            res.writeHead(response.statusCode, {
                ...response.header,
                'X-cache': 'MISS'
            });
            res.end(response.body);
        }
        return;
    }

    // non GET reqs
    await forwardUpstream(req, res);
}

async function forwardUpstream(req: http.IncomingMessage, res: http.ServerResponse, cacheKey?: string): Promise<void> {
    //get the available healthy upstream to forward the request to
    const target = pool.getNextTarget();
    if(!target) {
        res.writeHead(503, { "content-type": "text/plain" });
        res.end('503 Service Unavailable');
        return;
    }

    await streamPipe.forwardRequest(req, res, target, CONFIG.cache.maxSizeBytes, cacheKey ? cachedResponse => cache.put(cacheKey, cachedResponse) : undefined);
}

const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
        console.error('[Gateway Error]: ', err);
        if(!res.headersSent) {
            res.writeHead(500, { 'content-type': 'type/plain'});
            res.end('500 Internal Server Error');
        }
    });
});

server.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`[Gateway] Listening on http://${CONFIG.host}:${CONFIG.port}`);
});

function shutdown() {
    console.log('\n[Gateway] Shutting down...');
    healthChecker.stop();
    server.close(() => {
        console.log('[Gateway] Server closed.');
        process.exit(0);
    });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
