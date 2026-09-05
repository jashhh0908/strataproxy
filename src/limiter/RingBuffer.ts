export class RingBuffer {
    private buffer: number[]; // to store timestamps when a req is made
    private head: number; // points to the empty slot after the most recent timestamp
    private tail: number; // least recent timestamp
    private count: number; // count of req in the buffer
    private capacity: number; // capacity of reqs that can be made from a single IP before showing "429 Too many reqs"

    constructor(capacity: number) {
        this.buffer = new Array(capacity).fill(0);
        this.head = 0;
        this.tail = 0;
        this.count = 0;
        this.capacity = capacity;
    }

    evictOlderThan(cutoffTime: number): void {
        while(this.count > 0) {
            const oldestTimestamp = this.buffer[this.tail];
            if(oldestTimestamp === undefined || oldestTimestamp >= cutoffTime) {
                break;
            }      
            this.tail = (this.tail + 1) % this.capacity;
            this.count--;
        }
    }

    push(timestamp: number): boolean {
        if(this.count >= this.capacity) {
            return false;
        }

        this.buffer[this.head] = timestamp;
        this.head = (this.head + 1) % this.capacity;
        this.count++;
        return true;       
    }

    getCount(): number {
        return this.count;
    }

    getOldest(): number | null {
        if(this.count === 0) {
            return null;
        }

        return this.buffer[this.tail] ?? null;
    }
}