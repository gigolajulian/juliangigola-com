-- File > Plug-in Manager > juliangigola.com: a Check for picks button at the top.
return {
  sectionsForTopOfDialog = function(f)
    return {
      {
        title = "Client picks",
        f:row {
          f:push_button { title = "Check for picks", action = function() require("ProofsServiceProvider").runCheck() end },
          f:static_text { title = "Flags every frame a client sent with a Purple label. Nothing is published.", fill_horizontal = 1 },
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
