-- Library > Plug-in Extras > Check for picks. Off the main thread, so Lightroom never waits on the site.
local LrTasks = import "LrTasks"
local LrDialogs = import "LrDialogs"

LrTasks.startAsyncTask(function()
  local ok, err = pcall(require("ProofsServiceProvider").checkForPicks)
  if not ok then LrDialogs.message("Check for picks", tostring(err), "critical") end
end)
