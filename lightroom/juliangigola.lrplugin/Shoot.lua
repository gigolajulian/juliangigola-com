--[[
  Pure helpers for the client galleries: no Lightroom imports, so
  lightroom/Shoot.test.lua runs them outside Lightroom.
]]

local M = {}

--- The earliest of a list of capture times (nil entries skipped), or nil.
function M.earliest(times)
  local min
  for _, t in ipairs(times) do
    if t and (not min or t < min) then min = t end
  end
  return min
end

--- The shoot day the site names a gallery by: MMDDYYYY of the earliest capture, or nil
--  (the site then uses today). `format(t, pattern)` is LrDate.timeToUserFormat in Lightroom.
function M.day(times, format)
  local t = M.earliest(times)
  if not t then return nil end
  local d = format(t, "%m%d%Y")
  return d and d:match("^%d%d%d%d%d%d%d%d$") and d or nil
end

--- Ids as comma lists of at most `size` each: one DELETE per list keeps every URL short.
function M.idLists(ids, enc, size)
  size = size or 200
  local out, cur = {}, {}
  for _, id in ipairs(ids) do
    cur[#cur + 1] = enc(id)
    if #cur == size then out[#out + 1], cur = table.concat(cur, ","), {} end
  end
  if #cur > 0 then out[#out + 1] = table.concat(cur, ",") end
  return out
end

--- The published photos whose remote id the client selected. `items` are { remoteId = ..., photo = ... }.
function M.picked(items, selects)
  local want, out = {}, {}
  for _, id in ipairs(selects or {}) do want[id] = true end
  for _, it in ipairs(items) do
    if want[it.remoteId] then out[#out + 1] = it.photo end
  end
  return out
end

--- A lightroom:// link from the site: lightroom://<toolkit id>/<action>?token=<gallery>.
--  Returns action, token (either may be nil); nil for a link that is not this plugin's.
function M.parseLink(url, toolkitId)
  local rest = tostring(url or ""):match("^lightroom://([^?#]*)")
  if not rest then return nil end
  local id, action = rest:match("^([^/]+)/?([%w%-]*)")
  if id ~= toolkitId then return nil end
  local token = tostring(url):match("[?&]token=([%w%-]+)")
  return action ~= "" and action or "sync", token
end

--- What syncing with the site changes. `locals`: { remoteId, name, url, proofs = bool }, `site`: { token, name, url }.
--  Renames only proof galleries (a delivery may carry its id on the end); refreshes every link. Creates and deletes nothing:
--  galleries missing on either side are only listed.
function M.planGalleries(locals, site)
  local byToken, seen = {}, {}
  for _, g in ipairs(site) do byToken[g.token] = g end
  local out = { rename = {}, relink = {}, onlySite = {}, onlyHere = {} }
  for i, c in ipairs(locals) do
    local g = byToken[c.remoteId]
    if not g then
      out.onlyHere[#out.onlyHere + 1] = c.name
    else
      seen[g.token] = true
      if c.proofs and g.name and g.name ~= "" and g.name ~= c.name then out.rename[#out.rename + 1] = { index = i, name = g.name } end
      if g.url and g.url ~= c.url then out.relink[#out.relink + 1] = { index = i, url = g.url } end
    end
  end
  for _, g in ipairs(site) do
    if not seen[g.token] then out.onlySite[#out.onlySite + 1] = g.name or g.token end
  end
  return out
end

return M
