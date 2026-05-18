# Git2Report

一个基于 Vue 3 和 Vokex 的 Git 工作报告生成器，自动记录你的 Git 提交，通过 AI 生成日报、周报、月报。

## 功能特性

- 📊 自动记录所有 Git 项目的提交
- 🔍 查询指定时间段的 Git 提交记录
- 📝 按项目分组展示提交详情
- 🤖 自动生成 AI 提示词
- ✨ 通过 AI 智能生成工作报告（日报/周报/月报）
- 🎨 精美的渐变 UI 设计
- 💾 自动保存 AI 配置
- 📋 一键复制提示词或报告

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建打包

```bash
npm run build
```

## 使用说明

### 1. 初始化 Git 钩子

首次使用时，点击「初始化 Git 钩子」按钮，会自动：
- 创建 `~/.config/git/hooks` 目录
- 设置 Git 全局钩子路径
- 创建 `post-commit` 钩子脚本

此后你在任何 Git 项目中提交代码时，都会自动记录该项目。

### 2. 查询并生成报告

点击「生成日报」、「生成周报」或「生成月报」按钮，应用会：
- 查询指定时间段内所有已记录项目的 Git 提交
- 展示提交记录列表，包含项目名、日期、提交信息、作者和哈希
- 自动生成 AI 提示词

### 3. 配置 AI 服务（可选）

点击「⚙️ 配置 AI」按钮，填写：
- **API Key**: 你的 OpenAI API Key（或兼容的 API Key）
- **Base URL**: API 地址（默认 `https://api.openai.com/v1`，可配置为其他兼容地址）
- **Model**: 模型名称（默认 `gpt-3.5-turbo`）

配置会自动保存。

### 4. 生成 AI 报告

在查询到提交记录后：
1. 可以先查看提交记录和自动生成的提示词
2. 点击「📋 复制提示词」可以复制提示词到剪贴板
3. 点击「生成报告」按钮通过 AI 生成工作报告
4. 点击「📋 复制报告」可以复制报告到剪贴板

## 技术栈

- **前端框架**: Vue 3 (Composition API)
- **构建工具**: Vite 8
- **桌面应用**: Vokex
- **语言**: TypeScript

## 文件结构

```
git2report/
├── src/
│   ├── services/
│   │   ├── gitService.ts    # Git 相关服务
│   │   └── aiService.ts     # AI 相关服务
│   ├── App.vue              # 主应用组件
│   └── main.ts              # 应用入口
├── vite.config.ts           # Vite 配置
└── package.json
```

## 项目记录存储

所有 Git 提交记录保存在配置的报告目录下的 `original/` 子目录中，文件按日期命名（格式：`YYYY-MM-DD-git_commit_history.txt`）。应用会从这些日志文件中自动扫描和识别项目。

## 注意事项

1. 确保你的系统已安装 Git
2. 首次使用需要初始化 Git 钩子
3. AI 配置是可选的，可以直接使用生成的提示词
4. 在 Windows 上，Git 需要正确配置环境变量

## 许可证

MIT
