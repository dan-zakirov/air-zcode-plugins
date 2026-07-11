---
description: Диагностика конфигурации ZCode на русском языке.
skills: russian-response,russian-setup-guide
---

Проведи read-only диагностику текущего ZCode и выведи результат на русском.

1. Прочитай `~/.zcode/cli/config.json` и проверь `plugins.enabledPlugins`.
2. Прочитай `~/.zcode/cli/plugins/installed_plugins.json` и найди установленную версию `russian-language-pack`.
3. Проверь `.zcode-plugin/plugin.json`, `hooks/hooks.json`, `SessionStart` и `UserPromptSubmit`.
4. Проверь `~/.zcode/air-russian-language-pack/supervisor.lock.json`, `supervisor.state.json`, `runtime.lock.json`, `runtime.state.json` и живы ли указанные PID. Фактическая активация подтверждается `runtime.state.json`: `status: active`, `runtimeStatus.patched: true`, `lastError: null`.
5. Проверь пользовательскую запись автозапуска `AIR ZCode Russian Language Pack` в `HKCU:\Software\Microsoft\Windows\CurrentVersion\Run`.
6. Подтверди, что используется обычный ZCode, а `app.asar` или исполняемые файлы приложения не требуют изменений.
7. Найди последнее выполнение hooks плагина в логах ZCode и покажи точную ошибку, если она есть.

Формат: **Плагин**, **Hooks**, **Runtime**, **Язык**, **Логи**, затем короткий список действий. Не изменяй файлы без отдельной просьбы пользователя.
