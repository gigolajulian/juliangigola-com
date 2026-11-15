--[[
  Plug-in Extras > Sync galleries with site.

  Reads the site's gallery list once and brings this catalog's gallery
  collections in line: a proof gallery renamed in /admin is renamed here,
  and every collection gets its current link (a delivery moves to
  /delivery/<id>). It creates and deletes nothing: deleting a Client Gallery
  collection deletes the gallery on the site, so a gallery that exists on
  only one side is listed, never added or removed.
]]

local LrHttp = import "LrHttp"
local LrApplication = import "LrApplication"
local LrDialogs = import "LrDialogs"
local LrTasks = import "LrTasks"

local Site = require "Site"
local Shoot = require "Shoot"

local M = {}

function M.sync()
  local catalog = LrApplication.activeCatalog()
  local cols, locals = {}, {}
  local function walk(node, proofs)
    for _, pc in ipairs(node:getChildCollections()) do
      local remote = pc:getRemoteId()
      if remote then
        cols[#cols + 1] = pc
        locals[#locals + 1] = { remoteId = remote, name = pc:getName(), url = pc:getRemoteUrl(), proofs = proofs }
      end
    end
    for _, set in ipairs(node:getChildCollectionSets()) do walk(set, proofs) end
  end
  for _, service in ipairs(catalog:getPublishServices()) do
    if Site.ofPlugin(service) then walk(service, not Site.isDelivery(service)) end
  end

  local b, h = LrHttp.get(Site.API .. "?list", Site.headers(), 60)
  local site = {}
  for i, p in ipairs(Site.check(b, h, "list galleries").proofs or {}) do
    site[i] = { token = p.token, name = p.name, url = p.url }
  end

  local plan = Shoot.planGalleries(locals, site)
  local renamed, clashed = {}, {}
  if #plan.rename + #plan.relink > 0 then
    catalog:withWriteAccessDo("Sync galleries with juliangigola.com", function()
      for _, r in ipairs(plan.rename) do
        -- setName refuses a name another collection here already has: list it rather than fail.
        if cols[r.index]:setName(r.name) == false then clashed[#clashed + 1] = r.name else renamed[#renamed + 1] = r.name end
      end
      for _, r in ipairs(plan.relink) do cols[r.index]:setRemoteUrl(r.url) end
    end, { timeout = 30 })
  end

  local lines = { ("Checked %d %s here against %d on the site."):format(#locals, #locals == 1 and "gallery" or "galleries", #site) }
  if #renamed > 0 then lines[#lines + 1] = "Renamed: " .. table.concat(renamed, ", ") end
  if #clashed > 0 then lines[#lines + 1] = "Not renamed, the name is taken here: " .. table.concat(clashed, ", ") end
  if #plan.relink > 0 then lines[#lines + 1] = ("Links updated: %d"):format(#plan.relink) end
  if #plan.onlySite > 0 then lines[#lines + 1] = "On the site, not in this catalog: " .. table.concat(plan.onlySite, ", ") end
  if #plan.onlyHere > 0 then lines[#lines + 1] = "In this catalog, gone from the site: " .. table.concat(plan.onlyHere, ", ") end
  if #lines == 1 then lines[#lines + 1] = "Everything matches." end
  LrDialogs.message("Sync galleries with site", table.concat(lines, "\n\n"))
end

function M.run()
  LrTasks.startAsyncTask(function()
    -- LrTasks.pcall: plain pcall cannot wrap LrHttp, which yields.
    local ok, err = LrTasks.pcall(M.sync)
    if not ok then LrDialogs.message("Sync galleries with site", tostring(err), "critical") end
  end)
end

return M
