import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const translationsPath = new URL("./ru-translations.js", import.meta.url);
const { RU_TRANSLATIONS } = await import(`${translationsPath.href}?now=${Date.now()}`);

class InspectorClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !this.pending.has(message.id)) return;
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result || {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }
}

async function connect() {
  const targets = await fetch("http://127.0.0.1:9229/json/list").then((response) => response.json());
  const target = targets.find((item) => item.type === "node" && item.webSocketDebuggerUrl);
  if (!target) throw new Error("Node inspector target not found");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const client = new InspectorClient(socket);
  await client.send("Runtime.enable");
  return client;
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function installRuntimeController(translations) {
  const require = process.getBuiltinModule("module").createRequire(process.execPath);
  const { BrowserWindow } = require("electron");
  const KEY = "__airRussianLanguagePackRuntimeV015";
  const RENDERER_KEY = "__AIR_RLP_RENDERER_V015__";
  const TRANSLATIONS_KEY = "__air_rlp_translations_v015";

  await globalThis.__airRussianLanguagePackRuntimeV014?.deactivate?.();
  await globalThis.__airRussianLanguagePackRuntimeV019?.deactivate?.();
  await globalThis.__airRussianLanguagePackRuntimeV018?.deactivate?.();

  function installRendererRuntime(bundle, russian, runtimeKey) {
    const preferenceKey = "air-russian-language-pack.locale";
    const previous = globalThis[runtimeKey];
    previous?.observer?.disconnect?.();
    if (previous?.captureListener) document.removeEventListener("click", previous.captureListener, true);

    const state = {
      bundle,
      english: { ...bundle },
      russian,
      selected: localStorage.getItem(preferenceKey) === "ru",
      observer: null,
      captureListener: null,
    };
    if (state.selected) Object.assign(bundle, russian);

    const nativeLabels = new Set([
      "System default",
      "Simplified Chinese",
      "English",
      "Системный",
      "Системный язык",
      "Системный по умолчанию",
      "Китайский",
      "Китайский (упрощённый)",
      "Упрощённый китайский",
      "Английский",
    ]);
    const profileNativeLabels = new Set([
      "System default",
      "Simplified Chinese",
      "English",
      "中文简体",
      "Системный",
      "Системный по умолчанию",
      "Китайский",
      "Упрощённый китайский",
      "Английский",
    ]);

    function text(node) {
      return node?.textContent?.trim() || "";
    }

    function languageOptions() {
      const options = Array.from(document.querySelectorAll('[role="option"]'));
      return options.filter((option) => nativeLabels.has(text(option)) || option.dataset.airRussianOption === "true");
    }

    function profileLanguageOptions() {
      const options = Array.from(document.querySelectorAll('[role="menuitemradio"]'));
      return options.filter((option) =>
        profileNativeLabels.has(text(option)) || option.dataset.airRussianProfileOption === "true");
    }

    function replaceText(node, value) {
      const textNodes = [];
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      const target = textNodes.findLast((candidate) => candidate.nodeValue?.trim());
      if (target) target.nodeValue = value;
    }

    function syncLanguageMenu() {
      const options = languageOptions();
      const native = options.filter((option) => option.dataset.airRussianOption !== "true");
      if (native.length < 3) return;
      if (!native.some((option) => ["English", "Английский"].includes(text(option)))) return;
      if (!native.some((option) =>
        ["Simplified Chinese", "Китайский", "Китайский (упрощённый)", "Упрощённый китайский"].includes(text(option)))) return;

      let russianOption = options.find((option) => option.dataset.airRussianOption === "true");
      if (!russianOption) {
        const englishOption = native.find((option) => ["English", "Английский"].includes(text(option)));
        russianOption = englishOption.cloneNode(true);
        russianOption.dataset.airRussianOption = "true";
        russianOption.removeAttribute("id");
        const labelled = russianOption.querySelector("[id]");
        if (labelled) {
          labelled.id = `air-russian-option-${Date.now()}`;
          russianOption.setAttribute("aria-labelledby", labelled.id);
        }
        replaceText(russianOption, "Русский");
        englishOption.after(russianOption);
      }

      russianOption.dataset.state = state.selected ? "checked" : "unchecked";
      russianOption.setAttribute("aria-selected", state.selected ? "true" : "false");
      if (state.selected) {
        const selectedNative = native.find((option) => option.dataset.state === "checked");
        const check = selectedNative?.firstElementChild?.innerHTML || "";
        for (const option of native) {
          option.dataset.state = "unchecked";
          option.setAttribute("aria-selected", "false");
        }
        if (russianOption.firstElementChild && check && russianOption.firstElementChild.innerHTML !== check) {
          russianOption.firstElementChild.innerHTML = check;
        }
        if (selectedNative?.firstElementChild?.innerHTML) selectedNative.firstElementChild.innerHTML = "";
      } else if (russianOption.firstElementChild) {
        if (russianOption.firstElementChild.innerHTML) russianOption.firstElementChild.innerHTML = "";
      }

      const content = russianOption.closest('[role="listbox"]') || russianOption.parentElement;
      const contentId = content?.id;
      if (state.selected && contentId) {
        const trigger = document.querySelector(`[role="combobox"][aria-controls="${CSS.escape(contentId)}"]`);
        const value = trigger?.querySelector('[data-slot="select-value"]');
        if (value && text(value) !== "Русский") value.textContent = "Русский";
      }
    }

    function syncProfileLanguageMenu() {
      const options = profileLanguageOptions();
      const native = options.filter((option) => option.dataset.airRussianProfileOption !== "true");
      if (native.length < 3) return;
      if (!native.some((option) => ["English", "Английский"].includes(text(option)))) return;
      if (!native.some((option) =>
        ["Simplified Chinese", "中文简体", "Китайский", "Упрощённый китайский"].includes(text(option)))) return;

      let russianOption = options.find((option) => option.dataset.airRussianProfileOption === "true");
      if (!russianOption) {
        const chineseOption = native.find((option) =>
          ["Simplified Chinese", "中文简体", "Китайский", "Упрощённый китайский"].includes(text(option)));
        russianOption = chineseOption.cloneNode(true);
        russianOption.dataset.airRussianProfileOption = "true";
        russianOption.removeAttribute("id");
        replaceText(russianOption, "Русский");
        chineseOption.after(russianOption);
      }

      russianOption.dataset.state = state.selected ? "checked" : "unchecked";
      russianOption.setAttribute("aria-checked", state.selected ? "true" : "false");
      const russianIndicator = russianOption.querySelector('[data-slot="dropdown-menu-radio-item-indicator"]');
      if (state.selected) {
        const selectedNative = native.find((option) => option.dataset.state === "checked");
        const nativeIndicator = selectedNative?.querySelector('[data-slot="dropdown-menu-radio-item-indicator"]');
        const check = nativeIndicator?.innerHTML || "";
        for (const option of native) {
          option.dataset.state = "unchecked";
          option.setAttribute("aria-checked", "false");
        }
        if (russianIndicator && check) russianIndicator.innerHTML = check;
        if (nativeIndicator) nativeIndicator.innerHTML = "";
      } else if (russianIndicator) {
        russianIndicator.innerHTML = "";
      }
    }

    function syncLanguageMenus() {
      syncLanguageMenu();
      syncProfileLanguageMenu();
    }

    state.captureListener = (event) => {
      const option = event.composedPath().find((node) =>
        node instanceof Element && ["option", "menuitemradio"].includes(node.getAttribute?.("role")));
      if (!option) return;
      const isProfileOption = option.getAttribute("role") === "menuitemradio";
      const options = isProfileOption ? profileLanguageOptions() : languageOptions();
      if (!options.includes(option)) return;
      if (option.dataset.airRussianOption === "true" || option.dataset.airRussianProfileOption === "true") {
        event.preventDefault();
        event.stopImmediatePropagation();
        localStorage.setItem(preferenceKey, "ru");
        location.reload();
      } else if ((isProfileOption ? profileNativeLabels : nativeLabels).has(text(option))) {
        localStorage.removeItem(preferenceKey);
        setTimeout(() => location.reload(), 200);
      }
    };
    document.addEventListener("click", state.captureListener, true);
    state.observer = new MutationObserver(syncLanguageMenus);
    state.observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    syncLanguageMenus();
    globalThis[runtimeKey] = state;
    return { selected: state.selected };
  }

  function findWindow() {
    return BrowserWindow.getAllWindows().find((candidate) =>
      candidate.webContents.getURL().includes("/out/renderer/index.html"));
  }

  function findObjectEnd(source, objectStart) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = objectStart; index < source.length; index++) {
      const char = source[index];
      if (quote !== null) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") quote = char;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) return index;
    }
    return -1;
  }

  function sourceLocation(source, offset) {
    const before = source.slice(0, offset);
    const lineNumber = (before.match(/\n/g) || []).length;
    const lastNewline = before.lastIndexOf("\n");
    return { lineNumber, columnNumber: offset - lastNewline - 1 };
  }

  function findEnglishBundle(source) {
    const match = /([A-Za-z_$][\w$]*)=\{(?="common\.loading":(?:`Loading\.\.\.`|"Loading\.\.\."|'Loading\.\.\.'))/.exec(source);
    if (!match) throw new Error("en-US bundle assignment not found");
    const objectStart = match.index + match[0].lastIndexOf("{");
    const objectEnd = findObjectEnd(source, objectStart);
    if (objectEnd < 0) throw new Error("en-US bundle end not found");
    return { identifier: match[1], objectEnd };
  }

  function buildBootstrap(activeTranslations, source = null) {
    const translated = Object.keys(activeTranslations).length;
    if (translated < 3000) throw new Error(`Only ${translated} translations supplied`);
    const result = {
      stageSource: `localStorage.setItem(${JSON.stringify(TRANSLATIONS_KEY)},${JSON.stringify(JSON.stringify(activeTranslations))})`,
      translated,
    };
    if (source !== null) {
      const bundle = findEnglishBundle(source);
      result.expression = `(${installRendererRuntime.toString()})(${bundle.identifier},JSON.parse(localStorage.getItem(${JSON.stringify(TRANSLATIONS_KEY)})),${JSON.stringify(RENDERER_KEY)})`;
      result.location = sourceLocation(source, bundle.objectEnd + 2);
    }
    return result;
  }

  const previous = globalThis[KEY];
  if (previous?.activate) {
    await previous.activate(translations);
    return previous.status();
  }

  const controller = {
    enabled: false,
    translations,
    scripts: new Map(),
    instrumentationBreakpointId: null,
    injectionBreakpointId: null,
    assignment: null,
    translated: 0,
    patched: false,
    lastError: null,
    pauseQueue: Promise.resolve(),
    window: null,
    debuggerApi: null,
    ownedAttachment: false,
    skipNextNavigationArm: false,
    navigationCount: 0,
    pauseCount: 0,
    lastPausedUrl: "",
    phase: "idle",
  };

  async function removeBreakpoint(id) {
    if (!id || !controller.debuggerApi?.isAttached()) return;
    await controller.debuggerApi.sendCommand("Debugger.removeBreakpoint", { breakpointId: id }).catch(() => {});
  }

  async function arm() {
    await removeBreakpoint(controller.instrumentationBreakpointId);
    await removeBreakpoint(controller.injectionBreakpointId);
    controller.scripts.clear();
    controller.instrumentationBreakpointId = null;
    controller.injectionBreakpointId = null;
    controller.assignment = null;
    controller.patched = false;
    controller.lastError = null;
    const result = await controller.debuggerApi.sendCommand(
      "Debugger.setInstrumentationBreakpoint",
      { instrumentation: "beforeScriptExecution" },
    );
    controller.instrumentationBreakpointId = result.breakpointId;
  }

  async function handlePaused(params) {
    const scriptId = params.callFrames?.[0]?.location?.scriptId;
    const url = controller.scripts.get(scriptId) || params.data?.scriptName || "";
    controller.pauseCount++;
    controller.lastPausedUrl = url;
    try {
      if (!controller.enabled) return;
      if (controller.assignment && controller.injectionBreakpointId) {
        const callFrameId = params.callFrames?.[0]?.callFrameId;
        if (!callFrameId) throw new Error("Injection call frame not found");
        controller.phase = "inject";
        const evaluated = await controller.debuggerApi.sendCommand("Debugger.evaluateOnCallFrame", {
          callFrameId,
          expression: controller.assignment,
          silent: false,
          returnByValue: true,
        });
        if (evaluated.exceptionDetails) {
          throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
        }
        await removeBreakpoint(controller.injectionBreakpointId);
        controller.injectionBreakpointId = null;
        controller.assignment = null;
        controller.patched = true;
        const instrumentation = await controller.debuggerApi.sendCommand(
          "Debugger.setInstrumentationBreakpoint",
          { instrumentation: "beforeScriptExecution" },
        );
        controller.instrumentationBreakpointId = instrumentation.breakpointId;
        controller.phase = "injected";
      } else if (!controller.patched && /usageStatsUiParts-[^/]+\.js(?:\?|$)/.test(url)) {
        controller.phase = "locate-bundle";
        const sourceResult = await controller.debuggerApi.sendCommand("Debugger.getScriptSource", { scriptId });
        const injection = buildBootstrap(controller.translations, String(sourceResult.scriptSource || ""));
        const breakpoint = await controller.debuggerApi.sendCommand("Debugger.setBreakpoint", {
          location: { scriptId, ...injection.location },
        });
        controller.assignment = injection.expression;
        controller.injectionBreakpointId = breakpoint.breakpointId;
        controller.translated = injection.translated;
        await removeBreakpoint(controller.instrumentationBreakpointId);
        controller.instrumentationBreakpointId = null;
        controller.phase = "breakpoint-armed";
      }
    } catch (error) {
      controller.lastError = error instanceof Error ? error.message : String(error);
    } finally {
      await controller.debuggerApi.sendCommand("Debugger.resume").catch(() => {});
      if (!["breakpoint-armed", "injected"].includes(controller.phase)) controller.phase = "idle";
    }
  }

  function onDebuggerMessage(_event, method, params) {
    if (method === "Debugger.scriptParsed") {
      controller.scripts.set(params.scriptId, params.url || "");
    } else if (method === "Debugger.paused") {
      controller.pauseQueue = controller.pauseQueue.then(() => handlePaused(params));
    }
  }

  function onStartNavigation(_event, _url, _isInPlace, isMainFrame) {
    if (!isMainFrame || !controller.enabled) return;
    controller.navigationCount++;
    controller.scripts.clear();
    controller.assignment = null;
    controller.injectionBreakpointId = null;
    controller.patched = false;
    controller.phase = "navigation";
  }

  controller.status = () => ({
    enabled: controller.enabled,
    patched: controller.patched,
    translated: controller.translated,
    lastError: controller.lastError,
    debuggerAttached: Boolean(controller.debuggerApi?.isAttached()),
    navigationCount: controller.navigationCount,
    pauseCount: controller.pauseCount,
    lastPausedUrl: controller.lastPausedUrl,
    scriptCount: controller.scripts.size,
    hasAssignment: Boolean(controller.assignment),
    phase: controller.phase,
  });

  controller.activate = async (nextTranslations) => {
    controller.enabled = true;
    controller.translations = nextTranslations;
    controller.window = findWindow();
    if (!controller.window) throw new Error("ZCode renderer window not found");
    controller.debuggerApi = controller.window.webContents.debugger;
    if (!controller.debuggerApi.isAttached()) {
      controller.debuggerApi.attach("1.3");
      controller.ownedAttachment = true;
    }
    controller.debuggerApi.removeListener("message", onDebuggerMessage);
    controller.debuggerApi.on("message", onDebuggerMessage);
    controller.window.webContents.removeListener("did-start-navigation", onStartNavigation);
    controller.window.webContents.on("did-start-navigation", onStartNavigation);
    await controller.debuggerApi.sendCommand("Debugger.enable");
    await controller.debuggerApi.sendCommand("Runtime.enable");
    const bootstrap = buildBootstrap(controller.translations);
    const staged = await controller.debuggerApi.sendCommand("Runtime.evaluate", {
      expression: bootstrap.stageSource,
      silent: false,
      returnByValue: false,
    });
    if (staged.exceptionDetails) {
      throw new Error(staged.exceptionDetails.exception?.description || staged.exceptionDetails.text);
    }
    await arm();
    controller.window.webContents.reloadIgnoringCache();
  };

  controller.deactivate = async () => {
    controller.enabled = false;
    await removeBreakpoint(controller.instrumentationBreakpointId);
    await removeBreakpoint(controller.injectionBreakpointId);
    controller.instrumentationBreakpointId = null;
    controller.injectionBreakpointId = null;
    controller.assignment = null;
    controller.patched = false;
    controller.debuggerApi?.removeListener("message", onDebuggerMessage);
    controller.window?.webContents.removeListener("did-start-navigation", onStartNavigation);
    if (controller.debuggerApi?.isAttached()) {
      await controller.debuggerApi.sendCommand("Runtime.evaluate", {
        expression: `localStorage.removeItem(${JSON.stringify(TRANSLATIONS_KEY)})`,
        silent: true,
      }).catch(() => {});
    }
    if (controller.ownedAttachment && controller.debuggerApi?.isAttached()) {
      controller.debuggerApi.detach();
    }
    controller.window?.webContents.reloadIgnoringCache();
  };

  globalThis[KEY] = controller;
  await controller.activate(translations);
  return controller.status();
}

const PLUGIN_ID = "russian-language-pack@air-zcode-plugins";
const configPath = join(homedir(), ".zcode", "cli", "config.json");
const installedPath = join(homedir(), ".zcode", "cli", "plugins", "installed_plugins.json");
const stateDir = join(homedir(), ".zcode", "air-russian-language-pack");
const lockPath = join(stateDir, "runtime.lock.json");
const statePath = join(stateDir, "runtime.state.json");
const mainPidIndex = process.argv.indexOf("--zcode-pid");
const mainPid = Number(mainPidIndex >= 0 ? process.argv[mainPidIndex + 1] : 0);
const runtimeVersionIndex = process.argv.indexOf("--runtime-version");
const runtimeVersion = String(runtimeVersionIndex >= 0 ? process.argv[runtimeVersionIndex + 1] : "");
let lastStateFingerprint = "";

if (!Number.isInteger(mainPid) || mainPid <= 0) throw new Error("Missing --zcode-pid");
if (!runtimeVersion) throw new Error("Missing --runtime-version");

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function writeRuntimeState(status, details = {}) {
  mkdirSync(dirname(statePath), { recursive: true });
  const state = {
    version: runtimeVersion,
    pid: process.pid,
    zcodePid: mainPid,
    status,
    ...details,
  };
  const fingerprint = JSON.stringify(state);
  if (fingerprint === lastStateFingerprint) return;
  lastStateFingerprint = fingerprint;
  writeFileSync(statePath, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}

function currentPlugin() {
  const config = readJson(configPath, {});
  const installed = readJson(installedPath, { plugins: [] });
  const enabled = config?.plugins?.enabledPlugins?.[PLUGIN_ID] === true;
  const record = installed.plugins?.find((plugin) => plugin.id === PLUGIN_ID) || null;
  return enabled && record ? record : null;
}

async function loadTranslations(record) {
  const candidate = record?.installPath
    ? join(record.installPath, "scripts", "ru-translations.js")
    : null;
  if (!candidate) return RU_TRANSLATIONS;
  try {
    const module = await import(`${pathToFileURL(candidate).href}?version=${encodeURIComponent(record.version)}&now=${Date.now()}`);
    return module.RU_TRANSLATIONS || RU_TRANSLATIONS;
  } catch {
    return RU_TRANSLATIONS;
  }
}

async function connectToMain() {
  try {
    process._debugProcess(mainPid);
  } catch {
    // The inspector may already be active.
  }
  let lastError = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      return await connect();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError || new Error("Unable to connect to the ZCode inspector");
}

async function acquireLock() {
  mkdirSync(dirname(lockPath), { recursive: true });
  const lock = JSON.stringify({ pid: process.pid, zcodePid: mainPid, version: runtimeVersion });
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      writeFileSync(lockPath, lock, { encoding: "utf8", flag: "wx" });
      return true;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const existing = readJson(lockPath, null);
      if (existing?.pid && existing?.zcodePid &&
          isAlive(Number(existing.pid)) && isAlive(Number(existing.zcodePid))) return false;
      if (existing === null && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }
      rmSync(lockPath, { force: true });
    }
  }
  return false;
}

if (!(await acquireLock())) process.exit(0);

const client = await connectToMain();
let activeVersion = null;
let stopping = false;
let lastStatusAt = 0;
writeRuntimeState("starting");

async function synchronize() {
  const record = currentPlugin();
  if (record && activeVersion !== record.version) {
    writeRuntimeState("loading-translations", { pluginVersion: record.version });
    const translations = await loadTranslations(record);
    writeRuntimeState("installing-runtime", { pluginVersion: record.version });
    const runtimeStatus = await evaluate(client, `(${installRuntimeController.toString()})(${JSON.stringify(translations)})`);
    activeVersion = record.version;
    lastStatusAt = Date.now();
    writeRuntimeState("active", { pluginVersion: record.version, runtimeStatus });
  } else if (record && Date.now() - lastStatusAt >= 3000) {
    const runtimeStatus = await evaluate(client, "globalThis.__airRussianLanguagePackRuntimeV015?.status?.() || null");
    lastStatusAt = Date.now();
    writeRuntimeState("active", { pluginVersion: record.version, runtimeStatus });
  } else if (!record && activeVersion !== null) {
    await evaluate(client, `globalThis.__airRussianLanguagePackRuntimeV015?.deactivate?.() || null`);
    activeVersion = null;
    writeRuntimeState("plugin-disabled");
  }
}

async function shutdown() {
  if (stopping) return;
  stopping = true;
  try {
    if (activeVersion !== null && isAlive(mainPid)) {
      await evaluate(client, `globalThis.__airRussianLanguagePackRuntimeV015?.deactivate?.() || null`);
    }
  } catch {
    // ZCode may already be closing.
  }
  client.socket.close();
  const lock = readJson(lockPath, null);
  if (lock?.pid === process.pid) rmSync(lockPath, { force: true });
}

process.on("SIGINT", () => shutdown().finally(() => process.exit(0)));
process.on("SIGTERM", () => shutdown().finally(() => process.exit(0)));

while (!stopping && isAlive(mainPid)) {
  try {
    await synchronize();
  } catch (error) {
    // Keep the watcher alive; a renderer reload may temporarily close a target.
    writeRuntimeState("retrying", { error: error instanceof Error ? error.message : String(error) });
  }
  await new Promise((resolve) => setTimeout(resolve, 750));
}

await shutdown();
