#!/usr/bin/env bash
# Playwright's WebKit with App Nap off, for the perf suite on a Mac.
#
# macOS naps an app that is not the frontmost one after about 30s, and a
# napping WebKit draws a few frames a second. Every frame measured after
# that is the OS, not the site. `-NSAppSleepDisabled YES` is a user default
# given on the command line, so it holds for this process only and
# changes nothing on the machine.
#
# PERF_WEBKIT is Playwright's own launcher, set by `playwright.config.ts`.
exec "$PERF_WEBKIT" "$@" -NSAppSleepDisabled YES
