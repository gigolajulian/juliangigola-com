--[[
  juliangigola.com's gallery API (/api/proof), shared by the Client Gallery
  (proofs) and Client Delivery (finals) publish services. Every call here
  goes through LrHttp, so callers wrap it in LrTasks.pcall, never pcall.
]]

local LrHttp = import "LrHttp"
local LrPasswords = import "LrPasswords"
local LrDate = import "LrDate"
local LrTasks = import "LrTasks"

local Json = require "Json"
local Shoot = require "Shoot"

local M = {}

M.SITE = "https://juliangigola.com"
M.API = M.SITE .. "/api/proof"
-- The same GitHub token the website export saves; the site checks it can push to the repo.
local TOKEN_KEY = "github-token"

local function token()
  local t = LrPasswords.retrieve(TOKEN_KEY)
  if not t or t == "" then
    error("No GitHub token yet. Open File > Export > juliangigola.com once, paste it and press Save.", 0)
  end
  return t
end

function M.headers(contentType)
  return {
    { field = "Authorization", value = "Bearer " .. token() },
    { field = "Content-Type", value = contentType or "application/json" },
    { field = "User-Agent", value = "juliangigola-lightroom" },
  }
end

function M.check(body, hdrs, what)
  local status = hdrs and tonumber(hdrs.status)
  if not status then error("Could not reach juliangigola.com (" .. what .. "). Check the connection and publish again.", 0) end
  if status == 401 then error("The site did not accept the GitHub token. Paste a new one in File > Export > juliangigola.com.", 0) end
  if status >= 300 then
    local msg = body and body:match('"error"%s*:%s*"([^"]*)"') or what
    error(("juliangigola.com said %d: %s"):format(status, msg), 0)
  end
  return body and body ~= "" and Json.decode(body) or {}
end

function M.enc(s)
  return (tostring(s):gsub("[^%w%-%._~]", function(c) return ("%%%02X"):format(c:byte()) end))
end

function M.send(method, query, fields)
  local o = Json.object()
  for k, v in pairs(fields or {}) do Json.set(o, k, v) end
  local b, h = LrHttp.post(M.API .. (query or ""), Json.encode(o), M.headers(), method, 60)
  return M.check(b, h, method .. " " .. (query or "gallery"))
end

function M.fetch(galleryToken)
  local b, h = LrHttp.get(M.API .. "?token=" .. M.enc(galleryToken), M.headers(), 60)
  return M.check(b, h, "read gallery")
end

--- The shoot day (MMDDYYYY) of the photos being exported: the earliest capture date. Nil when none has one,
--  or when Lightroom will not say: a missing day must never stop a gallery being made (the site uses today).
function M.day(photos)
  local ok, d = LrTasks.pcall(function()
    local times = {}
    for i, photo in ipairs(photos or {}) do times[i] = photo:getRawMetadata("dateTimeOriginal") or false end
    return Shoot.day(times, function(t, f) return LrDate.timeToUserFormat(t, f) end)
  end)
  return ok and d or nil
end

-- Lightroom ids each service of a plugin as "<toolkit id>.<n>" (com.juliangigola.export.2), so match the prefix.
function M.ofPlugin(service)
  local id = tostring(service:getPluginId())
  return id == _PLUGIN.id or id:sub(1, #_PLUGIN.id + 1) == _PLUGIN.id .. "."
end

--- A Client Delivery service. Lightroom numbers services by their order in Info.lua, and Client Delivery is
--  the third (".3"); its publish settings also carry jg_delivery = true. Either is enough. A failed read
--  counts as not Delivery, so Sync with proof keeps working whatever happens here.
function M.isDelivery(service)
  local ok, yes = LrTasks.pcall(function()
    if tostring(service:getPluginId()) == _PLUGIN.id .. ".3" then return true end
    local s = service:getPublishSettings()
    return type(s) == "table" and (s.jg_delivery == true or (type(s["< contents >"]) == "table" and s["< contents >"].jg_delivery == true))
  end)
  return ok and yes == true
end

--- A Client Gallery (proofs) service of this plugin.
function M.isProofs(service)
  return M.ofPlugin(service) and not M.isDelivery(service)
end

return M
