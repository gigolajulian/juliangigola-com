-- Runs when Lightroom loads the plugin: one quiet update check, off the main thread.
local LrTasks = import "LrTasks"

LrTasks.startAsyncTask(function()
  -- LrTasks.pcall: LrHttp yields. Offline or no token: try again next start.
  LrTasks.pcall(require("Update").check, true)
end)
