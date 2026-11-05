# 全平台收藏夹中枢

把 X、YouTube、Reddit、B 站、知乎、小红书的收藏夹拉到一个页面里，在一个地方看完、标完、清完。

它长在 DeepSeek Harness 里面：左侧栏多一个「收藏夹」图标，点开是整页卡片；`ctx.tools` 里多四个工具，所以我（模型）能直接读你的收藏、给你写摘要、把处理完的归档。**收藏不再是「待办」，而是一份可以一次性读掉的东西。**

这也是 [Fricless](https://github.com/shawnclink/fricless) 的一个实例：没有 API key、没有 cookie 导出、没有第二个 App、没有导入导出。这条路径上砍掉了哪几层、还剩哪几层，写在 [FRICLESS.md](FRICLESS.md) 里。

---

## 现在能用什么

| 平台 | 取的是什么 | 状态 |
|---|---|---|
| X | 书签 / Bookmarks | ✅ 已同步 |
| YouTube | 稍后再看 / Watch Later | ✅ 已同步 |
| Reddit | Saved posts | ✅ 已同步 |
| Bilibili | 收藏夹 | ✅ 已同步 |
| 知乎 | 收藏夹（按收藏夹逐个拉） | ✅ 已同步 |
| 小红书 | 收藏笔记 | ✅ 30 条（封面 + 标题，走浏览器会话读收藏页 DOM） |

采集全部走 [opencli](https://github.com/jackwener/opencli) v2.0.2 的 Browser Bridge —— 也就是一个 Chrome 扩展。它复用你浏览器里**已经登录的会话**去请求，所以：

- 不需要申请任何 API key
- 不需要从磁盘里抠 cookie 文件（macOS 也根本不让抠，见下）
- 不需要跑一个爬虫，不会因为请求过快被封

代价是：Chrome 得开着，扩展得装着。这是唯一的前提。

## 用法

1. 左侧栏点书签图标 → 进收藏夹页
2. 右上角「同步」→ 后台跑，几十秒，进度按平台显示
3. 每条能标 `收件箱 / 在处理 / 已消化 / 归档`，能加标签、写笔记
4. 想让我归纳，直接在对话里说「把我收藏夹里的东西过一遍，按主题分组，写摘要」——我会读 `bookmarks_list`，把摘要用 `bookmarks_update` 写回条目，页面上就能看到

## 为什么不用 API、不用 cookie 文件

两条路都试过，都死了：

- **官方 API**：X 的 Bookmarks 端点改成了按量计费（Posts:Read $0.005/resource，5000 条约 $25；旧的 $200 包月档已取消），而且 X 的官方数据导出里**根本不含 bookmarks**。YouTube Data API 直接封死 Watch Later（`forbidden (403) watchLaterNotAccessible`）。知乎、B 站、小红书没有公开 API。
- **读浏览器 cookie**：macOS 的 App 数据保护（TCC）会拦住任何非授权进程读 `~/Library/Application Support/Google/Chrome/`，即使进程有完全磁盘权限策略也一样。只有你自己的 Terminal 和浏览器扩展能读。

所以 Browser Bridge 不是偷懒，是唯一活着的那条路。

## 目录

```
packages/dsh-bookmarks/
  index.js            插件主机侧：本地存储、六个采集器、HTTP 接口、四个工具
  client.js           界面：侧栏图标 + 主区整页
  cordis.patch.yml    挂载声明
  locale/{zh,en}.json 插件页标题与描述
  icon.svg            图标
tools/collect-cookies.py   备用：从终端里读浏览器 cookie（不给扩展权限时用）
setup.sh                   上面那个脚本的终端启动器
调研-跨平台收藏聚合-2026-11.md   24 个现成方案的调研（为什么最后自己写）
```

数据落在 `~/.dsh-bookmarks/state.json`，纯本地，不上云。

## 接口

页面和插件之间走同源 HTTP，不是 RPC——简单、可 curl、可调试：

```
GET  /dsh-bookmarks/v2/api/state     全部条目 + 六平台元数据 + 同步状态
POST /dsh-bookmarks/v2/api/sync      { platforms?: string[] } 触发同步
POST /dsh-bookmarks/v2/api/update    { ids, status?, tags?, note?, summary?, pinned? }
POST /dsh-bookmarks/v2/api/import    { url }
```

## 已知缺口

- **小红书**：`opencli xiaohongshu saved` 只回一页（25 条）且没有封面，所以改成借浏览器会话打开 `/user/profile/<uid>?tab=fav`、滚动读 `.note-item` 的 DOM（封面、标题、笔记 id 都在）。封面是带签名的 CDN 链接，放久了会失效，失效后卡片自动退回文字卡。
- **样式**：这个页面是「文件型」客户端插件，**没有** `ctx.styles` 这个服务（那是动态半边才有的），所以样式是自己往 `document.head` 插 `<style data-dsh-bookmarks>` 的。
- **分页上限**：X 默认 50 条、YouTube 上限 200、Reddit 约 1000 条封顶（Reddit 自己的限制）。要更多得改 `index.js` 里的 limit。
- **知乎**：按收藏夹逐个拉，取条目最多的前 8 个收藏夹，每个 20 条。私密收藏夹也能拉。
- **没有增量**：每次同步是全量覆盖式合并（按 URL hash 去重，不会重复，只更新 lastSeen）。没有做「只拉上次之后的新增」，因为几个 CLI 都没有这个参数。

## 页面里的两个视图

- **全部条目**：六平台统一列表，按平台、状态、关键词筛，卡片上能直接改状态/打标签/写笔记。点侧栏书签图标进入。
- **归纳**：读 `~/.dsh-bookmarks/digest.md`。让 DSH 里的模型读一遍收藏、写一份归纳稿存到那里，页面立刻就能看。`GET/POST /dsh-bookmarks/v2/api/digest`。

## 改完代码怎么生效（桌面版没有 Cmd+R）

DSH 桌面 app 的渲染层没有刷新快捷键，改 `client.js` 后页面上看不到变化。正确做法：

```
plugin_manager set_plugin { target: 'include:dsh-bookmarks', enabled: false }
plugin_manager set_plugin { target: 'include:dsh-bookmarks', enabled: true }
```

这一开一关会同时热重载 Host 和 Client 两半，不需要重启 app、不需要刷新页面。验证：`cordis_inspect_query { platform: 'client', provider: 'Slots', method: 'listSubTree', input: { root: 'sidebar.panellist' } }` 里应出现 `{"id": "bookmarks", "order": 20, "active": true}`。
