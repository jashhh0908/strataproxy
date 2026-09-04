import { DoublyLinkedList, Node } from "./DoublyLinkedList";

export interface CachedResponse {
    statusCode: number;
    header: Record<string, string | string[] | undefined>;
    body: Buffer;
    timestamp: number;
    ttlms: number;
}

export class LruCache<K> {
    private map: Map<K, Node<K, CachedResponse>>;
    private dll: DoublyLinkedList<K, CachedResponse>;
    private maxItems: number;
    private maxSizeBytes: number;
    private defaultTtlms: number;

    constructor(maxItems: number, maxSizeBytes: number, defaultTtlms: number) {
        this.map = new Map();
        this.dll = new DoublyLinkedList();
        this.maxItems = maxItems;
        this.maxSizeBytes = maxSizeBytes;
        this.defaultTtlms = defaultTtlms;
    }

    get(key: K): CachedResponse | null {
        const node = this.map.get(key);
        if(!node) {
            return null;
        }

        const isExpired = Date.now() > node.value.timestamp + node.value.ttlms;
        if(isExpired) {
            this.dll.removeNode(node);
            this.map.delete(key);
            return null;
        }

        this.dll.moveToHead(node);
        return node.value;
    }

    put(key: K, value: CachedResponse): boolean {
        // check to see if the value exceeds the byte range
        if(value.body.byteLength > this.maxSizeBytes) {
            return false;
        }

        // check if value already exists, if it does the update it and make it MRU
        const existingNode = this.map.get(key);
        if(existingNode) {
            existingNode.value = value;
            this.dll.moveToHead(existingNode);
            return true;
        }

        if(this.map.size >= this.maxItems) {
            const evictedNode = this.dll.removeTail();
            if(evictedNode) {
                this.map.delete(evictedNode?.key);
            }        
        }

        // add the new node to the head 
        const newNode = new Node(key, value);
        this.dll.pushHead(newNode);
        this.map.set(key, newNode);
        return true;
    }
}