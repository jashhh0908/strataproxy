export class UpstreamPool {
    private allUpstreams: string[];
    private activeUpstreams: string[];
    private currentIndex: number;

    constructor(upstreams: string[]) {
        this.allUpstreams = [...upstreams];
        this.activeUpstreams = [...upstreams];
        this.currentIndex = 0;
    }

    // round-robin selection between the 2 upstream ports 
    getNextTarget(): string | null {
        if (this.activeUpstreams.length === 0) return null; // all servers are DOWN

        const index = this.currentIndex % this.activeUpstreams.length;
        const target = this.activeUpstreams[index];
        this.currentIndex++;
        return target || null;
    }

    // mark server as UP or DOWN
    setUpstreams(target: string, isHealthy: boolean): void {
        if(isHealthy) {
            if(!this.activeUpstreams.includes(target)) {
                this.activeUpstreams.push(target);
                console.log(`[REINSTATED] Upstream Pool: ${target}`);

            }
        } else {
            const index = this.activeUpstreams.indexOf(target);
            if(index !== -1) {
                this.activeUpstreams.splice(index, 1);
                console.log(`[EJECTED] Upstream Pool: ${target}`);
            }
        }
    }

    getAllUpstream(): string[] {
        return [...this.allUpstreams];
    }

    getActiveUpstream(): string[] {
        return [...this.activeUpstreams];
    }
}