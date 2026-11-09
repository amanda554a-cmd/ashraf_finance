/**
 * Zero-Dependency Server for Chrome Raw Camera & Forensic Metadata Studio
 * - Serves HTTP on http://localhost:3000 (Secure Context on PC)
 * - Serves HTTPS on https://<LAN-IP>:3443 (Secure Context for Mobile Phones over Wi-Fi)
 * - Archives untouched raw binary captures + lossless EXIF copies + full JSON metadata to ./captures/
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const HTTP_PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const ROOT_DIR = __dirname;
const CAPTURES_DIR = path.join(ROOT_DIR, 'captures');

if (!fs.existsSync(CAPTURES_DIR)) {
  fs.mkdirSync(CAPTURES_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Pure Node.js ASN.1 DER Self-Signed X.509 Certificate Generator
 * Enables HTTPS on LAN IP for Mobile Chrome without requiring external npm packages.
 */
function generateSelfSignedCert() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  function derLen(len) {
    if (len < 128) return Buffer.from([len]);
    const hex = len.toString(16).padStart(len > 255 ? 4 : 2, '0');
    const bytes = Buffer.from(hex, 'hex');
    return Buffer.concat([Buffer.from([0x80 | bytes.length]), bytes]);
  }
  function derNode(tag, content) {
    return Buffer.concat([Buffer.from([tag]), derLen(content.length), content]);
  }
  function derSeq(...items) {
    return derNode(0x30, Buffer.concat(items));
  }
  function derSet(...items) {
    return derNode(0x31, Buffer.concat(items));
  }
  function derOid(oidHex) {
    return derNode(0x06, Buffer.from(oidHex, 'hex'));
  }
  function derUtf8(str) {
    return derNode(0x0c, Buffer.from(str, 'utf8'));
  }
  function derUtcTime(date) {
    const pad = n => String(n).padStart(2, '0');
    const s =
      String(date.getUTCFullYear()).slice(-2) +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      'Z';
    return derNode(0x17, Buffer.from(s, 'ascii'));
  }

  // sha256WithRSAEncryption (1.2.840.113549.1.1.11)
  const algId = derSeq(derOid('2a864886f70d01010b'), Buffer.from([0x05, 0x00]));
  // CN=ChromeRawForensicStudio
  const name = derSeq(derSet(derSeq(derOid('550403'), derUtf8('ChromeRawForensicStudio'))));
  const now = new Date(Date.now() - 86400000);
  const exp = new Date(Date.now() + 365 * 86400000);
  const validity = derSeq(derUtcTime(now), derUtcTime(exp));
  const version = derNode(0xa0, Buffer.from([0x02, 0x01, 0x02])); // v3
  const serial = derNode(0x02, Buffer.concat([Buffer.from([0x01]), crypto.randomBytes(7)]));

  const tbs = derSeq(version, serial, algId, name, validity, name, publicKey);
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(tbs);
  const sig = signer.sign(privateKey);
  const bitStringSig = derNode(0x03, Buffer.concat([Buffer.from([0x00]), sig]));
  const certDer = derSeq(tbs, algId, bitStringSig);
  const certPem =
    '-----BEGIN CERTIFICATE-----\n' +
    certDer.toString('base64').match(/.{1,64}/g).join('\n') +
    '\n-----END CERTIFICATE-----\n';

  return { key: privateKey, cert: certPem };
}

function handleRequest(req, res) {
  // Set Permissions-Policy headers so Chrome allows full camera, geolocation, gyroscope, accelerometer
  res.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)'
  );
  res.setHeader('Accept-CH', 'Sec-CH-UA, Sec-CH-UA-Arch, Sec-CH-UA-Bitness, Sec-CH-UA-Full-Version-List, Sec-CH-UA-Mobile, Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version');

  if (req.method === 'GET' && req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      capturesDir: CAPTURES_DIR
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/save-capture') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 150 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const safeId = String(payload.id || `RAW_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeExt = String(payload.ext || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
        const cleanMobileFile = payload.mobileFilename
          ? String(payload.mobileFilename).replace(/[^a-zA-Z0-9._-]/g, '_')
          : `${safeId}.${safeExt}`;

        const mobilePhotoPath = path.join(CAPTURES_DIR, cleanMobileFile);
        const rawFilePath = path.join(CAPTURES_DIR, `${safeId}_RAW_STREAM.${safeExt}`);
        const jsonFilePath = path.join(CAPTURES_DIR, `${safeId}_METADATA.json`);

        if (payload.enrichedBase64) {
          fs.writeFileSync(mobilePhotoPath, Buffer.from(payload.enrichedBase64, 'base64'));
        }
        if (payload.rawBase64) {
          fs.writeFileSync(rawFilePath, Buffer.from(payload.rawBase64, 'base64'));
        }
        if (payload.metadata) {
          fs.writeFileSync(jsonFilePath, JSON.stringify(payload.metadata, null, 2), 'utf8');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, folder: CAPTURES_DIR, id: safeId, mobileFile: cleanMobileFile }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Static files
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT_DIR, urlPath));

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(content);
  });
}

function getLanIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

const httpServer = http.createServer(handleRequest);
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`\n=============================================================`);
  console.log(` Chrome RAW Camera & Forensic Metadata Studio is RUNNING`);
  console.log(`=============================================================`);
  console.log(` -> PC Chrome (Localhost):   http://localhost:${HTTP_PORT}`);
  const lanIps = getLanIps();
  lanIps.forEach(ip => {
    console.log(` -> LAN HTTP:                http://${ip}:${HTTP_PORT}`);
  });
});

try {
  const creds = generateSelfSignedCert();
  const httpsServer = https.createServer(creds, handleRequest);
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    const lanIps = getLanIps();
    console.log(` -> PC HTTPS:                https://localhost:${HTTPS_PORT}`);
    lanIps.forEach(ip => {
      console.log(` -> Phone Chrome (Wi-Fi):    https://${ip}:${HTTPS_PORT}`);
    });
    console.log(` -> Auto-Save Folder on PC:  ${CAPTURES_DIR}`);
    console.log(`=============================================================\n`);
  });
} catch (err) {
  console.warn('HTTPS setup skipped:', err.message);
}
