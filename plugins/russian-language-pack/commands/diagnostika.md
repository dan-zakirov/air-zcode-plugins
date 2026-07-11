---
description: Диагностика конфигурации ZCode на русском языке.
skills: russian-response,russian-setup-guide
---

Проведи read-only диагностику текущего ZCode и выведи результат на русском.

1. Прочитай `~/.zcode/cli/config.json` и проверь `plugins.enabledPlugins`.
2. Прочитай `~/.zcode/cli/plugins/installed_plugins.json` и найди установленную версию `russian-language-pack`.
3. Проверь `.zcode-plugin/plugin.json`, `hooks/hooks.json`, `SessionStart` и `UserPromptSubmit`.
4. Проверь `~/.zcode/air-russian-language-pack/runtime.lock.json` и жив ли указанный PID.
5. Подтверди, что используется обычный ZCode, а `app.asar` или `ZCode.app` не требуют изменений.
6. Найди последнее выполнение hooks плагина в логах ZCode и покажи точную ошибку, если она есть.

Формат: **Плагин**, **Hooks**, **Runtime**, **Язык**, **Логи**, затем короткий список действий. Не изменяй файлы без отдельной просьбы пользователя.
