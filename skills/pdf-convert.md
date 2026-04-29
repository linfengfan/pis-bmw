# pdf-convert — PDF 转换 SOP

> 触发条件：用户要求将 PDF 转换为 Markdown，或执行文档转换任务

## 约束

- 仅支持 `.pdf` 文件
- 文件大小限制：50MB
- 输出格式：Markdown，保留表格、标题、脚注、公式
- 不支持扫描版图片 PDF（需 OCR）

## 分步 SOP

### Step 1：确认输入
- 确认文件路径或上传
- 检查文件扩展名为 `.pdf`
- 检查文件大小 ≤ 50MB

### Step 2：执行转换
```bash
pnpm convert [file-path]
```
或通过服务器 API：
```bash
POST /convert
Content-Type: multipart/form-data
Body: file (binary)
```

### Step 3：验证输出
- 检查生成的 Markdown 文件
- 验证表格、标题、脚注是否保留
- 如有异常，记录问题

### Step 4：返回结果
- 告知用户输出路径
- 如有降级情况，说明原因

## 典型输入/输出

**输入**：`test.pdf`（10 页财报）
**输出**：`ConvertedMarkdown/report.md`（保留表格结构）

## 错误处理

| 错误 | 处理方式 |
|------|---------|
| 文件类型不支持 | 返回"仅支持 .pdf 文件" |
| 文件为空 | 返回"文件为空" |
| 解析失败 | 记录日志，返回 500 + 错误详情 |