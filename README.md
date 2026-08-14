# dsh-think-sticky

DeepSeek Harness（`dsh web`）客户端插件：思考块（Think）的展开/收起标题行 **sticky 贴住视口顶部**——长思考内容滚动时，按钮始终可见，交互与视觉对齐官方 chat.deepseek.com。

English version: [README-en.md](./README-en.md)

## 安装

1. 把本目录链接进 dsh web profile 的模块目录（让 loader 能解析）：

   ```bash
   ln -sfn "$PWD" ~/.dsh/profiles/node_modules/@local/dsh-think-sticky
   ```

2. 在 `~/.dsh/profiles/web/cordis.patch.yml` 追加：

   ```yaml
   - insert:
       - id: dsh-think-sticky
         name: '@local/dsh-think-sticky'
   ```

   （本仓库根目录的 `cordis.patch.yml` 即步骤 2 的补丁片段。）

3. **重启 `dsh web`**（客户端模块扫描需重启生效；之后插件支持热重载）。

## 功能

- **滚动固定**：思考块（Think 折叠行）以及命令卡片、工具、bash 等块类型的标题行（`data-disclosure-row`、`data-variant="bash"`）sticky 于对话滚动容器顶部（`top: 0`）——块内容高于视口时，展开/收起按钮不再滚出视野
- **默认透明**：未钉住时行完全透明，与普通内容无异；只有**行真正钉住且块处于展开态**（`aria-expanded="true"`）时才显示遮罩
- **官方同款淡化**：钉住时行下方出现 24px 渐变淡化带（`linear-gradient(var(--dsw-alias-bg-base), transparent)`，官方 .c99b79f8 曲线），滚动的内容"融化"在行下而非被硬边截断；无边框、无阴影、无常驻背景块
- **主题适配**：全部使用 dsh web 设计令牌（`--dsw-alias-bg-base`），深色/浅色主题自动跟随
- **JS 驱动钉住态**：滚动监听（capture 阶段 + rAF 节流）逐行判断是否跨过滚动容器顶边，切换 `dsh-pinned` 类；遮罩透明度过渡 120ms
- **优雅降级**：若上游把行包进 overflow-hidden 祖先导致 sticky 失效，行为退回"随内容滚走"，遮罩不出现，不影响原有功能

## 工作原理

- **纯客户端**：`lib/index.js` 仅为满足 Cordis 加载契约的空 Host 插件；全部行为在 `lib/client.js`（浏览器 bundle，`window.__ModuleLoader__.load(...)`，由 `package.json` 的 `dsh.client` 声明发现）
- **注入样式**：启动时注入带 `data-plugin="dsh-think-sticky"` 的 `<style>`，幂等（HMR 重载不重复注入），卸载时移除
- **钉住检测**：`scrollerOf()` 沿祖先链找第一个可滚动容器（WeakMap 缓存）；行矩形同时"压住"容器顶边判定为 pinned
- **遮罩层级**：行内 `::after`（页面背景色，z-index -1）保证钉住时文字不透视滚动内容；`::before`（渐变淡化带）位于行下方 24px

## 许可证

MIT — see [LICENSE](./LICENSE)
