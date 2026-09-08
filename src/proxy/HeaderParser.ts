import http from "node:http";

const HOP_BY_HOP_HEADERS = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade'
]);

export class HeaderParser{
    static sanitizeHeaders(headers: http.IncomingHttpHeaders): http.IncomingHttpHeaders {
        const cleanHeaders: http.IncomingHttpHeaders = {};
        for(const [key, value]  of Object.entries(headers)) {
            if(!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
                cleanHeaders[key] = value;
            }
        }
        return cleanHeaders;
    }
    static applyForwardingHeaders(headers: http.IncomingHttpHeaders, clientIp: string, targetHost: string, isHttps = false): http.IncomingHttpHeaders {
        const forwardedHeaders = {...headers};
        const existingXff = headers['x-forwarded-for'];
        if (existingXff) {
            forwardedHeaders['x-forwarded-for'] = `${existingXff}, ${clientIp}`;
        } else {
            forwardedHeaders['x-forwarded-for'] = clientIp;
        }
        
        if(!headers['x-forwarded-proto']) {
            forwardedHeaders['x-forwarded-proto'] = isHttps ? 'https' : 'http';
        }

        if (!headers['x-forwarded-host'] && headers['host']) {
            forwardedHeaders['x-forwarded-host'] = headers['host'];
        }

        forwardedHeaders['host'] = targetHost;
        return forwardedHeaders;
    }
};

