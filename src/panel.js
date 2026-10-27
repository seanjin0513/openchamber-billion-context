/**
 * billion-context Web UI —— OpenChamber 面板
 *
 * 探测本机运行中的 bili 代理（通过扩展的本地 service），并在 OpenChamber 的
 * 浏览器面板（桌面）或系统浏览器中打开它的 Web 控制台：`<origin>/__bili/`。
 */
import { connectHost } from '@openchamber/sdk';
import { applyHostReady } from '@openchamber/sdk/ui';

const ROUTES = [
  { id: 'overview' },
  { id: 'sessions' },
  { id: 'logs' },
  { id: 'config' },
  { id: 'connect' },
  { id: 'updates' },
];

const COPY = {
  zh: {
    tagline: '上下文压缩代理 · Web 控制台',
    checking: '检测中',
    running: '运行中',
    offline: '未运行',
    error: '服务异常',
    starting: '启动中',
    version: '版本',
    lane: '通道',
    pid: '进程',
    started: '启动',
    origin: '地址',
    pages: '页面',
    instances: '实例',
    defaultTag: '默认',
    open: (name) => `打开${name}`,
    retry: '重新检测',
    start: '启动代理',
    startingBtn: '正在启动…',
    auto: '自动检测',
    updated: (time) => `${time} 更新`,
    routes: {
      overview: ['总览', '实时统计、缓存命中率与压缩活动'],
      sessions: ['会话', '每个对话的轨迹与压缩结构'],
      logs: ['日志', '请求与压缩流水'],
      config: ['配置', '运行时设置，保存即生效'],
      connect: ['接入', '各客户端的配置片段'],
      updates: ['版本', '版本状态与安装'],
    },
    offlineTitle: '未检测到运行中的代理',
    offlineBody:
      'billion-context 的 Web 控制台由本机 bili 代理提供。打开一个经过 bili 的会话，或让扩展在后台启动一个。',
    offlineHint: '只探测本机回环地址，不读取会话内容。',
    serviceTitle: '本地服务未就绪',
    serviceNoService:
      '扩展的本地服务还没有启动。若刚安装，请在 设置 → 扩展 里允许它运行本地服务，然后重试。',
    serviceFailed: '扩展的本地服务启动失败。重新加载扩展或重启 OpenChamber 后再试。',
    serviceTimeout: '本地服务响应超时，请重试。',
    serviceGeneric: '无法连接扩展的本地服务，请重试。',
    startFailed: '启动失败',
    noCli: '找不到 bili。请先安装 billion-context：npm i -g billion-context，再重试。',
    startTimeout: '已发起启动，但 15 秒内没有就绪。稍等片刻后点「重新检测」。',
    startExited: 'bili 进程退出得太快，可能端口被占用或配置有误。',
    startSpawn: '无法启动 bili 进程。',
    startUnknown: '启动没有成功，请重试。',
    startedToast: 'bili 代理已启动',
    openFailed: '无法打开控制台',
    laneNames: { opencode: 'OpenCode', pi: 'Pi', dsh: 'DSH' },
    standalone: '独立',
  },
  en: {
    tagline: 'Context compression proxy · Web console',
    checking: 'Checking',
    running: 'Running',
    offline: 'Not running',
    error: 'Service error',
    starting: 'Starting',
    version: 'Version',
    lane: 'Lane',
    pid: 'PID',
    started: 'Started',
    origin: 'Origin',
    pages: 'Pages',
    instances: 'Instance',
    defaultTag: 'Default',
    open: (name) => `Open ${name}`,
    retry: 'Check again',
    start: 'Start proxy',
    startingBtn: 'Starting…',
    auto: 'Auto-check',
    updated: (time) => `Updated ${time}`,
    routes: {
      overview: ['Overview', 'Live stats, cache hit rate and folds'],
      sessions: ['Sessions', 'Trajectory and fold structure per chat'],
      logs: ['Logs', 'Request and compression log'],
      config: ['Config', 'Runtime settings, applied on save'],
      connect: ['Connect', 'Setup snippets for each client'],
      updates: ['Versions', 'Version status and installs'],
    },
    offlineTitle: 'No running proxy found',
    offlineBody:
      'billion-context serves its web console from the local bili proxy. Open a session routed through bili, or let this extension start one in the background.',
    offlineHint: 'Only loopback addresses are probed; conversations are never read.',
    serviceTitle: 'Local service is not ready',
    serviceNoService:
      'The extension’s local service has not started. If you just installed it, allow it to run a local service in Settings → Extensions, then try again.',
    serviceFailed:
      'The extension’s local service failed to start. Reload the extension or restart OpenChamber, then try again.',
    serviceTimeout: 'The local service timed out. Try again.',
    serviceGeneric: 'Could not reach the extension’s local service. Try again.',
    startFailed: 'Could not start',
    noCli: 'bili was not found. Install billion-context first: npm i -g billion-context, then try again.',
    startTimeout: 'Start was requested, but nothing was ready within 15 seconds. Try “Check again” shortly.',
    startExited: 'The bili process exited too quickly; a port may be taken or the config may be invalid.',
    startSpawn: 'Could not spawn the bili process.',
    startUnknown: 'Start did not succeed. Try again.',
    startedToast: 'bili proxy started',
    openFailed: 'Could not open the console',
    laneNames: { opencode: 'OpenCode', pi: 'Pi', dsh: 'DSH' },
    standalone: 'Standalone',
  },
};

const ICON_LAYERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.6 20 8l-8 4.4L4 8l8-4.4Z"/><path d="m4 12 8 4.4 8-4.4"/><path d="m4 16 8 4.4 8-4.4"/></svg>`;
const ICON_EXTERNAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>`;
const ICON_ARROW = `<svg class="route-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`;

const APP_HTML = `
<div class="wrap">
  <header class="hero">
    <div class="mark">${ICON_LAYERS}</div>
    <div class="titles">
      <h1>billion-context</h1>
      <p class="tagline" data-copy="tagline"></p>
    </div>
    <span class="badge" id="badge" data-state="checking"><i class="dot"></i><span id="badge-text"></span></span>
  </header>

  <div class="notice" id="notice" hidden>
    <div class="notice-title" id="notice-title"></div>
    <div class="notice-body" id="notice-body"></div>
  </div>

  <div class="loading" id="loading">
    <span class="spinner"></span><span data-copy="checking"></span>
  </div>

  <section id="live" hidden>
    <div class="card meta">
      <div class="kv"><span class="k" data-copy="version"></span><span class="v" id="m-version">—</span></div>
      <div class="kv"><span class="k" data-copy="lane"></span><span class="v" id="m-lane">—</span></div>
      <div class="kv"><span class="k" data-copy="pid"></span><span class="v" id="m-pid">—</span></div>
      <div class="kv"><span class="k" data-copy="started"></span><span class="v" id="m-started">—</span></div>
      <div class="kv wide"><span class="k" data-copy="origin"></span><code class="v" id="m-origin">—</code></div>
    </div>

    <div class="instance" id="instance" hidden>
      <label class="k" for="instance-select" data-copy="instances"></label>
      <select id="instance-select" class="select"></select>
    </div>

    <div class="actions" style="margin-top: 10px">
      <button class="primary" id="open" type="button">${ICON_EXTERNAL}<span id="open-label"></span></button>
    </div>

    <div class="section-head" style="margin-top: 12px">
      <span data-copy="pages"></span>
      <span class="hint" id="updated"></span>
    </div>
    <div class="routes" id="routes"></div>
  </section>

  <section id="offline" hidden>
    <div class="card empty">
      <div class="empty-mark">${ICON_LAYERS}</div>
      <h2 id="offline-title"></h2>
      <p id="offline-body"></p>
      <div class="actions">
        <button class="primary" id="start" type="button"><span id="start-label"></span></button>
        <button class="ghost" id="retry" type="button" data-copy="retry"></button>
      </div>
      <p class="hint" id="offline-hint"></p>
    </div>
  </section>

  <footer class="foot">
    <label class="auto"><input type="checkbox" id="auto" /><span data-copy="auto"></span></label>
    <span class="foot-mark">bili webui</span>
  </footer>
</div>`;

const host = connectHost();

const state = {
  lang: 'zh',
  phase: 'checking',
  firstLoad: true,
  targets: [],
  selected: null,
  defaultRoute: 'overview',
  auto: true,
  starting: false,
  startError: null,
  startDetail: null,
  serviceError: null,
  serviceDetail: null,
  updatedAt: 0,
  refreshing: false,
  booted: false,
};

const refs = {};
let ticker = null;

const t = () => COPY[state.lang];

/* ------------------------------------------------------------------ utils */

function errorText(error) {
  if (!error) return '';
  const code = typeof error.code === 'string' ? error.code : '';
  const message = error instanceof Error ? error.message : String(error);
  if (code && message) return `${code}: ${message}`;
  return code || message;
}

function formatTime(ms) {
  try {
    return new Date(ms).toLocaleTimeString(state.lang === 'zh' ? 'zh-CN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function laneLabel(lane) {
  if (!lane) return t().standalone;
  return (t().laneNames && t().laneNames[lane]) || lane;
}

function currentTarget() {
  return state.targets.find((item) => item.origin === state.selected) || state.targets[0] || null;
}

function validTarget(item) {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.origin !== 'string' || typeof item.version !== 'string') return false;
  try {
    const url = new URL(item.origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

function serviceMessage(code) {
  if (code === 'NO_SERVICE') return t().serviceNoService;
  if (code === 'SERVICE_FAILED') return t().serviceFailed;
  if (code === 'HOST_TIMEOUT') return t().serviceTimeout;
  return t().serviceGeneric;
}

function startMessage(code, detail) {
  if (code === 'no-cli') return t().noCli;
  if (code === 'timeout') return t().startTimeout;
  if (code === 'exited') return `${t().startExited}${detail ? ` (${detail})` : ''}`;
  if (code === 'spawn-failed') return `${t().startSpawn}${detail ? ` (${detail})` : ''}`;
  return `${t().startUnknown}${detail ? ` (${detail})` : ''}`;
}

function notify(kind, message) {
  return host.toast({ kind, message }).catch(() => {});
}

/* ------------------------------------------------------------------ mount */

function mount() {
  document.getElementById('app').innerHTML = APP_HTML;

  refs.badge = document.getElementById('badge');
  refs.badgeText = document.getElementById('badge-text');
  refs.notice = document.getElementById('notice');
  refs.noticeTitle = document.getElementById('notice-title');
  refs.noticeBody = document.getElementById('notice-body');
  refs.loading = document.getElementById('loading');
  refs.live = document.getElementById('live');
  refs.offline = document.getElementById('offline');
  refs.mVersion = document.getElementById('m-version');
  refs.mLane = document.getElementById('m-lane');
  refs.mPid = document.getElementById('m-pid');
  refs.mStarted = document.getElementById('m-started');
  refs.mOrigin = document.getElementById('m-origin');
  refs.instance = document.getElementById('instance');
  refs.instanceSelect = document.getElementById('instance-select');
  refs.open = document.getElementById('open');
  refs.openLabel = document.getElementById('open-label');
  refs.updated = document.getElementById('updated');
  refs.routes = document.getElementById('routes');
  refs.offlineTitle = document.getElementById('offline-title');
  refs.offlineBody = document.getElementById('offline-body');
  refs.offlineHint = document.getElementById('offline-hint');
  refs.start = document.getElementById('start');
  refs.startLabel = document.getElementById('start-label');
  refs.retry = document.getElementById('retry');
  refs.auto = document.getElementById('auto');

  applyCopy();
  renderRoutes();
  update();

  refs.open.addEventListener('click', () => void openRoute(state.defaultRoute, false));
  refs.start.addEventListener('click', () => void startProxy());
  refs.retry.addEventListener('click', () => void refresh());
  refs.instanceSelect.addEventListener('change', () => {
    state.selected = refs.instanceSelect.value;
    update();
  });
  refs.auto.addEventListener('change', () => {
    state.auto = refs.auto.checked;
    void host.storage.set('autoRefresh', state.auto).catch(() => {});
    schedule();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.auto && Date.now() - state.updatedAt > 15000) {
      void refresh({ quiet: true });
    }
  });
}

function applyCopy() {
  const copy = t();
  for (const node of document.querySelectorAll('[data-copy]')) {
    const key = node.getAttribute('data-copy');
    const value = copy[key];
    if (typeof value === 'string') node.textContent = value;
  }
  if (refs.auto) refs.auto.checked = state.auto;
}

function renderRoutes() {
  if (!refs.routes) return;
  refs.routes.replaceChildren();
  for (const route of ROUTES) {
    const [name, description] = t().routes[route.id];
    const isDefault = route.id === state.defaultRoute;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'route';
    button.dataset.route = route.id;
    button.innerHTML = `<span class="route-main"><span class="route-name">${name}${
      isDefault ? `<span class="route-tag">${t().defaultTag}</span>` : ''
    }</span><span class="route-desc">${description}</span></span>${ICON_ARROW}`;
    button.addEventListener('click', () => void openRoute(route.id, true));
    refs.routes.append(button);
  }
}

/* ----------------------------------------------------------------- render */

function update() {
  const target = currentTarget();
  const showLive = Boolean(target) && state.phase !== 'error';
  const showLoading = state.firstLoad && state.phase === 'checking';

  if (refs.loading) refs.loading.hidden = !showLoading;
  if (refs.live) refs.live.hidden = !showLive;
  if (refs.offline) refs.offline.hidden = showLive || showLoading;

  let badgeState = 'offline';
  let badgeText = t().offline;
  if (state.starting) {
    badgeState = 'checking';
    badgeText = t().starting;
  } else if (state.phase === 'checking') {
    badgeState = 'checking';
    badgeText = t().checking;
  } else if (state.serviceError) {
    badgeState = 'error';
    badgeText = t().error;
  } else if (target) {
    badgeState = 'running';
    badgeText = t().running;
  } else if (state.startError) {
    badgeState = 'error';
    badgeText = t().startFailed;
  }
  if (refs.badge) {
    refs.badge.dataset.state = badgeState;
    refs.badgeText.textContent = badgeText;
  }

  const showNotice = Boolean(state.serviceError);
  if (refs.notice) {
    refs.notice.hidden = !showNotice;
    if (showNotice) {
      refs.noticeTitle.textContent = t().serviceTitle;
      refs.noticeBody.textContent = serviceMessage(state.serviceError);
    }
  }

  if (showLive && target) {
    refs.mVersion.textContent = target.version || '—';
    refs.mLane.textContent = laneLabel(target.lane);
    refs.mPid.textContent = target.pid ? String(target.pid) : '—';
    refs.mStarted.textContent = target.startedAt ? formatTime(target.startedAt) : '—';
    refs.mOrigin.textContent = target.origin;
    refs.mOrigin.title = target.origin;
    refs.openLabel.textContent = t().open(t().routes[state.defaultRoute][0]);
    refs.updated.textContent = state.updatedAt ? t().updated(formatTime(state.updatedAt)) : '';

    if (state.targets.length > 1) {
      refs.instance.hidden = false;
      const wanted = state.targets.map((item) => `${item.origin}`);
      const existing = Array.from(refs.instanceSelect.options).map((option) => option.value);
      if (wanted.join('\n') !== existing.join('\n')) {
        refs.instanceSelect.replaceChildren(
          ...state.targets.map((item) => {
            const option = document.createElement('option');
            option.value = item.origin;
            option.textContent = `${laneLabel(item.lane)} · ${item.origin.replace(/^https?:\/\//, '')}`;
            return option;
          }),
        );
      }
      refs.instanceSelect.value = target.origin;
    } else {
      refs.instance.hidden = true;
    }
  }

  if (!showLive) {
    let title = t().offlineTitle;
    let body = t().offlineBody;
    let hint = t().offlineHint;

    if (state.serviceError) {
      title = t().serviceTitle;
      body = serviceMessage(state.serviceError);
      hint = '';
    } else if (state.startError) {
      title = t().startFailed;
      body = startMessage(state.startError, state.startDetail);
      hint = '';
    }
    refs.offlineTitle.textContent = title;
    refs.offlineBody.textContent = body;
    refs.offlineHint.textContent = hint;
    refs.offlineHint.hidden = !hint;
  }

  if (refs.start) {
    const blocked = Boolean(state.serviceError);
    refs.start.disabled = state.starting || blocked;
    refs.start.classList.toggle('busy', state.starting);
    refs.startLabel.textContent = state.starting ? t().startingBtn : t().start;
    refs.retry.disabled = state.starting;
  }
  if (refs.auto) refs.auto.checked = state.auto;
}

/* ------------------------------------------------------------------ data */

async function refresh({ quiet = false } = {}) {
  if (state.refreshing) return;
  state.refreshing = true;
  if (!quiet) {
    state.phase = 'checking';
    state.serviceError = null;
    state.serviceDetail = null;
    update();
  }
  try {
    const response = await host.serviceRequest({ method: 'GET', path: '/targets' });
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    const data = JSON.parse(response.body);
    state.targets = Array.isArray(data.targets) ? data.targets.filter(validTarget) : [];
    if (!state.targets.some((item) => item.origin === state.selected)) {
      state.selected = state.targets[0]?.origin ?? null;
    }
    state.phase = 'ready';
    state.serviceError = null;
    state.serviceDetail = null;
    state.updatedAt = Date.now();
  } catch (error) {
    state.phase = 'error';
    state.targets = [];
    state.serviceError = error?.code || 'ERROR';
    state.serviceDetail = errorText(error);
  } finally {
    state.refreshing = false;
    state.firstLoad = false;
    update();
  }
}

async function startProxy() {
  if (state.starting) return;
  state.starting = true;
  state.startError = null;
  state.startDetail = null;
  update();
  try {
    const response = await host.serviceRequest({ method: 'POST', path: '/start' });
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    const data = JSON.parse(response.body);
    const targets = Array.isArray(data.targets) ? data.targets.filter(validTarget) : [];
    if (data.ok && targets.length) {
      state.targets = targets;
      state.selected = targets[0].origin;
      state.phase = 'ready';
      state.serviceError = null;
      state.updatedAt = Date.now();
      state.starting = false;
      update();
      await notify('success', t().startedToast);
      await openRoute(state.defaultRoute, false);
      return;
    }
    state.startError = data.error || 'timeout';
    state.startDetail = data.detail || null;
  } catch (error) {
    const code = error?.code;
    state.serviceError = code === 'NO_SERVICE' || code === 'SERVICE_FAILED' ? code : null;
    state.serviceDetail = errorText(error);
    state.startError = state.serviceError ? null : 'spawn-failed';
    state.startDetail = errorText(error);
  } finally {
    state.starting = false;
    update();
  }
}

async function openRoute(id, remember) {
  const target = currentTarget();
  if (!target) return;
  const route = ROUTES.some((item) => item.id === id) ? id : 'overview';
  try {
    await host.openUrl(`${target.origin}/__bili/#/${route}`);
    if (remember && route !== state.defaultRoute) {
      state.defaultRoute = route;
      renderRoutes();
      update();
      await host.storage.set('defaultRoute', route).catch(() => {});
    }
  } catch (error) {
    await notify('error', `${t().openFailed}: ${errorText(error)}`);
  }
}

/* ------------------------------------------------------------------ boot */

function schedule() {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
  if (!state.auto) return;
  ticker = setInterval(() => {
    if (document.visibilityState === 'hidden' || state.refreshing || state.starting) return;
    void refresh({ quiet: true });
  }, 15000);
}

async function loadPrefs() {
  try {
    const route = await host.storage.get('defaultRoute');
    if (ROUTES.some((item) => item.id === route)) state.defaultRoute = route;
  } catch {
    // storage may be unavailable on older hosts; keep defaults
  }
  try {
    const auto = await host.storage.get('autoRefresh');
    if (typeof auto === 'boolean') state.auto = auto;
  } catch {
    // ignore
  }
  if (refs.auto) refs.auto.checked = state.auto;
}

async function boot() {
  await loadPrefs();
  update();
  await refresh();
  schedule();
}

host.onReady((ctx) => {
  const lang = /^zh/i.test(ctx.locale || '') ? 'zh' : 'en';
  if (!state.booted) {
    state.booted = true;
    state.lang = lang;
    mount();
    applyHostReady(ctx, document.documentElement);
    void boot();
    return;
  }
  if (lang !== state.lang) {
    state.lang = lang;
    applyCopy();
    renderRoutes();
    update();
  }
  applyHostReady(ctx, document.documentElement);
});
