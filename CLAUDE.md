# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Git2Report 是一个基于 Vokex 桌面框架的桌面应用，从 Git 仓库实时抓取提交记录，通过 OpenAI 兼容 API 生成日报/周报/月报。使用 Vue 3 + TypeScript + Vite 构建。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | 并行运行 oxlint + eslint（带 `--fix`） |
| `npm run format` | 使用 oxfmt 格式化 `src/` |

Node 版本要求：`^20.19.0 || >=22.12.0`

## 架构

应用采用侧边栏三页面结构：

1. **系统设置** (`views/InitHooks/`) — 配置报告存放目录
2. **项目管理** (`views/Projects/`) — 管理 Git 仓库列表，支持手动添加和目录扫描
3. **报告生成** (`views/GenerateReport/`) — 核心页面，包含 GitPanel（提交记录）、ReportPanel（报告预览）、AIConfigModal（AI 配置）

### 关键模块

- **`services/aiService.ts`** — 单例 AI 服务，负责 AI Profile CRUD、SSE 流式报告生成、日报存档持久化
- **`utils.ts`** — AI 系统提示词模板（日报/周报/月报），定义了报告输出格式规范
- **`projects.ts`** — 项目列表的加载、保存、Git 仓库验证
- **`composables/`** — Vue 组合式函数：`useAI`（AI Profile 管理）、`useConfig`（全局配置）、`useGit`（Git 操作）、`useProjects`（项目管理）、`useDarkMode`（主题切换）、`useMessage`（Toast 提示）

### 桌面框架

Vokex (`vokex.app`) 提供原生能力：`fs`、`path`、`shell`、`storage`、`safeStorage`（加密存储 AI 密钥）、`dialog`、`clipboard`、`http`、应用自动更新。Vite 插件配置在 `vite.config.ts`，应用标识为 `com.git2report.app`。

### 数据存储

- AI 配置 → Vokex `safeStorage`（加密）
- 应用配置/项目列表 → Vokex `storage`
- 深色模式 → `localStorage`
- Git 提交日志 → 文件系统 `original/` 目录
- 日报存档 → `summary/daily_archive.json`

## 开发规范

- Vue 组件使用 Composition API + `<script setup>` + TypeScript
- 代码检查：ESLint + OxLint 并行，格式化：OxFmt
- 路径别名 `@` 指向 `src/`
- 所有 UI 文本使用中文
