# World Cup 8-0 世界杯传奇之路

组建一支跨时代世界杯梦之队，挑战 2026 世界杯赛程，让 AI 把每一场比赛模拟成真正的电视转播。

World Cup 8-0 是一个 React + Node.js 足球策略游戏。它借鉴了“82-0”挑战的爽感，但改造成 11 人制国际足球版本：你会从真实世界杯年份和国家队名单中抽球员，安排阵型和替补，面对不同年代的顶级强队，观看 AI 生成的实时解说，参加赛后发布会，并冲击八场全胜的冠军路线。

## 核心特色

- **跨时代梦之队选人**：随机抽取世界杯年份和国家队，从当届阵容里挑选球员。
- **11 人制战术板**：支持阵型槽位、位置适配、越位惩罚、首发和替补。
- **经典强队对手池**：不只冠军队，也包含 1954 匈牙利、1974 荷兰、1982 巴西、2018 比利时、2022 法国等历史强队。
- **AI 比赛模拟**：后端先锁定真实比分，再生成 14-18 条与比分一致的关键事件。
- **真实感比赛解说**：进球、角球、任意球、扑救、黄牌、换人、战术变化和重大机会都会进入转播流。
- **比分与解说强一致**：进球事件严格对应最终比分，非进球事件不会乱改比分。
- **FC 风格前端 UI**：现代转播比分牌、动态解说流、迷你球场、赛后统计面板。
- **每场技术统计**：赛后展示球队对比和球员数据，不再只有一段简单总结。
- **赛后发布会**：玩家自由输入回答，AI 根据发言生成媒体反应、士气变化和后续影响。
- **赛事荣誉系统**：金球、金靴、金手套、助攻榜、MVP 榜、扑救榜、团队奖项和夺冠典礼。
- **中英文切换**：主界面和 AI 生成内容都可以跟随语言设置。

## 技术栈

```text
client/   React + Vite
server/   Node.js + Express
db/       MySQL，可选，用于缓存导入或生成的世界杯阵容
ai/       OpenAI 兼容接口，默认 DeepSeek
```

浏览器不会直接请求 AI 服务。前端只访问 `/api/*`，由 Express 服务端负责 API Key、数据库、Prompt 构造、比赛结果归一化和静态前端托管。

## 游戏流程

1. 选择世界杯年代范围，例如 1930-2026。
2. 选择阵型。
3. 随机抽取一个世界杯年份和国家队。
4. 从该队名单中选择一名球员放入战术板。
5. 凑齐 11 名首发和 2 名替补。
6. 处理赛前突发事件。
7. 模拟比赛并观看实时 AI 解说。
8. 赛后查看球队技术统计和球员数据。
9. 参加发布会，回答记者尖锐提问。
10. 继续小组赛、淘汰赛、半决赛和决赛。

输一场，媒体就会写下你的失败故事。八场全胜，梦之队封神。

## 项目结构

```text
.
├── client/
│   ├── src/
│   │   ├── components/       # 选人、比赛转播、发布会、报纸、赛事 UI
│   │   ├── App.jsx           # 主游戏状态机
│   │   ├── tournament*.js    # 赛程、积分、奖项、排行榜
│   │   └── i18n.js           # 中英文 UI 文案
│   └── package.json
├── server/
│   ├── src/
│   │   ├── routes.js         # HTTP API
│   │   ├── prompts.js        # AI Prompt 编排
│   │   ├── matchEngine.js    # 比分、解说、统计归一化
│   │   ├── teamAssessment.js # 阵容强度和对阵判断
│   │   ├── db.js             # MySQL 阵容缓存
│   │   └── index.js          # Express 入口
│   └── package.json
├── package.json              # 根目录脚本
├── README.md                 # 英文说明
└── README.zh-CN.md           # 中文说明
```

## 运行要求

- Node.js 18+
- npm
- OpenAI 兼容聊天模型 API Key
- MySQL 可选，不配置也能运行，只是不会使用数据库缓存

## 环境变量

服务端直接读取环境变量，`.env` 文件不是必须的。部署到服务器时，可以在系统环境变量、PM2、Docker、宝塔、面板服务配置里设置。

| 变量 | 必填 | 默认值 | 说明 |
|---|---:|---|---|
| `PORT` | 否 | `8787` | Express 服务端口 |
| `OPENAI_API_KEY` | 使用 AI 时必填 | 无 | OpenAI 兼容服务的 API Key |
| `OPENAI_BASE_URL` | 否 | `https://api.deepseek.com` | AI 服务 Base URL |
| `OPENAI_MODEL` | 否 | `deepseek-v4-flash` | 聊天模型名称 |
| `DB_HOST` | 否 | 无 | MySQL 地址 |
| `DB_PORT` | 否 | `3306` | MySQL 端口 |
| `DB_USER` | 否 | 无 | MySQL 用户名 |
| `DB_PASSWORD` | 否 | 无 | MySQL 密码 |
| `DB_NAME` | 否 | 无 | MySQL 数据库名 |

PowerShell 示例：

```powershell
$env:OPENAI_API_KEY="your_key"
$env:OPENAI_BASE_URL="https://api.deepseek.com"
$env:OPENAI_MODEL="deepseek-v4-flash"
$env:PORT=8787
npm start
```

Linux / macOS 示例：

```bash
OPENAI_API_KEY="your_key" PORT=8787 npm start
```

## 安装

```bash
npm run install:all
```

也可以分别安装：

```bash
npm --prefix server install
npm --prefix client install
```

## 本地开发

启动后端：

```bash
npm run dev:server
```

启动 Vite 前端：

```bash
npm run dev:client
```

Vite 会把 `/api` 代理到 `http://localhost:8787`。

## 生产部署

先构建前端：

```bash
npm run build
```

再启动单进程 Express 服务：

```bash
npm start
```

Express 会同时托管前端静态文件和后端 API：

```text
http://localhost:8787/
http://localhost:8787/api/health
```

如果使用 Nginx 反向代理，直接把域名代理到 Node 服务即可，建议保持前端和 `/api` 在同一个域名下。

## API 概览

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/config` | 年份、阵型、解说风格 |
| `GET` | `/api/era/:year` | 年代氛围文案 |
| `POST` | `/api/spin` | 抽取年份和国家 |
| `POST` | `/api/squad` | 加载导入、缓存或生成的阵容 |
| `POST` | `/api/player-bio` | 生成球员卡片故事 |
| `POST` | `/api/opponent` | 抽取历史强队对手 |
| `POST` | `/api/event` | 生成赛前事件 |
| `POST` | `/api/match` | 比赛模拟、实时解说、技术统计 |
| `POST` | `/api/other-match` | 模拟非玩家场次 |
| `POST` | `/api/press` | 发布会舆论反应 |
| `POST` | `/api/endgame` | 终局报纸报道 |
| `POST` | `/api/awards` | 赛事奖项和排行榜 |

## 部署接口怎么换

如果前后端都由 Express 托管，不需要改前端接口。客户端默认请求相对路径 `/api`。

如果前端和后端分开部署，修改 `client/src/api.js`，把请求地址换成后端域名：

```js
fetch(`https://your-backend.example.com/api${path}`)
```

不要把 `.env`、API Key、数据库密码、`node_modules`、`client/dist` 提交到仓库。

## 当前状态

这是一个可玩的原型版本，已经具备完整选人、阵型、AI 解说、比赛模拟、发布会、技术统计、奖项、排行榜、中英文切换和单进程部署能力。

## 许可证

MIT License。详见 [LICENSE](LICENSE)。
