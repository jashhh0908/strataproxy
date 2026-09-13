import { CONFIG, ProxyConfig } from "../config";
import { UpstreamPool } from "./UpstreamPool";
import http from "node:http";

export class HealthChecker {
    private pool: UpstreamPool;
    private config: ProxyConfig['healthCheck'];
    private timer: NodeJS.Timeout | null;
    private consecutiveFailures: Map<string, number>;
    private consecutiveSuccesses: Map<string, number>;

    constructor(pool: UpstreamPool, config: ProxyConfig['healthCheck'] = CONFIG.healthCheck) {
        this.pool = pool;
        this.config = config;
        this.timer = null;
        this.consecutiveFailures = new Map();
        this.consecutiveSuccesses= new Map();

        for(const target of this.pool.getAllUpstream()) {
            this.consecutiveFailures.set(target, 0);
            this.consecutiveSuccesses.set(target, 0);
        }
    }

    // when the reverse proxy, start all background health checks 
    start() {
        if(this.timer) return;

        this.checkAll();

        this.timer = setInterval(() => {
            this.checkAll();
        }, this.config.intervalMS);
    }

    // stop timer once proxy shuts down
    stop() {
        if(this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    
    private async checkAll(): Promise<void> {
        const upstream = this.pool.getAllUpstream();
        await Promise.all(upstream.map(target => this.checkUpstream(target)))
    }

    private checkUpstream(target: string): Promise<void> {
        return new Promise((resolve) => {
            const url = new URL(this.config.path, target);
            const req = http.get(url, { timeout: this.config.timeoutMS }, (res) => {
                const isHealthy = res.statusCode === 200;
                res.resume();
                this.handleCheckResult(target, isHealthy);
                resolve();
            });
            req.on('timeout', () => {
                req.destroy();
                this.handleCheckResult(target, false);
                resolve();
            });
            req.on('error', () => {
                this.handleCheckResult(target, false);
                resolve();
            });
        });
    }

    private handleCheckResult(target: string, isHealthy: boolean): void {
        if (isHealthy) {
            this.consecutiveFailures.set(target, 0);
            const passCount = (this.consecutiveSuccesses.get(target) || 0) + 1;
            this.consecutiveSuccesses.set(target, passCount);

            if (passCount >= this.config.successThreshold) {
                this.pool.setUpstreams(target, true);
            }
        } else {
            this.consecutiveSuccesses.set(target, 0);
            const failCount = (this.consecutiveFailures.get(target) || 0) + 1;
            this.consecutiveFailures.set(target, failCount);

            if (failCount >= this.config.failureThreshold) {
                this.pool.setUpstreams(target, false);
            }
        }
    }
}