/**
 * Safe JSON Body Parser Middleware Stage
 *
 * Buffers and parses JSON payloads with a strict size limit (default 512KB),
 * while cleanly bypassing streaming binary uploads (e.g. /api/upload).
 */

const { BadRequestError } = require('../core/errors');
const { classifyRoute } = require('../routing/routes');

const DEFAULT_MAX_SIZE_BYTES = 512 * 1024; // 512 KB

/**
 * Creates the Body Parser middleware stage.
 *
 * @param {object} [options]
 * @param {number} [options.maxSizeBytes] - Maximum allowed payload size in bytes
 * @returns {Function} (ctx, next) => Promise<void>
 */
function createBodyParserStage(options = {}) {
  const maxSizeBytes = options.maxSizeBytes || DEFAULT_MAX_SIZE_BYTES;

  return async function bodyParserStage(ctx, next) {
    const method = ctx.method;

    // Methods without body payloads
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      await next();
      return;
    }

    // Bypass binary uploads and streaming endpoints
    const classification = classifyRoute(method, ctx.pathname);
    if (classification.isUpload || ctx.pathname.startsWith('/api/upload')) {
      await next();
      return;
    }

    const contentType = (ctx.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('multipart/') || contentType.includes('application/octet-stream')) {
      await next();
      return;
    }

    // Buffer incoming body
    await new Promise((resolve, reject) => {
      let receivedBytes = 0;
      const chunks = [];

      function onData(chunk) {
        receivedBytes += chunk.length;
        if (receivedBytes > maxSizeBytes) {
          cleanup();
          reject(new BadRequestError('Payload Too Large: Exceeded 512KB limit', 'PAYLOAD_TOO_LARGE', {
            code: 413,
            maxBytes: maxSizeBytes,
          }));
          return;
        }
        chunks.push(chunk);
      }

      function onEnd() {
        cleanup();
        const rawBody = Buffer.concat(chunks).toString('utf8').trim();
        if (!rawBody) {
          ctx.body = {};
          resolve();
          return;
        }

        try {
          ctx.body = JSON.parse(rawBody);
          resolve();
        } catch (err) {
          reject(new BadRequestError('Bad Request: Invalid JSON payload', 'INVALID_JSON'));
        }
      }

      function onError(err) {
        cleanup();
        reject(err);
      }

      function cleanup() {
        ctx.req.removeListener('data', onData);
        ctx.req.removeListener('end', onEnd);
        ctx.req.removeListener('error', onError);
      }

      ctx.req.on('data', onData);
      ctx.req.on('end', onEnd);
      ctx.req.on('error', onError);
    });

    await next();
  };
}

module.exports = {
  createBodyParserStage,
};
