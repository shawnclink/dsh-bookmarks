// 全平台收藏夹 —— 客户端一半（DSH Web UI 插件）
// 结构：一个主区整页（main/bookmarks）+ 一个侧栏按钮（sidebar.panellist/bookmarks）
// 数据：全部从同源 HTTP 路由 /dsh-bookmarks/v2/api 拿，不走 host.call。
window.__ModuleLoader__.load({
  id: '@local/dsh-bookmarks',
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
}
.bm-card:hover .bm-mask{opacity:1;}
.bm-icon-btn{
  width:28px; height:28px; border-radius:8px; border:1px solid rgba(255,255,255,.2);
  background:rgba(14,16,20,.6); backdrop-filter:blur(8px); color:#fff; cursor:pointer;
  display:flex; align-items:center; justify-content:center; padding:0;
  transition:background .15s, transform .12s, border-color .15s;
}
.bm-icon-btn:hover{background:rgba(24,26,32,.9); transform:translateY(-1px); border-color:rgba(255,255,255,.34);}
.bm-icon-btn.on{background:var(--dsw-alias-brand-primary, #4d7cff); border-color:transparent;}

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
        el.setAttribute('data-plugin', '@local/dsh-bookmarks');
        el.textContent = CSS;
        document.head.appendChild(el);
        return () => { if (el.parentNode) el.parentNode.removeChild(el); };
      } catch (error) {
        console.error('[bookmarks] 样式插入失败', error);
        return () => {};
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
        bookmark: [h('path', { key: 'a', d: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z' })],
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
          { className: 'bm-mask', onClick: (event) => event.preventDefault() },
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
        { className: `bm-card${textOnly ? ' text-only' : ''}${item.status === 'done' ? ' done' : ''}` },
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
              'div',
              {
                className: 'bm-card-title',
                onClick: () => props.onOpen(item),
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
    function BookmarksPage() {
      const [state, setState] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [platform, setPlatform] = React.useState('all');
      const [status, setStatus] = React.useState('all');
      const [sort, setSort] = React.useState('saved');
      const [query, setQuery] = React.useState('');
      const [view, setView] = React.useState('grid');
      const [picked, setPicked] = React.useState(null);
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
            setPicked(null);
            if (searchRef.current && document.activeElement === searchRef.current) searchRef.current.blur();
          }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, []);

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

      const items = (state && state.items) || [];
      const counts = (state && state.counts) || { total: 0, byPlatform: {} };
      const sources = (state && state.sources) || {};

      const visible = React.useMemo(() => {
        const needle = query.trim().toLowerCase();
        let list = items.slice();
        if (platform !== 'all') list = list.filter((item) => item.platform === platform);
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
      }, [items, platform, status, sort, query]);

      const failed = PLATFORMS.filter((p) => {
        const source = sources[p.id];
        return source && source.status === 'error';
      });

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
          h('button', { className: view === 'grid' ? 'on' : '', onClick: () => setView('grid'), title: '网格' }, '网格'),
          h('button', { className: view === 'digest' ? 'on' : '', onClick: () => setView('digest'), title: '归纳' }, '归纳')),
        h('button', {
          className: `bm-btn primary${busy || (state && state.syncing) ? ' spin' : ''}`,
          onClick: () => sync(),
          disabled: busy || (state && state.syncing),
        },
          icon('refresh', 13),
          state && state.syncing ? '同步中' : '同步'),
      );

      const bar = h(
        'div',
        { className: 'bm-bar' },
        h('button', { className: `bm-pill${platform === 'all' ? ' on' : ''}`, onClick: () => setPlatform('all') },
          '全部', h('span', { className: 'num' }, counts.total)),
        PLATFORMS.map((p) =>
          h('button',
            {
              key: p.id,
              className: `bm-pill${platform === p.id ? ' on' : ''}`,
              onClick: () => setPlatform(platform === p.id ? 'all' : p.id),
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
            })));
      }

      return h('div', { className: 'bm-root' },
        h('div', { className: 'bm-inner' },
          header,
          warn,
          view === 'digest' ? h(DigestPage, { revision: state && state.updatedAt }) : h(React.Fragment, null, bar, body)),
        picked
          ? h(Sheet, {
              item: picked,
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

    // ------------------------------------------------------------ 挂载
    return {
      inject: ['slots'],
      apply(ctx) {
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
