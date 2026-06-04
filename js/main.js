(function () {
  "use strict";

  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");
  const previewList = document.getElementById("previewList");
  const runBtn = document.getElementById("runBtn");
  const dedupeBtn = document.getElementById("dedupeBtn");
  const sortBtn = document.getElementById("sortBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const clearBtn = document.getElementById("clearBtn");
  const resultText = document.getElementById("resultText");
  const statusEl = document.getElementById("status");
  const wordCount = document.getElementById("wordCount");
  const ocrMode = document.getElementById("ocrMode");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const apiUrlInput = document.getElementById("apiUrlInput");
  const apiModelInput = document.getElementById("apiModelInput");
  const toggleApiKeyBtn = document.getElementById("toggleApiKeyBtn");
  const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
  const clearApiKeyBtn = document.getElementById("clearApiKeyBtn");

  const API_KEY_STORAGE = "image_word_extractor_api_key";
  const API_URL_STORAGE = "image_word_extractor_api_url";
  const API_MODEL_STORAGE = "image_word_extractor_api_model";
  const DEFAULT_API_URL = "https://api.xiaomimimo.com/v1/chat/completions";
  const DEFAULT_API_MODEL = "mimo-v2.5";

  let selectedFiles = [];
  let objectUrls = [];

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", Boolean(isError));
  }

  function setBusy(isBusy) {
    runBtn.disabled = isBusy;
    fileInput.disabled = isBusy;
    ocrMode.disabled = isBusy;
    apiKeyInput.disabled = isBusy;
    apiUrlInput.disabled = isBusy;
    apiModelInput.disabled = isBusy;
    saveApiKeyBtn.disabled = isBusy;
    clearApiKeyBtn.disabled = isBusy;
    toggleApiKeyBtn.disabled = isBusy;
  }

  function updateWordCount() {
    wordCount.textContent = `${getCurrentWords().length} 个单词`;
  }

  function getCurrentWords() {
    return resultText.value
      .split(/\r?\n/)
      .map((word) => word.trim())
      .filter(Boolean);
  }

  function extractWords(text) {
    const normalized = text
      .replace(/[’']/g, "")
      .replace(/[\u2010-\u2015]/g, "-");
    const matches = normalized.match(/[A-Za-z]+(?:-[A-Za-z]+)*/g) || [];
    return matches
      .map((word) => word.trim())
      .filter((word) => word.length > 1);
  }

  function appendWords(words) {
    const current = getCurrentWords();
    resultText.value = current.concat(words).join("\n");
    updateWordCount();
  }

  function renderPreviews(files) {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
    previewList.innerHTML = "";

    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.push(url);

      const item = document.createElement("div");
      item.className = "preview-item";

      const img = document.createElement("img");
      img.src = url;
      img.alt = file.name;

      const name = document.createElement("div");
      name.className = "preview-name";
      name.textContent = file.name;

      item.append(img, name);
      previewList.appendChild(item);
    });
  }

  function handleFiles(files) {
    selectedFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    renderPreviews(selectedFiles);
    setStatus(selectedFiles.length ? `已选择 ${selectedFiles.length} 张图片。` : "没有可识别的图片文件。", !selectedFiles.length);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function recognizeWithApi(file) {
    const apiKey = apiKeyInput.value.trim();
    const apiUrl = apiUrlInput.value.trim();
    const model = apiModelInput.value.trim();
    const image = await fileToDataUrl(file);
    const response = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, filename: file.name, apiKey, apiUrl, model }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API OCR 失败：${response.status}`);
    }

    const data = await response.json();
    return data.text || "";
  }

  async function recognizeWithBrowser(file) {
    if (!window.Tesseract) {
      throw new Error("Tesseract.js 未加载，请检查网络或使用 API OCR。");
    }

    const result = await window.Tesseract.recognize(file, "eng", {
      logger(event) {
        if (event.status === "recognizing text") {
          const progress = Math.round(event.progress * 100);
          setStatus(`浏览器 OCR 正在识别：${file.name}（${progress}%）`);
        }
      },
    });
    return result.data.text || "";
  }

  async function recognizeFile(file) {
    const mode = ocrMode.value;

    if (mode === "browser") {
      return recognizeWithBrowser(file);
    }

    if (mode === "api") {
      return recognizeWithApi(file);
    }

    try {
      return await recognizeWithApi(file);
    } catch (error) {
      setStatus(`API OCR 不可用，正在改用浏览器 OCR：${error.message}`);
      return recognizeWithBrowser(file);
    }
  }

  async function runOcr() {
    if (!selectedFiles.length) {
      setStatus("请先上传图片。", true);
      return;
    }

    setBusy(true);
    setStatus("开始识别图片...");

    try {
      const allWords = [];

      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        setStatus(`正在识别第 ${index + 1}/${selectedFiles.length} 张：${file.name}`);
        const text = await recognizeFile(file);
        allWords.push(...extractWords(text));
      }

      appendWords(allWords);
      setStatus(`识别完成，新增 ${allWords.length} 个英文单词。`);
    } catch (error) {
      setStatus(error.message || "识别失败。", true);
    } finally {
      setBusy(false);
    }
  }

  function dedupeWords() {
    const seen = new Set();
    const words = getCurrentWords().filter((word) => {
      const key = word.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    resultText.value = words.join("\n");
    updateWordCount();
    setStatus(`已去重，当前 ${words.length} 个单词。`);
  }

  function sortWords() {
    const words = getCurrentWords().sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    resultText.value = words.join("\n");
    updateWordCount();
    setStatus("已按字母顺序排序。");
  }

  function downloadTxt() {
    const words = getCurrentWords();
    if (!words.length) {
      setStatus("没有可导出的单词。", true);
      return;
    }

    const blob = new Blob([words.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "extracted_words.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("已导出 extracted_words.txt。");
  }

  function clearAll() {
    selectedFiles = [];
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
    previewList.innerHTML = "";
    fileInput.value = "";
    resultText.value = "";
    updateWordCount();
    setStatus("已清空。");
  }

  function loadApiKey() {
    apiKeyInput.value = localStorage.getItem(API_KEY_STORAGE) || "";
    apiUrlInput.value = localStorage.getItem(API_URL_STORAGE) || DEFAULT_API_URL;
    apiModelInput.value = localStorage.getItem(API_MODEL_STORAGE) || DEFAULT_API_MODEL;
  }

  function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    const apiUrl = apiUrlInput.value.trim();
    const model = apiModelInput.value.trim();

    if (!apiKey) {
      localStorage.removeItem(API_KEY_STORAGE);
    } else {
      localStorage.setItem(API_KEY_STORAGE, apiKey);
    }

    localStorage.setItem(API_URL_STORAGE, apiUrl || DEFAULT_API_URL);
    localStorage.setItem(API_MODEL_STORAGE, model || DEFAULT_API_MODEL);
    apiUrlInput.value = apiUrl || DEFAULT_API_URL;
    apiModelInput.value = model || DEFAULT_API_MODEL;
    setStatus("API 设置已保存在当前浏览器。");
  }

  function clearApiKey() {
    apiKeyInput.value = "";
    apiUrlInput.value = DEFAULT_API_URL;
    apiModelInput.value = DEFAULT_API_MODEL;
    localStorage.removeItem(API_KEY_STORAGE);
    localStorage.removeItem(API_URL_STORAGE);
    localStorage.removeItem(API_MODEL_STORAGE);
    setStatus("API 设置已恢复为 MiMo 默认值。");
  }

  function toggleApiKeyVisible() {
    const shouldShow = apiKeyInput.type === "password";
    apiKeyInput.type = shouldShow ? "text" : "password";
    toggleApiKeyBtn.textContent = shouldShow ? "隐藏" : "显示";
  }

  fileInput.addEventListener("change", () => handleFiles(fileInput.files));
  runBtn.addEventListener("click", runOcr);
  dedupeBtn.addEventListener("click", dedupeWords);
  sortBtn.addEventListener("click", sortWords);
  downloadBtn.addEventListener("click", downloadTxt);
  clearBtn.addEventListener("click", clearAll);
  resultText.addEventListener("input", updateWordCount);
  saveApiKeyBtn.addEventListener("click", saveApiKey);
  clearApiKeyBtn.addEventListener("click", clearApiKey);
  toggleApiKeyBtn.addEventListener("click", toggleApiKeyVisible);

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("is-over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("is-over");
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-over");
    handleFiles(event.dataTransfer.files);
  });

  loadApiKey();
  updateWordCount();
})();
