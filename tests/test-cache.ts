import { LruCache, CachedResponse } from '../src/cache/LruCache';
import { Coalescer } from '../src/cache/Coalescer';

async function runTests() {
    console.log('Running cache verification tests...');

    console.log('\nTesting LRU eviction');
    const cache = new LruCache<string>(2, 1024 * 1024, 60000);

    const makeResponse = (msg: string, size = 100): CachedResponse => ({
        statusCode: 200,
        header: { 'content-type': 'application/json' },
        body: Buffer.alloc(size, msg),
        timestamp: Date.now(),
        ttlms: 60000
    });

    cache.put('key1', makeResponse('val1'));
    cache.put('key2', makeResponse('val2'));

    // access key1 so key2 becomes least recently used
    cache.get('key1');

    // insert key3 to trigger eviction of key2
    cache.put('key3', makeResponse('val3'));

    if (!cache.get('key1') || cache.get('key2') || !cache.get('key3')) {
        throw new Error('LRU eviction test failed');
    }
    console.log('LRU eviction test passed');

    console.log('\nTesting 1 MB payload ceiling...');
    const oversizeResponse = makeResponse('oversize', 2 * 1024 * 1024);
    const putResult = cache.put('keyLarge', oversizeResponse);

    if (putResult !== false || cache.get('keyLarge') !== null) {
        throw new Error('Payload limit test failed');
    }
    console.log('1 MB payload ceiling test passed');

    console.log('\nTesting request coalescing...');
    const coalescer = new Coalescer();
    let upstreamCalls = 0;

    const mockFetch = async (): Promise<CachedResponse> => {
        upstreamCalls++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return makeResponse('coalesced-data');
    };

    // fire 50 concurrent requests for the same key
    const requests = Array.from({ length: 50 }, () =>
        coalescer.execute('GET:/delay', mockFetch)
    );

    const results = await Promise.all(requests);

    if (results.length !== 50 || upstreamCalls !== 1) {
        throw new Error('Request coalescing test failed');
    }
    console.log(`Coalesced 50 requests into ${upstreamCalls} upstream call`);
    console.log('Request coalescing test passed');

    console.log('\nAll tests passed successfully');
}

runTests().catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
});
