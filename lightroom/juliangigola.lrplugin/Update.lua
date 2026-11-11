--[[
  Keeps this plugin current with the site's repo (main), wherever Lightroom
  loads it from. At Lightroom start (Init.lua) one GitHub request asks for the
  plugin folder's tree id; only when it changed are the files read and the
  ones that differ written here. Lightroom uses them after a restart or
  Plug-in Manager > Reload. Files are only added or replaced, never removed.
  Only a higher VERSION in Info.lua installs: bump revision with every plugin change.
]]

local LrPasswords = import "LrPasswords"
local LrPathUtils = import "LrPathUtils"
local LrPrefs = import "LrPrefs"
local LrDialogs = import "LrDialogs"

local GitHub = require "GitHub"

local DIR = "lightroom/juliangigola.lrplugin"
local U = {}

-- "VERSION = { major = 1, minor = 2, revision = 5" as one comparable number.
local function version(info)
  local a, b, c = (info or ""):match("major%s*=%s*(%d+)%s*,%s*minor%s*=%s*(%d+)%s*,%s*revision%s*=%s*(%d+)")
  return a and (tonumber(a) * 1000000 + tonumber(b) * 1000 + tonumber(c)) or 0
end

local function readLocal(path)
  local f = io.open(path, "rb")
  if not f then return nil end
  local b = f:read("*a")
  f:close()
  return b
end

--- quiet: at startup, say nothing unless something was updated.
function U.check(quiet)
  local token = LrPasswords.retrieve("github-token")
  if not token or token == "" then
    if not quiet then LrDialogs.message("Plugin update", "No GitHub token yet. Open File > Export > juliangigola.com once, paste it and press Save.") end
    return
  end
  local tree
  for _, e in ipairs(GitHub.list(token, "lightroom")) do
    if e.name == "juliangigola.lrplugin" then tree = e.sha end
  end
  local prefs = LrPrefs.prefsForPlugin()
  if not tree or prefs.pluginTree == tree then
    if not quiet then LrDialogs.message("Plugin update", "The juliangigola.com plugin is up to date.") end
    return
  end
  -- Read everything first, then write: a dropped connection leaves the old plugin whole.
  local files = {}
  for _, e in ipairs(GitHub.list(token, DIR)) do
    if e.type == "file" then
      local bytes = GitHub.read(token, DIR .. "/" .. e.name)
      if bytes then files[#files + 1] = { path = LrPathUtils.child(_PLUGIN.path, e.name), bytes = bytes } end
    end
  end
  -- Only ever a newer plugin: never undo a build installed ahead of main.
  local remoteInfo
  for _, f in ipairs(files) do if LrPathUtils.leafName(f.path) == "Info.lua" then remoteInfo = f.bytes end end
  if version(remoteInfo) <= version(readLocal(LrPathUtils.child(_PLUGIN.path, "Info.lua"))) then
    prefs.pluginTree = tree
    if not quiet then LrDialogs.message("Plugin update", "The juliangigola.com plugin is up to date.") end
    return
  end
  local changed = 0
  for _, f in ipairs(files) do
    -- Line endings differ between git checkouts: compare without them.
    local old = readLocal(f.path)
    if not old or old:gsub("\r", "") ~= f.bytes:gsub("\r", "") then
      local out = assert(io.open(f.path, "wb"))
      out:write(f.bytes)
      out:close()
      changed = changed + 1
    end
  end
  prefs.pluginTree = tree
  if changed > 0 then
    LrDialogs.message("juliangigola.com plugin updated", "Restart Lightroom, or File > Plug-in Manager > Reload, to use it.")
  elseif not quiet then
    LrDialogs.message("Plugin update", "The juliangigola.com plugin is up to date.")
  end
end

return U
