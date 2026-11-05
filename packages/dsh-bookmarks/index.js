/**
 * 全平台收藏夹 —— Host 半边。
 *
 * 职责：
 *  1. 把 X / YouTube / Reddit / Bilibili / 知乎 / 小红书 的「已收藏」内容拉下来（复用本机现成 CLI）
 *  2. 归一化成同一个 item 模型，落在 ~/.dsh-bookmarks/state.json（纯本地，不上云）
 *  3. 通过 webServer 同源路由给前端整页提供数据
 *  4. 通过 tools 暴露给 Agent，让模型做归纳 / 打标签 / 清理
 */
import { spawn } from 'node:child_process'
import { promises as fsp } from 'node:fs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const name = 'bookmarks'
export const inject = { webServer: { required: true }, tools: { required: false } }

const API = '/dsh-bookmarks/v2/api'
const DATA_DIR = path.join(os.homedir(), '.dsh-bookmarks')
const STATE_FILE = path.join(DATA_DIR, 'state.json')
const CRED_FILE = path.join(DATA_DIR, 'credentials.json')

const PLATFORMS = [
  {
    id: 'x',
    label: 'X',
    badge: 'X',
    color: '#1d1d1f',
    home: 'https://x.com/i/bookmarks',
    clip: '书签 / Bookmarks',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    badge: '▶',
    color: '#ff0033',
    home: 'https://www.youtube.com/playlist?list=WL',
    clip: '稍后再看 / Watch Later',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    badge: 'r',
    color: '#ff4500',
    home: 'https://www.reddit.com/saved',
    clip: 'Saved posts',
  },
  {
    id: 'bilibili',
    label: 'Bilibili',
    badge: 'B',
    color: '#fb7299',
    home: 'https://space.bilibili.com',
    clip: '收藏夹 / 稍后再看',
  },
  {
    id: 'zhihu',
    label: '知乎',
    badge: '知',
    color: '#0066ff',
    home: 'https://www.zhihu.com/collections',
    clip: '收藏夹',
  },
  {
    id: 'xiaohongshu',
    label: '小红书',
    badge: '小',
    color: '#ff2442',
    home: 'https://www.xiaohongshu.com/user/profile',
    clip: '收藏',
  },
]

const PLATFORM_BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]))

const DEFAULT_SETTINGS = {
  enabled: {
    x: true,
    youtube: true,
    reddit: true,
    bilibili: true,
    zhihu: true,
    xiaohongshu: false,
  },
  limits: { x: 300, youtube: 100, reddit: 50, bilibili: 600, zhihu: 500, xiaohongshu: 120 },
  bilibiliMaxFolders: 20,
  timeoutMs: 180000,
  // 零摩擦那几条：导出到哪、提醒进哪个列表、日历放哪个日历、多久自己跑一次。
  obsidianVault: path.join(os.homedir(), 'Library/Mobile Documents/iCloud~md~obsidian/Documents/fricless'),
  obsidianFolder: '05-收藏复利',
  remindersList: '',
  calendarName: '',
  autoSyncHours: 6,
  // 每个平台在这个人这里的“角色”：不是标签，是后面所有提炼/路由规则的开关。
  roles: {
    x: { name: '前沿情报站', desc: '高质量行业动态、AI/天文/金融前沿、巨头一手消息', intensity: 'light' },
    youtube: { name: '体系化学习库', desc: '系统课程、技术深度讲解、海外优质教程', intensity: 'deep' },
    bilibili: { name: '中文实操教程库', desc: '本土化实操教程、项目复盘、中文知识讲解', intensity: 'standard' },
    reddit: { name: '用户真实洞察池', desc: '海外用户真实反馈、需求痛点、踩坑经验', intensity: 'standard' },
    zhihu: { name: '深度观点分析库', desc: '长文深度分析、行业观点、逻辑拆解', intensity: 'standard' },
    xiaohongshu: { name: '生活化经验库', desc: '实操经验、种草测评、轻量解决方案', intensity: 'light' },
  },
}


// ---------------------------------------------------------------- 走出收藏夹
// 收藏不是终点，能不能“用上”才是。这里只做三件确定的事：
// 写成 Markdown、丢进提醒事项、排进日历。全部走本机能力，不联网。

function dayStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function timeStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${dayStamp(date)}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

function mdEscape(text) {
  return String(text || '').replace(/\r/g, '').replace(/\n+/g, ' ').trim()
}

function linkHostOf(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function shortDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function itemMarkdown(item, roleName) {
  const bare = String(item.title || '').replace(/https?:\/\/\S+/g, '').trim()
  const title = mdEscape(bare) || mdEscape(linkHostOf(item.url)) || mdEscape(item.url)
  const bits = [item.author, shortDate(item.savedAt || item.firstSeen), item.duration, item.folder].filter(Boolean)
  const meta = bits.length ? ` · ${bits.join(' · ')}` : ''
  const tags = (item.tags || []).length ? ` ${(item.tags || []).map((tag) => `#${tag.replace(/\s+/g, '-')}`).join(' ')}` : ''
  const lines = [`- [${title}](${item.url})${meta}${tags}`]
  if (item.summary) lines.push(`  > ${mdEscape(item.summary)}`)
  if (item.note) lines.push(`  > 备注：${mdEscape(item.note)}`)
  return lines.join('\n')
}

function buildMarkdown(items, settings, { title, note } = {}) {
  const now = new Date()
  const roles = settings.roles || {}
  const byRole = new Map()
  for (const item of items) {
    const role = (roles[item.platform] && roles[item.platform].name) || item.platform
    if (!byRole.has(role)) byRole.set(role, [])
    byRole.get(role).push(item)
  }
  const out = [
    '---',
    `title: ${title}`,
    'source: dsh-bookmarks',
    `created: ${now.toISOString()}`,
    `count: ${items.length}`,
    '---',
    '',
    `# ${title}`,
    '',
    `> 来源：DeepSeek Harness 收藏夹中枢 · ${items.length} 条`,
    `> 导出时间：${now.toLocaleString('zh-CN')}${note ? ` · ${note}` : ''}`,
    '',
  ]
  for (const [role, list] of byRole) {
    out.push(`## ${role}（${list.length}）`, '')
    const sorted = [...list].sort((a, b) =>
      String(b.savedAt || b.firstSeen || '').localeCompare(String(a.savedAt || a.firstSeen || '')))
    for (const item of sorted) out.push(itemMarkdown(item, role), '')
  }
  return out.join('\n')
}

async function osascript(script, args = []) {
  return runCli('/usr/bin/osascript', ['-e', script, '--', ...args], { timeout: 30000 })
}

const REMIND_SCRIPT = `
on run argv
  set theTitle to item 1 of argv
  set theBody to item 2 of argv
  set listName to item 3 of argv
  tell application "Reminders"
    if listName is "" then
      set targetList to default list
    else
      try
        set targetList to list listName
      on error
        set targetList to make new list with properties {name:listName}
      end try
    end if
    make new reminder at end of targetList with properties {name:theTitle, body:theBody}
  end tell
end run
`

const CALENDAR_SCRIPT = `
on run argv
  set theTitle to item 1 of argv
  set theDesc to item 2 of argv
  set calName to item 3 of argv
  set startDate to (current date)
  set hours of startDate to 20
  set minutes of startDate to 0
  set seconds of startDate to 0
  set startDate to startDate + 1 * days
  set endDate to startDate + 20 * minutes
  tell application "Calendar"
    if calName is "" then
      set targetCal to calendar 1
    else
      set targetCal to calendar calName
    end if
    tell targetCal
      make new event with properties {summary:theTitle, start date:startDate, end date:endDate, description:theDesc}
    end tell
  end tell
end run
`

// ---------------------------------------------------------------- 基础工具

function home(...parts) {
  return path.join(os.homedir(), ...parts)
}

function which(candidates) {
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate
    } catch {}
  }
  return null
}

const BINS = {
  twitter: () => which([home('.local/bin/twitter'), '/opt/homebrew/bin/twitter', '/usr/local/bin/twitter']) || 'twitter',
  bili: () => which([home('.local/bin/bili'), '/opt/homebrew/bin/bili', '/usr/local/bin/bili']) || 'bili',
  opencli: () => which(['/opt/homebrew/bin/opencli', '/usr/local/bin/opencli', home('.local/bin/opencli')]) || 'opencli',
}

function cliEnv(extra) {
  const prefix = [home('.local/bin'), '/opt/homebrew/bin', '/usr/local/bin']
  return {
    ...process.env,
    PATH: [...prefix, process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin'].join(':'),
    NO_COLOR: '1',
    ...extra,
  }
}

function runCli(bin, args, { timeout = 180000, env } = {}) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(bin, args, {
        cwd: os.homedir(),
        env: cliEnv(env),
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      resolve({ ok: false, stdout: '', stderr: '', spawnError: String(error?.message || error) })
      return
    }
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {}
      finish({ ok: false, stdout, stderr, timedOut: true })
    }, timeout)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => finish({ ok: false, stdout, stderr, spawnError: String(error?.message || error) }))
    child.on('close', (code) => finish({ ok: code === 0, code, stdout, stderr }))
  })
}

/** 从混杂着提示行的输出里抠出第一个完整 JSON 值。 */
function extractJson(text) {
  const source = String(text || '')
  for (const [open, close] of [['{', '}'], ['[', ']']]) {
    const start = source.indexOf(open)
    if (start < 0) continue
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < source.length; i += 1) {
      const char = source[i]
      if (inString) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') inString = false
        continue
      }
      if (char === '"') inString = true
      else if (char === open) depth += 1
      else if (char === close) {
        depth -= 1
        if (depth === 0) {
          try {
            return JSON.parse(source.slice(start, i + 1))
          } catch {
            break
          }
        }
      }
    }
  }
  return undefined
}

class SourceError extends Error {
  constructor(code, message, detail) {
    super(message)
    this.code = code
    this.detail = detail
  }
}

/** 统一识别 CLI 的失败姿势（JSON error doc / yaml error doc / 崩溃）。 */
function parseCliJson(result, label) {
  if (result.spawnError) {
    throw new SourceError('tool', `${label} 命令跑不起来：${result.spawnError}`)
  }
  if (result.timedOut) {
    throw new SourceError('timeout', `${label} 超时没返回`)
  }
  const json = extractJson(result.stdout) ?? extractJson(result.stderr)
  if (json && typeof json === 'object' && json.ok === false) {
    const code = String(json.error?.code || '')
    const message = String(json.error?.message || json.error || '未知错误')
    if (/not_authenticated|login|unauthor|cookie|auth/i.test(code + message)) {
      throw new SourceError('auth', message, json)
    }
    if (/BROWSER_CONNECT|browser/i.test(code + message)) {
      throw new SourceError('browser', message, json)
    }
    throw new SourceError('cli', message, json)
  }
  if (json !== undefined) return json
  const combined = `${result.stdout}\n${result.stderr}`.trim()
  if (/BROWSER_CONNECT|Browser Bridge|extension not connected/i.test(combined)) {
    throw new SourceError('browser', 'Chrome 浏览器桥没连上')
  }
  if (/not_authenticated|需要登录|No .* cookies/i.test(combined)) {
    throw new SourceError('auth', '需要登录')
  }
  const tail = combined.split('\n').filter(Boolean).slice(-3).join(' / ')
  throw new SourceError('parse', `${label} 输出解析不了${tail ? `：${tail}` : ''}`, combined.slice(0, 2000))
}

// opencli 走 Browser Bridge：复用浏览器里已登录的会话，不碰磁盘上的 cookie 文件。
// 六个平台都有命令，所以它是首选通道；旧 CLI 只当兜底。
async function runOpencli(args, label, settings) {
  const result = await runCli(BINS.opencli(), args, { timeout: settings.timeoutMs })
  return parseCliJson(result, label)
}

function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined
  for (const key of keys) {
    const value = key
      .split('.')
      .reduce((acc, part) => (acc == null ? undefined : acc[part]), obj)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

const CONTAINER_KEYS = [
  'data', 'items', 'list', 'result', 'results', 'rows', 'medias', 'tweets', 'notes',
  'favorites', 'collections', 'videos', 'edges', 'records', 'nodes',
]

/** 在一坨不确定形状的 JSON 里找出「对象数组」。 */
function findRows(value, depth = 0) {
  if (value == null || depth > 6) return null
  if (Array.isArray(value)) {
    const objects = value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
    if (objects.length > 0 && objects.length >= value.length * 0.6) return objects
    for (const entry of value) {
      const found = findRows(entry, depth + 1)
      if (found) return found
    }
    return null
  }
  if (typeof value === 'object') {
    for (const key of CONTAINER_KEYS) {
      if (key in value) {
        const found = findRows(value[key], depth + 1)
        if (found) return found
      }
    }
    for (const entry of Object.values(value)) {
      const found = findRows(entry, depth + 1)
      if (found) return found
    }
  }
  return null
}

function hash(text) {
  let acc = 5381
  const source = String(text)
  for (let i = 0; i < source.length; i += 1) acc = ((acc << 5) + acc + source.charCodeAt(i)) >>> 0
  return acc.toString(36)
}

function cleanUrl(raw) {
  let url = String(raw || '').trim()
  if (!url) return ''
  if (url.startsWith('//')) url = `https:${url}`
  if (!/^https?:\/\//i.test(url)) url = `https://${url.replace(/^\/+/, '')}`
  try {
    const parsed = new URL(url)
    const junk = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'share_source', 'share_medium', 'share_plat', 'share_session_id', 'share_tag',
      'timestamp', 'unique_k', 'spm_id_from', 'vd_source', 'from_source',
      'si', 'pp', 'feature', 'ref', 'ref_src', 'ref_url', 's', 't',
    ]
    for (const key of junk) parsed.searchParams.delete(key)
    return parsed.toString()
  } catch {
    return url
  }
}

function textOf(value, max = 200) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function toIso(value) {
  if (!value) return null
  if (typeof value === 'number') {
    const ms = value > 1e12 ? value : value * 1000
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** 从 URL 推出平台内的稳定 id。 */
function nativeIdFromUrl(platform, url) {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    if (platform === 'youtube') return parsed.searchParams.get('v') || segments.at(-1) || hash(url)
    if (platform === 'reddit') {
      const index = segments.indexOf('comments')
      return index >= 0 ? segments[index + 1] : hash(url)
    }
    if (platform === 'zhihu') {
      const answer = segments.indexOf('answer')
      if (answer >= 0) return segments[answer + 1]
      return segments.at(-1) || hash(url)
    }
    if (platform === 'bilibili') return segments.at(-1) || hash(url)
    if (platform === 'xiaohongshu') {
      const explore = segments.indexOf('explore')
      if (explore >= 0) return segments[explore + 1]
      return segments.at(-1) || hash(url)
    }
    if (platform === 'x') {
      const status = segments.indexOf('status')
      if (status >= 0) return segments[status + 1]
      return segments.at(-1) || hash(url)
    }
    return segments.at(-1) || hash(url)
  } catch {
    return hash(url)
  }
}

// ---------------------------------------------------------------- 数据仓

function emptyState() {
  return {
    version: 1,
    items: {},
    sources: {},
    settings: structuredClone(DEFAULT_SETTINGS),
    updatedAt: new Date().toISOString(),
  }
}

class Store {
  constructor() {
    this.state = emptyState()
    this.loaded = false
    this.writing = Promise.resolve()
  }

  async load() {
    if (this.loaded) return this.state
    this.loaded = true
    try {
      const raw = await fsp.readFile(STATE_FILE, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        this.state = {
          ...emptyState(),
          ...parsed,
          items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {},
          sources: parsed.sources && typeof parsed.sources === 'object' ? parsed.sources : {},
          settings: {
            ...DEFAULT_SETTINGS,
            ...(parsed.settings || {}),
            enabled: { ...DEFAULT_SETTINGS.enabled, ...(parsed.settings?.enabled || {}) },
            limits: (() => {
              const merged = { ...DEFAULT_SETTINGS.limits, ...(parsed.settings?.limits || {}) }
              // 老 state.json 里存着早期的小额度（知乎 20），会把分页直接截断 —— 只升不降。
              for (const [key, value] of Object.entries(DEFAULT_SETTINGS.limits)) {
                merged[key] = Math.max(Number(merged[key]) || 0, Number(value) || 0)
              }
              return merged
            })(),
            roles: { ...DEFAULT_SETTINGS.roles, ...(parsed.settings?.roles || {}) },
            obsidianVault: parsed.settings?.obsidianVault ?? DEFAULT_SETTINGS.obsidianVault,
            obsidianFolder: parsed.settings?.obsidianFolder ?? DEFAULT_SETTINGS.obsidianFolder,
            remindersList: parsed.settings?.remindersList ?? DEFAULT_SETTINGS.remindersList,
            calendarName: parsed.settings?.calendarName ?? DEFAULT_SETTINGS.calendarName,
            autoSyncHours: parsed.settings?.autoSyncHours ?? DEFAULT_SETTINGS.autoSyncHours,
          },
        }
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        // 坏档不静默丢，先备份再起重来
        try {
          await fsp.mkdir(DATA_DIR, { recursive: true })
          await fsp.rename(STATE_FILE, `${STATE_FILE}.broken-${Date.now()}`)
        } catch {}
      }
    }
    return this.state
  }

  save() {
    this.state.updatedAt = new Date().toISOString()
    const snapshot = JSON.stringify(this.state)
    this.writing = this.writing.then(async () => {
      await fsp.mkdir(DATA_DIR, { recursive: true })
      const tmp = `${STATE_FILE}.tmp`
      await fsp.writeFile(tmp, snapshot, 'utf8')
      await fsp.rename(tmp, STATE_FILE)
    }).catch(() => {})
    return this.writing
  }

  items() {
    return Object.values(this.state.items)
  }
}

// ---------------------------------------------------------------- 各平台适配

function makeItem(platform, row, folder) {
  const url = cleanUrl(row.url)
  if (!url) return null
  const nativeId = row.nativeId || nativeIdFromUrl(platform, url)
  return {
    id: `${platform}:${nativeId}`,
    platform,
    nativeId: String(nativeId),
    url,
    title: textOf(row.title, 180) || url,
    author: textOf(row.author, 60) || '',
    excerpt: textOf(row.excerpt, 400) || '',
    cover: row.cover ? cleanUrl(row.cover) : '',
    duration: row.duration || '',
    meta: row.meta || {},
    folder: folder || '',
    savedAt: row.savedAt || null,
  }
}

function genericRow(row) {
  const url = pick(row, ['url', 'link', 'web_url', 'share_url', 'shareUrl', 'href', 'target'])
  return {
    url,
    title: pick(row, ['title', 'name', 'text', 'full_text', 'content', 'excerpt', 'desc', 'description', 'question.title']),
    author: pick(row, [
      'author', 'author.name', 'channel', 'channelName', 'subreddit', 'upper.name',
      'owner.name', 'user.name', 'user.screen_name', 'creator.nickname', 'nickname',
      'uname', 'screen_name', 'blog.name',
    ]),
    excerpt: pick(row, ['excerpt', 'description', 'desc', 'summary', 'intro', 'abstract', 'content']),
    cover: pick(row, ['cover', 'thumbnail', 'pic', 'image', 'images.0', 'media.0.url', 'cover_url']),
    duration: pick(row, ['duration', 'length']),
    savedAt: toIso(pick(row, ['savedAt', 'saved_at', 'fav_time', 'created_at', 'createdAt', 'collect_time', 'time', 'published'])),
  }
}

function tweetRow(row) {
  const tweetId = pick(row, ['id_str', 'id', 'rest_id', 'tweet_id'])
  const url = pick(row, ['url', 'permalink', 'link'])
    || (tweetId ? `https://x.com/i/status/${tweetId}` : '')
  return {
    url,
    nativeId: tweetId ? String(tweetId) : undefined,
    title: pick(row, ['text', 'full_text', 'title', 'note_tweet.text']),
    author: pick(row, [
      'author.name', 'author.screen_name', 'user.name', 'user.screen_name',
      'screen_name', 'name', 'username',
    ]),
    excerpt: pick(row, ['text', 'full_text', 'note_tweet.text']),
    cover: pick(row, ['media.0.url', 'media.0.preview_image_url', 'photos.0.url', 'thumbnail', 'media_posters.0', 'media_urls.0']),
    savedAt: toIso(pick(row, ['bookmarked_at', 'created_at', 'createdAt', 'time'])),
    meta: {
      likes: pick(row, ['favorite_count', 'likes', 'like_count']),
      reposts: pick(row, ['retweet_count', 'reposts', 'retweets']),
      views: pick(row, ['view_count', 'views', 'impressions']),
    },
  }
}

async function readX(ctx, { limit, settings }) {
  try {
    const json = await runOpencli(
      ['twitter', 'bookmarks', '-f', 'json', '--limit', String(limit)],
      'opencli twitter bookmarks',
      settings,
    )
    const rows = (findRows(json) || []).map(tweetRow).filter((row) => row.url)
    if (rows.length) return { folder: 'Bookmarks', rows }
  } catch {
    // 扩展没装 / 没登录 → 退回 twitter CLI
  }
  const result = await runCli(BINS.twitter(), ['bookmarks', '--json', '-n', String(limit)], {
    timeout: settings.timeoutMs,
  })
  const json = parseCliJson(result, 'twitter bookmarks')
  const rows = findRows(json) || []
  return { folder: 'Bookmarks', rows: rows.map(tweetRow).filter((row) => row.url) }
}

async function readYoutube(ctx, { limit, settings }) {
  const result = await runCli(
    BINS.opencli(),
    ['youtube', 'watch-later', '-f', 'json', '--limit', String(limit)],
    { timeout: settings.timeoutMs },
  )
  const json = parseCliJson(result, 'opencli youtube watch-later')
  const rows = findRows(json) || []
  return {
    folder: 'Watch Later',
    rows: rows.map((row) => ({
      url: pick(row, ['url', 'link', 'video_url']),
      cover: (() => {
        const url = String(pick(row, ['url', 'link', 'video_url']) || '')
        const id = (url.match(/[?&]v=([\w-]{6,})/) || url.match(/youtu\.be\/([\w-]{6,})/) || [])[1]
        return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''
      })(),
      title: pick(row, ['title', 'name']),
      author: pick(row, ['channel', 'channelName', 'author', 'uploader']),
      duration: pick(row, ['duration', 'length']),
      meta: { views: pick(row, ['views', 'view_count']), published: pick(row, ['published', 'published_at']) },
      savedAt: null,
    })),
  }
}

async function readReddit(ctx, { limit, settings }) {
  const result = await runCli(
    BINS.opencli(),
    ['reddit', 'saved', '-f', 'json', '--limit', String(limit)],
    { timeout: settings.timeoutMs },
  )
  const json = parseCliJson(result, 'opencli reddit saved')
  const rows = findRows(json) || []
  return {
    folder: 'Saved',
    rows: rows.map((row) => ({
      url: pick(row, ['url', 'permalink', 'link']),
      title: pick(row, ['title', 'name']),
      author: pick(row, ['subreddit', 'author', 'channel']),
      meta: {
        score: pick(row, ['score', 'ups']),
        comments: pick(row, ['comments', 'num_comments']),
      },
      savedAt: null,
    })),
  }
}

const BILI_SESSION = 'dsh-bookmarks'

// 「我的收藏夹」有几个夹子、各多少条 —— 只能从 B 站接口问，而接口要登录态。
// 走 opencli 的浏览器会话：直接带着 Chrome 里已登录的 cookie 发一次 fetch，
// 比让用户再登录一次 bili CLI 省事，也不碰磁盘上的 cookie（macOS 会拦）。
async function biliFolders(settings) {
  const me = await runOpencli(['bilibili', 'me', '-f', 'json'], 'opencli bilibili me', settings)
  const uid = pick(me, ['uid', 'mid', 'data.uid', 'data.mid'])
  if (!uid) throw new Error('拿不到 B 站 uid')
  const open = ['browser', 'open', '--session', BILI_SESSION, '--window', 'background', 'https://www.bilibili.com']
  await runCli(BINS.opencli(), open, { timeout: settings.timeoutMs })
  try {
    const expr =
      `fetch('https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${uid}',{credentials:'include'})` +
      '.then(r=>r.json()).then(j=>JSON.stringify((j.data&&j.data.list||[]).map(f=>[f.id,f.title,f.media_count])))'
    const out = await runCli(
      BINS.opencli(),
      ['browser', 'eval', '--session', BILI_SESSION, expr],
      { timeout: settings.timeoutMs },
    )
    const envelope = parseCliJson(out, 'opencli browser eval')
    const payload = typeof envelope?.data === 'string' ? JSON.parse(envelope.data) : envelope?.data
    return (Array.isArray(payload) ? payload : []).map(([id, title, count]) => ({
      id: String(id),
      title: String(title || '收藏夹'),
      count: Number(count) || 0,
    }))
  } finally {
    try {
      await runCli(BINS.opencli(), ['browser', 'close', '--session', BILI_SESSION], { timeout: 20000 })
    } catch {
      // 关不掉就算了，下一次 open 会复用会话
    }
  }
}

// B 站接口：一个会话里把每个收藏夹翻到底（一页 20 条、has_more 明确），
// 比滚页面稳，还附带封面 / 时长 / 播放量 / 收藏时间。
async function biliWithSession(settings, work) {
  // 上一轮如果被中途打断，会话会留着，复用它拿到的 tab 可能是死的，先收掉
  try {
    await runCli(BINS.opencli(), ['browser', 'close', '--session', BILI_SESSION], { timeout: 20000 })
  } catch {
    // 没有会话可关，正常
  }
  const open = ['browser', 'open', '--session', BILI_SESSION, '--window', 'background', 'https://www.bilibili.com']
  await runCli(BINS.opencli(), open, { timeout: settings.timeoutMs })
  try {
    const evaluate = async (expr) => {
      const out = await runCli(
        BINS.opencli(),
        ['browser', 'eval', '--session', BILI_SESSION, expr],
        { timeout: Math.max(settings.timeoutMs, 120000) },
      )
      const envelope = parseCliJson(out, 'opencli browser eval')
      if (envelope && envelope.ok === false) {
        throw new Error(String(envelope.error?.message || envelope.error || 'browser eval 失败'))
      }
      const payload = typeof envelope?.data === 'string' ? JSON.parse(envelope.data) : envelope?.data
      return payload
    }
    return await work(evaluate)
  } finally {
    try {
      await runCli(BINS.opencli(), ['browser', 'close', '--session', BILI_SESSION], { timeout: 20000 })
    } catch {
      // 关不掉就复用会话
    }
  }
}

async function biliFolderPage(folderId, page, evaluate) {
  const expr = `fetch('https://api.bilibili.com/x/v3/fav/resource/list?media_id=${folderId}&pn=${page}&ps=20&platform=web',{credentials:'include'})` +
    ".then(r=>r.json()).then(j=>{const d=j.data||{};return JSON.stringify({more:!!d.has_more,ms:(d.medias||[]).map(m=>({t:m.title,c:m.cover,d:m.duration,p:(m.cnt_info||{}).play,ft:m.fav_time,bv:m.bvid,up:(m.upper||{}).name,l:m.link}))})})"
  const raw = await evaluate(expr)
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!parsed || typeof parsed !== 'object') return { more: false, medias: [] }
  return { more: !!parsed.more, medias: Array.isArray(parsed.ms) ? parsed.ms : [] }
}

function clockOf(seconds) {
  const total = Math.round(Number(seconds) || 0)
  if (!total) return ''
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

async function readBilibili(ctx, { limit, settings }) {
  const cap = Number(settings.limits?.bilibili) || limit || 600

  let folders = []
  try {
    folders = await biliFolders(settings)
  } catch {
    folders = []
  }
  if (folders.length === 0) folders = [{ id: '2254795491', title: '默认收藏夹', count: 0 }]
  folders = folders.slice(0, Number(settings.bilibiliMaxFolders) || 25)

  const rows = []
  const seen = new Set()
  let failures = 0
  let firstError = ''

  const collected = await biliWithSession(settings, async (evaluate) => {
    const buckets = []
    for (const folder of folders) {
      let items = []
      try {
        const first = await biliFolderPage(folder.id, 1, evaluate)
        items = first.medias.slice()
        let more = first.more
        let page = 1
        while (more && page < 25 && items.length < cap) {
          page += 1
          const next = await biliFolderPage(folder.id, page, evaluate)
          if (next.medias.length === 0) break
          items = items.concat(next.medias)
          more = next.more
        }
      } catch (error) {
        failures += 1
        if (!firstError) firstError = String(error?.message || error)
        continue
      }
      buckets.push({ folder, items })
    }
    return buckets
  })

  for (const { folder, items } of collected) {
    for (const media of items) {
      const bv = media.bv ? String(media.bv) : ''
      const link = typeof media.l === 'string' && media.l.startsWith('http') ? media.l : ''
      const url = bv ? `https://www.bilibili.com/video/${bv}` : link
      if (!url || seen.has(url)) continue
      seen.add(url)
      rows.push({
        url,
        nativeId: bv || undefined,
        title: String(media.t || '').trim(),
        author: String(media.up || '').trim(),
        excerpt: '',
        cover: typeof media.c === 'string' ? media.c.replace(/^http:/, 'https:') : '',
        duration: clockOf(media.d),
        savedAt: media.ft ? new Date(Number(media.ft) * 1000).toISOString() : null,
        meta: { folder: folder.title, plays: Number(media.p) || 0 },
        folder: folder.title,
      })
      if (rows.length >= cap) break
    }
    if (rows.length >= cap) break
  }

  if (rows.length === 0) {
    throw new SourceError('parse', `B 站 ${folders.length} 个收藏夹都没拉到条目${firstError ? `：${firstError}` : ''}`, '')
  }
  if (failures > 0) rows.partial = `${failures} 个收藏夹没拉到`
  return { folder: '全部收藏夹', rows }
}

async function readZhihu(ctx, { limit, settings }) {
  const cap = Number(settings.limits?.zhihu) || limit || 500
  const pageSize = 20

  // 收藏夹列表：这个命令没有 --offset，一次最多 20 个，够用（他只有 3 个夹）。
  const listed = await runOpencli(
    ['zhihu', 'collections', '-f', 'json', '--limit', '20'],
    'opencli zhihu collections',
    settings,
  )
  const collections = (findRows(listed) || [])
    .map((row) => ({
      id: pick(row, ['collection_id', 'id']),
      title: pick(row, ['title', 'name']),
      count: Number(pick(row, ['item_count', 'count']) || 0),
    }))
    .filter((row) => row.id != null)

  const rows = []
  const seen = new Set()
  for (const collection of collections.slice(0, Number(settings.zhihuMaxCollections) || 30)) {
    for (let offset = 0; offset < cap; offset += pageSize) {
      let page
      try {
        page = await runOpencli(
          ['zhihu', 'collection', String(collection.id), '-f', 'json', '--limit', String(pageSize), '--offset', String(offset)],
          `opencli zhihu collection ${collection.id}`,
          settings,
        )
      } catch {
        break
      }
      const items = findRows(page) || []
      if (items.length === 0) break
      for (const row of items) {
        const mapped = genericRow(row)
        if (!mapped.url || seen.has(mapped.url)) continue
        seen.add(mapped.url)
        rows.push({ ...mapped, meta: { folder: collection.title } })
        if (rows.length >= cap) break
      }
      if (items.length < pageSize || rows.length >= cap) break
    }
    if (rows.length >= cap) break
  }

  if (rows.length === 0) throw new SourceError('parse', '知乎一个收藏夹都没拉到条目', '')
  return { folder: '收藏夹', rows }
}

// 小红书：opencli 的 saved 命令只回一页、也没有封面，所以改成像 B 站那样
// 借浏览器会话直接读收藏页的 DOM —— 封面、标题、笔记 id 都在里面。
const XHS_COLLECT = `JSON.stringify([...document.querySelectorAll('.note-item')].map(el=>{` +
  `const a=el.querySelector('a[href*="/explore/"]')||el.querySelector('a');` +
  `const img=el.querySelector('img');` +
  `const t=(el.querySelector('.footer .title')||{}).textContent||'';` +
  `return {h:a?a.href:'',s:img?img.src:'',t:(t||'').trim()}}))`

function noteIdFrom(url) {
  const match = String(url || '').match(/\/explore\/([0-9a-f]{24})/) || String(url || '').match(/\/([0-9a-f]{24})(?:\?|$)/)
  return match ? match[1] : ''
}

// 小红书主页地址需要自己的 uid。whoami 这个命令在 creator 侧有毛病
// （`Xiaohongshu creator profile failed (HTTP 0)`），所以退回从收藏条目的
// URL 里抠 —— saved 命令返回的每一条都带 /user/profile/<uid>/。
async function xhsUid(ctx, settings) {
  try {
    const me = await runOpencli(['xiaohongshu', 'whoami', '-f', 'json'], 'opencli xiaohongshu whoami', settings)
    if (me && me.ok !== false) {
      const value = pick(me, ['user_id', 'userId', 'id', 'data.user_id', 'data.userId', 'data.id'])
      if (value) return String(value)
    }
  } catch {
    // 忽略，走下面的兜底
  }
  const fromUrl = (text) => {
    const match = String(text || '').match(/\/user\/profile\/([0-9a-f]{24})/)
    return match ? match[1] : ''
  }
  try {
    const saved = await runOpencli(
      ['xiaohongshu', 'saved', '-f', 'json', '--limit', '3'],
      'opencli xiaohongshu saved',
      settings,
    )
    for (const row of findRows(saved) || []) {
      const id = fromUrl(row.url)
      if (id) return id
    }
  } catch {
    // 继续兜底
  }
  try {
    const items = ctx?.store?.state?.items || []
    for (const item of items) {
      if (item.platform !== 'xiaohongshu') continue
      const id = fromUrl(item.url)
      if (id) return id
    }
  } catch {
    // 没有就算了
  }
  return ''
}

async function readXiaohongshu(ctx, { limit, settings }) {
  const cap = Number(settings.limits?.xiaohongshu) || limit || 120
  const uid = await xhsUid(ctx, settings)
  const url = uid
    ? `https://www.xiaohongshu.com/user/profile/${uid}?tab=fav`
    : 'https://www.xiaohongshu.com/user/profile/me?tab=fav'

  try {
    await runCli(BINS.opencli(), ['browser', 'close', '--session', BILI_SESSION], { timeout: 20000 })
  } catch {
    // 没有会话可关
  }
  await runCli(
    BINS.opencli(),
    ['browser', 'open', '--session', BILI_SESSION, '--window', 'background', url],
    { timeout: settings.timeoutMs },
  )
  await new Promise((resolve) => setTimeout(resolve, 3500))
  const collected = new Map()
  try {
    const evaluate = async (expr) => {
      const out = await runCli(
        BINS.opencli(),
        ['browser', 'eval', '--session', BILI_SESSION, expr],
        { timeout: Math.max(settings.timeoutMs, 120000) },
      )
      const envelope = parseCliJson(out, 'opencli browser eval')
      if (envelope && envelope.ok === false) {
        throw new Error(String(envelope.error?.message || envelope.error || 'browser eval 失败'))
      }
      const raw = envelope?.data
      if (typeof raw !== 'string') return raw
      try {
        return JSON.parse(raw)
      } catch {
        return raw
      }
    }
    let idle = 0
    for (let round = 0; round < 24 && collected.size < cap; round += 1) {
      const batch = await evaluate(XHS_COLLECT)
      let fresh = 0
      for (const entry of Array.isArray(batch) ? batch : []) {
        const id = noteIdFrom(entry.h)
        if (!id || !entry.s || collected.has(id)) continue
        collected.set(id, { id, url: `https://www.xiaohongshu.com/explore/${id}`, cover: entry.s, title: entry.t })
        fresh += 1
      }
      idle = fresh === 0 ? idle + 1 : 0
      if (idle >= 4) break
      await evaluate('window.scrollTo(0, document.body.scrollHeight), JSON.stringify({y: window.scrollY})')
      await new Promise((resolve) => setTimeout(resolve, 900))
    }
  } finally {
    try {
      await runCli(BINS.opencli(), ['browser', 'close', '--session', BILI_SESSION], { timeout: 20000 })
    } catch {
      // 关不掉就复用
    }
  }

  const rows = [...collected.values()].slice(0, cap).map((entry) => ({
    nativeId: entry.id,
    url: entry.url,
    title: entry.title || '小红书笔记',
    cover: entry.cover,
    author: '',
    folder: '收藏',
    savedAt: null,
    meta: {},
  }))

  if (rows.length) return { folder: '收藏', rows }

  // 兜底：浏览器那条路断了，至少把 opencli 那一页拿回来
  const json = await runOpencli(
    ['xiaohongshu', 'saved', '-f', 'json', '--limit', String(Math.min(Number(limit) || 25, 100))],
    'opencli xiaohongshu saved',
    settings,
  )
  const fallback = (findRows(json) || [])
    .map((row) => ({ ...genericRow(row), meta: { folder: '收藏' } }))
    .filter((row) => row.url)
  return { folder: '收藏', rows: fallback }
}

const READERS = {
  x: readX,
  youtube: readYoutube,
  reddit: readReddit,
  bilibili: readBilibili,
  zhihu: readZhihu,
  xiaohongshu: readXiaohongshu,
}

// ---------------------------------------------------------------- 同步引擎

class Hub {
  constructor() {
    this.store = new Store()
    this.syncing = false
    this.progress = {}
    this.startedAt = null
    this.listeners = new Set()
  }

  async init() {
    await this.store.load()
  }

  async credentials() {
    try {
      const raw = await fsp.readFile(CRED_FILE, 'utf8')
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  sourceState(platform) {
    return (
      this.store.state.sources[platform] || {
        platform,
        status: 'idle',
        lastRun: null,
        lastError: null,
        errorCode: null,
        count: 0,
      }
    )
  }

  markSource(platform, patch) {
    const current = this.sourceState(platform)
    this.store.state.sources[platform] = { ...current, ...patch, platform }
  }

  mergeItems(platform, folder, rows) {
    const now = new Date().toISOString()
    let added = 0
    let updated = 0
    const fresh = []
    for (const row of rows) {
      const item = makeItem(platform, row, row.meta?.folder || folder)
      if (!item) continue
      const existing = this.store.state.items[item.id]
      if (existing) {
        existing.title = item.title || existing.title
        existing.author = item.author || existing.author
        existing.excerpt = item.excerpt || existing.excerpt
        existing.cover = item.cover || existing.cover
        existing.duration = item.duration || existing.duration
        existing.meta = { ...existing.meta, ...item.meta }
        existing.folder = item.folder || existing.folder
        existing.lastSeen = now
        existing.url = item.url
        updated += 1
      } else {
        this.store.state.items[item.id] = {
          ...item,
          status: 'inbox',
          tags: [],
          note: '',
          summary: '',
          pinned: false,
          firstSeen: now,
          lastSeen: now,
        }
        added += 1
        fresh.push(this.store.state.items[item.id])
      }
    }
    return { added, updated, fresh, ids: new Set(rows.map((row) => makeItem(platform, row, row.meta?.folder || folder)).filter(Boolean).map((item) => item.id)) }
  }

  // 平台那边已经取消收藏的条目，如果用户没动过（没备注/标签/状态/置顶），就从本地删掉，
  // 不然旧数据会一直挂在页面上，看起来像同步不完整。
  pruneMissing(platform, ids) {
    const items = this.store.state.items
    let removed = 0
    for (const [id, item] of Object.entries(items)) {
      if (item.platform !== platform) continue
      if (!ids || ids.has(id)) continue
      const touched = item.pinned || item.note || (item.tags && item.tags.length) ||
        (item.status && item.status !== 'inbox') || item.summary
      if (touched) continue
      delete items[id]
      removed += 1
    }
    return removed
  }

  async sync(platforms) {
    if (this.syncing) return { started: false, reason: 'already-running' }
    await this.init()
    const settings = this.store.state.settings
    const targets = (platforms && platforms.length ? platforms : PLATFORMS.map((p) => p.id))
      .filter((platform) => PLATFORM_BY_ID.has(platform))

    this.syncing = true
    this.startedAt = new Date().toISOString()
    this.progress = Object.fromEntries(targets.map((platform) => [platform, { status: 'pending' }]))
    this.emit()

    const credentials = await this.credentials()
    // 这一轮新进来的条目，收尾时写进 inbox/YYYY-MM-DD.md，给「零操作」那条线用。
    const freshAll = []

    for (const platform of targets) {
      const reader = READERS[platform]
      if (!reader) {
        this.progress[platform] = { status: 'unsupported', message: '这个平台还没有能自动拉取的收藏接口' }
        this.markSource(platform, {
          status: 'unsupported',
          errorCode: 'unsupported',
          lastError: '暂无自动同步：小红书没有公开的收藏列表接口',
        })
        this.emit()
        continue
      }
      this.progress[platform] = { status: 'running' }
      this.markSource(platform, { status: 'running', errorCode: null, lastError: null })
      this.emit()
      const limit = settings.limits?.[platform] || 50
      try {
        const { folder, rows } = await reader(null, { limit, settings, credentials })
        const { added, updated, ids, fresh } = this.mergeItems(platform, folder, rows)
        freshAll.push(...fresh)
        // 只在「这个平台是全量枚举、且没有收藏夹失败」时清理旧条目；
        // 有额度上限的平台（知乎/Reddit）不能清，会把限额外的条目误删。
        const fullyEnumerated = platform === 'bilibili' && !rows.partial && rows.length < (settings.limits?.bilibili || 600)
        const removed = fullyEnumerated ? this.pruneMissing(platform, ids) : 0
        this.markSource(platform, {
          status: 'ok',
          lastRun: new Date().toISOString(),
          lastError: null,
          errorCode: null,
          count: rows.length,
        })
        this.progress[platform] = { status: 'done', added, updated, total: rows.length }
        await this.store.save()
      } catch (error) {
        const code = error instanceof SourceError ? error.code : 'unknown'
        const message = String(error?.message || error)
        this.markSource(platform, {
          status: 'error',
          lastRun: new Date().toISOString(),
          lastError: message,
          errorCode: code,
        })
        this.progress[platform] = { status: 'error', code, message }
        await this.store.save()
      }
      this.emit()
    }

    this.syncing = false
    await this.store.save()
    this.emit()
    if (freshAll.length) {
      // 不打扰：只在本地记一笔“今天又进来了什么”，Agent 读这个文件就知道要不要提炼。
      try {
        const dir = path.join(DATA_DIR, 'inbox')
        await fsp.mkdir(dir, { recursive: true })
        const day = new Date().toISOString().slice(0, 10)
        const file = path.join(dir, `${day}.md`)
        const exists = fs.existsSync(file)
        const lines = []
        if (!exists) lines.push(`# ${day} 新收藏`, '', `> 来自收藏夹中枢的自动巡检，共 ${freshAll.length} 条。`, '')
        for (const item of freshAll) {
          lines.push(`- [${mdEscape(item.title) || item.url}](${item.url}) · ${item.platform}${item.folder ? ` · ${item.folder}` : ''}`)
        }
        lines.push('')
        await fsp.appendFile(file, lines.join('\n'), 'utf8')
        this.lastInboxNote = file
      } catch (error) {
        console.error('[bookmarks] 写新收藏清单失败', error)
      }
    }
    return { started: true, added: freshAll.length }
  }

  onChange(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit() {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {}
    }
  }

  counts() {
    const items = this.store.items()
    const byPlatform = {}
    const byStatus = { inbox: 0, doing: 0, done: 0, archived: 0 }
    for (const item of items) {
      byPlatform[item.platform] = (byPlatform[item.platform] || 0) + 1
      byStatus[item.status] = (byStatus[item.status] || 0) + 1
    }
    return { total: items.length, byPlatform, byStatus }
  }

  async patchItem(id, patch) {
    await this.init()
    const item = this.store.state.items[id]
    if (!item) return null
    if (typeof patch.status === 'string') item.status = patch.status
    if (typeof patch.note === 'string') item.note = patch.note
    if (typeof patch.summary === 'string') item.summary = patch.summary
    if (typeof patch.pinned === 'boolean') item.pinned = patch.pinned
    if (Array.isArray(patch.tags)) item.tags = patch.tags.map(String).slice(0, 12)
    if (Array.isArray(patch.addTags)) {
      item.tags = [...new Set([...(item.tags || []), ...patch.addTags.map(String)])].slice(0, 12)
    }
    item.updatedAt = new Date().toISOString()
    await this.store.save()
    this.emit()
    return item
  }

  async importUrl(rawUrl, platformHint) {
    await this.init()
    const url = cleanUrl(rawUrl)
    if (!url) throw new Error('不是有效链接')
    const platform = platformHint && PLATFORM_BY_ID.has(platformHint)
      ? platformHint
      : guessPlatform(url)
    if (!platform) throw new Error('认不出这个链接属于哪个平台')
    const nativeId = nativeIdFromUrl(platform, url)
    const id = `${platform}:${nativeId}`
    const now = new Date().toISOString()
    const existing = this.store.state.items[id]
    if (existing) return existing
    const item = {
      id,
      platform,
      nativeId,
      url,
      title: url,
      author: '',
      excerpt: '',
      cover: '',
      duration: '',
      meta: {},
      folder: '手动',
      savedAt: null,
      status: 'inbox',
      tags: [],
      note: '',
      summary: '',
      pinned: false,
      firstSeen: now,
      lastSeen: now,
    }
    this.store.state.items[id] = item
    await this.store.save()
    this.emit()
    return item
  }

  snapshot() {
    const items = this.store.items()
      .map((item) => ({ ...item, platformMeta: PLATFORM_BY_ID.get(item.platform) || null }))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        const left = a.savedAt || a.firstSeen || ''
        const right = b.savedAt || b.firstSeen || ''
        return right.localeCompare(left)
      })
    return {
      ok: true,
      build: BUILD,
      items,
      platforms: PLATFORMS,
      sources: this.store.state.sources,
      settings: this.store.state.settings,
      counts: this.counts(),
      syncing: this.syncing,
      progress: this.progress,
      startedAt: this.startedAt,
      updatedAt: this.store.state.updatedAt,
      dataDir: DATA_DIR,
    }
  }
}

function guessPlatform(rawUrl) {
  const url = String(rawUrl || '').toLowerCase()
  if (/(^|\/\/)(www\.)?(x|twitter)\.com\//.test(url)) return 'x'
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube'
  if (/reddit\.com/.test(url)) return 'reddit'
  if (/bilibili\.com|b23\.tv/.test(url)) return 'bilibili'
  if (/zhihu\.com/.test(url)) return 'zhihu'
  if (/xiaohongshu\.com|xhslink\.com/.test(url)) return 'xiaohongshu'
  return null
}

// ---------------------------------------------------------------- HTTP 接口

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('content-length', Buffer.byteLength(payload))
  res.end(payload)
}

async function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (!text.trim()) return resolve({})
      try {
        resolve(JSON.parse(text))
      } catch (error) {
        reject(new Error(`JSON 解析失败: ${error.message}`))
      }
    })
    req.on('error', reject)
  })
}

const diag = { report: null }

function makeHandler(hub) {
  return async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const route = url.pathname.slice(API.length) || '/'
    try {
      if (req.method === 'GET' && route === '/state') {
        await hub.init()
        return sendJson(res, 200, hub.snapshot())
      }
      if (req.method === 'POST' && route === '/sync') {
        const body = await readBody(req)
        const result = await hub.sync(Array.isArray(body.platforms) ? body.platforms : undefined)
        return sendJson(res, 200, { ok: true, ...result })
      }
      if (req.method === 'POST' && route === '/item') {
        const body = await readBody(req)
        if (!body.id) return sendJson(res, 400, { ok: false, error: '缺少 id' })
        const item = await hub.patchItem(String(body.id), body.patch || {})
        if (!item) return sendJson(res, 404, { ok: false, error: '没有这条' })
        return sendJson(res, 200, { ok: true, item })
      }
      if (req.method === 'POST' && route === '/import') {
        const body = await readBody(req)
        const item = await hub.importUrl(body.url, body.platform)
        return sendJson(res, 200, { ok: true, item })
      }
      if (req.method === 'POST' && route === '/diag') {
        // 客户端回来报一句“我渲染成什么样了”，用于在宿主侧确认 UI 真的挂上了样式。
        const body = await readBody(req)
        diag.report = { ...body, at: new Date().toISOString() }
        return sendJson(res, 200, { ok: true })
      }
      if (req.method === 'GET' && route === '/diag') {
        return sendJson(res, 200, { ok: true, report: diag.report || null })
      }
      if (req.method === 'GET' && route === '/digest') {
        const file = path.join(DATA_DIR, 'digest.md')
        try {
          const markdown = await fsp.readFile(file, 'utf8')
          const stat = await fsp.stat(file)
          return sendJson(res, 200, { ok: true, markdown, updatedAt: stat.mtimeMs })
        } catch {
          return sendJson(res, 200, { ok: true, markdown: '', updatedAt: null })
        }
      }
      if (req.method === 'POST' && route === '/digest') {
        const body = await readBody(req)
        const file = path.join(DATA_DIR, 'digest.md')
        await fsp.mkdir(DATA_DIR, { recursive: true })
        await fsp.writeFile(file, String(body.markdown || ''), 'utf8')
        return sendJson(res, 200, { ok: true })
      }
      if (req.method === 'POST' && route === '/settings') {
        const body = await readBody(req)
        await hub.init()
        const current = hub.store.state.settings
        hub.store.state.settings = {
          ...current,
          ...(body.settings || {}),
          enabled: { ...current.enabled, ...(body.settings?.enabled || {}) },
          limits: { ...current.limits, ...(body.settings?.limits || {}) },
          roles: { ...current.roles, ...(body.settings?.roles || {}) },
        }
        await hub.store.save()
        return sendJson(res, 200, { ok: true, settings: hub.store.state.settings })
      }
      if (req.method === 'POST' && route === '/export') {
        const body = await readBody(req)
        await hub.init()
        const settings = hub.store.state.settings
        let items = hub.store.items()
        if (Array.isArray(body.ids) && body.ids.length) {
          const wanted = new Set(body.ids.map(String))
          items = items.filter((item) => wanted.has(item.id))
        } else if (body.filter && typeof body.filter === 'object') {
          const f = body.filter
          if (f.platform && f.platform !== 'all') items = items.filter((item) => item.platform === f.platform)
          if (f.folder && f.folder !== 'all') items = items.filter((item) => String(item.folder || '') === String(f.folder))
          if (f.status && f.status !== 'all') items = items.filter((item) => item.status === f.status)
          if (f.role && f.role !== 'all') {
            const roles = settings.roles || {}
            const matched = Object.keys(roles).filter((key) => roles[key] && roles[key].name === f.role)
            items = items.filter((item) => matched.includes(item.platform))
          }
          if (f.query) {
            const needle = String(f.query).toLowerCase()
            items = items.filter((item) => [item.title, item.author, item.excerpt, item.note, ...(item.tags || [])]
              .join(' ').toLowerCase().includes(needle))
          }
        }
        const title = body.title || `收藏复利 · ${new Date().toLocaleDateString('zh-CN')}`
        const markdown = buildMarkdown(items, settings, { title, note: body.note })
        const outDir = path.join(DATA_DIR, 'exports')
        await fsp.mkdir(outDir, { recursive: true })
        const file = path.join(outDir, `收藏-${timeStamp()}.md`)
        await fsp.writeFile(file, markdown, 'utf8')
        let obsidianPath = null
        let obsidianError = null
        if (body.toObsidian !== false && settings.obsidianVault) {
          try {
            const vault = String(settings.obsidianVault).replace(/^~(?=$|\/)/, os.homedir())
            const dir = path.join(vault, settings.obsidianFolder || '05-收藏复利')
            await fsp.mkdir(dir, { recursive: true })
            obsidianPath = path.join(dir, `${new Date().toISOString().slice(0, 10)} ${title.replace(/[\\/:*?"<>|]/g, '-')}.md`)
            await fsp.writeFile(obsidianPath, markdown, 'utf8')
          } catch (error) {
            obsidianError = String(error?.message || error)
          }
        }
        return sendJson(res, 200, { ok: true, path: file, obsidianPath, obsidianError, count: items.length })
      }

      if (req.method === 'POST' && route === '/remind') {
        const body = await readBody(req)
        await hub.init()
        const settings = hub.store.state.settings
        const ids = new Set((body.ids || []).map(String))
        const picked = hub.store.items().filter((item) => ids.has(item.id)).slice(0, 12)
        if (!picked.length) return sendJson(res, 400, { ok: false, error: '没选中条目' })
        const errors = []
        let added = 0
        for (const item of picked) {
          const title = (item.title || item.url).slice(0, 120)
          const detail = `${item.url}${item.note ? `\n\n备注：${item.note}` : ''}`
          const result = await osascript(REMIND_SCRIPT, [title, detail, settings.remindersList || ''])
          if (result.ok) added += 1
          else errors.push(String(result.stderr || result.spawnError || '').trim().slice(0, 160))
        }
        return sendJson(res, 200, {
          ok: added > 0,
          added,
          requested: picked.length,
          list: settings.remindersList || '默认列表',
          errors: errors.slice(0, 3),
        })
      }

      if (req.method === 'POST' && route === '/calendar') {
        const body = await readBody(req)
        await hub.init()
        const settings = hub.store.state.settings
        const ids = new Set((body.ids || []).map(String))
        const picked = hub.store.items().filter((item) => ids.has(item.id)).slice(0, 6)
        if (!picked.length) return sendJson(res, 400, { ok: false, error: '没选中条目' })
        const errors = []
        let added = 0
        for (const item of picked) {
          const title = `读：${(item.title || item.url).slice(0, 80)}`
          const detail = `${item.url}${item.summary ? `\n\n${item.summary}` : ''}`
          const result = await osascript(CALENDAR_SCRIPT, [title, detail, settings.calendarName || ''])
          if (result.ok) added += 1
          else errors.push(String(result.stderr || result.spawnError || '').trim().slice(0, 160))
        }
        return sendJson(res, 200, { ok: added > 0, added, requested: picked.length, errors: errors.slice(0, 3) })
      }

      if (req.method === 'POST' && route === '/reveal') {
        const body = await readBody(req)
        const target = String(body.path || '')
        if (!target) return sendJson(res, 400, { ok: false, error: '缺 path' })
        await runCli('/usr/bin/open', ['-R', target], { timeout: 8000 })
        return sendJson(res, 200, { ok: true })
      }

      return sendJson(res, 404, { ok: false, error: 'no such route' })
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: String(error?.message || error) })
    }
  }
}

// ---------------------------------------------------------------- Agent 工具

const contentText = (text) => [{ type: 'text', text }]

function toolOutput(textSchema) {
  return {
    schema: textSchema || { type: 'object', properties: {} },
    render(args, value) {
      const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      return contentText(text)
    },
  }
}

function registerTools(ctx, hub) {
  const tools = ctx.get('tools')
  if (!tools) return []

  const disposers = []

  disposers.push(
    tools.register({
      name: 'bookmarks_list',
      description:
        '列出本地收藏夹中枢里的条目（来自 X / YouTube / Reddit / Bilibili / 知乎 / 小红书）。可按平台、状态、关键词过滤。用于归纳、写摘要、决定清理。',
      parameters: {
        type: 'object',
        properties: {
          platform: { type: 'string', description: 'x | youtube | reddit | bilibili | zhihu | xiaohongshu' },
          folder: { type: 'string', description: '只看某个收藏夹，例如 B 站的「AP自学」' },
          role: { type: 'string', description: '按平台角色过滤，例如「前沿情报站」' },
          status: { type: 'string', description: 'inbox | doing | done | archived' },
          query: { type: 'string', description: '标题/作者/摘要里的关键词' },
          limit: { type: 'integer', description: '最多返回多少条，默认 30' },
          offset: { type: 'integer', description: '跳过多少条' },
        },
        additionalProperties: false,
      },
      output: toolOutput({ type: 'object', properties: { items: { type: 'array' }, total: { type: 'integer' } } }),
      async execute(args) {
        await hub.init()
        const options = args || {}
        const limit = Math.min(Number(options.limit) || 30, 200)
        const offset = Number(options.offset) || 0
        const needle = String(options.query || '').toLowerCase()
        let items = hub.store.items()
        if (options.platform) items = items.filter((item) => item.platform === options.platform)
        if (options.folder) items = items.filter((item) => String(item.folder || '') === String(options.folder))
        if (options.role) {
          const roles = hub.store.state.settings.roles || {}
          const matched = Object.keys(roles).filter((key) => roles[key] && roles[key].name === options.role)
          items = items.filter((item) => matched.includes(item.platform))
        }
        if (options.status) items = items.filter((item) => item.status === options.status)
        if (needle) {
          items = items.filter((item) =>
            [item.title, item.author, item.excerpt, item.summary, item.note, ...(item.tags || [])]
              .join(' ')
              .toLowerCase()
              .includes(needle),
          )
        }
        items.sort((a, b) => String(b.savedAt || b.firstSeen || '').localeCompare(String(a.savedAt || a.firstSeen || '')))
        const page = items.slice(offset, offset + limit)
        return {
          total: items.length,
          counts: hub.counts(),
          items: page.map((item) => ({
            id: item.id,
            platform: item.platform,
            title: item.title,
            author: item.author,
            url: item.url,
            folder: item.folder,
            role: (hub.store.state.settings.roles?.[item.platform] || {}).name || null,
            status: item.status,
            tags: item.tags,
            note: item.note,
            summary: item.summary,
            savedAt: item.savedAt || item.firstSeen,
          })),
        }
      },
    }),
  )

  disposers.push(
    tools.register({
      name: 'bookmarks_sync',
      description:
        '从各平台本地 CLI 重新拉取收藏内容到中枢。传 platforms 只同步指定平台，不传则全同步。会在后台跑，立刻返回。',
      parameters: {
        type: 'object',
        properties: {
          platforms: {
            type: 'array',
            items: { type: 'string', enum: ['x', 'youtube', 'reddit', 'bilibili', 'zhihu', 'xiaohongshu'] },
            description: '要同步的平台，省略=全部',
          },
        },
        additionalProperties: false,
      },
      output: toolOutput({ type: 'object', properties: { started: { type: 'boolean' } } }),
      async execute(args) {
        const result = await hub.sync(args?.platforms)
        return {
          ...result,
          hint: result.started ? '同步已在后台开始，用 bookmarks_list 查看结果' : '已有同步在跑',
        }
      },
    }),
  )

  disposers.push(
    tools.register({
      name: 'bookmarks_update',
      description:
        '更新收藏条目的状态 / 标签 / 笔记 / 摘要。批量传 ids 即可一次性处理多条。摘要写进 summary 字段后会显示在收藏夹页面。',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: '条目 id 列表' },
          status: { type: 'string', enum: ['inbox', 'doing', 'done', 'archived'] },
          addTags: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' }, description: '整体替换标签' },
          note: { type: 'string' },
          summary: { type: 'string', description: '给这条写的中文摘要/价值判断' },
          pinned: { type: 'boolean' },
        },
        required: ['ids'],
        additionalProperties: false,
      },
      output: toolOutput({ type: 'object', properties: { updated: { type: 'integer' } } }),
      async execute(args) {
        const ids = Array.isArray(args?.ids) ? args.ids : []
        let updated = 0
        const missing = []
        for (const id of ids) {
          const patch = {}
          for (const key of ['status', 'note', 'summary', 'pinned', 'tags', 'addTags']) {
            if (args[key] !== undefined) patch[key] = args[key]
          }
          const item = await hub.patchItem(String(id), patch)
          if (item) updated += 1
          else missing.push(id)
        }
        return { updated, missing }
      },
    }),
  )

  disposers.push(
    tools.register({
      name: 'bookmarks_import',
      description: '往收藏夹中枢里手动加一条链接（任何平台，小红书尤其用得上）。自动识别平台。',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          platform: { type: 'string', description: '可选，强制指定平台' },
        },
        required: ['url'],
        additionalProperties: false,
      },
      output: toolOutput({ type: 'object', properties: { id: { type: 'string' } } }),
      async execute(args) {
        const item = await hub.importUrl(args?.url, args?.platform)
        return { id: item.id, title: item.title, platform: item.platform }
      },
    }),
  )


  disposers.push(
    tools.register({
      name: 'bookmarks_export',
      description:
        '把收藏导出成 Markdown：默认写两份（~/.dsh-bookmarks/exports/ 和 Obsidian 的 fricless/05-收藏复利/），返回落盘路径。可按平台/收藏夹/角色/状态/关键词筛选，也可以只给 ids。',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: '只导这些条目' },
          platform: { type: 'string' },
          folder: { type: 'string' },
          role: { type: 'string' },
          status: { type: 'string' },
          query: { type: 'string' },
          title: { type: 'string', description: '文档标题，默认带日期' },
          toObsidian: { type: 'boolean', description: '是否同时写进 Obsidian，默认 true' },
        },
        additionalProperties: false,
      },
      output: toolOutput({ type: 'object', properties: { path: { type: 'string' }, obsidianPath: { type: 'string' } } }),
      async execute(args) {
        await hub.init()
        const settings = hub.store.state.settings
        let items = hub.store.items()
        if (Array.isArray(args?.ids) && args.ids.length) {
          const wanted = new Set(args.ids.map(String))
          items = items.filter((item) => wanted.has(item.id))
        } else {
          if (args?.platform) items = items.filter((item) => item.platform === args.platform)
          if (args?.folder) items = items.filter((item) => String(item.folder || '') === String(args.folder))
          if (args?.status) items = items.filter((item) => item.status === args.status)
          if (args?.role) {
            const roles = settings.roles || {}
            const matched = Object.keys(roles).filter((key) => roles[key] && roles[key].name === args.role)
            items = items.filter((item) => matched.includes(item.platform))
          }
          if (args?.query) {
            const needle = String(args.query).toLowerCase()
            items = items.filter((item) => [item.title, item.author, item.excerpt, item.note, ...(item.tags || [])]
              .join(' ').toLowerCase().includes(needle))
          }
        }
        const title = args?.title || `收藏复利 · ${new Date().toLocaleDateString('zh-CN')}`
        const markdown = buildMarkdown(items, settings, { title })
        const outDir = path.join(DATA_DIR, 'exports')
        await fsp.mkdir(outDir, { recursive: true })
        const file = path.join(outDir, `收藏-${timeStamp()}.md`)
        await fsp.writeFile(file, markdown, 'utf8')
        let obsidianPath = null
        if (args?.toObsidian !== false && settings.obsidianVault) {
          try {
            const vault = String(settings.obsidianVault).replace(/^~(?=$|\/)/, os.homedir())
            const dir = path.join(vault, settings.obsidianFolder || '05-收藏复利')
            await fsp.mkdir(dir, { recursive: true })
            obsidianPath = path.join(dir, `${new Date().toISOString().slice(0, 10)} ${title.replace(/[\\/:*?"<>|]/g, '-')}.md`)
            await fsp.writeFile(obsidianPath, markdown, 'utf8')
          } catch {}
        }
        return { path: file, obsidianPath, count: items.length }
      },
    }),
  )

  disposers.push(
    tools.register({
      name: 'bookmarks_review',
      description:
        '看一眼“还没动的东西”：未读总数、躺了 30 天以上的、连标题都没有的（5 秒法则没执行）、按平台的积压。用来决定今天该消化什么。',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: toolOutput({ type: 'object', properties: { inbox: { type: 'integer' }, stale: { type: 'array' } } }),
      async execute() {
        await hub.init()
        const now = Date.now()
        const items = hub.store.items()
        const inbox = items.filter((item) => (item.status || 'inbox') === 'inbox')
        const age = (item) => now - new Date(item.savedAt || item.firstSeen || 0).getTime()
        const stale = inbox.filter((item) => age(item) > 30 * 864e5)
        // 标题只剩链接的，等于“当时根本没起标题”，归到 5 秒法则那一类。
        const empty = inbox.filter((item) => !String(item.title || '').replace(/https?:\/\/\S+/g, '').trim())
        const byPlatform = {}
        for (const item of inbox) byPlatform[item.platform] = (byPlatform[item.platform] || 0) + 1
        return {
          inbox: inbox.length,
          staleCount: stale.length,
          emptyCount: empty.length,
          byPlatform,
          stale: stale.slice(0, 10).map((item) => ({
            id: item.id, title: item.title, platform: item.platform, days: Math.round(age(item) / 864e5),
          })),
        }
      },
    }),
  )

  return disposers
}

// ---------------------------------------------------------------- 装配

// 插件被禁用再启用时，旧实例可能还没被销毁，路由和工具就会撞名。
// globalThis 上的寄存器跨模块实例存活，先把上一份清掉再用 ctx.effect 挂接
// （ctx.effect 是 Cordis 的自动销毁机制，fiber 一停就回收）。
const BUILD = 'opencli-5'
const ROUTES = (globalThis.__dshBookmarksRoutes ??= new Map())

function releaseStale() {
  for (const [key, dispose] of [...ROUTES]) {
    try {
      dispose()
    } catch {}
    ROUTES.delete(key)
  }
}

function keep(key, register) {
  try {
    const dispose = register()
    ROUTES.set(key, dispose)
    return dispose
  } catch (error) {
    console.warn(`[bookmarks] ${key} 注册失败（多半是上一个实例还占着）：${error && error.message}`)
    return () => {}
  }
}

export function apply(ctx) {
  releaseStale()
  const hub = new Hub()

  hub.init().catch(() => {})

  ctx.effect(() => keep('route', () => ctx.webServer.register({ kind: 'prefix', path: API, handler: makeHandler(hub) })))

  try {
    registerTools(ctx, hub).forEach((dispose, index) => {
      ctx.effect(() => keep(`tool:${index}`, () => dispose))
    })
  } catch (error) {
    console.error('[bookmarks] 工具注册失败', error)
  }

  // 零操作的那一半：自己按点跑一次同步。跑完只在本地留清单，不弹窗、不打扰。
  ctx.effect(() => {
    let timer = null
    const schedule = () => {
      const hours = Number(hub.store.state.settings.autoSyncHours) || 0
      if (timer) clearInterval(timer)
      timer = null
      if (hours <= 0) return
      timer = setInterval(() => {
        if (hub.syncing) return
        hub.sync().catch((error) => console.error('[bookmarks] 自动同步失败', error))
      }, Math.max(1, hours) * 3600 * 1000)
      if (typeof timer.unref === 'function') timer.unref()
    }
    hub.init().then(schedule).catch(() => {})
    if (typeof hub.onChange === 'function') {
      // 设置改了（比如把自动同步关掉），下一轮生效。
      hub.onChange(schedule)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  })

  return { hub }
}
