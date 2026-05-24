const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const ROOT_WITH_SEPARATOR = `${ROOT}${path.sep}`;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function send(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, headers);
  response.end(body);
}

function resolveRequestPath(urlPath) {
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  } catch (error) {
    return null;
  }

  const normalizedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const requestedPath = path.normalize(normalizedPath).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = path.resolve(ROOT, `.${requestedPath}`);

  if (absolutePath !== ROOT && !absolutePath.startsWith(ROOT_WITH_SEPARATOR)) {
    return null;
  }

  return absolutePath;
}

function fileHeaders(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const headers = {
    "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
  };

  if (extension === ".webmanifest" || path.basename(filePath) === "sw.js") {
    headers["Cache-Control"] = "no-cache";
  }

  return headers;
}

const server = http.createServer((request, response) => {
  if (!request.url) {
    send(response, 400, "Bad Request");
    return;
  }

  const absolutePath = resolveRequestPath(request.url);
  if (!absolutePath) {
    send(response, 403, "Forbidden");
    return;
  }

  fs.stat(absolutePath, (statError, stats) => {
    if (statError) {
      send(response, 404, "Not Found");
      return;
    }

    const finalPath = stats.isDirectory() ? path.join(absolutePath, "index.html") : absolutePath;
    fs.readFile(finalPath, (readError, content) => {
      if (readError) {
        send(response, 500, "Internal Server Error");
        return;
      }

      send(response, 200, content, fileHeaders(finalPath));
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Flappy Bird Club is running at http://${HOST}:${PORT}`);
  console.log("Open that URL on desktop, or use localhost on your phone for install testing.");
});
