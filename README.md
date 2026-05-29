# Git2Report

智能 Git 工作报告生成器 —— 实时从 Git 仓库抓取提交记录，结合 AI 智能生成日报、周报、月报。

## 核心功能

### 自动化 Git 提交记录

- 实时从 Git 仓库抓取提交记录，无需初始化全局钩子
- 支持多项目统一管理，所有记录存储在报告目录

### AI 智能生成报告

- 兼容 OpenAI API 接口（GPT、Claude、DeepSeek 等）
- SSE 流式响应，边生成边显示
- 日报：基于 Git 提交日志 + 用户补充内容生成结构化工作日报
- 日报「详细要点」开关：开启后 AI 输出每项工作的具体改动点及收益说明
- 周报/月报：基于存档日报智能整合，按核心业务、系统架构等大类成果导向输出

### 灵活的工作记录

- 支持补充非代码工作内容（会议、文档、线上排查等）
- Markdown 实时预览/编辑切换
- 一键复制到剪贴板，存档管理

### 项目管理

- 从日志文件自动扫描项目路径和远程 URL
- 支持搜索过滤、忽略项目切换（被忽略项目不参与报告生成）
- 今日增量扫描与全量扫描两种模式

## 技术架构

```
git2report/
├── src/
│   ├── main.ts                        # 应用入口
│   ├── App.vue                        # 根组件（侧边栏导航 + 深色模式）
│   ├── utils.ts                       # AI Prompt 模板
│   ├── components/                    # 通用 UI 组件
│   │   ├── AppButton.vue
│   │   ├── AppDialog.vue
│   │   ├── AppInput.vue
│   │   ├── AppTextarea.vue
│   │   ├── AppUpdate.vue
│   │   ├── DatePicker.vue
│   │   └── Message.vue
│   ├── views/                         # 页面视图
│   │   ├── InitHooks/                 # 系统设置页面
│   │   ├── Projects/                  # 项目管理页面
│   │   └── GenerateReport/            # 报告生成页面（核心）
│   │       └── components/
│   │           ├── GitPanel.vue
│   │           ├── AIConfigModal.vue
│   │           └── ReportPanel.vue
│   ├── composables/                   # Vue Composables
│   │   ├── useConfig.ts               # 全局配置管理
│   │   ├── useGit.ts                  # Git 操作封装
│   │   ├── useAI.ts                   # AI 配置管理（加密存储）
│   │   ├── useProjects.ts             # 项目列表管理
│   │   ├── useMessage.ts              # 全局消息提示
│   │   └── useDarkMode.ts             # 深色模式切换
│   └── services/                      # 核心服务层
│       ├── gitService.ts              # Git 服务（项目扫描）
│       └── aiService.ts               # AI 服务（报告生成、存档）
├── public/
│   ├── icon.ico                       # 应用图标
│   ├── icon.png
│   └── vokex-config.json              # Vokex 桌面应用配置
├── release/
│   └── Git2Report.exe                 # Windows 可执行文件
├── package.json
└── vite.config.ts
```

**技术栈**

| 分类       | 技术                                              |
| ---------- | ------------------------------------------------- |
| 框架       | Vue 3 (Composition API + `<script setup>`)        |
| 语言       | TypeScript 6                                      |
| 构建       | Vite 8                                            |
| 桌面框架   | Vokex（fs/shell/safeStorage/dialog/clipboard 等） |
| 代码检查   | ESLint + OxLint                                   |
| 代码格式化 | OxFmt                                             |
| AI 接口    | OpenAI 兼容 API（SSE 流式响应）                   |
| 许可证     | MIT                                               |

## 使用指南

### 1. 初始化配置

首次使用需设置报告存放目录：

1. 在「系统设置」页面选择报告存放目录（建议创建专用文件夹）

### 2. 生成工作报告

#### 日报生成

1. 在左侧面板选择日期，查看 Git 提交记录
2. 可补充非代码工作内容
3. 可勾选「详细要点」开关，让 AI 输出每项工作的具体改动点
4. 点击「AI 一键生成」，等待流式生成完成
5. 预览/编辑报告，一键复制或确认存档

#### 周报/月报生成

1. 切换到「周报」或「月报」标签
2. 系统自动汇总期间所有存档的日报
3. AI 智能整合生成周期报告（按成果导向分类，非机械拼接）

### 3. AI 配置

点击右上角设置按钮配置 AI 服务：

- **API Key**：模型 API Key
- **Base URL**：API 地址（支持 OpenAI 兼容接口）
- **Model**：模型名称（如 gpt-4o、deepseek-chat 等）
- **个人偏好**：报告风格要求

AI 配置通过 Vokex `safeStorage` 加密存储，确保密钥安全。

### 6. 深色模式

- 自动检测系统偏好
- 支持手动切换，状态持久化
- 同步 Vokex 窗口主题

## 数据存储

### 目录结构

```
报告目录/
├── original/
│   ├── 2026-05-18-git_commit_history.txt
│   ├── 2026-05-19-git_commit_history.txt
│   └── ...
└── summary/
    └── daily_archive.json    # 日报存档
```

### 日志条目格式

```
----------{hash}-o----------
项目：/path/to/project
hash：{hash}
时间：2026-05-18 13:22:40 +0800
内容：提交主题(提交描述)
diff_start
[diff 内容或 已忽略]
diff_end
----------{hash}-e----------
```

### 数据持久化

| 数据         | 存储方式                          |
| ------------ | --------------------------------- |
| AI 配置      | Vokex safeStorage（加密）         |
| 应用配置     | Vokex storage                     |
| 项目列表     | Vokex storage                     |
| 深色模式     | localStorage                      |
| Git 提交日志 | 文件系统（`original/` 目录）      |
| 日报存档     | JSON 文件（`daily_archive.json`） |

## 常见问题

### Q: 初始化失败怎么办？

确保 Git 已正确安装，且有写入 `~/.config/git/hooks` 的权限。

### Q: 为什么某些提交没有 diff？

当提交信息长度 ≥ 15 字符时，判定为有意义提交，不记录详细 diff，仅标记 `[已忽略]`。

### Q: 如何补录历史提交？

使用「手动补全」功能，选择项目目录和日期即可自动补录。

### Q: 报告目录可以修改吗？

可以，在初始化页面重新选择目录即可。

### Q: 支持哪些 AI 模型？

所有兼容 OpenAI API 接口的模型均可使用，包括 GPT、Claude、DeepSeek 等。

## 更新日志

### v1.3.5

- 优化日报「详细要点」提示词，增强对不同 AI 模型的兼容性（如小米 MiMo），确保详细要点输出稳定
- 优化 AI 配置弹窗交互，禁用点击蒙层关闭，防止鼠标滑动选择内容时误关闭弹窗

### v1.3.4

- 新增 OpenAI Responses API 支持，AI 配置可切换 Chat Completions / Responses 两种 API 类型
- 重构 AI 请求逻辑，统一调度 Chat 和 Responses 两种端点

### v1.3.3

- 新增「复制提示词」功能，支持将完整提示词复制到剪贴板，可粘贴到任意网页版 AI 使用
- 重构提示词生成逻辑，提取为独立方法确保复制内容与实际请求一致
- 修复 storage API 调用，统一使用正确的 getItem/setItem 方法

### v1.3.2

- 新增下载镜像配置功能，支持自定义应用更新下载源
- 重构 Markdown 列表渲染逻辑，修复嵌套列表解析异常
- 修复 Markdown 列表嵌套解析的空指针风险
- 优化详细要点输出格式，统一使用无序列表

### v1.3.1

- 新增日报「详细要点」开关，开启后 AI 输出每项工作的具体改动点及收益说明
- 优化 Markdown 渲染支持三级列表缩进和有序列表

### v1.3.0

- **移除 Git 钩子依赖**，改为实时从 Git 仓库抓取提交记录，无需初始化全局钩子
- 新增项目扫描与管理（批量添加、自定义目录扫描、Git 用户名展示）
- 新增多 AI 配置管理（支持多套 API 配置切换）
- 新增周报/月报生成（基于存档日报 AI 智能汇总，非机械拼接）
- 新增应用内一键更新（自动下载 + 重启替换，无需手动下载安装）
- 新增全局消息提示组件，优化交互体验
- 优化 Git 提交扫描性能（并发控制，多项目扫描更快）
- 优化自动更新检查为静默模式（仅更新按钮状态，不弹窗）

### v1.2.0

- 新增应用自动更新检查功能和版本展示
- 新增项目自定义显示名称功能
- 优化 Markdown 渲染逻辑并更新复制功能
- 生成日报后自动保存到指定路径

### v1.1.0

- 新增手动补全提交记录功能
- 新增全量扫描与无效记录智能清理
- 优化项目加载与日志排序逻辑
- 修复日志追加格式异常等问题

### v1.0.0

- AI 报告生成功能（日报/周报/月报）
- Git 全局钩子自动记录提交
- Git hash 有效性验证
- 模型思考过程展示
- SSE 流式响应支持

## 许可证

[MIT](LICENSE)
