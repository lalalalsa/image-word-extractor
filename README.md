# 图片英文单词提取工具 📝

上传图片 → OCR 识别英文单词 → 导出为 `.txt` 文件。现代化界面，支持 API 和浏览器双引擎。

## ✨ 功能

- 🖼️ **多图片上传**：点击或拖拽，支持 PNG / JPG / WebP
- ☁️ **双引擎 OCR**：
  - **API OCR**：调用大模型识别，速度快、精度高（默认适配小米 MiMo）
  - **浏览器 OCR**：Tesseract.js 本地识别，无需 API Key
  - **自动模式**：API 优先，失败自动回退浏览器 OCR
- 🔍 **智能过滤**：自动去除中文、数字、标点，只保留纯英文单词
- ✏️ **人工校对**：识别结果可在编辑区直接修改
- 🔧 **实用工具**：去重（大小写不敏感）、排序（字母序）、导出 TXT

## 🚀 快速开始

### 方式一：浏览器 OCR（最简单）

直接双击 `index.html`，上传图片即可识别。

> 浏览器 OCR 需要联网加载 Tesseract.js（CDN）。**API OCR 在此模式下不可用**，如需 API OCR 请用方式二。

### 方式二：完整功能（推荐）

双击 `启动图片单词提取工具.cmd`，自动启动本地服务并用 Edge 打开。

或在终端手动启动：

```bash
node server.js
# 访问 http://localhost:5177
```

### 桌面快捷方式

在 PowerShell 中运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\创建桌面快捷方式.ps1
```

## 🔑 配置 API OCR

### 网页内配置（推荐）

打开工具后，在页面顶部的 API 设置栏填入 Key，点击「保存」即可。设置会保存在浏览器中。

### 环境变量

```bash
# CMD
set OCR_API_KEY=你的APIKey
node server.js

# PowerShell
$env:OCR_API_KEY="你的APIKey"
node server.js
```

默认 API 适配小米 MiMo：

```
API 地址：https://api.xiaomimimo.com/v1/chat/completions
模型：mimo-v2.5
```

可通过环境变量 `OCR_API_URL` 和 `OCR_MODEL` 自定义。

## 🛠️ 技术栈

- **前端**：原生 HTML + CSS + JavaScript（IIFE，无框架）
- **浏览器 OCR**：[Tesseract.js v5](https://github.com/naptha/tesseract.js)（CDN）
- **后端**：Node.js 原生 `http` 模块，端口 5177
- **API 格式**：兼容 OpenAI Chat Completions 和小米 MiMo

## 📁 项目结构

```
image-word-extractor/
├── index.html              # 主页面
├── styles.css              # 样式
├── server.js               # Node 服务（API 代理 + 静态文件）
├── js/
│   └── main.js             # 核心逻辑
├── start-app.ps1           # Windows 启动脚本
├── 启动图片单词提取工具.cmd   # 双击启动入口
├── 创建桌面快捷方式.ps1       # 快捷方式生成脚本
└── README.md
```
