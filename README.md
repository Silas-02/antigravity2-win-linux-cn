# Antigravity 2.0 中文汉化引擎 (Windows/Linux)

> **Fork 自**：[qqxpee/antigravity2-cn](https://github.com/qqxpee/antigravity2-cn) — 感谢原作者 [qqxpee](https://github.com/qqxpee) 的辛勤付出！

> **支持系统**：Windows / Linux（含 Ubuntu 等常见发行版，已内置安装与还原脚本）
>
> **语言支持**：仅简体中文
>
> **汉化版本**：v2.9.1.2
>
> **匹配版本**：Antigravity v2.9.1
>
> **最近更新**：2026-08-24
>
> **核心运行环境**：Node.js 与 npm（无需 Python、无需安装项目依赖；首次运行会由 `npx` 获取 `@electron/asar`）
>
> **汉化范围**：当前 v2.9.1.2 词典面向 Antigravity v2.9.1，覆盖主界面、顶部系统菜单与任务栏菜单、加载页、设置面板、新手引导与登录流程、对话及计划任务管理、MCP 服务器列表，以及各类动态状态、提示和操作反馈。少量内容可能因客户端异步渲染、第三方嵌入或官方后续新增界面而暂未覆盖。
>
> **注入原理**：通过 ASAR 还原与重包，安全注入 `preload.js` 动态翻译机制，绝不修改核心二进制，一键安装与完美还原。

> [!IMPORTANT]
> **聊天历史记录/对话内容隔离与匹配机制说明（开发者必读）**：
>
> - **用户消息隔离**：Antigravity 2.9.1 会为每条已发送及历史用户消息标记 `data-testid="user-input-step"`。翻译引擎会跳过该容器及其全部后代节点，因此用户发送的英文原文不会再被界面词条误译。
> - **扩展禁区**：如需为第三方嵌入区或特殊内容区显式禁用翻译，可在容器元素上添加 `data-ag-localization-skip` 属性；该容器及其后代都不会参与翻译。
> - **核心匹配机制**：
>   - **精确匹配（任意长度，如 `Knowledge`）**：翻译仅在词条 **完全精准匹配（且单独占一行）** 时触发。如果该词前后有其他任何字符、空格或标点符号（如 `Knowledge是什么`、`哈哈 Knowledge`），则不会触发精确匹配。
>   - **长句（长度 > 20 字符，如 `Enable Antigravity to deploy apps...`）**：由于需要兼容界面动态渲染，长句采用 **"子串滑动替换"** 算法。这意味着只要普通 UI 文本中包含了这一长串完整英文字句，该段子串就会被自动翻译成中文（即使加了引号或前后带有文字）。但由于长句匹配极其苛刻，必须一字不差（包括大小写、标点和空格）。
> - **说明**：这**不影响 AI 接收到的原文**。大模型获取到的依旧是你发送的纯正英文原始指令，仅在软件的视觉渲染层面发生了汉化，纯属视觉影响，无需担心影响大模型的效果。

## 📸 汉化效果展示

以下是部分功能板块的实际汉化效果展示，涵盖登录引导页、主编辑器界面与详细设置面板：

### 1. 欢迎页与登录新手引导

![欢迎页与登录新手引导](./showimg/showlogin.png)

### 2. 主编辑器界面与菜单

![主编辑器界面与菜单](./showimg/showmain.png)

### 3. 详细参数设置面板

![详细参数设置面板](./showimg/showmenu.png)

---

## 📂 项目文件结构

- **`双击安装中文汉化.bat`**：Windows 一键汉化执行入口。
- **`双击卸载还原官方英文.bat`**：Windows 一键完美恢复原版入口。
- **`install.sh`**：Linux 一键汉化执行入口。
- **`uninstall.sh`**：Linux 一键完美恢复原版入口。
- **`localization_engine.js`**：核心汉化逻辑，跨平台自动适配，负责 app.asar 的解包、代码注入和重新打包。
- **`dicts/`**：汉化字典文件夹，内含按模块分类的 JSON 对照翻译字典；当前版本的核心词典为 `dicts/v2.9.1.2.json`。
- **`AGENTS.md`**：项目通用规则。支持 `AGENTS.md` 的 AI Agent 会将其作为项目上下文，按其中的汉化边界、动态文案处理与验证要求工作。
- **`.gitattributes`**：Git 属性规则。它会保护 Windows `.bat` 文件的 GBK/CRLF 字节内容，避免 Git 的自动文本转换破坏安装或卸载脚本，请保留此文件。
- **`convert_to_gbk.ps1`**：仅供维护者使用的 Windows 批处理文件编码转换脚本。它会将预先准备好的 UTF-8 临时源文件转换为 GBK 编码的 `.bat` 成品；普通安装或卸载时无需运行。

---

## 🚀 极速使用指南

### 1. 获取汉化包代码（二选一）

* **方法 A：直接下载 ZIP 压缩包（最便捷 📦）**

  1. 点击页面右上角绿色的 **`Code`** 按钮。
  2. 在下拉菜单中选择 **`Download ZIP`** 并下载。
  3. 将下载好的压缩包**解压到您电脑本地的任意目录**（例如您的 `Downloads` 文件夹）。
* **方法 B：通过 Git 命令行克隆（开发者推荐 💻）**

  ```bash
  git clone https://github.com/Silas-02/antigravity2-win-linux-cn.git
  cd antigravity2-win-linux-cn
  ```

---

### 2. 一键安装汉化

1. **完全退出** Antigravity 编程软件。
2. 进入解压或克隆出来的 `antigravity2-win-linux-cn` 文件夹：
   - **Windows**：右键 **`双击安装中文汉化.bat`**，选择“以管理员身份运行”。
   - **Linux**：首次使用先赋予脚本执行权限，然后运行安装命令：
     ```bash
     chmod +x install.sh uninstall.sh
     sudo ./install.sh
     ```
3. 按提示选择左上角品牌显示方式：
   - **显示英文 Antigravity（默认推荐）**：保留官方品牌名，避免左上角显示过长。
   - **不显示品牌名**：隐藏左上角的品牌文字。
   - **显示中文品牌名**：保持原汉化效果，显示"反重力智能编程"。
4. 运行完成后，重新启动 Antigravity 软件，即可畅享全中文界面！

> [!TIP]
> Linux 安装路径会自动识别。若自动识别失败，可在项目根目录手动指定 Antigravity 的安装目录：
>
> ```bash
> sudo ./install.sh --install-dir "/path/to/Antigravity"
> ```
>
> 请使用安装脚本，而不要直接执行 `node localization_engine.js`；安装脚本会提供品牌选项，并在权限不足时显示 `sudo ./install.sh` 的重试提示。

---

### 3. 一键卸载还原

1. **完全退出** Antigravity 编程软件。
2. 在当前文件夹下：
   - **Windows**：右键 **`双击卸载还原官方英文.bat`**，选择“以管理员身份运行”。
   - **Linux**：运行 `sudo ./uninstall.sh`。如自动定位失败，可追加 `--install-dir "/path/to/Antigravity"`。
3. 运行完成后，软件将自动清除所有汉化注入，无痕恢复至官方原版英文状态。

---

## 🛠️ 汉化原理说明

本引擎采用 **ASAR 包注入模式**，适配 **Antigravity 2.0** 的 Electron 打包结构：

1. **自动释放锁**：脚本运行前会自动探测并安全关闭 Antigravity 进程，防止文件占用锁定。
2. **安全备份**：首次运行时，会在软件目录自动创建原始 `app.asar.bak` 文件，确保随时可无损还原。
3. **精准注入**：
   - 注入 `preload.js`：采用 WeakSet 记录与 Shadow DOM 穿透，启动高效的 `MutationObserver` 引擎，动态监测并将渲染层文本翻译为中文。
   - 注入 `menu.js`：深度补丁系统级标题栏菜单。
   - 注入 `tray.js`：汉化托盘与右键通知状态菜单。
   - 注入 `loadingOverlay.js`：注入极具极客风格的趣味加载语："反重力引擎已启动，正在摆脱地心引力..."。

---

## 💡 如何通过 AI 助手自动补充或修改汉化？

如果在使用过程中，您发现了漏译的英文，或者觉得某些中文翻译不够接地气，您可以让 AI 编码助手协助更新词库。直接发送截图或文字描述即可；将本仓库作为工作区打开时，支持 `AGENTS.md` 的 Agent 会先读取项目中的汉化规则。

> [!IMPORTANT]
> **⚠️ AI 助手如何定位您的汉化词库文件？**
>
> 1. **推荐做法（最省心）**：
>    在 Antigravity 软件中，点击 **"打开文件夹 (Open Folder)"**，直接将本汉化包目录（即包含当前 `README.md` 和 `AGENTS.md` 的文件夹）作为**项目/工作区**打开，然后在此工作区下与 AI 对话。此时 AI 能够直接定位项目词典与规则；直接发送翻译要求即可。
> 2. **免开项目做法（提示词中需指定汉化目录）**：
>    如果您当前正在开发别的项目，没有把汉化目录作为项目打开，那么您在对 AI 发起汉化命令时，**必须在提示词里明确告诉 AI 您的汉化包所在路径**，否则 AI 无法得知要修改您电脑上的哪个文件夹。
>
>    * **提示词示例**：
>      > **"我的汉化包目录在 `~/Downloads/antigravity2-win-linux-cn`（请替换为您本地的实际路径），请先阅读 `AGENTS.md`，再帮我把下面这张截图里漏译的内容补全到词典里。"**
>      >

### 📋 常用提示词（Prompt）模板

#### 1. 方式一：直接在聊天中发送截图（推荐 📸）

如果您不方便打字，可以直接将未汉化干净的界面截图粘贴发送给 AI，并附带以下指令：

> **"帮我把这张截图里所有未汉化的英文选项和面板内容补全到中文词典中。"**
> *(AI 会自动通过视觉识别截图中的全部英文，并精准写入字典。)*

#### 2. 方式二：直接在聊天中发送文字描述（极速 ✍️）

如果您只想修改或增加某一个特定词汇，可以直接发送文字描述给 AI：

> **"帮我把漏译的英文 'Allow agent to view and edit files outside of the current workspace automatically' 汉化为 '允许智能体自动查看并编辑当前工作区之外的文件'。"**
> *(AI 会立即找到对应的词典并精准修改或追加该词条。)*

---

### 🔄 更新生效流程

1. **命令 AI 更新**：在对话中通过截图或文字告诉 AI 您的汉化需求，AI 会自动更新 `dicts/` 下的字典文件。
2. **退出软件**：**完全退出**您的 Antigravity 软件。
3. **重新注入**：Windows 右键以管理员身份运行 `双击安装中文汉化.bat`；Linux 在项目根目录运行 `sudo ./install.sh`。
4. **重启软件**：重新打开 Antigravity，您的改动即可完美生效！

---

## 📝 词典自定义指南 (供极客手动使用)

如果您想手动修改翻译，可以直接打开 `dicts/` 目录下的 JSON 文件。引擎会加载其中全部 JSON 词典：

- **`v2.9.1.2.json`**：汉化版本 v2.9.1.2 的核心词典，适配 Antigravity v2.9.1。
- **`common.json`**：公共基础词汇、侧边栏概览、登录页、常用按钮与权限弹窗等。
- **`menu_nav.json`**：系统菜单、导航和任务栏菜单。
- **`page_agents.json`**：Agent、任务与对话相关页面。
- **`page_mcp_knowledge.json`**：MCP、知识库与相关配置页面。
- **`page_settings.json`**：详细设置面板和权限二级菜单。
- **`page_workspaces.json`**：工作区与项目相关页面。

在 JSON 中新增一行，格式如下即可（注意英文逗号）：

```json
"Original English Text": "您的中文翻译"
```

保存后，重新运行安装脚本部署汉化即可。

---

## 常见问题解答 (FAQ)

### 1）提示"解包失败"或缺少 npm 环境

* **原因**：汉化引擎依赖 Node.js 进行 ASAR 包的解析。
* **解决**：安装 Node.js 与 npm（LTS 版本即可；安装脚本会通过 `npx` 使用 `@electron/asar`）：
  ```bash
  # Ubuntu/Debian
  sudo apt update && sudo apt install -y nodejs npm

  # 或使用 NodeSource 安装最新 LTS
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt install -y nodejs
  ```

### 2）提示"权限不足"

* **解决**：
  - **Windows**：右键点击 `.bat` 文件，选择 **"以管理员身份运行"**。
  - **Linux**：在项目根目录首次执行 `chmod +x install.sh uninstall.sh`，然后使用 `sudo ./install.sh`；卸载时使用 `sudo ./uninstall.sh`。安装窗口遇到 `EACCES` 或权限不足时也会显示相同的简短提权命令。

### 3）软件官方更新后，汉化失效了怎么办？

* 软件升级时，官方会覆盖 `app.asar` 文件。您无需担心，完全退出软件后重新注入即可：Windows 右键以管理员身份运行 `双击安装中文汉化.bat`，Linux 在项目根目录运行 `sudo ./install.sh`。

## 🤝 致谢

- 感谢原作者 [qqxpee](https://github.com/qqxpee) 开发并开源了本汉化项目：[antigravity2-cn](https://github.com/qqxpee/antigravity2-cn)
- 感谢所有参与测试与反馈的贡献者！
