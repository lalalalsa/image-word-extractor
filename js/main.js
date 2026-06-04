(function () {
  "use strict";

  /* ===== DOM Refs ===== */
  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const previewList = document.getElementById("previewList");
  const runBtn = document.getElementById("runBtn");
  const dedupeBtn = document.getElementById("dedupeBtn");
  const sortBtn = document.getElementById("sortBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const clearBtn = document.getElementById("clearBtn");
  const resultText = document.getElementById("resultText");
  const statusBar = document.getElementById("status");
  const statusDot = statusBar.querySelector(".status-dot");
  const statusText = statusBar.querySelector(".status-text");
  const wordCount = document.getElementById("wordCount");
  const ocrMode = document.getElementById("ocrMode");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const apiUrlInput = document.getElementById("apiUrlInput");
  const apiModelInput = document.getElementById("apiModelInput");
  const toggleApiKeyBtn = document.getElementById("toggleApiKeyBtn");
  const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
  const clearApiKeyBtn = document.getElementById("clearApiKeyBtn");
  const toast = document.getElementById("toast");

  /* ===== Constants ===== */
  const API_KEY_STORAGE = "image_word_extractor_api_key";
  const API_URL_STORAGE = "image_word_extractor_api_url";
  const API_MODEL_STORAGE = "image_word_extractor_api_model";
  const DEFAULT_API_URL = "https://api.xiaomimimo.com/v1/chat/completions";
  const DEFAULT_API_MODEL = "mimo-v2.5";
  const EMPTY_PREVIEW_HTML =
    '<div class="preview-empty"><span class="icon">📷</span><span>暂无图片，请先上传</span></div>';

  /* ===== State ===== */
  let selectedFiles = [];
  let objectUrls = [];
  let toastTimer = null;

  /* ===== Toast ===== */
  function showToast(message, type) {
    if (toastTimer) clearTimeout(toastTimer);

    toast.textContent = message;
    toast.className = "toast " + (type || "");
    // force reflow
    void toast.offsetWidth;
    toast.classList.add("show");

    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
      toastTimer = null;
    }, 2500);
  }

  /* ===== Status Bar ===== */
  function setStatus(message, level) {
    statusText.textContent = message;
    statusBar.classList.remove("error", "success");

    if (level === "error") {
      statusBar.classList.add("error");
    } else if (level === "success") {
      statusBar.classList.add("success");
    }
  }

  /* ===== Busy State ===== */
  function setBusy(busy) {
    var interactive =
      [runBtn, ocrMode, apiKeyInput, apiUrlInput, apiModelInput,
       saveApiKeyBtn, clearApiKeyBtn, toggleApiKeyBtn, fileInput];

    interactive.forEach(function (el) { el.disabled = busy; });

    if (busy) {
      statusDot.style.background = "#f59e0b";
      statusDot.style.animation = "pulse-dot 1.5s ease infinite";
    } else {
      statusDot.style.background = "";
      statusDot.style.animation = "";
    }
  }

  /* ===== Word Helpers ===== */
  function updateWordCount() {
    var count = getCurrentWords().length;
    wordCount.textContent = count + " 个单词";
  }

  function getCurrentWords() {
    return resultText.value
      .split(/\r?\n/)
      .map(function (w) { return w.trim(); })
      .filter(Boolean);
  }

  function extractWords(text) {
    var normalized = text
      .replace(/[’']/g, "")
      .replace(/[‐-―]/g, "-");
    var matches = normalized.match(/[A-Za-z]+(?:-[A-Za-z]+)*/g) || [];
    return matches
      .map(function (w) { return w.trim(); })
      .filter(function (w) { return w.length > 1; });
  }

  function appendWords(words) {
    var current = getCurrentWords();
    resultText.value = current.concat(words).join("\n");
    updateWordCount();
  }

  /* ===== Preview ===== */
  function renderPreviews(files) {
    objectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    objectUrls = [];
    previewList.innerHTML = "";

    if (!files.length) {
      previewList.innerHTML = EMPTY_PREVIEW_HTML;
      return;
    }

    files.forEach(function (file) {
      var url = URL.createObjectURL(file);
      objectUrls.push(url);

      var item = document.createElement("div");
      item.className = "preview-item";

      var img = document.createElement("img");
      img.src = url;
      img.alt = file.name;
      img.loading = "lazy";

      var name = document.createElement("div");
      name.className = "preview-name";
      name.textContent = file.name;

      item.append(img, name);
      previewList.appendChild(item);
    });
  }

  function handleFiles(files) {
    selectedFiles = Array.from(files).filter(function (f) {
      return f.type.startsWith("image/");
    });

    renderPreviews(selectedFiles);

    if (selectedFiles.length) {
      setStatus("已选择 " + selectedFiles.length + " 张图片，点击「开始识别」即可", "success");
    } else {
      setStatus("没有可识别的图片文件", "error");
    }
  }

  /* ===== File → Data URL ===== */
  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }

  /* ===== OCR: API ===== */
  async function recognizeWithApi(file) {
    // file:// 协议下 /api/ocr 不可用，给出明确提示
    if (window.location.protocol === "file:") {
      throw new Error(
        "当前通过 file:// 打开，API OCR 不可用。" +
        "请用「启动图片单词提取工具.cmd」启动，或切换到浏览器 OCR 模式。"
      );
    }

    var apiKey = apiKeyInput.value.trim();
    var apiUrl = apiUrlInput.value.trim();
    var model = apiModelInput.value.trim();
    var image = await fileToDataUrl(file);

    var response = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: image,
        filename: file.name,
        apiKey: apiKey,
        apiUrl: apiUrl,
        model: model,
      }),
    });

    if (!response.ok) {
      var error = await response.json().catch(function () { return {}; });
      throw new Error(error.message || "API OCR 失败：" + response.status);
    }

    var data = await response.json();
    return data.text || "";
  }

  /* ===== OCR: Browser (Tesseract) ===== */
  async function recognizeWithBrowser(file) {
    if (!window.Tesseract) {
      throw new Error("Tesseract.js 未加载，请检查网络或使用 API OCR。");
    }

    var result = await window.Tesseract.recognize(file, "eng", {
      logger: function (event) {
        if (event.status === "recognizing text") {
          var pct = Math.round(event.progress * 100);
          setStatus("浏览器 OCR 识别中：" + file.name + "（" + pct + "%）");
        }
      },
    });

    return result.data.text || "";
  }

  /* ===== OCR Dispatcher ===== */
  async function recognizeFile(file) {
    var mode = ocrMode.value;

    if (mode === "browser") {
      return recognizeWithBrowser(file);
    }

    if (mode === "api") {
      return recognizeWithApi(file);
    }

    // auto
    try {
      return await recognizeWithApi(file);
    } catch (err) {
      setStatus("API OCR 不可用 → 自动切换浏览器 OCR：" + err.message);
      return recognizeWithBrowser(file);
    }
  }

  /* ===== Run OCR ===== */
  async function runOcr() {
    if (!selectedFiles.length) {
      setStatus("请先上传图片", "error");
      showToast("⚠️ 请先上传图片", "error");
      return;
    }

    setBusy(true);
    setStatus("准备识别……");

    try {
      var allWords = [];

      for (var i = 0; i < selectedFiles.length; i++) {
        var file = selectedFiles[i];
        setStatus("识别中 " + (i + 1) + "/" + selectedFiles.length + "：" + file.name);
        var text = await recognizeFile(file);
        var words = extractWords(text);
        allWords.push.apply(allWords, words);
      }

      appendWords(allWords);
      setStatus("识别完成，新增 " + allWords.length + " 个英文单词", "success");
      showToast("✅ 识别完成，新增 " + allWords.length + " 个单词");
    } catch (err) {
      setStatus(err.message || "识别失败", "error");
      showToast("❌ " + (err.message || "识别失败"), "error");
    } finally {
      setBusy(false);
    }
  }

  /* ===== Dedupe ===== */
  function dedupeWords() {
    var seen = new Set();
    var words = getCurrentWords().filter(function (w) {
      var key = w.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    resultText.value = words.join("\n");
    updateWordCount();
    setStatus("已去重，当前 " + words.length + " 个单词", "success");
    showToast("🔍 去重完成：" + words.length + " 个单词");
  }

  /* ===== Sort ===== */
  function sortWords() {
    var words = getCurrentWords().sort(function (a, b) {
      return a.localeCompare(b, "en", { sensitivity: "base" });
    });

    resultText.value = words.join("\n");
    updateWordCount();
    setStatus("已按字母顺序排序", "success");
    showToast("🔤 排序完成");
  }

  /* ===== Download ===== */
  function downloadTxt() {
    var words = getCurrentWords();

    if (!words.length) {
      setStatus("没有可导出的单词", "error");
      showToast("⚠️ 没有可导出的单词", "error");
      return;
    }

    var blob = new Blob([words.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "extracted_words.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setStatus("已导出 extracted_words.txt", "success");
    showToast("📥 已导出 " + words.length + " 个单词");
  }

  /* ===== Clear ===== */
  function clearAll() {
    selectedFiles = [];
    objectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    objectUrls = [];
    previewList.innerHTML = EMPTY_PREVIEW_HTML;
    fileInput.value = "";
    resultText.value = "";
    updateWordCount();
    setStatus("已清空");
  }

  /* ===== API Key Management ===== */
  function loadApiKey() {
    apiKeyInput.value = localStorage.getItem(API_KEY_STORAGE) || "";
    apiUrlInput.value = localStorage.getItem(API_URL_STORAGE) || DEFAULT_API_URL;
    apiModelInput.value = localStorage.getItem(API_MODEL_STORAGE) || DEFAULT_API_MODEL;
  }

  function saveApiKey() {
    var apiKey = apiKeyInput.value.trim();
    var apiUrl = apiUrlInput.value.trim();
    var model = apiModelInput.value.trim();

    if (!apiKey) {
      localStorage.removeItem(API_KEY_STORAGE);
    } else {
      localStorage.setItem(API_KEY_STORAGE, apiKey);
    }

    localStorage.setItem(API_URL_STORAGE, apiUrl || DEFAULT_API_URL);
    localStorage.setItem(API_MODEL_STORAGE, model || DEFAULT_API_MODEL);
    apiUrlInput.value = apiUrl || DEFAULT_API_URL;
    apiModelInput.value = model || DEFAULT_API_MODEL;

    setStatus("API 设置已保存到浏览器", "success");
    showToast("💾 API 设置已保存");
  }

  function clearApiKey() {
    apiKeyInput.value = "";
    apiUrlInput.value = DEFAULT_API_URL;
    apiModelInput.value = DEFAULT_API_MODEL;
    localStorage.removeItem(API_KEY_STORAGE);
    localStorage.removeItem(API_URL_STORAGE);
    localStorage.removeItem(API_MODEL_STORAGE);
    setStatus("API 设置已恢复默认");
  }

  function toggleApiKeyVisible() {
    var show = apiKeyInput.type === "password";
    apiKeyInput.type = show ? "text" : "password";
    toggleApiKeyBtn.textContent = show ? "🙈" : "👁️";
  }

  /* ===== Event Binding ===== */
  fileInput.addEventListener("change", function () {
    handleFiles(fileInput.files);
  });

  runBtn.addEventListener("click", runOcr);
  dedupeBtn.addEventListener("click", dedupeWords);
  sortBtn.addEventListener("click", sortWords);
  downloadBtn.addEventListener("click", downloadTxt);
  clearBtn.addEventListener("click", clearAll);
  resultText.addEventListener("input", updateWordCount);
  saveApiKeyBtn.addEventListener("click", saveApiKey);
  clearApiKeyBtn.addEventListener("click", clearApiKey);
  toggleApiKeyBtn.addEventListener("click", toggleApiKeyVisible);

  /* Drag & Drop */
  dropZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropZone.classList.add("is-over");
  });

  dropZone.addEventListener("dragleave", function () {
    dropZone.classList.remove("is-over");
  });

  dropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropZone.classList.remove("is-over");
    handleFiles(e.dataTransfer.files);
  });

  /* ===== Init ===== */
  loadApiKey();
  updateWordCount();
  renderPreviews([]);
  setStatus("等待上传图片");
})();
