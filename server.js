const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 5177);
const API_URL = process.env.OCR_API_URL || "https://api.xiaomimimo.com/v1/chat/completions";
const API_KEY = process.env.OCR_API_KEY || "";
const MODEL = process.env.OCR_MODEL || "mimo-v2.5";
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".js": "application/javascript;charset=utf-8",
  ".json": "application/json;charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json;charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error("图片过大，请换一张更小的图片。"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(new Error("请求 JSON 格式不正确。"));
      }
    });
    req.on("error", reject);
  });
}

function getTextFromResponse(data) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  if (Array.isArray(data.output)) {
    return data.output
      .flatMap((item) => item.content || [])
      .map((content) => content.text || "")
      .join("\n");
  }

  if (Array.isArray(data.choices)) {
    return data.choices
      .map((choice) => {
        const content = choice.message && choice.message.content;
        if (Array.isArray(content)) {
          return content.map((item) => item.text || "").join("\n");
        }
        return content;
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function buildPrompt() {
  return (
    "请只提取图片中的英文单词。忽略中文、数字、标点、表格线和其他符号。" +
    "如果是手写或 OCR 可能有误，请按常见英文单词修正。返回纯文本，每行一个英文单词，不要解释。"
  );
}

function buildRequestBody({ apiUrl, model, image, filename }) {
  if (apiUrl.includes("/chat/completions")) {
    return {
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: image,
              },
            },
            {
              type: "text",
              text: buildPrompt(),
            },
          ],
        },
      ],
      max_completion_tokens: 2048,
      temperature: 0,
      stream: false,
      metadata: {
        filename: filename || "uploaded-image",
      },
    };
  }

  return {
    model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildPrompt(),
          },
          {
            type: "input_image",
            image_url: image,
          },
        ],
      },
    ],
    metadata: {
      filename: filename || "uploaded-image",
    },
  };
}

function buildHeaders(apiUrl, apiKey) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (apiUrl.includes("xiaomimimo.com")) {
    headers["api-key"] = apiKey;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

async function handleOcr(req, res) {
  try {
    const { image, filename, apiKey, apiUrl, model } = await readJson(req);
    const activeApiKey = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : API_KEY;
    const activeApiUrl = typeof apiUrl === "string" && apiUrl.trim() ? apiUrl.trim() : API_URL;
    const activeModel = typeof model === "string" && model.trim() ? model.trim() : MODEL;

    if (!activeApiKey) {
      sendJson(res, 400, { message: "请在页面输入 API Key，或配置 OCR_API_KEY。" });
      return;
    }

    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      sendJson(res, 400, { message: "缺少图片数据。" });
      return;
    }

    const response = await fetch(activeApiUrl, {
      method: "POST",
      headers: buildHeaders(activeApiUrl, activeApiKey),
      body: JSON.stringify(buildRequestBody({ apiUrl: activeApiUrl, model: activeModel, image, filename })),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      sendJson(res, response.status, {
        message: data.error && data.error.message ? data.error.message : "API OCR 调用失败。",
      });
      return;
    }

    sendJson(res, 200, { text: getTextFromResponse(data) });
  } catch (error) {
    sendJson(res, 500, { message: error.message || "服务器处理失败。" });
  }
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const safePath = path.normalize(urlPath === "/" ? "/index.html" : urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/ocr") {
    handleOcr(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`图片英文单词提取工具已启动：http://localhost:${PORT}`);
});
