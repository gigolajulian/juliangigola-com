--[[
  A client gallery's settings, as the plugin sends them to /api/proof.

  The watermark is on by default only for a gallery being created. A gallery
  that already exists on the site keeps what it has unless Julian ticks or
  unticks the box himself, so older galleries (made before the watermark)
  never get one by being opened, saved or published again (QA on #792).
]]

local M = {}

M.DEFAULTS = { email = "", note = "", included = 10, price = 15, days = 14 }

--- The fields to send. `isNew`: no remote gallery yet. A nil watermark is left out of the table, so it is not sent.
function M.fields(cs, isNew)
  local out = {}
  for k, v in pairs(M.DEFAULTS) do
    local x = cs and cs[k]
    if x == nil then x = v end
    out[k] = x
  end
  out.watermark = cs and cs.watermark
  if out.watermark == nil and isNew then out.watermark = true end
  return out
end

--- Fill the settings dialog. The watermark box starts ticked only on a new gallery.
function M.fill(cs, isNew)
  for k, v in pairs(M.DEFAULTS) do if cs[k] == nil then cs[k] = v end end
  if cs.watermark == nil and isNew then cs.watermark = true end
end

return M
