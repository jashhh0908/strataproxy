export class Node<K, V> {
    key: K;
    value: V;
    prev: Node<K,V> | null; 
    next: Node<K,V> | null;

    constructor(key: K, value: V) {
        this.key = key;
        this.value = value;
        this.prev = null;
        this.next = null;
    }
}

export class DoublyLinkedList<K, V> {
    head: Node<K, V> | null;
    tail: Node<K, V> | null;
    size: number;

    constructor() {
        this.head = null;
        this.tail = null;
        this.size = 0;
    }

    // insert at head
    pushHead(node: Node<K,V>): void {
        if(!this.head) {
            this.head = node;
            this.tail = node;
        } else {
            node.next = this.head;
            this.head.prev = node;
            this.head = node;
        }
        this.size++;
    }

    // remove from anywhere
    removeNode(node: Node<K,V>): void {
        if(node.prev) {
            node.prev.next = node.next;
        } else {
            //node to remove is head node
            this.head = node.next;
        }

        if(node.next) {
            node.next.prev = node.prev;
        } else {
            //node to remove is tail node
            this.tail = node.prev
        }
        node.prev = null;
        node.next = null;
        this.size--;
    }

    // move an existing node to head (when an item is accessed) 
    moveToHead(node: Node<K,V>): void {
        this.removeNode(node);
        this.pushHead(node);
    } 

    // remove and return the tail node (evict the least recently used)
    removeTail(): Node<K,V> | null {
        if(!this.tail) return null;
        const lruNode = this.tail;
        this.removeNode(lruNode);
        return lruNode;
    }
}