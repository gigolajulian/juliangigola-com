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

return M
