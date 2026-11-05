// 全平台收藏夹 —— 客户端一半（DSH Web UI 插件）
// 结构：一个主区整页（main/bookmarks）+ 一个侧栏按钮（sidebar.panellist/bookmarks）
// 数据：全部从同源 HTTP 路由 /dsh-bookmarks/v2/api 拿，不走 host.call。
// 注意：这里的 id 必须和 package.json 的 name 完全一致，否则 loader 匹配不到这一半，
// 表现就是「侧栏图标和整页都消失了」——改成 @shawnclink 时漏改过一次。
window.__ModuleLoader__.load({
  id: '@shawnclink/dsh-bookmarks',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const API = '/dsh-bookmarks/v2/api';

    // ------------------------------------------------------------ 平台表
    const PLATFORMS = [
      { id: 'x', label: 'X', color: '#12161c', tint: '#6b7683', home: '书签' },
      { id: 'bilibili', label: '哔哩哔哩', color: '#00aeec', tint: '#00aeec', home: '收藏夹' },
      { id: 'youtube', label: 'YouTube', color: '#ff0033', tint: '#ff0033', home: '稍后再看' },
      { id: 'zhihu', label: '知乎', color: '#0084ff', tint: '#0084ff', home: '收藏夹' },
      { id: 'reddit', label: 'Reddit', color: '#ff4500', tint: '#ff4500', home: 'saved' },
      { id: 'xiaohongshu', label: '小红书', color: '#ff2442', tint: '#ff2442', home: '收藏' },
    ];

    const BY_ID = {};
    for (const platform of PLATFORMS) BY_ID[platform.id] = platform;

    const STATUSES = [
      { id: 'inbox', label: '待看' },
      { id: 'doing', label: '在看' },
      { id: 'done', label: '看完' },
      { id: 'archived', label: '归档' },
    ];

    const FIX = {
      auth: '在 Chrome 里重新登录这个平台，扩展会自动拿到新 cookie',
      browser: '装 opencli 的 Chrome 扩展（opencli doctor 看状态）',
      tool: '本机没装这个平台的 CLI',
      timeout: '拉取超时，稍后重试',
      parse: '返回格式变了，需要更新解析规则',
      unsupported: '这个平台暂时拉不了，用标题栏的「+ 链接」手动加',
      cli: 'CLI 直接报错，看终端输出',
      unknown: '未知错误',
    };

    // ------------------------------------------------------------ 样式
    const CSS = `
.bm-root{
  --bm-grad: linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-brand-primary, #4d7cff) 6%, transparent), transparent 180px);
  position:absolute; inset:0; overflow-y:auto; overflow-x:hidden; background:var(--dsw-alias-bg-base, #17181b);
  height:100%; min-height:0;
  background-image:var(--bm-grad);
  color:var(--dsw-alias-label-primary, #e9ebef);
  font-family:inherit; -webkit-font-smoothing:antialiased;
}
.bm-inner{max-width:1560px; margin:0 auto; padding:22px 26px 64px;}

/* 顶部 */
.bm-head{display:flex; align-items:flex-end; gap:14px; margin-bottom:18px;}
.bm-title{font-size:21px; font-weight:650; letter-spacing:-.2px; line-height:1.2;}
.bm-title small{font-weight:500; font-size:12px; color:var(--dsw-alias-label-secondary, #9aa0aa); margin-left:9px; letter-spacing:0;}
.bm-head-spacer{flex:1;}
.bm-search{position:relative; width:236px;}
.bm-search input{
  width:100%; box-sizing:border-box; height:32px; padding:0 30px 0 30px;
  border-radius:9px; border:1px solid var(--dsw-alias-border-l2, #3b3e45);
  background:color-mix(in srgb, var(--dsw-alias-bg-layer-1, #1e2024) 70%, transparent);
  color:inherit; font-size:12.5px; font-family:inherit; outline:none;
  transition:border-color .16s, background .16s, box-shadow .16s;
}
.bm-search input::placeholder{color:color-mix(in srgb, var(--dsw-alias-label-secondary, #9aa0aa) 82%, transparent);}
.bm-search input:focus{border-color:var(--dsw-alias-brand-primary, #4d7cff); background:var(--dsw-alias-bg-layer-1, #1e2024); box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary, #4d7cff) 16%, transparent);}
.bm-search .bm-search-ico{position:absolute; left:9px; top:50%; transform:translateY(-50%); opacity:.5; display:flex;}
.bm-search .bm-search-key{position:absolute; right:8px; top:50%; transform:translateY(-50%); font-size:10.5px; opacity:.45; border:1px solid var(--dsw-alias-border-l1, #2f3136); border-radius:4px; padding:0 4px; line-height:15px;}

.bm-btn{
  height:32px; padding:0 12px; border-radius:9px; border:1px solid var(--dsw-alias-border-l2, #3b3e45);
  background:color-mix(in srgb, var(--dsw-alias-bg-layer-1, #1e2024) 70%, transparent); color:inherit;
  font-size:12.5px; font-family:inherit; cursor:pointer; display:inline-flex; align-items:center; gap:6px;
  transition:background .16s, border-color .16s, transform .1s, color .16s;
}
.bm-btn:hover{background:var(--dsw-alias-bg-layer-2, #26282d); border-color:color-mix(in srgb, var(--dsw-alias-label-secondary, #9aa0aa) 40%, transparent);}
.bm-btn:active{transform:translateY(.5px);}
.bm-btn.primary{background:var(--dsw-alias-brand-primary, #4d7cff); border-color:transparent; color:#fff;}
.bm-btn.primary:hover{filter:brightness(1.06);}
.bm-btn.ghost{border-color:transparent; background:transparent;}
.bm-btn.spin svg{animation:bm-rot 1s linear infinite;}
@keyframes bm-rot{to{transform:rotate(360deg);}}

.bm-seg{display:inline-flex; padding:2px; gap:2px; border-radius:10px; background:color-mix(in srgb, var(--dsw-alias-bg-layer-2, #26282d) 80%, transparent);}
.bm-seg button{
  border:0; background:transparent; color:var(--dsw-alias-label-secondary, #9aa0aa); font-family:inherit;
  font-size:12px; padding:5px 12px; border-radius:8px; cursor:pointer; transition:background .16s,color .16s;
}
.bm-seg button.on{background:var(--dsw-alias-bg-layer-1, #1e2024); color:var(--dsw-alias-label-primary, #e9ebef); box-shadow:0 1px 2px rgba(0,0,0,.14);}

/* 平台筛选 */
.bm-bar{display:flex; align-items:center; gap:8px; margin-bottom:16px; flex-wrap:wrap;}
.bm-pill{
  display:inline-flex; align-items:center; gap:7px; height:30px; padding:0 11px 0 9px;
  border-radius:999px; border:1px solid transparent; cursor:pointer; font-family:inherit;
  background:color-mix(in srgb, var(--dsw-alias-bg-layer-1, #1e2024) 60%, transparent); color:var(--dsw-alias-label-secondary, #9aa0aa);
  font-size:12px; transition:all .16s;
}
.bm-pill:hover{color:var(--dsw-alias-label-primary, #e9ebef); background:var(--dsw-alias-bg-layer-2, #26282d);}
.bm-pill.on{color:var(--dsw-alias-label-primary, #e9ebef); border-color:color-mix(in srgb, var(--dsw-alias-label-secondary, #9aa0aa) 32%, transparent); background:var(--dsw-alias-bg-layer-1, #1e2024);}
.bm-pill .dot{width:7px; height:7px; border-radius:50%; flex:none;}
.bm-pill .num{font-variant-numeric:tabular-nums; opacity:.55; font-size:11px;}
.bm-bar-spacer{flex:1;}
.bm-sort{
  height:30px; border-radius:9px; border:1px solid var(--dsw-alias-border-l1, #2f3136); background:transparent;
  color:var(--dsw-alias-label-secondary, #9aa0aa); font-family:inherit; font-size:12px; padding:0 8px; cursor:pointer; outline:none;
}

/* 网格 */
.bm-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(246px, 1fr)); gap:22px 16px;}
.bm-card{display:flex; flex-direction:column; min-width:0; position:relative; transition:transform .22s cubic-bezier(.2,.7,.3,1);}
.bm-card:hover{transform:translateY(-3px);}
.bm-thumb{
  position:relative; aspect-ratio:16/9; border-radius:11px; overflow:hidden;
  background:var(--dsw-alias-bg-layer-2, #26282d); display:block; text-decoration:none; color:inherit;
  box-shadow:0 1px 2px rgba(0,0,0,.16);
}
.bm-card:hover .bm-thumb{box-shadow:0 12px 26px -8px rgba(0,0,0,.42);}
.bm-thumb img{
  position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;
  transition:transform .5s cubic-bezier(.2,.7,.3,1);
  background:var(--dsw-alias-bg-layer-2, #26282d);
}
.bm-card:hover .bm-thumb img{transform:scale(1.045);}
.bm-thumb .bm-fallback{
  position:absolute; inset:0; padding:16px 15px 15px; display:flex; flex-direction:column; justify-content:flex-end;
  background:
    radial-gradient(130% 96% at 92% 104%, var(--bm-c1), transparent 64%),
    linear-gradient(180deg, var(--dsw-alias-bg-layer-2, #26282d), var(--dsw-alias-bg-layer-1, #1e2024));
  box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1, #2f3136);
  overflow:hidden;
}
.bm-thumb .bm-fallback::before{
  content:''; position:absolute; right:-26px; top:-30px; width:120px; height:120px; border-radius:50%;
  background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.16), transparent 68%);
}
.bm-thumb .bm-fallback .quote{
  position:absolute; left:12px; top:0; font-size:54px; line-height:1; opacity:.5;
  font-family:Georgia,'Times New Roman',serif; color:var(--bm-c1);
}
.bm-thumb .bm-fallback .txt{
  position:relative; font-size:16.5px; line-height:1.42; letter-spacing:-.01em;
  color:var(--dsw-alias-label-primary, #f2f4f8); font-weight:650;
  display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden;
}
.bm-thumb .bm-fallback .kind{
  position:relative; font-size:11px; letter-spacing:.08em;
  color:var(--dsw-alias-label-secondary, #9aa0aa); margin-bottom:6px; font-weight:600;
}
.bm-chip{
  position:absolute; left:7px; top:7px; display:inline-flex; align-items:center; gap:5px;
  height:20px; padding:0 7px; border-radius:6px; font-size:10.5px; font-weight:600; letter-spacing:.2px;
  color:#fff; background:rgba(12,14,18,.62); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
  border:1px solid rgba(255,255,255,.14);
}
.bm-chip .dot{width:6px; height:6px; border-radius:50%;}
.bm-dur{
  position:absolute; right:7px; bottom:7px; height:19px; padding:0 5px; border-radius:5px;
  background:rgba(8,10,14,.76); color:#fff; font-size:11px; font-variant-numeric:tabular-nums;
  display:flex; align-items:center; letter-spacing:.2px;
}
.bm-plays{
  position:absolute; left:7px; bottom:7px; height:19px; padding:0 6px 0 5px; border-radius:5px;
  background:rgba(8,10,14,.62); color:#fff; font-size:10.5px; display:flex; align-items:center; gap:4px;
  font-variant-numeric:tabular-nums;
}
.bm-mask{
  position:absolute; inset:0; display:flex; align-items:flex-end; justify-content:flex-end; gap:6px; padding:8px;
  background:linear-gradient(to top, rgba(6,8,12,.62), rgba(6,8,12,0) 55%);
  opacity:0; transition:opacity .2s;
  /* 这一层铺满封面，但不能接点击 —— 否则点图片就被它拦住，只有底下的标题能跳 */
  pointer-events:none;
}
.bm-card:hover .bm-mask{opacity:1;}
.bm-icon-btn{
  width:28px; height:28px; border-radius:8px; border:1px solid rgba(255,255,255,.2);
  background:rgba(14,16,20,.6); backdrop-filter:blur(8px); color:#fff; cursor:pointer;
  display:flex; align-items:center; justify-content:center; padding:0;
  pointer-events:auto;
  transition:background .15s, transform .12s, border-color .15s;
}
.bm-icon-btn:hover{background:rgba(24,26,32,.9); transform:translateY(-1px); border-color:rgba(255,255,255,.34);}
.bm-icon-btn.on{background:var(--dsw-alias-brand-primary, #4d7cff); border-color:transparent;}

/* 宿主有全局 a 重置，但预览环境/其它主题不一定有，自己兜一层，别让标题变蓝。 */
.bm-root a{color:inherit; text-decoration:none;}

.bm-card-title{
  margin-top:9px; font-size:13.5px; line-height:1.46; font-weight:520; letter-spacing:-.1px;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
  cursor:pointer; transition:color .15s;
}
.bm-card:hover .bm-card-title{color:var(--dsw-alias-brand-primary, #4d7cff);}
.bm-card-foot{
  margin-top:6px; display:flex; align-items:center; gap:6px; font-size:11.5px;
  color:var(--dsw-alias-label-secondary, #9aa0aa); min-width:0;
}
.bm-card-foot .who{overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%;}
.bm-card-foot .sep{opacity:.4;}
.bm-card-foot .when{margin-left:auto; flex:none; font-variant-numeric:tabular-nums; opacity:.8;}
.bm-card.done{opacity:.52;}
.bm-card.done .bm-thumb::after{
  content:''; position:absolute; inset:0; background:rgba(6,8,12,.32);
  box-shadow:inset 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-success-primary, #3ecf8e) 60%, transparent);
}

/* 空 / 加载 */
.bm-folders{display:flex; flex-wrap:wrap; gap:6px; margin:-6px 0 16px;}
.bm-folder{
  border:1px solid var(--dsw-alias-border-l1, #2f3136); background:transparent;
  color:var(--dsw-alias-label-secondary, #9aa0aa); border-radius:8px; padding:4px 9px;
  font-size:12px; cursor:pointer; font-family:inherit; transition:all .16s ease;
}
.bm-folder:hover{color:var(--dsw-alias-label-primary, #e9ebef); border-color:var(--dsw-alias-border-l2, #3b3e45);}
.bm-folder.on{background:var(--dsw-alias-bg-layer-2, #26282d); color:var(--dsw-alias-label-primary, #e9ebef); border-color:var(--dsw-alias-border-l2, #3b3e45);}
.bm-folder .num{opacity:.55; margin-left:5px; font-variant-numeric:tabular-nums;}
.bm-exit{
  display:flex; align-items:center; gap:6px; height:30px; padding:0 11px; border-radius:8px;
  border:1px solid var(--dsw-alias-border-l1, #2f3136); background:transparent; cursor:pointer;
  color:var(--dsw-alias-label-secondary, #9aa0aa); font-size:12.5px; font-family:inherit;
  transition:all .16s ease;
}
.bm-exit:hover{color:var(--dsw-alias-label-primary, #e9ebef); background:var(--dsw-alias-bg-layer-2, #26282d);}

.bm-exportbar{
  display:flex; align-items:center; gap:9px; font-size:12px; color:var(--dsw-alias-label-secondary, #9aa0aa);
  border:1px solid var(--dsw-alias-border-l1, #2f3136); border-radius:9px; padding:6px 10px; margin:0 0 12px;
}
.bm-review{display:flex; flex-direction:column; gap:22px;}
.bm-stats{display:flex; gap:12px; flex-wrap:wrap;}
.bm-stat{
  flex:1 1 180px; border:1px solid var(--dsw-alias-border-l1, #2f3136); border-radius:12px;
  padding:13px 16px; background:var(--dsw-alias-bg-layer-1, #1e2024);
}
.bm-stat .n{font-size:24px; font-weight:700; letter-spacing:-.02em;}
.bm-stat .l{font-size:12px; color:var(--dsw-alias-label-secondary, #9aa0aa); margin-top:2px;}
.bm-today{display:grid; grid-template-columns:repeat(auto-fill, minmax(300px,1fr)); gap:12px;}
.bm-today-card{
  border:1px solid var(--dsw-alias-border-l1, #2f3136); border-radius:12px; overflow:hidden;
  background:var(--dsw-alias-bg-layer-1, #1e2024); display:flex; flex-direction:column;
}
.bm-today-card img{width:100%; aspect-ratio:16/9; object-fit:cover; display:block;}
.bm-today-card .body{padding:11px 13px 13px; display:flex; flex-direction:column; gap:8px; flex:1;}
.bm-today-card h4{display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;}
.bm-today-card h4{margin:0; font-size:13.5px; line-height:1.45; font-weight:600;}
.bm-today-card .acts{display:flex; gap:7px; margin-top:2px;}
.bm-sec-h{display:flex; align-items:baseline; gap:10px; margin:0 0 10px;}
.bm-sec-h h3{margin:0; font-size:14px; font-weight:650;}
.bm-sec-h span{font-size:12px; color:var(--dsw-alias-label-secondary, #9aa0aa);}
.bm-stale{display:flex; flex-direction:column; gap:6px;}
.bm-stale-row{
  display:flex; gap:10px; align-items:center; padding:8px 10px; border-radius:9px;
  background:var(--dsw-alias-bg-layer-1, #1e2024); font-size:13px;
}
.bm-stale-row a{color:inherit; text-decoration:none; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.bm-stale-row .age{font-size:11.5px; color:var(--dsw-alias-state-warn-primary, #d9a441); flex:none;}
.bm-roles{display:grid; grid-template-columns:repeat(auto-fill, minmax(360px, 1fr)); gap:14px;}
.bm-role{
  border:1px solid var(--dsw-alias-border-l1, #2f3136); border-radius:12px; padding:14px 16px;
  background:var(--dsw-alias-bg-layer-1, #1e2024); display:flex; flex-direction:column; gap:9px;
}
.bm-role-top{display:flex; align-items:center; gap:8px; font-size:12px; color:var(--dsw-alias-label-secondary, #9aa0aa);}
.bm-role input, .bm-role select{
  width:100%; background:var(--dsw-alias-bg-base, #17181b); color:var(--dsw-alias-label-primary, #e9ebef);
  border:1px solid var(--dsw-alias-border-l1, #2f3136); border-radius:8px; padding:7px 10px;
  font-size:13px; font-family:inherit; outline:none;
}
.bm-role input:focus, .bm-role select:focus{border-color:var(--dsw-alias-brand-primary, #4d7cff);}
.bm-role .nm{font-weight:650; font-size:14.5px;}
.bm-role .row{display:flex; gap:9px; align-items:center;}
.bm-role .row .lbl{font-size:11.5px; color:var(--dsw-alias-label-secondary, #9aa0aa); width:58px; flex:none;}
.bm-role-hint{font-size:12px; color:var(--dsw-alias-label-secondary, #9aa0aa); margin:0 0 16px;}
.bm-menu{
  position:fixed; z-index:70; min-width:196px; padding:5px;
  background:var(--dsw-alias-bg-overlay, #2c2e34); border:1px solid var(--dsw-alias-border-l2, #3b3e45);
  border-radius:10px; box-shadow:0 14px 40px -12px rgba(0,0,0,.65);
  animation:bm-in .12s ease-out;
}
.bm-menu .head{
  padding:6px 9px 8px; font-size:11.5px; color:var(--dsw-alias-label-secondary, #9aa0aa);
  line-height:1.45; max-width:240px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
}
.bm-menu button{
  display:flex; align-items:center; gap:8px; width:100%; text-align:left; border:0; background:transparent;
  color:var(--dsw-alias-label-primary, #e9ebef); font-family:inherit; font-size:12.5px;
  padding:7px 9px; border-radius:7px; cursor:pointer;
}
.bm-menu button:hover{background:var(--dsw-alias-bg-layer-2, #26282d);}
.bm-menu button .hint{margin-left:auto; font-size:11px; opacity:.45;}
/* 菜单头部的链接行：一眼能看出这张图指向哪个视频，点一下即复制 */
.bm-menu .urlline{
  font-size:11px; color:var(--dsw-alias-label-secondary, #9aa0aa); gap:6px;
  padding:5px 9px 7px; letter-spacing:.01em;
}
.bm-menu .urlline span{overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.bm-menu .urlline:hover{color:var(--dsw-alias-label-primary, #e9ebef);}
.bm-menu .sep{height:1px; margin:4px 6px; background:var(--dsw-alias-border-l1, #2f3136);}
.bm-menu-backdrop{position:fixed; inset:0; z-index:65;}
.bm-empty{
  border:1px dashed var(--dsw-alias-border-l2, #3b3e45); border-radius:14px; padding:56px 24px; text-align:center;
  color:var(--dsw-alias-label-secondary, #9aa0aa); font-size:13px; line-height:1.9;
}
.bm-empty b{color:var(--dsw-alias-label-primary, #e9ebef); font-weight:600;}
.bm-sk{border-radius:11px; background:var(--dsw-alias-bg-layer-2, #26282d); position:relative; overflow:hidden;}
.bm-sk::after{
  content:''; position:absolute; inset:0;
  background:linear-gradient(90deg, transparent, color-mix(in srgb, var(--dsw-alias-bg-overlay, #2c2e34) 60%, transparent), transparent);
  animation:bm-sh 1.4s infinite;
}
@keyframes bm-sh{0%{transform:translateX(-100%);}100%{transform:translateX(100%);}}
.bm-sk-line{height:11px; border-radius:5px; margin-top:9px; background:var(--dsw-alias-bg-layer-2, #26282d); position:relative; overflow:hidden;}
.bm-sk-line::after{content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--dsw-alias-bg-overlay, #2c2e34) 60%,transparent),transparent); animation:bm-sh 1.4s infinite;}

/* 同步警告 */
.bm-warn{
  border:1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary, #f5b544) 34%, transparent);
  background:color-mix(in srgb, var(--dsw-alias-state-warn-primary, #f5b544) 8%, transparent);
  border-radius:10px; padding:10px 12px; margin-bottom:14px; font-size:12px;
}
.bm-warn-head{color:var(--dsw-alias-state-warn-primary, #f5b544); font-weight:600; margin-bottom:5px;}
.bm-warn-row{display:flex; flex-wrap:wrap; gap:6px; line-height:1.7;}
.bm-warn-row b{font-weight:600;}
.bm-warn-reason{color:var(--dsw-alias-label-secondary, #9aa0aa);}
.bm-warn-fix{color:var(--dsw-alias-label-secondary, #9aa0aa); opacity:.75;}

/* 详情面板 */
.bm-sheet{
  position:fixed; top:0; right:0; bottom:0; width:392px; z-index:40;
  background:var(--dsw-alias-bg-layer-1, #1e2024); border-left:1px solid var(--dsw-alias-border-l1, #2f3136);
  box-shadow:-18px 0 40px -20px rgba(0,0,0,.5); display:flex; flex-direction:column;
  animation:bm-slide .22s cubic-bezier(.2,.7,.3,1);
}
@keyframes bm-slide{from{transform:translateX(24px); opacity:0;}to{transform:translateX(0); opacity:1;}}
.bm-sheet-head{display:flex; align-items:center; gap:8px; padding:14px 16px 10px;}
.bm-sheet-body{overflow:auto; padding:0 16px 28px;}
.bm-sheet-cover{border-radius:10px; overflow:hidden; aspect-ratio:16/9; background:var(--dsw-alias-bg-layer-2, #26282d); margin-bottom:12px;}
.bm-sheet-cover img{width:100%; height:100%; object-fit:cover; display:block;}
.bm-sheet h3{font-size:14.5px; line-height:1.5; font-weight:600; margin:0 0 8px;}
.bm-sheet .meta{font-size:11.5px; color:var(--dsw-alias-label-secondary, #9aa0aa); line-height:1.8; margin-bottom:14px;}
.bm-sheet label{display:block; font-size:11px; letter-spacing:.4px; text-transform:uppercase; color:var(--dsw-alias-label-secondary, #9aa0aa); margin:14px 0 6px;}
.bm-sheet textarea,.bm-sheet input[type=text]{
  width:100%; box-sizing:border-box; border-radius:8px; border:1px solid var(--dsw-alias-border-l2, #3b3e45);
  background:color-mix(in srgb, var(--dsw-alias-bg-base, #17181b) 60%, transparent); color:inherit;
  font-family:inherit; font-size:12.5px; padding:8px 9px; outline:none; resize:vertical; line-height:1.6;
}
.bm-sheet textarea:focus,.bm-sheet input[type=text]:focus{border-color:var(--dsw-alias-brand-primary, #4d7cff);}
.bm-stause-row{display:flex; gap:6px; flex-wrap:wrap;}
.bm-tag{display:inline-flex; align-items:center; gap:5px; font-size:11px; padding:2px 7px; border-radius:6px; background:var(--dsw-alias-bg-layer-2, #26282d); color:var(--dsw-alias-label-secondary, #9aa0aa);}

/* 归纳 */
.bm-digest{max-width:780px; font-size:13.5px; line-height:1.85; color:var(--dsw-alias-label-primary, #e9ebef);}
.bm-digest h1{font-size:22px; letter-spacing:-.3px; margin:4px 0 18px; font-weight:680;}
.bm-digest h2{font-size:15.5px; margin:30px 0 10px; padding-top:16px; border-top:1px solid var(--dsw-alias-border-l1, #2f3136); font-weight:640;}
.bm-digest h3{font-size:13.5px; margin:18px 0 6px; font-weight:620;}
.bm-digest p{margin:8px 0;}
.bm-digest ul{margin:8px 0; padding-left:18px;}
.bm-digest li{margin:4px 0;}
.bm-digest strong{font-weight:640;}
.bm-digest table{border-collapse:collapse; margin:12px 0; font-size:12.5px;}
.bm-digest th,.bm-digest td{border:1px solid var(--dsw-alias-border-l1, #2f3136); padding:6px 11px; text-align:left;}
.bm-digest th{background:color-mix(in srgb, var(--dsw-alias-bg-layer-1, #1e2024) 70%, transparent); font-weight:600;}
.bm-digest hr{border:0; border-top:1px solid var(--dsw-alias-border-l1, #2f3136); margin:22px 0;}
.bm-digest code{font-size:12px; padding:1px 5px; border-radius:4px; background:var(--dsw-alias-bg-layer-2, #26282d);}

/* 侧栏按钮 */
.bm-side{
  width:100%; display:flex; align-items:center; gap:8px; padding:7px 9px; border-radius:8px;
  border:0; background:transparent; color:var(--dsw-alias-label-secondary, #9aa0aa); cursor:pointer;
  font-family:inherit; font-size:12.5px; transition:background .15s, color .15s;
}
.bm-side:hover{background:color-mix(in srgb, var(--dsw-alias-label-secondary, #9aa0aa) 12%, transparent); color:var(--dsw-alias-label-primary, #e9ebef);}
.bm-side .count{margin-left:auto; font-size:11px; opacity:.6; font-variant-numeric:tabular-nums;}

/* toast */
.bm-toast{
  position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:60;
  background:rgba(18,20,26,.94); color:#fff; font-size:12.5px; padding:8px 14px; border-radius:9px;
  border:1px solid rgba(255,255,255,.14); box-shadow:0 10px 30px -10px rgba(0,0,0,.6);
  animation:bm-in .18s ease-out;
}
@keyframes bm-in{from{opacity:0; transform:translate(-50%,8px);}to{opacity:1; transform:translate(-50%,0);}}
`;

    // ------------------------------------------------------------ 小工具
    // 样式表：文件型客户端插件没有 `styles` 内建符号（那是动态半边才有的闭包参数），
    // require('styles') 也不在静态模块表里。loader 会把工厂执行期插入的 <style>
    // 认领到本插件名下（claimStyles），所以这里直接插 <style> 就是官方做法。
    function safeInsertCss() {
      try {
        const existing = document.querySelector('style[data-dsh-bookmarks]');
        if (existing) existing.remove();
        const el = document.createElement('style');
        el.setAttribute('data-dsh-bookmarks', '1');
        el.setAttribute('data-plugin', '@shawnclink/dsh-bookmarks');
        el.textContent = CSS;
        document.head.appendChild(el);
        return () => { if (el.parentNode) el.parentNode.removeChild(el); };
      } catch (error) {
        console.error('[bookmarks] 样式插入失败', error);
        return () => {};
      }
    }

    // 交互自检：退出这类“点了没反应”的问题，光看代码看不出来，让客户端
    // 把动作结果直接报回宿主，curl /diag 一眼就知道点没点到、值改没改。
    function reportAction(payload) {
      try {
        fetch(`${API}/diag`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...payload, at: new Date().toISOString() }),
        }).catch(() => {});
      } catch (error) {
        console.error('[bookmarks] reportAction 失败', error);
      }
    }

    // 渲染侧自检：把“样式到底生效没有”报回宿主，宿主侧 curl 一眼就能看到，
    // 不用靠人截图猜。
    let diagSent = false;
    function reportDiag(extra) {
      if (diagSent) return;
      diagSent = true;
      const info = { ...extra };
      try {
        info.tag = !!document.querySelector('style[data-dsh-bookmarks]');
        info.styleSheets = document.styleSheets.length;
        const el = document.querySelector('.bm-root');
        if (el) {
          const cs = getComputedStyle(el);
          info.rootPosition = cs.position;
          info.rootBackground = cs.backgroundColor;
          const card = document.querySelector('.bm-card');
          if (card) {
            const cc = getComputedStyle(card);
            info.cardDisplay = cc.display;
            info.cardWidth = Math.round(card.getBoundingClientRect().width);
          }
        }
        info.viewport = `${window.innerWidth}x${window.innerHeight}`;
      } catch (error) {
        info.diagError = String(error && error.message);
      }
      try {
        fetch(`${API}/diag`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(info),
        }).catch(() => {});
      } catch (error) { /* 自检失败不影响页面 */ }
    }

    if (typeof setTimeout === 'function') setTimeout(() => reportDiag({ where: 'boot' }), 1500);

    function icon(name, size) {
      const s = size || 14;
      const common = {
        width: s, height: s, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      };
      const paths = {
        search: [h('circle', { key: 'c', cx: 11, cy: 11, r: 7 }), h('path', { key: 'l', d: 'M20 20l-3.6-3.6' })],
        refresh: [h('path', { key: 'a', d: 'M21 12a9 9 0 1 1-3-6.7' }), h('path', { key: 'b', d: 'M21 3v6h-6' })],
        external: [h('path', { key: 'a', d: 'M14 4h6v6' }), h('path', { key: 'b', d: 'M20 4l-9 9' }), h('path', { key: 'c', d: 'M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5' })],
        check: [h('path', { key: 'a', d: 'M4 12.5l5 5L20 6.5' })],
        pin: [h('path', { key: 'a', d: 'M12 3v9' }), h('path', { key: 'b', d: 'M8.5 7.5L12 3l3.5 4.5' }), h('path', { key: 'c', d: 'M6 21h12' }), h('path', { key: 'd', d: 'M12 12v6' })],
        close: [h('path', { key: 'a', d: 'M6 6l12 12' }), h('path', { key: 'b', d: 'M18 6L6 18' })],
        plus: [h('path', { key: 'a', d: 'M12 5v14' }), h('path', { key: 'b', d: 'M5 12h14' })],
        grid: [h('rect', { key: 'a', x: 3, y: 3, width: 7, height: 7, rx: 1.5 }), h('rect', { key: 'b', x: 14, y: 3, width: 7, height: 7, rx: 1.5 }), h('rect', { key: 'c', x: 3, y: 14, width: 7, height: 7, rx: 1.5 }), h('rect', { key: 'd', x: 14, y: 14, width: 7, height: 7, rx: 1.5 })],
        doc: [h('path', { key: 'a', d: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z' }), h('path', { key: 'b', d: 'M14 3v4h4' }), h('path', { key: 'c', d: 'M9 12h6' }), h('path', { key: 'd', d: 'M9 16h4' })],
        play: [h('path', { key: 'a', d: 'M8 5.5v13l11-6.5z', fill: 'currentColor', stroke: 'none' })],
        link: [h('path', { key: 'a', d: 'M10 13a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1L11 4.9' }), h('path', { key: 'b', d: 'M14 11a5 5 0 0 0-7.1 0l-2.4 2.4a5 5 0 0 0 7.1 7.1L13 19' })],
        bookmark: [h('path', { key: 'a', d: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z' })],
        back: [h('path', { key: 'a', d: 'M15 5l-7 7 7 7' })],
        download: [
          h('path', { key: 'a', d: 'M12 4v10' }),
          h('path', { key: 'b', d: 'M8 10l4 4 4-4' }),
          h('path', { key: 'c', d: 'M5 18h14' }),
        ],
      };
      return h('svg', { ...common, 'aria-hidden': 'true' }, paths[name] || []);
    }

    function relativeTime(iso) {
      if (!iso) return '';
      const then = new Date(iso).getTime();
      if (Number.isNaN(then)) return '';
      const diff = Date.now() - then;
      const minute = 60000, hour = 60 * minute, day = 24 * hour;
      if (diff < minute) return '刚刚';
      if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
      if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
      if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;
      const d = new Date(then);
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    }

    function shortNumber(value) {
      const n = Number(value);
      if (!n || Number.isNaN(n)) return '';
      if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`;
      if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
      return String(Math.round(n));
    }

    function cleanText(text) {
      return String(text || '')
        .replace(/https?:\/\/t\.co\/\S+/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function linkHost(text) {
      const match = String(text || '').match(/https?:\/\/([^\s/]+)/);
      return match ? match[1].replace(/^www\./, '') : '';
    }

    // 右键菜单里显示的那截路径：太长就掐掉，够看出是哪个视频/哪条推文就行。
    function shortPath(url) {
      try {
        const path = new URL(String(url)).pathname.replace(/\/$/, '');
        if (!path || path === '/') return '';
        const parts = path.split('/').filter(Boolean);
        const tail = parts.slice(-2).join('/');
        return '/' + (tail.length > 34 ? tail.slice(0, 33) + '…' : tail);
      } catch {
        return '';
      }
    }

    function textOf(item) {
      return String(item.summary || item.excerpt || item.title || '').replace(/\s+/g, ' ').trim();
    }

    function hexToRgb(hex) {
      const clean = String(hex).replace('#', '');
      const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
      return [parseInt(full.slice(0, 2), 16) || 0, parseInt(full.slice(2, 4), 16) || 0, parseInt(full.slice(4, 6), 16) || 0];
    }

    function fallbackColors(platformId, seed) {
      const base = (BY_ID[platformId] || {}).tint || '#5b6b7c';
      const [r, g, b] = hexToRgb(base);
      const shift = (seed % 24) - 12;
      const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
      return {
        // 文字卡不铺大面积品牌色 —— 一屏十几个红块太吵。用低饱和的染色渐变，
        // 底子还是深色卡片，只留一点平台的味道。
        c1: `rgba(${clamp(r)}, ${clamp(g)}, ${clamp(b)}, ${0.14 + (seed % 7) * 0.008})`,
        c2: `rgba(${clamp(r * 0.45)}, ${clamp(g * 0.45)}, ${clamp(b * 0.55)}, 0.06)`,
      };
    }

    function shortReason(text) {
      const first = String(text || '').split('\n').find((line) => line.trim());
      const line = (first || '').trim();
      return line.length > 64 ? `${line.slice(0, 64)}…` : line;
    }

    // ------------------------------------------------------------ 卡片
    function Thumb(props) {
      const { item } = props;
      const platform = BY_ID[item.platform] || { label: item.platform, tint: '#666' };
      const seed = String(item.id).length + String(item.title || '').length;
      const colors = fallbackColors(item.platform, seed);
      const [broken, setBroken] = React.useState(false);
      const [ready, setReady] = React.useState(false);
      const imgRef = React.useRef(null);
      const fail = () => {
        setBroken(true);
        if (typeof props.onBroken === 'function') props.onBroken();
      };
      const cover = item.cover;
      // 图片可能在我们挂上 onLoad 之前就已经 load 完了（缓存命中时很常见），
      // 那种情况下 load 事件不会再来，得自己查一次 complete。
      React.useEffect(() => {
        const el = imgRef.current;
        if (!el || !cover) return;
        if (el.complete) {
          if (el.naturalWidth > 0) setReady(true);
          else fail();
          return;
        }
        // 懒加载的图还没进视口时不会去请求，所以这里不设超时 —— 真正的失败
        // 会走 onError（小红书的签名链接过期就是 403）。
      }, [cover]);
      const plays = shortNumber(item.meta && (item.meta.plays || item.meta.views));

      let media;
      if (cover && !broken) {
        media = h('img', {
          ref: imgRef,
          src: cover,
          alt: '',
          loading: 'lazy',
          referrerPolicy: 'no-referrer',
          className: ready ? 'ready' : '',
          onLoad: () => setReady(true),
          onError: () => fail(),
        });
      }
      return h(
        'a',
        {
          className: 'bm-thumb',
          href: item.url,
          target: '_blank',
          rel: 'noreferrer',
          title: item.title,
          style: { '--bm-c1': colors.c1, '--bm-c2': colors.c2 },
        },
        media,
        !media || broken
          ? h(
              'div',
              { className: 'bm-fallback' },
              h('div', { className: 'quote' }, '“'),
              h('div', { className: 'kind' }, kindOf(item)),
              h('div', { className: 'txt' }, cleanText(item.title) || cleanText(item.excerpt) || linkHost(item.title) || '（无标题）'),
            )
          : null,
        h(
          'span',
          { className: 'bm-chip' },
          h('span', { className: 'dot', style: { background: platform.tint } }),
          platform.label,
        ),
        item.duration ? h('span', { className: 'bm-dur' }, item.duration) : null,
        plays ? h('span', { className: 'bm-plays' }, icon('play', 10), plays) : null,
        h(
          'div',
          { className: 'bm-mask' },
          h(
            'button',
            {
              className: 'bm-icon-btn',
              title: item.status === 'done' ? '标记为待看' : '标记看完',
              onClick: (event) => {
                event.preventDefault();
                event.stopPropagation();
                props.onToggleDone(item);
              },
            },
            icon('check', 13),
          ),
          h(
            'button',
            {
              className: `bm-icon-btn${item.pinned ? ' on' : ''}`,
              title: item.pinned ? '取消置顶' : '置顶',
              onClick: (event) => {
                event.preventDefault();
                event.stopPropagation();
                props.onPin(item);
              },
            },
            icon('pin', 13),
          ),
          h(
            'button',
            {
              className: 'bm-icon-btn',
              title: '详情',
              onClick: (event) => {
                event.preventDefault();
                event.stopPropagation();
                props.onOpen(item);
              },
            },
            icon('doc', 13),
          ),
        ),
      );
    }

    // 图文帖在封面上要有一句话说明“这是什么”，比只放正文更像信息流。
    function kindOf(item) {
      const url = String(item.url || '');
      if (item.platform === 'zhihu') return url.includes('/question/') ? '知乎问答' : '知乎文章';
      if (item.platform === 'xiaohongshu') return '小红书笔记';
      if (item.platform === 'x') return '推文';
      if (item.platform === 'reddit') return 'Reddit 讨论';
      if (item.platform === 'youtube' || item.platform === 'bilibili') return '视频';
      return '';
    }

    function Card(props) {
      const { item } = props;
      const platform = BY_ID[item.platform] || { label: item.platform };
      const when = relativeTime(item.savedAt || item.firstSeen);
      const folder = item.folder && item.folder !== platform.home ? item.folder : '';
      // 没封面的条目（知乎、Reddit、纯文字推文）不硬凑一张假图：
      // 用平台的色块当底，正文直接排在上面，底下就不再重复标题。
      const [brokenCover, setBrokenCover] = React.useState(false);
      const textOnly = !item.cover || brokenCover;
      return h(
        'article',
        {
          className: `bm-card${textOnly ? ' text-only' : ''}${item.status === 'done' ? ' done' : ''}`,
          onContextMenu: (event) => {
            event.preventDefault();
            event.stopPropagation();
            props.onMenu(item, event.clientX, event.clientY);
          },
          // 单击卡片任意空白处 = 打开原文；带交互的元素（链接、按钮、输入框）自己处理。
          onClick: (event) => {
            const target = event.target;
            if (target && target.closest && target.closest('a,button,input,textarea')) return;
            window.open(item.url, '_blank', 'noreferrer');
          },
          style: { cursor: 'pointer' },
        },
        h(Thumb, {
          item,
          onToggleDone: props.onToggleDone,
          onPin: props.onPin,
          onOpen: props.onOpen,
          onBroken: () => setBrokenCover(true),
        }),
        textOnly
          ? null
          : h(
              'a',
              {
                className: 'bm-card-title',
                href: item.url,
                target: '_blank',
                rel: 'noreferrer',
                title: item.title,
              },
              cleanText(item.title) || linkHost(item.title) || textOf(item) || '（无标题）',
            ),
        h(
          'div',
          { className: 'bm-card-foot' },
          h('span', { className: 'who' }, item.author || platform.label),
          folder ? h('span', { className: 'sep' }, '·') : null,
          folder ? h('span', { className: 'who', style: { maxWidth: '40%' } }, folder) : null,
          h('span', { className: 'when' }, when),
        ),
      );
    }

    // ------------------------------------------------------------ 详情面板
    function Sheet(props) {
      const { item, onClose, onSave } = props;
      const platform = BY_ID[item.platform] || { label: item.platform };
      const [note, setNote] = React.useState(item.note || '');
      const [tags, setTags] = React.useState((item.tags || []).join(', '));
      const [busy, setBusy] = React.useState(false);

      React.useEffect(() => {
        setNote(item.note || '');
        setTags((item.tags || []).join(', '));
      }, [item.id]);

      const post = async (path, target) => {
        {
          try {
            const response = await fetch(`${API}${path}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ ids: [target.id] }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.ok === false) {
              throw new Error((result.errors && result.errors[0]) || result.error || '失败');
            }
            props.toast(path === '/remind' ? '已加进提醒事项' : '已排进明天 20:00 的日历');
          } catch (error) {
            props.toast(`没成功：${error.message}`);
          }
        }
      };

      const status = item.status || 'inbox';
      const save = async (patch) => {
        setBusy(true);
        try {
          await onSave(item, patch);
        } finally {
          setBusy(false);
        }
      };

      return h(
        'aside',
        { className: 'bm-sheet', onKeyDown: (event) => { if (event.key === 'Escape') onClose(); } },
        h(
          'div',
          { className: 'bm-sheet-head' },
          h('span', { className: 'bm-tag' }, platform.label),
          props.role ? h('span', { className: 'bm-tag' }, props.role) : null,
          h('span', { className: 'bm-tag' }, item.folder || platform.home || ''),
          h('div', { style: { flex: 1 } }),
          h('button', { className: 'bm-btn ghost', onClick: onClose, title: '关闭 (Esc)' }, icon('close', 15)),
        ),
        h(
          'div',
          { className: 'bm-sheet-body' },
          item.cover
            ? h('div', { className: 'bm-sheet-cover' }, h('img', { src: item.cover, alt: '', referrerPolicy: 'no-referrer' }))
            : null,
          h('h3', null, item.title || textOf(item) || '（无标题）'),
          h(
            'div',
            { className: 'meta' },
            [item.author, relativeTime(item.savedAt || item.firstSeen), item.duration].filter(Boolean).join(' · '),
            h('br'),
            h(
              'a',
              { href: item.url, target: '_blank', rel: 'noreferrer', style: { color: 'inherit' } },
              String(item.url).replace(/^https?:\/\//, '').slice(0, 64),
            ),
          ),
          h('label', null, '状态'),
          h(
            'div',
            { className: 'bm-stause-row' },
            STATUSES.map((option) =>
              h(
                'button',
                {
                  key: option.id,
                  className: `bm-btn${status === option.id ? ' primary' : ''}`,
                  disabled: busy,
                  onClick: () => save({ status: option.id }),
                },
                option.label,
              ),
            ),
          ),
          h('label', null, '备注'),
          h('textarea', {
            rows: 4,
            value: note,
            placeholder: '为什么存它 / 想拿它做什么',
            onChange: (event) => setNote(event.target.value),
            onBlur: () => {
              if ((item.note || '') !== note) save({ note });
            },
          }),
          h('label', null, '标签'),
          h('input', {
            type: 'text',
            value: tags,
            placeholder: '用逗号分隔',
            onChange: (event) => setTags(event.target.value),
            onBlur: () => {
              const next = tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
              if (next.join(',') !== (item.tags || []).join(',')) save({ tags: next });
            },
          }),
          item.excerpt && item.excerpt !== item.title
            ? h(React.Fragment, null, h('label', null, '原文'), h('div', { style: { fontSize: 12.5, lineHeight: 1.75, color: 'var(--dsw-alias-label-secondary)', maxHeight: 220, overflow: 'auto' } }, item.excerpt))
            : null,
          h('label', null, '操作'),
          h(
            'div',
            { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            h('a', { className: 'bm-btn', href: item.url, target: '_blank', rel: 'noreferrer' }, icon('external', 13), '打开原文'),
            h('button', { className: 'bm-btn', onClick: () => post('/remind', item) }, '加提醒'),
            h('button', { className: 'bm-btn', onClick: () => post('/calendar', item) }, '排进日历'),
            h(
              'button',
              {
                className: 'bm-btn',
                onClick: () => {
                  try {
                    navigator.clipboard.writeText(item.url);
                    props.toast('链接已复制');
                  } catch {
                    props.toast('复制失败，手动选一下');
                  }
                },
              },
              '复制链接',
            ),
            h(
              'button',
              {
                className: 'bm-btn',
                disabled: busy,
                onClick: () => save({ pinned: !item.pinned }),
              },
              item.pinned ? '取消置顶' : '置顶',
            ),
          ),
        ),
      );
    }

    // ------------------------------------------------------------ 归纳页
    function inline(text, keyBase) {
      const parts = [];
      let rest = text;
      let index = 0;
      const pattern = /\*\*(.+?)\*\*|`(.+?)`/;
      while (rest.length) {
        const match = rest.match(pattern);
        if (!match) {
          parts.push(rest);
          break;
        }
        if (match.index > 0) parts.push(rest.slice(0, match.index));
        if (match[1] !== undefined) parts.push(h('strong', { key: `${keyBase}-b${index}` }, match[1]));
        else parts.push(h('code', { key: `${keyBase}-c${index}` }, match[2]));
        rest = rest.slice(match.index + match[0].length);
        index += 1;
      }
      return parts;
    }

    function renderDigest(markdown) {
      const lines = String(markdown || '').split('\n');
      const out = [];
      let list = null;
      let table = null;
      const flushList = () => {
        if (list) {
          out.push(h('ul', { key: `ul${out.length}` }, list));
          list = null;
        }
      };
      const flushTable = () => {
        if (table) {
          const head = table.rows[0] || [];
          const rest = table.rows.slice(1);
          out.push(
            h(
              'table',
              { key: `tb${out.length}` },
              head.length ? h('thead', null, h('tr', null, head.map((cell, i) => h('th', { key: i }, inline(cell, `h${i}`))))) : null,
              h('tbody', null, rest.map((row, r) => h('tr', { key: r }, row.map((cell, c) => h('td', { key: c }, inline(cell, `d${r}${c}`)))))),
            ),
          );
          table = null;
        }
      };
      for (const raw of lines) {
        const line = raw.replace(/\s+$/, '');
        if (/^\s*$/.test(line)) { flushList(); flushTable(); continue; }
        if (/^\s*\|/.test(line)) {
          const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
          if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
          flushList();
          if (!table) table = { rows: [] };
          table.rows.push(cells);
          continue;
        }
        flushTable();
        if (/^#\s/.test(line)) { flushList(); out.push(h('h1', { key: out.length }, inline(line.slice(2), 'h1'))); continue; }
        if (/^##\s/.test(line)) { flushList(); out.push(h('h2', { key: out.length }, inline(line.slice(3), 'h2'))); continue; }
        if (/^###\s/.test(line)) { flushList(); out.push(h('h3', { key: out.length }, inline(line.slice(4), 'h3'))); continue; }
        if (/^---+\s*$/.test(line)) { flushList(); out.push(h('hr', { key: out.length })); continue; }
        if (/^\s*[-*]\s/.test(line)) {
          if (!list) list = [];
          list.push(h('li', { key: `li${out.length}-${list.length}` }, inline(line.replace(/^\s*[-*]\s/, ''), `l${list.length}`)));
          continue;
        }
        flushList();
        out.push(h('p', { key: out.length }, inline(line, `p${out.length}`)));
      }
      flushList();
      flushTable();
      return out;
    }

    function DigestPage(props) {
      const [markdown, setMarkdown] = React.useState('');
      const [updatedAt, setUpdatedAt] = React.useState(null);
      const [loading, setLoading] = React.useState(true);

      const load = React.useCallback(async () => {
        try {
          const response = await fetch(`${API}/digest`, { headers: { accept: 'application/json' }, cache: 'no-store' });
          const payload = await response.json();
          setMarkdown(payload.markdown || '');
          setUpdatedAt(payload.updatedAt || null);
        } catch {
          setMarkdown('');
        } finally {
          setLoading(false);
        }
      }, []);

      React.useEffect(() => { load(); }, [load, props.revision]);

      if (loading) {
        return h('div', { className: 'bm-digest' },
          h('div', { className: 'bm-sk-line', style: { width: '40%', height: 20 } }),
          h('div', { className: 'bm-sk-line', style: { width: '90%' } }),
          h('div', { className: 'bm-sk-line', style: { width: '80%' } }),
          h('div', { className: 'bm-sk-line', style: { width: '85%' } }));
      }
      if (!markdown) {
        return h('div', { className: 'bm-empty' },
          h('div', null, h('b', null, '还没有归纳稿')),
          h('div', null, '在对话里说「把这批收藏归纳一下」，我写好后会落在 ~/.dsh-bookmarks/digest.md，这里直接显示。'));
      }
      return h(
        'div',
        null,
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 } },
          h('span', { style: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' } },
            updatedAt ? `更新于 ${relativeTime(new Date(updatedAt).toISOString())}` : ''),
          h('div', { style: { flex: 1 } }),
          h('button', { className: 'bm-btn', onClick: load }, icon('refresh', 13), '重读')),
        h('div', { className: 'bm-digest' }, renderDigest(markdown)),
      );
    }

    // ------------------------------------------------------------ 主页面


    // 右键菜单：单击卡片 = 打开原文，右键才出这套动作。
    function ContextMenu(props) {
      const { menu, onClose, onAction } = props;
      const item = menu.item;
      const width = 208;
      const left = Math.min(menu.x, (window.innerWidth || 1200) - width - 8);
      const top = Math.min(menu.y, (window.innerHeight || 800) - 268);
      const action = (name, patch) => () => {
        onAction(name, item, patch);
        onClose();
      };
      const done = item.status === 'done';
      return h(React.Fragment, null,
        h('div', { className: 'bm-menu-backdrop', onClick: onClose, onContextMenu: (e) => { e.preventDefault(); onClose(); } }),
        h('div', { className: 'bm-menu', style: { left: Math.max(8, left), top: Math.max(8, top) }, onContextMenu: (e) => e.preventDefault() },
          h('div', { className: 'head' }, cleanText(item.title) || linkHost(item.title) || '（无标题）'),
          h('button', { className: 'urlline', title: '点一下复制链接', onClick: action('copy') },
            icon('link', 11), h('span', null, linkHost(item.url) + shortPath(item.url))),
          h('button', { onClick: action('open') }, icon('external', 13), '打开原文', h('span', { className: 'hint' }, '单击卡片同效')),
          h('button', { onClick: action('detail') }, icon('doc', 13), '详情 / 备注 / 标签'),
          h('div', { className: 'sep' }),
          h('button', { onClick: action('toggleDone') }, icon('check', 13), done ? '标记为待看' : '标记看完'),
          h('button', { onClick: action('archive') }, icon('bookmark', 13), item.status === 'archived' ? '移出归档' : '归档'),
          h('button', { onClick: action('pin') }, icon('pin', 13), item.pinned ? '取消置顶' : '置顶'),
          h('div', { className: 'sep' }),
          h('button', { onClick: action('copy') }, icon('link', 13), '复制链接')));
    }

    // 平台角色：每个平台在这个人这里是什么用途。这层不是标签，后面
    // 提炼模板、输出位置、评分权重都挂在它上面。
    const INTENSITY = [
      { id: 'light', label: '轻量' },
      { id: 'standard', label: '标准' },
      { id: 'deep', label: '深度' },
    ];


    // 复利页：不看你“存了什么”，只看你“还没动什么”。收藏的价值在回流，
    // 不在数量。
    function ReviewPage(props) {
      const { items, roles, onOpen, onPatch, onRemind, onExport } = props;
      const now = Date.now();
      const roleOf = (platformId) => (roles[platformId] && roles[platformId].name) || (BY_ID[platformId] ? BY_ID[platformId].label : platformId);
      const ageOf = (item) => now - new Date(item.savedAt || item.firstSeen || 0).getTime();
      const inbox = items.filter((item) => (item.status || 'inbox') === 'inbox');
      const stale = inbox.filter((item) => ageOf(item) > 30 * 864e5).sort((a, b) => ageOf(b) - ageOf(a));
      const empty = inbox.filter((item) => !cleanText(item.title).trim() && !cleanText(item.excerpt).trim());

      // 每天固定三条：同一天刷新也是同一批，不让人反复挑。
      const today = React.useMemo(() => {
        const seed = new Date().toISOString().slice(0, 10);
        let hash = 7;
        for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 99991;
        // 今天这三条要“能读”：没标题又没摘要的纯链接先排除，它们归 5 秒法则那栏。
        const readable = inbox.filter((item) => (cleanText(item.title) || cleanText(item.excerpt) || '').trim().length > 8);
        const pool = readable.sort((a, b) => (b.cover ? 1 : 0) - (a.cover ? 1 : 0) || ageOf(b) - ageOf(a));
        const picked = [];
        const used = new Set();
        for (let step = 0; step < pool.length && picked.length < 3; step += 1) {
          const index = (hash + step * 37) % pool.length;
          const item = pool[index];
          if (used.has(item.id)) continue;
          used.add(item.id);
          picked.push(item);
        }
        return picked;
      }, [items]);

      const backlog = React.useMemo(() => {
        const map = new Map();
        for (const item of inbox) {
          const role = roleOf(item.platform);
          const entry = map.get(role) || { role, count: 0, oldest: null };
          entry.count += 1;
          const time = new Date(item.savedAt || item.firstSeen || 0).getTime();
          if (!entry.oldest || time < entry.oldest) entry.oldest = time;
          map.set(role, entry);
        }
        return [...map.values()].sort((a, b) => b.count - a.count);
      }, [items, roles]);

      return h('div', { className: 'bm-review' },
        h('div', { className: 'bm-stats' },
          h('div', { className: 'bm-stat' }, h('div', { className: 'n' }, inbox.length), h('div', { className: 'l' }, '还没动过的')),
          h('div', { className: 'bm-stat' }, h('div', { className: 'n' }, stale.length), h('div', { className: 'l' }, '躺了 30 天以上')),
          h('div', { className: 'bm-stat' }, h('div', { className: 'n' }, empty.length), h('div', { className: 'l' }, '连标题都没有（5 秒法则没执行）'))),

        h('div', null,
          h('div', { className: 'bm-sec-h' }, h('h3', null, '今天这三条'), h('span', null, '点开就算消化，别存着')),
          h('div', { className: 'bm-today' },
            today.map((item) => {
              const platform = BY_ID[item.platform] || {};
              return h('div', { key: item.id, className: 'bm-today-card' },
                item.cover ? h('img', { src: item.cover, alt: '', referrerPolicy: 'no-referrer', loading: 'lazy' }) : null,
                h('div', { className: 'body' },
                  h('h4', null, cleanText(item.title) || linkHost(item.url) || '（无标题）'),
                  h('div', { style: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary, #9aa0aa)' } },
                    `${platform.label || item.platform} · ${roleOf(item.platform)} · ${relativeTime(item.savedAt || item.firstSeen)}`),
                  h('div', { className: 'acts' },
                    h('button', { className: 'bm-btn primary', onClick: () => { onPatch(item, { status: 'doing' }); onOpen(item); } }, '打开，两分钟'),
                    h('button', { className: 'bm-btn', onClick: () => onPatch(item, { status: 'archived' }) }, '丢掉'))));
            }))),

        empty.length
          ? h('div', null,
              h('div', { className: 'bm-sec-h' }, h('h3', null, '5 秒法则没执行的那些'), h('span', null, '标题都没有，说明当时根本没决定')),
              h('div', { style: { marginBottom: 10 } },
                h('button', {
                  className: 'bm-btn',
                  onClick: () => empty.forEach((item) => onPatch(item, { status: 'archived' })),
                }, `把 ${empty.length} 条一起归档`)),
              h('div', { className: 'bm-stale' },
                empty.slice(0, 8).map((item) => h('div', { key: item.id, className: 'bm-stale-row' },
                  h('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' } }, (BY_ID[item.platform] || {}).label || item.platform),
                  h('a', { href: item.url, target: '_blank', rel: 'noreferrer' }, item.url),
                  h('span', { className: 'age' }, relativeTime(item.savedAt || item.firstSeen))))))
          : null,

        stale.length
          ? h('div', null,
              h('div', { className: 'bm-sec-h' }, h('h3', null, '躺太久了'), h('span', null, '超过 30 天没碰，只有三种结局：读、转成任务、删')),
              h('div', { className: 'bm-stale' },
                stale.slice(0, 10).map((item) => h('div', { key: item.id, className: 'bm-stale-row' },
                  h('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' } }, (BY_ID[item.platform] || {}).label || item.platform),
                  h('a', { href: item.url, target: '_blank', rel: 'noreferrer' }, cleanText(item.title) || item.url),
                  h('span', { className: 'age' }, `${Math.round(ageOf(item) / 864e5)} 天`),
                  h('button', { className: 'bm-btn', onClick: () => onRemind([item]) }, '加提醒'),
                  h('button', { className: 'bm-btn', onClick: () => onPatch(item, { status: 'archived' }) }, '归档')))))
          : null,

        h('div', null,
          h('div', { className: 'bm-sec-h' }, h('h3', null, '按角色的积压'), h('span', null, '哪个角色在堆灰')),
          h('div', { className: 'bm-stale' },
            backlog.map((entry) => h('div', { key: entry.role, className: 'bm-stale-row' },
              h('a', { href: '#', onClick: (event) => { event.preventDefault(); props.onFilterRole(entry.role); } }, entry.role),
              h('span', { style: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' } }, `${entry.count} 条没动`),
              h('span', { className: 'age' }, entry.oldest ? `最老的 ${Math.round((now - entry.oldest) / 864e5)} 天` : ''))))),

        h('div', { style: { display: 'flex', gap: 8 } },
          h('button', { className: 'bm-btn', onClick: () => onExport({ ids: today.map((item) => item.id), title: '今天这三条' }) }, '把今天三条导出成 Markdown'),
          h('button', { className: 'bm-btn', onClick: () => onRemind(today) }, '三条都加进提醒')));
    }

    function RoleSettings(props) {
      const [draft, setDraft] = React.useState(null);
      const roles = props.roles || {};
      const value = draft || roles;

      const save = (platformId, patch) => {
        const next = { ...value, [platformId]: { ...value[platformId], ...patch } };
        setDraft(next);
        props.onSave({ [platformId]: next[platformId] });
      };

      return h('div', { className: 'bm-inner' },
        h('div', { className: 'bm-role-hint' }, '给每个平台定一个角色。采集之后的所有提炼、评分、输出都按它来走。'),
        h('div', { className: 'bm-roles' },
          PLATFORMS.map((platform) => {
            const role = value[platform.id] || { name: '', desc: '', intensity: 'standard' };
            return h('div', { key: platform.id, className: 'bm-role' },
              h('div', { className: 'bm-role-top' },
                h('span', { className: 'dot', style: { background: platform.tint, width: 7, height: 7, borderRadius: 4, display: 'inline-block' } }),
                platform.label),
              h('input', {
                className: 'nm',
                defaultValue: role.name,
                placeholder: '角色名，例如：AI 情报站',
                onBlur: (event) => save(platform.id, { name: event.target.value.trim() }),
              }),
              h('input', {
                defaultValue: role.desc,
                placeholder: '一句话说明：这个平台的收藏拿来干什么',
                onBlur: (event) => save(platform.id, { desc: event.target.value.trim() }),
              }),
              h('div', { className: 'row' },
                h('span', { className: 'lbl' }, '消化强度'),
                h('select', {
                  defaultValue: role.intensity,
                  onChange: (event) => save(platform.id, { intensity: event.target.value }),
                }, INTENSITY.map((level) => h('option', { key: level.id, value: level.id }, level.label)))));
          })));
    }

    function BookmarksPage() {
      const [state, setState] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [platform, setPlatform] = React.useState('all');
      const [folder, setFolder] = React.useState('all');
      const [role, setRole] = React.useState('all');
      const [exportInfo, setExportInfo] = React.useState(null);
      const [status, setStatus] = React.useState('all');
      const [sort, setSort] = React.useState('saved');
      const [query, setQuery] = React.useState('');
      const [view, setView] = React.useState('review');
      const [picked, setPicked] = React.useState(null);
      const [menu, setMenu] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [hostDown, setHostDown] = React.useState(false);
      const [toastText, setToastText] = React.useState('');
      const searchRef = React.useRef(null);

      const toast = React.useCallback((text) => {
        setToastText(text);
        window.setTimeout(() => setToastText((current) => (current === text ? '' : current)), 2200);
      }, []);

      const load = React.useCallback(async () => {
        try {
          const response = await fetch(`${API}/state`, { headers: { accept: 'application/json' }, cache: 'no-store' });
          const payload = await response.json();
          if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`);
          setState(payload);
          setHostDown(false);
          setPicked((current) => (current ? payload.items.find((i) => i.id === current.id) || current : current));
        } catch {
          setHostDown(true);
        } finally {
          setLoading(false);
        }
      }, []);

      React.useEffect(() => { load(); }, [load]);

      React.useEffect(() => {
        const timer = setInterval(() => {
          if (document.visibilityState !== 'visible') return;
          if (state && !state.syncing && !hostDown) return;
          load();
        }, 1600);
        return () => clearInterval(timer);
      }, [load, state && state.syncing, hostDown]);

      React.useEffect(() => {
        const timer = setInterval(() => {
          if (document.visibilityState !== 'visible') return;
          if (state && state.syncing) return;
          load();
        }, 8000);
        return () => clearInterval(timer);
      }, [load, state && state.syncing]);

      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key === '/' && document.activeElement !== searchRef.current) {
            event.preventDefault();
            if (searchRef.current) searchRef.current.focus();
          }
          if (event.key === 'Escape') {
            if (menu) {
              setMenu(null);
              return;
            }
            if (picked) {
              setPicked(null);
              return;
            }
            if (searchRef.current && document.activeElement === searchRef.current) {
              searchRef.current.blur();
              return;
            }
            // 没有抽屉、也没在搜索框里，Esc 就当“退出这个面板”。
            exitToConversation();
          }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [picked, menu]);

      const patch = React.useCallback(async (item, body) => {
        setState((current) => {
          if (!current) return current;
          return {
            ...current,
            items: current.items.map((entry) => (entry.id === item.id ? { ...entry, ...body } : entry)),
          };
        });
        try {
          const response = await fetch(`${API}/item`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: item.id, patch: body }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || payload.ok === false) throw new Error(payload.error || '保存失败');
        } catch (error) {
          toast(`没存上：${error.message}`);
          load();
        }
      }, [load, toast]);

      const runExport = React.useCallback(async (options) => {
        const payload = options && options.ids
          ? { ids: options.ids, title: options.title }
          : { filter: { platform, folder, role, status, query }, title: `收藏复利 · ${new Date().toLocaleDateString('zh-CN')}` };
        try {
          toast('正在写 Markdown…');
          const response = await fetch(`${API}/export`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || result.ok === false) throw new Error(result.error || '导出失败');
          setExportInfo(result);
          toast(`导出 ${result.count} 条 → ${result.obsidianPath ? 'Obsidian + 本地' : '本地'}`);
        } catch (error) {
          toast(`没导出去：${error.message}`);
        }
      }, [platform, folder, role, status, query]);

      const reveal = React.useCallback(async (target) => {
        try {
          await fetch(`${API}/reveal`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ path: target }),
          });
        } catch (error) {
          toast(`打不开：${error.message}`);
        }
      }, [toast]);

      const addReminders = React.useCallback(async (list) => {
        const ids = (list || []).map((item) => item.id);
        if (!ids.length) return;
        try {
          toast('在写提醒事项…');
          const response = await fetch(`${API}/remind`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ids }),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || result.ok === false) throw new Error((result.errors && result.errors[0]) || result.error || '失败');
          toast(`已加 ${result.added} 条到提醒「${result.list}」`);
        } catch (error) {
          toast(`提醒没写进去：${error.message}`);
        }
      }, []);

      const saveRoles = React.useCallback(async (partial) => {
        try {
          const response = await fetch(`${API}/settings`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ settings: { roles: partial } }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || payload.ok === false) throw new Error(payload.error || '保存失败');
          setState((current) => current
            ? { ...current, settings: { ...current.settings, roles: { ...current.settings.roles, ...partial } } }
            : current);
          toast('角色已保存');
        } catch (error) {
          toast(`没存上：${error.message}`);
        }
      }, [toast]);

      // 右键菜单的动作：单击卡片永远是打开原文，改造性操作全放这儿。
      const onMenuAction = React.useCallback((name, item) => {
        if (name === 'open') window.open(item.url, '_blank', 'noreferrer');
        else if (name === 'detail') setPicked(item);
        else if (name === 'toggleDone') patch(item, { status: item.status === 'done' ? 'inbox' : 'done' });
        else if (name === 'archive') patch(item, { status: item.status === 'archived' ? 'inbox' : 'archived' });
        else if (name === 'pin') patch(item, { pinned: !item.pinned });
        else if (name === 'copy') {
          try {
            navigator.clipboard.writeText(item.url);
            toast('链接已复制');
          } catch {
            toast('复制失败，手动选一下');
          }
        }
      }, [patch, toast]);

      const sync = React.useCallback(async (targets) => {
        setBusy(true);
        try {
          await fetch(`${API}/sync`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(targets ? { platforms: targets } : {}),
          });
          toast('开始同步，拉取期间数据会陆续出现');
          window.setTimeout(load, 900);
        } catch (error) {
          toast(`同步没启动：${error.message}`);
        } finally {
          setBusy(false);
        }
      }, [load, toast]);

      const roles = (state && state.settings && state.settings.roles) || {};
      const roleOf = (platformId) => (roles[platformId] && roles[platformId].name) || (BY_ID[platformId] ? BY_ID[platformId].label : '');
      const items = (state && state.items) || [];
      const counts = (state && state.counts) || { total: 0, byPlatform: {} };
      const sources = (state && state.sources) || {};

      const visible = React.useMemo(() => {
        const needle = query.trim().toLowerCase();
        let list = items.slice();
        if (platform !== 'all') list = list.filter((item) => item.platform === platform);
        if (folder !== 'all') list = list.filter((item) => (item.folder || '') === folder);
        if (role !== 'all') list = list.filter((item) => roleOf(item.platform) === role);
        if (status === 'done') list = list.filter((item) => item.status === 'done' || item.status === 'archived');
        if (status === 'open') list = list.filter((item) => item.status !== 'done' && item.status !== 'archived');
        if (needle) {
          list = list.filter((item) =>
            [item.title, item.author, item.folder, item.note, item.summary, (item.tags || []).join(' ')]
              .join(' ')
              .toLowerCase()
              .includes(needle),
          );
        }
        list.sort((a, b) => {
          if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
          const ta = new Date(a.savedAt || a.firstSeen || 0).getTime();
          const tb = new Date(b.savedAt || b.firstSeen || 0).getTime();
          return sort === 'old' ? ta - tb : tb - ta;
        });
        return list;
      }, [items, platform, folder, role, roles, status, sort, query]);

      const failed = PLATFORMS.filter((p) => {
        const source = sources[p.id];
        return source && source.status === 'error';
      });

      const header = h(
        'div',
        { className: 'bm-head' },
        h('div', { className: 'bm-title' },
          '收藏夹',
          h('small', null, `${counts.total} 条 · ${PLATFORMS.length} 个平台`)),
        h('div', { className: 'bm-head-spacer' }),
        h('div', { className: 'bm-search' },
          h('span', { className: 'bm-search-ico' }, icon('search', 13)),
          h('input', {
            ref: searchRef,
            value: query,
            placeholder: '搜标题、作者、收藏夹',
            onChange: (event) => setQuery(event.target.value),
          }),
          h('span', { className: 'bm-search-key' }, '/')),
        h('div', { className: 'bm-seg' },
          h('button', { className: view === 'review' ? 'on' : '', onClick: () => setView('review'), title: '复利' }, '复利'),
          h('button', { className: view === 'grid' ? 'on' : '', onClick: () => setView('grid'), title: '网格' }, '网格'),
          h('button', { className: view === 'digest' ? 'on' : '', onClick: () => setView('digest'), title: '归纳' }, '归纳'),
          h('button', { className: view === 'roles' ? 'on' : '', onClick: () => setView('roles'), title: '平台角色' }, '角色')),
        h('button', {
          className: `bm-btn primary${busy || (state && state.syncing) ? ' spin' : ''}`,
          onClick: () => sync(),
          disabled: busy || (state && state.syncing),
        },
          icon('refresh', 13),
          state && state.syncing ? '同步中' : '同步'),
        h('button', {
          className: 'bm-btn',
          onClick: () => runExport(),
          title: '把当前筛选导出成 Markdown（同时写一份到 Obsidian）',
        }, icon('download', 13), '导出'),
        h('button', {
          className: 'bm-exit',
          onClick: exitToConversation,
          title: '回到对话（Esc 也可以）',
        },
          icon('back', 13),
          '退出'),
      );

      const bar = h(
        'div',
        { className: 'bm-bar' },
        h('button', { className: `bm-pill${platform === 'all' ? ' on' : ''}`, onClick: () => { setPlatform('all'); setFolder('all'); } },
          '全部', h('span', { className: 'num' }, counts.total)),
        PLATFORMS.map((p) =>
          h('button',
            {
              key: p.id,
              className: `bm-pill${platform === p.id ? ' on' : ''}`,
              onClick: () => { setPlatform(platform === p.id ? 'all' : p.id); setFolder('all'); },
              title: `${p.label} · ${p.home}`,
            },
            h('span', { className: 'dot', style: { background: p.tint } }),
            p.label,
            h('span', { className: 'num' }, counts.byPlatform[p.id] || 0),
            sources[p.id] && sources[p.id].status === 'error'
              ? h('span', { style: { color: 'var(--dsw-alias-state-error-primary)', marginLeft: 2 } }, '!')
              : null)),
        h('div', { className: 'bm-bar-spacer' }),
        h('div', { className: 'bm-seg' },
          h('button', { className: status === 'all' ? 'on' : '', onClick: () => setStatus('all') }, '全部'),
          h('button', { className: status === 'open' ? 'on' : '', onClick: () => setStatus('open') }, '没看完'),
          h('button', { className: status === 'done' ? 'on' : '', onClick: () => setStatus('done') }, '看完')),
        h('select', {
          className: 'bm-sort',
          value: sort,
          onChange: (event) => setSort(event.target.value),
        },
          h('option', { value: 'saved' }, '最近收藏'),
          h('option', { value: 'old' }, '最早收藏')),
      );

      const roleOptions = React.useMemo(() => {
        const seen = new Map();
        for (const platform of PLATFORMS) {
          const name = (roles[platform.id] && roles[platform.id].name) || '';
          if (!name || seen.has(name)) continue;
          seen.set(name, (seen.get(name) || 0));
        }
        return [...seen.keys()];
      }, [roles]);

      const folderCounts = React.useMemo(() => {
        const map = new Map();
        for (const item of items) {
          if (platform !== 'all' && item.platform !== platform) continue;
          const name = item.folder || '';
          if (!name) continue;
          map.set(name, (map.get(name) || 0) + 1);
        }
        return [...map.entries()].sort((a, b) => b[1] - a[1]);
      }, [items, platform]);

      const roleBar = roleOptions.length > 1
        ? h('div', { className: 'bm-folders' },
            h('button', {
              className: `bm-folder${role === 'all' ? ' on' : ''}`,
              onClick: () => setRole('all'),
            }, '按角色'),
            roleOptions.map((name) =>
              h('button', {
                key: name,
                className: `bm-folder${role === name ? ' on' : ''}`,
                onClick: () => setRole(role === name ? 'all' : name),
              }, name)))
        : null;

      const showFolders = platform !== 'all' && folderCounts.length > 1;
      const folders = showFolders
        ? h('div', { className: 'bm-folders' },
            h('button', {
              className: `bm-folder${folder === 'all' ? ' on' : ''}`,
              onClick: () => setFolder('all'),
            }, '全部收藏夹', h('span', { className: 'num' }, folderCounts.reduce((sum, entry) => sum + entry[1], 0))),
            folderCounts.map(([name, count]) =>
              h('button', {
                key: name,
                className: `bm-folder${folder === name ? ' on' : ''}`,
                onClick: () => setFolder(folder === name ? 'all' : name),
                title: name,
              }, name, h('span', { className: 'num' }, count))))
        : null;

      const warn = failed.length
        ? h('div', { className: 'bm-warn' },
            h('div', { className: 'bm-warn-head' }, '这些平台还没接上：'),
            failed.map((p) =>
              h('div', { className: 'bm-warn-row', key: p.id },
                h('b', null, p.label),
                h('span', { className: 'bm-warn-reason' }, shortReason(sources[p.id].lastError)),
                h('span', { className: 'bm-warn-fix' }, `→ ${FIX[sources[p.id].errorCode] || FIX.unknown}`))))
        : hostDown
          ? h('div', { className: 'bm-warn' },
              h('div', { className: 'bm-warn-head' }, '连不上插件后端'),
              h('div', { className: 'bm-warn-row' }, 'Host 那一半没跑起来，在插件管理里禁用再启用一次。'))
          : null;

      // 注意：这个早退必须放在所有 hook 之后，否则加载完成那一刻
      // hook 数量变了，React 会直接抛 #310（Rendered fewer hooks than expected）。
      if (loading) {
        return h('div', { className: 'bm-root' },
          h('div', { className: 'bm-inner' },
            h('div', { className: 'bm-grid' },
              Array.from({ length: 12 }, (_, i) =>
                h('div', { key: i },
                  h('div', { className: 'bm-sk', style: { aspectRatio: '16/9' } }),
                  h('div', { className: 'bm-sk-line', style: { width: '88%' } }),
                  h('div', { className: 'bm-sk-line', style: { width: '46%' } }))))));
      }

      let body;
      if (!visible.length) {
        body = h('div', { className: 'bm-empty' },
          h('div', null, h('b', null, query ? `没搜到「${query}」` : platform === 'all' ? '这里还是空的' : `${BY_ID[platform].label} 还没有条目`)),
          h('div', null, query ? '换个词试试，或者把平台切到「全部」。' : '点右上角「同步」从六个平台拉一次。'));
      } else {
        body = h('div', { className: 'bm-grid' },
          visible.map((item) =>
            h(Card, {
              key: item.id,
              item,
              onToggleDone: (entry) => patch(entry, { status: entry.status === 'done' ? 'inbox' : 'done' }),
              onPin: (entry) => patch(entry, { pinned: !entry.pinned }),
              onOpen: (entry) => setPicked(entry),
              onMenu: (entry, x, y) => setMenu({ item: entry, x, y }),
            })));
      }

      return h('div', { className: 'bm-root' },
        h('div', { className: 'bm-inner' },
          header,
          warn,
          exportInfo
            ? h('div', { className: 'bm-exportbar' },
                icon('download', 13),
                h('span', null, `已导出 ${exportInfo.count} 条`),
                exportInfo.obsidianPath
                  ? h('button', { className: 'bm-btn', onClick: () => reveal(exportInfo.obsidianPath) }, 'Obsidian 里看')
                  : null,
                h('button', { className: 'bm-btn', onClick: () => reveal(exportInfo.path) }, '打开导出目录'))
            : null,

          view === 'digest'
            ? h(DigestPage, { revision: state && state.updatedAt })
            : view === 'review'
              ? h(ReviewPage, {
                  items,
                  roles,
                  onOpen: (item) => window.open(item.url, '_blank', 'noreferrer'),
                  onPatch: patch,
                  onRemind: addReminders,
                  onExport: runExport,
                  onFilterRole: (name) => { setRole(name); setView('list'); },
                })
              : view === 'roles'
              ? h(RoleSettings, { roles, onSave: saveRoles })
              : h(React.Fragment, null, bar, roleBar, folders, body)),
        menu
          ? h(ContextMenu, { menu, onClose: () => setMenu(null), onAction: onMenuAction })
          : null,
        picked
          ? h(Sheet, {
              item: picked,
              role: roleOf(picked.platform),
              onClose: () => setPicked(null),
              onSave: patch,
              toast,
            })
          : null,
        toastText ? h('div', { className: 'bm-toast' }, toastText) : null);
    }

    // ------------------------------------------------------------ 侧栏按钮
    // 侧栏把这里的组件包在自己的 <button> 里（点它就会切到同 id 的主区），
    // 所以这里只画图标，不要再套按钮、也不要自己绑点击。
    function SidebarGlyph(props) {
      const size = (props && props.size) || 16;
      return h('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center' } }, icon('bookmark', size));
    }

    // 退出这个面板：主区是 keyed slot，切回 conversation 就等于“退出收藏夹”。
    // layout 服务在 apply 时不一定就绪，所以点击那一刻再去取。
    let clientCtx = null;
    function exitToConversation() {
      let layout = null;
      try {
        if (clientCtx && clientCtx.layout) layout = clientCtx.layout;
        else if (clientCtx && typeof clientCtx.get === 'function') layout = clientCtx.get('layout');
      } catch (error) {
        console.error('[bookmarks] 取 layout 失败', error);
      }
      if (!layout) {
        console.error('[bookmarks] 拿不到 layout 服务');
        reportAction({ where: 'exit', ok: false, reason: 'no-layout-service', ctxKeys: clientCtx ? Object.keys(clientCtx).slice(0, 24) : null });
        return;
      }
      // 关键：真正的“回到对话”是把 activePanelId 置空（layout 里主面板
      // 的 id 兜底值就是 "conversation"，写 'conversation' 反而让面板
      // 一直算“激活”，对话区被挡住 —— 这就是之前点退出没反应的原因。
      let before = null;
      try {
        if (layout.panelInfo && typeof layout.panelInfo.getSnapshot === 'function') {
          before = layout.panelInfo.getSnapshot().activePanelId;
        }
      } catch (error) {
        console.error('[bookmarks] 读 panelInfo 失败', error);
      }
      try {
        layout.selectPanel(null);
      } catch (error) {
        console.error('[bookmarks] 退出失败', error);
        try { layout.selectPanel('conversation'); } catch (nested) { console.error('[bookmarks] 退出失败2', nested); }
      }
      reportAction({ where: 'exit', ok: true, hasSelectPanel: typeof layout.selectPanel === 'function', before, after: (() => {
        try { return layout.panelInfo.getSnapshot().activePanelId; } catch { return 'unknown'; }
      })() });
    }

    // ------------------------------------------------------------ 挂载
    return {
      // 只声明 slots：这是唯一硬依赖。layout 在点击那一刻用 ctx.get 现取，
      // 免得为了一个按钮改动 inject 形态、把整个 UI 的激活条件绑死。
      // 只能是字符串数组：loader 的 optionalStringArray 校验会在对象形式上直接判失败，
      // 整条 entry 不激活，侧栏图标就没了。layout 由 dsh-client-ui-layout 在根上 provide，
      // 同层的 sidebar/workspace 也是这么 inject 的。
      inject: ['slots', 'layout'],
      apply(ctx) {
        clientCtx = ctx;
        let slots = ctx && ctx.slots;
        if (!slots && ctx && typeof ctx.get === 'function') {
          try { slots = ctx.get('slots'); } catch (error) { console.error('[bookmarks] 取 slots 失败', error); }
        }
        if (!slots) {
          console.error('[bookmarks] 没有 slots 服务，UI 不挂载');
          return;
        }

        try {
          const dispose = safeInsertCss();
          if (typeof ctx.effect === 'function') {
            ctx.effect(() => dispose);
          } else {
            ctx.on('dispose', dispose);
          }
        } catch (error) {
          console.error('[bookmarks] 样式挂载失败', error);
        }

        try {
          slots.inject('main', () =>
            slots.register({ name: 'main', key: 'bookmarks' }, BookmarksPage));
        } catch (error) {
          console.error('[bookmarks] 主区注册失败', error);
        }

        try {
          slots.inject('sidebar.panellist', () =>
            slots.register({ name: 'sidebar.panellist', id: 'bookmarks', order: 20, label: '收藏夹' }, SidebarGlyph));
        } catch (error) {
          console.error('[bookmarks] 侧栏注册失败', error);
        }
      },
    };
  },
});
