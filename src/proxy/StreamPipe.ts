// src/proxy/StreamPipe.ts

import http from 'node:http';
import { pipeline } from 'node:stream';
import { HeaderParser } from './HeaderParser';
import { CachedResponse } from '../cache/LruCache';

export class StreamPipe {
    private agent: http.Agent;

    constructor() {
        this.agent = new http.Agent({
            keepAlive: true,
            maxSockets: 100
        });
    }

    forwardRequest(
        clientReq: http.IncomingMessage,
        clientRes: http.ServerResponse,
        targetUrl: string,
        maxSizeBytes: number,
        onBufferComplete?: (response: CachedResponse) => void
    ): Promise<boolean> {
        return new Promise((resolve) => {
            const target = new URL(targetUrl);
            const clientIp = clientReq.socket.remoteAddress || '127.0.0.1';

            const sanitizedHeaders = HeaderParser.sanitizeHeaders(clientReq.headers);
            const outboundHeaders = HeaderParser.applyForwardingHeaders(
                sanitizedHeaders,
                clientIp,
                target.host
            );

            const options: http.RequestOptions = {
                hostname: target.hostname,
                port: target.port,
                path: `${target.pathname}${target.search}`,
                method: clientReq.method,
                headers: outboundHeaders,
                agent: this.agent
            };

            const upstreamReq = http.request(options, (upstreamRes) => {
                const statusCode = upstreamRes.statusCode || 500;
                const responseHeaders = HeaderParser.sanitizeHeaders(upstreamRes.headers);

                const isGet = clientReq.method?.toUpperCase() === 'GET';
                const is200 = statusCode === 200;
                const isCacheable = isGet && is200 && Boolean(onBufferComplete);

                if (isCacheable) {
                    const chunks: Buffer[] = [];
                    let totalSize = 0;
                    let exceededCeiling = false;

                    upstreamRes.on('data', (chunk: Buffer) => {
                        totalSize += chunk.length;
                        if (!exceededCeiling && totalSize <= maxSizeBytes) {
                            chunks.push(chunk);
                        } else {
                            if (!exceededCeiling) {
                                exceededCeiling = true;
                                const bufferedSoFar = Buffer.concat(chunks);
                                if (!clientRes.headersSent) {
                                    clientRes.writeHead(statusCode, responseHeaders);
                                }
                                clientRes.write(bufferedSoFar);
                            }
                            clientRes.write(chunk);
                        }
                    });

                    upstreamRes.on('end', () => {
                        if (!exceededCeiling) {
                            const fullBody = Buffer.concat(chunks);
                            if (!clientRes.headersSent) {
                                clientRes.writeHead(statusCode, responseHeaders);
                            }
                            clientRes.end(fullBody);

                            onBufferComplete?.({
                                statusCode,
                                header: responseHeaders,
                                body: fullBody,
                                timestamp: Date.now(),
                                ttlms: 60000
                            });
                        } else {
                            clientRes.end();
                        }
                        resolve(true);
                    });
                } else {
                    if (!clientRes.headersSent) {
                        clientRes.writeHead(statusCode, responseHeaders);
                    }

                    pipeline(upstreamRes, clientRes, (err) => {
                        if (err) {
                            console.error('[StreamPipe] Pipeline error:', err);
                            if (!clientRes.headersSent) {
                                clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
                                clientRes.end('Bad Gateway');
                            }
                        }
                        resolve(true);
                    });
                }
            });

            upstreamReq.on('error', (err) => {
                console.error('[StreamPipe] Upstream request error:', err.message);
                if (!clientRes.headersSent) {
                    clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
                    clientRes.end('Bad Gateway');
                }
                resolve(false);
            });

            pipeline(clientReq, upstreamReq, (err) => {
                if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
                    console.error('[StreamPipe] Request body pipe error:', err);
                }
            });
        });
    }
}
