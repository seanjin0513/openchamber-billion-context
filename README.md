# OpenChamber × billion-context

在 OpenChamber 侧边栏加一个 **billion-context** 面板：显示本机 bili 代理的运行状态，并一键打开它的 Web 控制台（概览、会话、日志、配置、接入、更新）。

## 功能

- **自动发现**：扫描 bili 的状态目录，找出本机所有实例，并逐个请求 `/__bili/health` 实测存活，只显示真正在运行的代理。
- **状态一览**：版本、PID、监听地址、lane、启动时间、上游地址；多个实例时可在下拉框切换。
- **一键打开**：在 OpenChamber 内打开 Web UI（桌面端有项目时，会出现在聊天旁的浏览器面板），也可以单独打开某个路由。
- **一键启动**：没有存活实例时，面板可以后台执行 `bili start`，等它就绪后自动打开。
- **跟随主题**：使用 OpenChamber 的 CSS 变量，自动适配明暗主题与字体；界面随 OpenChamber 语言在中文/英文间切换。

## 安装

仓库自带构建产物，直接安装即可，不需要先构建。

1. 打开 OpenChamber 的 **设置 → 扩展**，选择「从 Git 安装」，填入：

   ```
   https://github.com/seanjin0513/openchamber-billion-context
   ```

   本地开发时也可以选择「从文件夹安装」，指向克隆下来的目录。

2. 安装后授予 **service（本地服务）** 权限。这个权限用于运行 `service/main.js`：它只监听 `127.0.0.1`，用 OpenChamber 下发的临时 token 鉴权，负责探测本机端口和按需启动 `bili start`。不授权也能打开面板，但只会提示服务不可用。

3. 在侧边栏打开 **billion-context** 面板。

> 也可以用 OpenChamber 桌面端的本地接口安装：
>
> ```bash
> curl -X POST http://127.0.0.1:57123/api/guests \
>   -H 'content-type: application/json' \
>   -d '{"url":"https://github.com/seanjin0513/openchamber-billion-context"}'
> curl -X PUT http://127.0.0.1:57123/api/guests/bili-webui/capabilities \
>   -H 'content-type: application/json' -d '{"granted":["service"]}'
> ```

## 使用

面板顶部是状态徽标：

- **运行中**：显示实例信息与快捷路由，点「打开 Web UI」即可。
- **检查中**：正在探测端口。
- **未运行**：显示「启动 billion-context」，执行 `bili start` 并等待就绪。
- **服务不可用**：检查扩展的 service 权限，或重新加载 OpenChamber。

快捷路由直接拼接在代理地址后：

| 路由 | 地址 |
| --- | --- |
| 概览 | `<origin>/__bili/#/` |
| 会话 | `<origin>/__bili/#/sessions` |
| 日志 | `<origin>/__bili/#/logs` |
| 配置 | `<origin>/__bili/#/config` |
| 接入 | `<origin>/__bili/#/connect` |
| 更新 | `<origin>/__bili/#/updates` |

底部可以设置默认打开的路由，以及是否每 15 秒自动刷新状态。

## 它是怎么找代理的

服务按下面的顺序收集候选地址，再用 `GET /__bili/health`（1.2 秒超时）验证：

1. `~/.local/state/billion-context/instances/*.json` 里注册的实例（含 lane、pid）；
2. `~/.local/state/billion-context/proxy-origin` 指针；
3. `port-zone.json` 中各 lane 的端口（如 opencode 18787、pi 18800、dsh 18795）；
4. `127.0.0.1:8787` 兜底。

排序规则：`opencode` > `pi` > `dsh` > 其他 > 未知 lane，同 lane 内新的实例优先。所有地址都必须是回环地址。

启动时按 `PATH` 和常见安装位置查找 `bili`（`~/.local/bin/bili`、`~/.bun/bin/bili`、Homebrew、各 agent 的 node_modules 等）；找不到可执行文件就直接运行 `dist/index.js`，优先用系统的 `node`，否则用 OpenChamber 自带的 Node（`ELECTRON_RUN_AS_NODE=1`）。子进程 detached，OpenChamber 退出后代理继续运行。

## 开发

```bash
git clone https://github.com/seanjin0513/openchamber-billion-context
cd openchamber-billion-context
npm install
npm run build   # 重新生成 panel/main.js 与 service/main.js
```

- 面板源码：`src/panel.js` + `panel/index.html` + `panel/style.css`，构建成 IIFE（浏览器脚本）。
- 服务源码：`src/service.js`，构建成 CommonJS（Node 22）。
- 构建脚本：`build.mjs`。

单独调试服务：

```bash
OPENCHAMBER_SERVICE_PORT=5999 OPENCHAMBER_SERVICE_TOKEN=dev node service/main.js
curl -H 'Authorization: Bearer dev' http://127.0.0.1:5999/targets
curl -X POST -H 'Authorization: Bearer dev' http://127.0.0.1:5999/start
```

接口：`GET /health`、`GET /targets`、`POST /start`，全部要求 `Authorization: Bearer <token>`。

## 卸载

设置 → 扩展 → billion-context → 移除。卸载不会删除这个项目目录，也不会停止已经在跑的 bili 代理。
