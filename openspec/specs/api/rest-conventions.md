# API 规范

> 最后更新：2026/04/29
> 状态：活跃

---

## 服务器启动

- **开发环境**：`pnpm dev`
- **生产构建**：`pnpm build`

---

## API 端点

### GET /

**描述**：健康检查

**响应 200**：
```json
{ "status": "ok" }
```

---

### POST /convert

**描述**：PDF 文件转换

**Request**：
- Content-Type: `multipart/form-data`
- Body: `file` (binary)

**响应 200**：
```json
{
  "success": true,
  "markdown": "# 标题\n\n内容...",
  "metadata": {
    "filename": "report.pdf",
    "pageCount": 10
  }
}
```

**错误响应**：
- `400` — 不支持的文件类型
- `413` — 文件为空
- `500` — 解析失败

---

## 响应格式

所有成功响应：
```json
{ "success": true, "data": {...} }
```

所有错误响应：
```json
{ "success": false, "error": "错误描述", "code": "ERROR_CODE" }
```

---

## 已知约束

| 约束 | 影响 | 缓解措施 |
|------|------|---------|
| pdfjs-dist 不支持扫描版 PDF | 图片型 PDF 无法提取文字 | 未来接入 OCR |
| 仅支持英文/部分中文 PDF | 复杂中文排版可能偏差 | 持续优化提取器 |