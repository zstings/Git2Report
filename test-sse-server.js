import http from 'node:http';

const PORT = 4000;

// 模拟大模型根据输入可能生成的漂亮日报文本
const MOCK_REPORT_PARAGRAPHS = [
  "### 今日工作进展汇报\n\n",
  "1. **代码重构与模块升级**：成功将底层 HTTP 模块由 `minreq` 平滑迁移至 `ureq`，并实现了完美对齐原生浏览器行为的 `vokexFetch` 接口，解决了解析大模型流式输出过程中的延迟阻塞问题。\n\n",
  "2. **安全模块架构设计**：针对本地明文存储带来的风险漏洞，推翻了直接读取硬件标识的脆皮方案，设计并确立了工业级的 `keyring` (仅守护 Master Key) + `aes-gcm` (全文件加密) 混合存储架构，规避了系统容量限制。\n\n",
  "3. **自动化测试与环境联调**：搭建了全原生的本地 ESM SSE 模拟桩，完成了多轮长连接流式断开与异常拦截边界测试，确保全管道抗网络抖动能力达标。\n\n",
  "### 明日计划\n\n",
  "- 准备把 `safeStorage` 的 Rust 底层核心加解密以及内存缓存同步逻辑编写完毕，引入单元测试闭环。\n\n",
  "- 优化多线程 IPC 通信在极高频投递下的内存开销。\n\n"
];

const server = http.createServer((req, res) => {
  // 1. 全局 CORS 跨域处理，确保你的 Vokex 混合客户端或网页能顺畅访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 2. 路由匹配：严格对齐 OpenAI 的标准 Chat 接口路径（兼容你传入的任何 /chat/completions 后缀）
  if (req.url.endsWith('/chat/completions') && req.method === 'POST') {
    let bodyData = '';

    // 收集前端发过来的 POST Body
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', async () => {
      let jsonBody = {};
      try {
        jsonBody = JSON.parse(bodyData);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }

      const isStream = jsonBody.stream === true;
      const modelName = jsonBody.model || "mock-gpt-4";
      const createdTime = Math.floor(Date.now() / 1000);
      const chatID = `chatcmpl-mock-${Math.random().toString(36).substr(2, 9)}`;

      console.log(`[Mock OpenAI] 收到请求 | 模型: ${modelName} | 模式: ${isStream ? "流式(Stream)" : "非流式(Normal)"}`);

      // ─────────────────── 【情况 A：非流式一问一答】 ───────────────────
      if (!isStream) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        
        const fullContent = MOCK_REPORT_PARAGRAPHS.join('');
        const responsePayload = {
          id: chatID,
          object: "chat.completion",
          created: createdTime,
          model: modelName,
          choices: [{
            index: 0,
            message: { role: "assistant", content: fullContent },
            finish_reason: "stop"
          }]
        };
        
        res.end(JSON.stringify(responsePayload));
        return;
      }

      // ─────────────────── 【情况 B：流式 SSE 返回（打字机效果）】 ───────────────────
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // 模拟打字机：按段落或词组有节奏地泵出数据块
      for (const paragraph of MOCK_REPORT_PARAGRAPHS) {
        // 将一个大段落再次切碎为更小的词组，让前端的“打字机颗粒感”更细腻、更逼真
        // 把段落拆成一个一个的单字和符号（包括 \n 也会被拆成独立的个体）
        const characters = Array.from(paragraph);
        
        for (const char of characters) {
          if (res.writableEnded) return;

          const chunkPayload = {
            id: "mock-id",
            object: "chat.completion.chunk",
            choices: [{ 
              index: 0, 
              delta: { content: char }, // 💥 每个字符（包括独立的\n）都会单独成帧
              finish_reason: null 
            }]
          };
          
          res.write(`data: ${JSON.stringify(chunkPayload)}\n\n`);
          // 逐字打印延迟，20ms 看起来非常丝滑
          await new Promise(r => setTimeout(r, 20));
        }
      }

      // 发送 OpenAI 流式协议的标配结束标记：[DONE]
      if (!res.writableEnded) {
        // 在 [DONE] 之前，其实 OpenAI 还会发一个带有 finish_reason: "stop" 的空 delta 包，这里精简直接发送结束符
        res.write('data: [DONE]\n\n');
        res.end();
        console.log(`[Mock OpenAI] ${chatID} 流式推送完毕。`);
      }
    });

  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`🚀 本地零成本 Mock OpenAI 服务已启动: http://localhost:${PORT}`);
  console.log(`👉 请将你前端配置的 baseUrl 替换为: "http://localhost:${PORT}" 即可联调测试！`);
});