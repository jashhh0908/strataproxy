import { spawn, ChildProcess } from 'child_process';
import http from 'http';

// helper to make quick http get requests
function httpGet(url: string): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({
                statusCode: res.statusCode || 500,
                headers: res.headers,
                body
            }));
        }).on('error', reject);
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFinalTests() {
    console.log('=== STARTING INTEGRATION TEST ===\n');

    // spin up mock upstreams (4001, 4002) and the main gateway server
    console.log('[1/5] Booting Upstream A (4001), Upstream B (4002), and Gateway (8080)...');
    const upstreamA: ChildProcess = spawn('npx', ['tsx', 'test-servers/upstreamA.ts'], { shell: true });
    const upstreamB: ChildProcess = spawn('npx', ['tsx', 'test-servers/upstreamB.ts'], { shell: true });
    const gateway: ChildProcess = spawn('npx', ['tsx', 'src/server.ts'], { shell: true });

    // clean up child processes when test finishes or fails
    const cleanup = () => {
        upstreamA.kill();
        upstreamB.kill();
        gateway.kill();
    };

    try {
        // give servers 2s to start listening on their ports
        await sleep(2000);

        // test 1: round robin load balancing between 4001 and 4002
        console.log('\n[2/5] Testing Load Balancing...');
        const res1 = await httpGet('http://127.0.0.1:8080/?req=1');
        const res2 = await httpGet('http://127.0.0.1:8080/?req=2');
        console.log(`Req 1 Status: ${res1.statusCode}, Server: ${JSON.parse(res1.body).server}`);
        console.log(`Req 2 Status: ${res2.statusCode}, Server: ${JSON.parse(res2.body).server}`);

        // test 2: verify second request hits lru cache
        console.log('\n[3/5] Testing LRU Caching...');
        const cacheMiss = await httpGet('http://127.0.0.1:8080/cache-test');
        console.log(`First Call /cache-test: X-Cache = ${cacheMiss.headers['x-cache'] || 'MISS'}`);

        const cacheHit = await httpGet('http://127.0.0.1:8080/cache-test');
        console.log(`Second Call /cache-test: X-Cache = ${cacheHit.headers['x-cache']}`);

        if (cacheHit.headers['x-cache'] !== 'HIT') {
            throw new Error('Cache HIT verification failed!');
        }

        // test 3: trigger rate limiter by spamming 12 requests
        console.log('\n[4/5] Testing Rate Limiting (10 req/10s limit)...');
        let hitRateLimit = false;
        for (let i = 0; i < 12; i++) {
            const r = await httpGet(`http://127.0.0.1:8080/rate-test-${i}`);
            if (r.statusCode === 429) {
                console.log(`Request #${i + 1} blocked! HTTP 429 received. Retry-After: ${r.headers['retry-after']}s`);
                hitRateLimit = true;
                break;
            }
        }

        if (!hitRateLimit) {
            throw new Error('Rate limiter failed to trigger HTTP 429');
        }

        console.log('\n[5/5] ALL TESTS PASSED SUCCESSFULLY!');
    } catch (err) {
        console.error('\nTEST FAILED:', err);
    } finally {
        console.log('\nCleaning up server processes...');
        cleanup();
        process.exit(0);
    }
}

runFinalTests();
