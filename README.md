# 图片英文单词提取工具

一个简单的本地 Web 项目：上传图片，提取其中的英文单词，并导出为一个单词一行的 `.txt` 文件。

## 功能

- 支持多图片上传
- OCR 可选择两种模式：
  - API OCR：配置 API 后优先使用
  - 浏览器 OCR：没有 API 或 API 失败时使用 Tesseract.js
- 自动过滤中文、数字、标点，只保留英文单词
- 支持人工编辑识别结果
- 支持去重、排序、清空、导出 txt

## 直接打开使用

双击打开 `index.html` 即可使用浏览器 OCR。

> 浏览器 OCR 使用 CDN 加载 Tesseract.js，需要联网。

## Windows 应用模式

Windows 上可以直接双击：

```text
启动图片单词提取工具.cmd
```

它会自动启动本地服务，并用 Edge 独立应用窗口打开页面。

如果想创建桌面快捷方式，在 PowerShell 中运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\创建桌面快捷方式.ps1
```

## 使用 API OCR

如果要使用 API OCR，请先启动本地服务：

```bash
node server.js
```

然后访问：

```text
http://localhost:5177
```

在网页里的 `API Key（可选）` 输入框填入 Key 后，选择 API OCR 或自动模式即可。

默认 API 设置适配小米 MiMo 图片理解：

```text
API 地址：https://api.xiaomimimo.com/v1/chat/completions
模型：mimo-v2.5
```

也可以用环境变量作为默认 Key：

```bash
set OCR_API_KEY=你的APIKey
set OCR_API_URL=https://api.xiaomimimo.com/v1/chat/completions
set OCR_MODEL=mimo-v2.5
node server.js
```

PowerShell 示例：

```powershell
$env:OCR_API_KEY="你的APIKey"
$env:OCR_API_URL="https://api.xiaomimimo.com/v1/chat/completions"
$env:OCR_MODEL="mimo-v2.5"
node server.js
```

如果没有配置 `OCR_API_KEY`，或者 API 调用失败，页面会自动回退到浏览器 OCR。
