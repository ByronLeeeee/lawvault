# LawVault - 智能法条库

<p align="center">
  <img src="./src-tauri/icons/128x128.png" alt="LawVault Logo" width="128" height="128"/>
</p>

<p align="center">
  <strong>本地化、隐私优先的智能法律检索工具</strong>
</p>

<p align="center">
  <a href="https://github.com/byronleeeee/lawvault/releases">
    <img alt="GitHub Release" src="https://img.shields.io/github/v/release/byronleeeee/lawvault?style=flat-square&color=blue">
  </a>
  <a href="https://github.com/byronleeeee/lawvault/blob/main/LICENSE">
    <img alt="GitHub License" src="https://img.shields.io/github/license/byronleeeee/lawvault?style=flat-square">
  </a>
  <a href="https://github.com/byronleeeee/lawvault/issues">
    <img alt="GitHub Issues" src="https://img.shields.io/github/issues/byronleeeee/lawvault?style=flat-square&color=orange">
  </a>
</p>

## 📖 项目简介

**LawVault** 是一款专为法律从业者设计的现代化桌面应用程序。它结合了传统的全文检索与先进的向量语义搜索技术，旨在提供**离线、快速、精准**的法律法规查询体验。

与传统工具不同，LawVault 承诺**数据完全本地化**，您的搜索记录和使用习惯永远不会离开您的设备。

### 核心优势

- 🔒 **隐私至上**: 零云端依赖，所有数据库和AI运算均在本地运行。
- ⚡ **混合检索**: 融合关键词匹配与向量语义搜索，模糊记忆也能找到准确法条。
- 🤖 **本地AI**: 提供基于检索增强生成 (RAG) 的智能法律问答。
- 💼 **专业交互**: 专为律师设计，支持法条引用复制、收藏分组及全文阅读。
- 🖥️ **全平台**: 完美支持 Windows、macOS 和 Linux。

## ⚠️ 数据文件配置说明 (重要)

由于法律数据库体积较大，**不包含在软件安装包中**。请在运行软件前，按照以下步骤准备数据：

1.  **下载数据包**：请通过以下链接下载最新的 `LawVault-DBs.zip`。
```text
链接：https://pan.xunlei.com/s/VOfNGS52Y_8sFa1U7Xx4j86nA1#
提取码：bebr
```
2.  **解压文件**：可以将该压缩包解压到您启动文件的同目录下，或电脑的任意位置（建议存放在非系统盘，例如 `D:\LawData` 或 `~/Documents/LawData`）。
3.  **目录结构核对**：
    解压后的文件夹内**必须**直接包含以下两个文件/文件夹，结构如下：
    
    如放在软件同目录下：
    ```text
    您的软件文件夹/
    ├── lawvault.exe
    └── resources/       # 压缩包默认带的文件夹
        └── app_data/          # 压缩包默认带的文件夹
            ├── content.db          # (文件) SQLite 法律条文数据库
            └── law_db.lancedb/     # (文件夹) 向量索引数据库
                ├── data/
                └── ...
    ```
    如放在其他目录下：
    ```text
    您的数据文件夹/  <-- 请在软件设置中选择此文件夹
    ├── content.db          # (文件) SQLite 法律条文数据库
    └── law_db.lancedb/     # (文件夹) 向量索引数据库
        ├── data/
        └── ...
    ```

4.  **软件设置**：首次打开 LawVault，如没有放在软件目录下，则会自动弹出设置窗口（或点击右上角设置图标），在 **"高级设置"** -> **"数据库位置"** 中选择上述文件夹即可。

## ✨ 主要功能

### 🔍 智能语义搜索
- **自然语言理解**：直接输入 "试用期被辞退怎么赔偿"，而非仅搜索关键词。
- **混合排序**：支持按相关度或发布日期排序。
- **多维筛选**：支持按效力级别（法律、行政法规、司法解释、地方法规）筛选。

### 📚 全文与引用
- **沉浸式阅读**：支持查看完整法律文本，带有目录导航。
- **智能高亮**：自动高亮搜索关键词。
- **一键引用**：提供标准的法条引用格式复制，方便起草文书。

### ⭐ 收藏夹
- 创建自定义收藏夹（如“合同纠纷常用”、“劳动法相关”）。
- 拖拽式管理或右键快速操作。

### 🤖 AI 法律助手
- 配置本地 LLM (如 qwen, gemma) 进行对话。
- 基于检索到的法条内容进行总结和解释，减少幻觉。

## 🚀 快速开始

### 1. 安装应用
从 [发布页面](https://github.com/byronleeeee/lawvault/releases) 下载适用于您系统的安装包：
- **Windows**: 下载 `.exe` 安装包或绿色版。
- **macOS**: 下载 `.dmg` 或 `.app`。
- **Linux**: 下载 `.AppImage` 或 `.deb`。

### 2. 准备环境（推荐使用Ollama，其他平台请自行安装）
1. 下载并安装 [Ollama](https://ollama.com/)。
2. 拉取EmbeddingGemma 模型：
   ```bash
   ollama pull embeddinggemma:300m
   ```

**注意：仅支持未量化的FP32或量化的FP16模型，请勿使用Q8/Q4模型，否则会导致返回结果出错。**

3. 如希望使用AI问答功能，请拉取LLM模型（建议使用 Qwen3 或 Gemma3）：
   ```bash
   ollama pull qwen3
   ```
   然后在LawVault 设置中启用 AI 功能


## 🛠 开发环境搭建

如果您是开发者并希望贡献代码：

#### 前置条件
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (最新稳定版)
- [pnpm](https://pnpm.io/) 或 npm

#### 构建步骤
```bash
# 1. 克隆项目
git clone https://github.com/byronleeeee/lawvault.git

# 2. 安装依赖
npm install

# 3. 运行开发模式 (前端+后端)
npm run tauri dev

# 4. 打包构建
npm run tauri build
```

## 📄 许可证

本项目采用 **MIT 许可证**。这意味着您可以免费使用、修改和分发本项目，但在分发时必须保留原始的版权声明。详情请查看 [LICENSE](./LICENSE) 文件。

## 👥 贡献与联系

- **Bug 反馈**: 请提交 [GitHub Issue](https://github.com/byronleeeee/lawvault/issues)。
- **邮件联系**: [liboyang@lslby.com]

---

<p align="center">
  Made with ❤️ by 李伯阳律师 | © 2025 LawVault
</p>
