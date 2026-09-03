import http from "node:http"

const PORT = 4002;
const SERVER_NAME = 'Upstream A (Port 4002)';

const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`); // parse incoming request
    console.log(`[${SERVER_NAME}] ${req.method} ${url.pathname}${url.search}`);

    // check for health endpoint
    if(url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json'});
        res.end(JSON.stringify({status: "UP", server: SERVER_NAME}));
        return;
    }

    if(url.pathname === '/delay') {
        const delayMS = parseInt(url.searchParams.get('ms') || "1000", 10);
        setTimeout(() => {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                message: "Delayed response", 
                delayMS,
                server: SERVER_NAME,
                timestamp: Date.now()
            }
            ))
        }, delayMS);
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Upstream-Server': SERVER_NAME
    });
    res.end(
        JSON.stringify({
            message: 'Hello from Upstream A',
            method: req.method,
            path: url.pathname,
            headers: req.headers,
            server: SERVER_NAME,
            timestamp: Date.now()
      })
    );
})

server.listen(PORT, '127.0.0.1', () => {
    console.log(`${SERVER_NAME} listening on http://localhost:500`)
});
