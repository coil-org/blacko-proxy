import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

// Simple proxy endpoint - Fixed version with frame-busting prevention
app.get("/proxy", async (request, reply) => {
  try {
    const targetUrl = request.query.url;

    if (!targetUrl) {
      return reply.code(400).send({ error: "Missing URL parameter" });
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return reply.code(400).send({ error: "Invalid URL - must start with http:// or https://" });
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': request.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const contentType = response.headers.get('content-type') || 'text/html';
    let content = await response.text();

    // If it's HTML, inject aggressive frame-busting prevention
    if (contentType.includes('text/html')) {
      // Super aggressive anti-frame-busting script
      const framePreventionScript = `
        <script>
          // AGGRESSIVE frame-busting prevention
          (function() {
            // Override window properties
            try {
              Object.defineProperty(window, 'top', {
                configurable: false,
                get: function() { return window.self; },
                set: function() {}
              });
              Object.defineProperty(window, 'parent', {
                configurable: false,
                get: function() { return window.self; },
                set: function() {}
              });
              Object.defineProperty(window, 'frameElement', {
                configurable: false,
                get: function() { return null; }
              });
            } catch(e) {}
            
            // Prevent location changes
            var originalReplace = window.location.replace;
            var originalAssign = window.location.assign;
            
            window.location.replace = function(url) {
              if (url && !url.includes(window.location.hostname)) {
                console.log('Blocked navigation to:', url);
                return;
              }
              return originalReplace.call(window.location, url);
            };
            
            window.location.assign = function(url) {
              if (url && !url.includes(window.location.hostname)) {
                console.log('Blocked navigation to:', url);
                return;
              }
              return originalAssign.call(window.location, url);
            };
            
            // Intercept document.write to prevent navigation scripts
            var originalWrite = document.write;
            document.write = function(content) {
              if (content && (content.includes('top.location') || content.includes('parent.location'))) {
                console.log('Blocked frame-busting script');
                return;
              }
              return originalWrite.call(document, content);
            };
          })();
        </script>
      `;
      
      // Insert after <head> tag or at the beginning
      if (content.includes('<head>')) {
        content = content.replace('<head>', '<head>' + framePreventionScript);
      } else if (content.includes('<html>')) {
        content = content.replace('<html>', '<html>' + framePreventionScript);
      } else {
        content = framePreventionScript + content;
      }
      
      // Also remove any existing frame-busting scripts
      content = content.replace(/if\s*\(\s*top\s*!==?\s*self\s*\)/gi, 'if(false)');
      content = content.replace(/if\s*\(\s*self\s*!==?\s*top\s*\)/gi, 'if(false)');
      content = content.replace(/top\.location\s*=/gi, '//top.location=');
      content = content.replace(/parent\.location\s*=/gi, '//parent.location=');
    }

    // Set CORS headers and remove frame-blocking headers
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    reply.header("Cache-Control", "no-cache");
    
    // IMPORTANT: Remove headers that prevent iframe embedding
    reply.removeHeader("X-Frame-Options");
    reply.removeHeader("Content-Security-Policy");

    return reply.type(contentType).send(content);
  } catch (error) {
    console.error('Proxy error:', error);
    return reply.code(500).send({ error: "Proxy failed: " + error.message });
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
  console.log(`📁 Open the URL shown above or in the preview panel`);
});
