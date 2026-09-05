import { RateLimiter } from '../src/limiter/RateLimiter';

async function runTests() {
    console.log('Running rate limiter verification tests...');

    const limiter = new RateLimiter(5, 1000); // 5 requests per 1000ms (1 second)
    const clientIp = '127.0.0.1';

    // test 1: allow burst requests up to limit (5)
    console.log('Testing allowed burst requests...');
    for (let i = 1; i <= 5; i++) {
        const result = limiter.check(clientIp);
        if (!result.allowed || result.remaining !== 5 - i) {
            throw new Error(`Burst request ${i} failed`);
        }
    }
    console.log('Allowed burst requests test passed');

    // test 2: block request exceeding limit (6th request)
    console.log('Testing rate limit breach (429)...');
    const breachResult = limiter.check(clientIp);
    if (breachResult.allowed !== false || breachResult.remaining !== 0 || breachResult.retryAfterSec < 1) {
        throw new Error('Rate limit breach test failed');
    }
    console.log(`Blocked request 6 with retryAfterSec = ${breachResult.retryAfterSec}`);
    console.log('Rate limit breach test passed');

    // test 3: window reset after waiting
    console.log('Testing window reset after delay...');
    await new Promise((resolve) => setTimeout(resolve, 1100)); // wait 1.1s for window to reset

    const resetResult = limiter.check(clientIp);
    if (!resetResult.allowed || resetResult.remaining !== 4) {
        throw new Error('Window reset test failed');
    }
    console.log('Window reset test passed');

    console.log('All rate limiter tests passed successfully');
}

runTests().catch((err) => {
    console.error('Rate limiter test failed:', err);
    process.exit(1);
});
