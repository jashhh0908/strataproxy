import { UpstreamPool } from '../src/balancer/UpstreamPool';

function runBalancerTests() {
    console.log('--- Testing UpstreamPool Round Robin ---');
    const pool = new UpstreamPool(['http://127.0.0.1:4001', 'http://127.0.0.1:4002']);

    const target1 = pool.getNextTarget();
    const target2 = pool.getNextTarget();
    const target3 = pool.getNextTarget();

    console.log(`Call 1: ${target1}`);
    console.log(`Call 2: ${target2}`);
    console.log(`Call 3: ${target3}`);

    if (target1 !== 'http://127.0.0.1:4001' || target2 !== 'http://127.0.0.1:4002' || target3 !== 'http://127.0.0.1:4001') {
        throw new Error('Round-robin rotation failed');
    }

    console.log('\n--- Testing Ejection & Reinstatement ---');
    pool.setUpstreams('http://127.0.0.1:4001', false);
    console.log('Active upstreams after ejecting 4001:', pool.getActiveUpstream());

    if (pool.getNextTarget() !== 'http://127.0.0.1:4002' || pool.getNextTarget() !== 'http://127.0.0.1:4002') {
        throw new Error('Fallback after ejection failed');
    }

    pool.setUpstreams('http://127.0.0.1:4001', true);
    console.log('Active upstreams after reinstating 4001:', pool.getActiveUpstream());

    console.log('\nALL BALANCER TESTS PASSED CLEANLY');
}

runBalancerTests();