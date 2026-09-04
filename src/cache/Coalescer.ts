import { CachedResponse } from "./LruCache";

export class Coalescer {
    private inFlightMap: Map<string, Promise<CachedResponse>> = new Map();
    // deduplicate concurrent requests for the same key into 1 upstream fetch
    async execute(key: string, fetchFn: () => Promise<CachedResponse>): Promise<CachedResponse> {
        // check if an upstream request for this key is already en route
        const inFlightPromise = this.inFlightMap.get(key);
        if (inFlightPromise) {
            return inFlightPromise;
        }
        // start a new upstream fetch and store its Promise in the map
        const fetchPromise = fetchFn().finally(() => {
            this.inFlightMap.delete(key);
        });
        
        this.inFlightMap.set(key, fetchPromise);
        return fetchPromise;
    }
}