import { RingBuffer } from "./RingBuffer";

export interface RateLimitResult {
    allowed: boolean; // if to allow req or not 
    limit: number; // max no of reqs that can be made
    remaining: number; // reqs left in the window
    retryAfterSec: number; // time the client shud wait before making another req
}

export class RateLimiter {
    private clientMap: Map<string, RingBuffer>; //every client gets their own buffer
    private maxReqs: number;
    private windowMs: number;

    constructor(maxReqs: number, windowMs: number) {
        this.clientMap = new Map();
        this.maxReqs = maxReqs;
        this.windowMs = windowMs;
    }

    check(ip: string): RateLimitResult {
        //setup ip in the map if it doesnt exist 
        let ringBuffer = this.clientMap.get(ip);
        if(!ringBuffer) {
            ringBuffer = new RingBuffer(this.maxReqs);
            this.clientMap.set(ip, ringBuffer);  
        }

        // calc current time and cutoff time 
        const now = Date.now();
        const cutoffTime = now - this.windowMs;

        // clean expired timestamps
        ringBuffer.evictOlderThan(cutoffTime);

        // check if the request can be pushed to the buffer
        const allowed = ringBuffer.push(now);
        if(allowed) {
            return {
                allowed: true,
                limit: this.maxReqs,
                remaining: this.maxReqs - ringBuffer.getCount(),
                retryAfterSec: 0 
            };
        }
        // if not then calculate retry after
        const oldestTimestamp = ringBuffer.getOldest() ?? now;
        const retryAfterMs = (this.windowMs + oldestTimestamp) - now;
        const retryAfterSec = (retryAfterMs / 1000);

        return {
            allowed: false,
            limit: this.maxReqs,
            remaining: 0,
            retryAfterSec
        };
    }
}

