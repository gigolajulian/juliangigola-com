-- File > Plug-in Manager > juliangigola.com: a Sync with proof button at the top.
return {
  sectionsForTopOfDialog = function(f)
    return {
      {
        title = "Client picks",
        f:row {
          f:push_button { title = "Sync with proof", action = function() require("ProofsServiceProvider").runCheck() end },
          f:static_text { title = "Matches Lightroom to each gallery: picks get a Purple label, unpicks lose it. Nothing is published.", fill_horizontal = 1 },
        },
        f:row {
          f:push_button { title = "Check for updates", action = function()
            local LrTasks = import "LrTasks"
            LrTasks.startAsyncTask(function()
              local ok, err = LrTasks.pcall(require("Update").check, false)
              if not ok then (import "LrDialogs").message("Plugin update", tostring(err), "critical") end
            end)
          end },
          f:static_text { title = "The plugin also updates itself each time Lightroom starts.", fill_horizontal = 1 },
        },
      },
    }
  end,
}
