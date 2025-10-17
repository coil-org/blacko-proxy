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

// ULTIMATE proxy endpoint - Maximum compatibility
app.get("/proxy", async (request, reply) => {
  try {
    const targetUrl = request.query.url;

    if (!targetUrl) {
      return reply.code(400).send({ error: "Missing URL parameter" });
    }

    // Validate URL
    let decodedUrl;
    try {
      decodedUrl = decodeURIComponent(targetUrl);
      if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
        return reply.code(400).send({ error: "Invalid URL" });
      }
      new URL(decodedUrl);
    } catch (e) {
      return reply.code(400).send({ error: "Invalid URL format" });
    }

    // Fetch with realistic headers
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      redirect: 'follow',
      timeout: 30000
    });

    if (!response.ok) {
      return reply.code(200).send(`
        <html>
          <body>
            <h1>BLACKO - Page Load Issue</h1>
            <p>Status: ${response.status} ${response.statusText}</p>
            <button onclick="window.location.reload()">Retry</button>
            <button onclick="history.back()">Go Back</button>
          </body>
        </html>
      `);
    }

    const contentType = response.headers.get('content-type') || 'text/html';
    
    // Handle non-HTML content
    if (!contentType.includes('text/html')) {
      const buffer = await response.arrayBuffer();
      reply.header("Access-Control-Allow-Origin", "*");
      reply.removeHeader("X-Frame-Options");
      reply.removeHeader("Content-Security-Policy");
      return reply.type(contentType).send(Buffer.from(buffer));
    }

    let content = await response.text();

    // ULTRA AGGRESSIVE Frame-Busting Prevention
    const antiFrameScript = `
<!-- BLACKO Proxy Injection -->
<script>
// NUCLEAR frame-busting prevention
(function() {
    'use strict';
    
    // Override EVERYTHING at the prototype level
    const overrideWindowProperties = () => {
        const originalWindow = window;
        
        // Override window.top, window.parent, window.self
        try {
            Object.defineProperty(window, 'top', {
                get: () => window,
                set: () => {},
                configurable: false
            });
        } catch(e) {}
        
        try {
            Object.defineProperty(window, 'parent', {
                get: () => window,
                set: () => {},
                configurable: false
            });
        } catch(e) {}
        
        try {
            Object.defineProperty(window, 'frameElement', {
                get: () => null,
                set: () => {},
                configurable: false
            });
        } catch(e) {}
        
        try {
            Object.defineProperty(window, 'frames', {
                get: () => window,
                set: () => {},
                configurable: false
            });
        } catch(e) {}
        
        try {
            Object.defineProperty(window, 'self', {
                get: () => window,
                set: () => {},
                configurable: false
            });
        } catch(e) {}
        
        // Override window.length
        try {
            Object.defineProperty(window, 'length', {
                get: () => 0,
                set: () => {},
                configurable: false
            });
        } catch(e) {}
    };

    // Override location methods COMPLETELY
    const overrideLocation = () => {
        const originalLocation = window.location;
        
        // Create a fake location object
        const fakeLocation = {
            href: originalLocation.href,
            protocol: originalLocation.protocol,
            host: originalLocation.host,
            hostname: originalLocation.hostname,
            port: originalLocation.port,
            pathname: originalLocation.pathname,
            search: originalLocation.search,
            hash: originalLocation.hash,
            origin: originalLocation.origin,
            
            assign: function(url) {
                console.log('[BLACKO] Blocked location.assign:', url);
                return false;
            },
            
            replace: function(url) {
                console.log('[BLACKO] Blocked location.replace:', url);
                return false;
            },
            
            reload: function() {
                return originalLocation.reload();
            },
            
            toString: function() {
                return originalLocation.toString();
            }
        };
        
        try {
            Object.defineProperty(window, 'location', {
                get: () => fakeLocation,
                set: (value) => {
                    console.log('[BLACKO] Blocked location set to:', value);
                    return false;
                },
                configurable: false
            });
        } catch(e) {}
    };

    // Nuclear option: Override entire Window constructor
    const overrideWindowConstructor = () => {
        const OriginalWindow = window.constructor;
        
        function FakeWindow() {
            const win = OriginalWindow.apply(this, arguments);
            
            // Override properties on new windows
            try {
                Object.defineProperty(win, 'top', { get: () => win });
                Object.defineProperty(win, 'parent', { get: () => win });
                Object.defineProperty(win, 'frameElement', { get: () => null });
            } catch(e) {}
            
            return win;
        }
        
        FakeWindow.prototype = OriginalWindow.prototype;
        window.constructor = FakeWindow;
    };

    // Intercept and modify JavaScript on the fly
    const interceptScripts = () => {
        const originalCreateElement = document.createElement;
        
        document.createElement = function(tagName) {
            const element = originalCreateElement.call(this, tagName);
            
            if (tagName.toLowerCase() === 'script') {
                // Intercept script content loading
                const originalTextDescriptor = Object.getOwnPropertyDescriptor(element, 'text');
                const originalInnerHTMLDescriptor = Object.getOwnPropertyDescriptor(element, 'innerHTML');
                const originalSrcDescriptor = Object.getOwnPropertyDescriptor(element, 'src');
                
                if (originalTextDescriptor) {
                    Object.defineProperty(element, 'text', {
                        get: () => originalTextDescriptor.get.call(element),
                        set: (value) => {
                            if (value && typeof value === 'string') {
                                const cleaned = cleanScriptContent(value);
                                return originalTextDescriptor.set.call(element, cleaned);
                            }
                            return originalTextDescriptor.set.call(element, value);
                        }
                    });
                }
                
                if (originalInnerHTMLDescriptor) {
                    Object.defineProperty(element, 'innerHTML', {
                        get: () => originalInnerHTMLDescriptor.get.call(element),
                        set: (value) => {
                            if (value && typeof value === 'string') {
                                const cleaned = cleanScriptContent(value);
                                return originalInnerHTMLDescriptor.set.call(element, cleaned);
                            }
                            return originalInnerHTMLDescriptor.set.call(element, value);
                        }
                    });
                }
                
                // Allow src scripts but monitor them
                if (originalSrcDescriptor && element.setAttribute) {
                    const originalSetAttribute = element.setAttribute;
                    element.setAttribute = function(name, value) {
                        if (name === 'src' && value) {
                            console.log('[BLACKO] Loading external script:', value);
                        }
                        return originalSetAttribute.call(this, name, value);
                    };
                }
            }
            
            return element;
        };
    };

    // Clean script content from frame-busting code
    const cleanScriptContent = (content) => {
        if (!content || typeof content !== 'string') return content;
        
        // Replace frame-busting patterns
        const patterns = [
            // Common frame detection
            /top\s*!==?\s*(self|window\.self|this\.self)/g,
            /(self|window\.self|this\.self)\s*!==?\s*top/g,
            /parent\s*!==?\s*(self|window\.self|this\.self)/g,
            /(self|window\.self|this\.self)\s*!==?\s*parent/g,
            /window\.top\s*!==?\s*window\.self/g,
            /window\.self\s*!==?\s*window\.top/g,
            
            // Location changes
            /top\.location\./g,
            /parent\.location\./g,
            /window\.top\.location/g,
            /window\.parent\.location/g,
            /location\.replace\(/g,
            /location\.assign\(/g,
            
            // Frame references
            /frames\[\d*\]/g,
            /window\.frames/g
        ];
        
        let cleaned = content;
        patterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '/* BLACKO-BLOCKED */ false && ');
        });
        
        // Specific replacements for common busters
        cleaned = cleaned
            .replace(/if\s*\(\s*top\s*!==?\s*self\s*\)/g, 'if(false)')
            .replace(/if\s*\(\s*self\s*!==?\s*top\s*\)/g, 'if(false)')
            .replace(/if\s*\(\s*parent\s*!==?\s*self\s*\)/g, 'if(false)')
            .replace(/top\.location\s*=/g, '// top.location =')
            .replace(/parent\.location\s*=/g, '// parent.location =')
            .replace(/window\.top\.location/g, 'window.location')
            .replace(/window\.parent\.location/g, 'window.location');
        
        return cleaned;
    };

    // Override postMessage to prevent communication
    const overridePostMessage = () => {
        const originalPostMessage = window.postMessage;
        window.postMessage = function(message, targetOrigin, transfer) {
            // Block messages that might break frames
            if (message && typeof message === 'string' && 
                (message.includes('frame') || message.includes('parent') || 
                 message.includes('top') || message.includes('buster'))) {
                console.log('[BLACKO] Blocked postMessage:', message);
                return;
            }
            return originalPostMessage.apply(this, arguments);
        };
    };

    // Execute all overrides
    overrideWindowProperties();
    overrideLocation();
    overridePostMessage();
    interceptScripts();
    
    // Try constructor override (may fail in strict mode)
    try {
        overrideWindowConstructor();
    } catch(e) {
        console.log('[BLACKO] Constructor override failed (normal in strict mode)');
    }

    // Continuous protection - re-apply every second
    setInterval(() => {
        overrideWindowProperties();
    }, 1000);

    console.log('[BLACKO] Nuclear frame protection activated');
})();
</script>
<style>
/* Hide any "open in new tab" banners */
[onclick*="top.location"],
[onclick*="parent.location"],
[href*="javascript:top.location"],
[href*="javascript:parent.location"] {
    display: none !important;
}
</style>
`;

    // Inject the nuclear script at the beginning
    content = antiFrameScript + content;

    // Additional content cleaning
    content = content
        // Remove common frame-busting meta tags
        .replace(/<meta[^>]*frame-options[^>]*>/gi, '')
        .replace(/<meta[^>]*csp[^>]*>/gi, '')
        
        // Remove common frame-busting scripts
        .replace(/<script[^>]*>[\s\S]*?top\.location[\s\S]*?<\/script>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?parent\.location[\s\S]*?<\/script>/gi, '')
        
        // Remove X-Frame-Options headers from meta tags
        .replace(/<meta[^>]*http-equiv=["']X-Frame-Options["'][^>]*>/gi, '')
        .replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

    // Set permissive headers
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "*");
    reply.header("Access-Control-Allow-Headers", "*");
    reply.header("Access-Control-Allow-Credentials", "true");
    reply.removeHeader("X-Frame-Options");
    reply.removeHeader("Content-Security-Policy");
    reply.removeHeader("X-Content-Type-Options");

    return reply.type('text/html').send(content);
  } catch (error) {
    console.error('Proxy error:', error);
    return reply.code(200).send(`
      <html>
        <body style="background: #1a1a2e; color: white; font-family: sans-serif; padding: 20px;">
          <h1>BLACKO - Proxy Error</h1>
          <p>Error: ${error.message}</p>
          <button onclick="window.location.reload()">Retry</button>
          <button onclick="history.back()">Go Back</button>
        </body>
      </html>
    `);
  }
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
  console.log(`🚀 BLACKO ULTRA Proxy running at: ${address}`);
  console.log(`🔗 Proxy ready to bypass most sites`);
});
