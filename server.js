import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = Fastify({ 
  logger: true 
});

// Serve static files from public folder
await app.register(fastifyStatic, {
  root: join(__dirname, "public"),
  prefix: "/"
});

// Enhanced proxy endpoint
app.get("/proxy", async (request, reply) => {
  try {
    const targetUrl = request.query.url;

    if (!targetUrl) {
      return reply.code(400).send({ error: "Missing URL parameter" });
    }

    // Validate URL format
    let decodedUrl;
    try {
      decodedUrl = decodeURIComponent(targetUrl);
      if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
        return reply.code(400).send({ error: "Invalid URL - must start with http:// or https://" });
      }
      new URL(decodedUrl); // This will throw if invalid
    } catch (e) {
      return reply.code(400).send({ error: "Invalid URL format" });
    }

    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      redirect: 'follow'
    });
    
    if (!response.ok) {
      return reply.code(response.status).send({ 
        error: `Failed to fetch: ${response.status} ${response.statusText}` 
      });
    }

    const contentType = response.headers.get('content-type') || 'text/html';
    
    // Handle non-HTML content (images, CSS, JS)
    if (!contentType.includes('text/html')) {
      const buffer = await response.arrayBuffer();
      
      reply.header("Access-Control-Allow-Origin", "*");
      reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      reply.removeHeader("X-Frame-Options");
      reply.removeHeader("Content-Security-Policy");
      
      return reply.type(contentType).send(Buffer.from(buffer));
    }

    // Handle HTML content with frame-busting prevention
    let content = await response.text();

    // Enhanced frame-busting prevention
    const framePreventionScript = `
<script>
// ULTRA frame-busting prevention
(function() {
    // Override window properties
    const overrides = ['top', 'parent', 'frameElement', 'frames', 'length', 'self'];
    overrides.forEach(prop => {
        try {
            if (prop === 'top' || prop === 'parent') {
                Object.defineProperty(window, prop, {
                    configurable: false,
                    get: () => window,
                    set: () => {}
                });
            } else if (prop === 'frameElement') {
                Object.defineProperty(window, prop, {
                    configurable: false,
                    get: () => null
                });
            } else if (prop === 'frames') {
                Object.defineProperty(window, prop, {
                    configurable: false,
                    get: () => window
                });
            }
        } catch(e) {}
    });

    // Block navigation attempts
    const originalReplace = window.location.replace;
    const originalAssign = window.location.assign;
    
    window.location.replace = function(url) {
        console.log('Blocked replace:', url);
        return false;
    };
    
    window.location.assign = function(url) {
        console.log('Blocked assign:', url);
        return false;
    };
    
    // Block common frame-busting scripts
    const checkers = [
        'top !== self',
        'top != self', 
        'self != top',
        'self !== top',
        'window.top !== window.self',
        'window.top != window.self',
        'parent !== self',
        'parent != self'
    ];
    
    // Override common detection methods
    window.self = window;
    window.top = window;
    window.parent = window;
    
    // Intercept script tags
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName) {
        const element = originalCreateElement.call(document, tagName);
        if (tagName.toLowerCase() === 'script') {
            const originalSrcDescriptor = Object.getOwnPropertyDescriptor(element, 'src');
            Object.defineProperty(element, 'src', {
                get: () => originalSrcDescriptor?.get?.call(element),
                set: (value) => {
                    if (value && typeof value === 'string') {
                        // Allow the script to load but monitor it
                        console.log('Loading script:', value);
                        return originalSrcDescriptor?.set?.call(element, value);
                    }
                }
            });
        }
        return element;
    };
})();
</script>
`;

    // Inject the script
    if (content.includes('<head>')) {
        content = content.replace('<head>', '<head>' + framePreventionScript);
    } else {
        content = framePreventionScript + content;
    }

    // Remove existing frame-busting scripts more aggressively
    const bustingPatterns = [
        /if\s*\(\s*top\s*!==?\s*self\s*\)/gi,
        /if\s*\(\s*self\s*!==?\s*top\s*\)/gi,
        /if\s*\(\s*parent\s*!==?\s*self\s*\)/gi,
        /top\.location\s*=/gi,
        /parent\.location\s*=/gi,
        /window\.top\.location/gi,
        /window\.parent\.location/gi,
        /location\.replace/gi,
        /location\.assign/gi
    ];

    bustingPatterns.forEach(pattern => {
        content = content.replace(pattern, '// BLOCKED: $&');
    });

    // Set headers
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    reply.header("Cache-Control", "no-cache");
    reply.removeHeader("X-Frame-Options");
    reply.removeHeader("Content-Security-Policy");

    return reply.type(contentType).send(content);
  } catch (error) {
    console.error('Proxy error:', error);
    return reply.code(500).send({ 
      error: "Proxy failed to fetch the URL",
      details: error.message 
    });
  }
});

// Handle OPTIONS for CORS preflight
app.options("/proxy", async (request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return reply.send();
});

// Serve index.html for all other routes
app.setNotFoundHandler((request, reply) => {
  reply.sendFile("index.html");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 BLACKO Proxy running at: ${address}`);
  console.log(`📁 Serving files from: ${join(__dirname, "public")}`);
  console.log(`🔗 Proxy endpoint: ${address}/proxy?url=YOUR_URL`);
});
