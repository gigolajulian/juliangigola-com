-- Run from the repo root: uv run --with lupa python -c "import lupa; lupa.LuaRuntime().execute(open('lightroom/GallerySettings.test.lua').read())"
package.path = "lightroom/juliangigola.lrplugin/?.lua;" .. package.path
local G = require "GallerySettings"

-- A new gallery is watermarked unless Julian unticks it.
assert(G.fields({}, true).watermark == true)
assert(G.fields(nil, true).watermark == true)
assert(G.fields({ watermark = false }, true).watermark == false)

-- An existing gallery that never had the setting sends no watermark at all (QA on #792: Jenin's and older galleries).
local old = G.fields({ email = "a@b.c" }, false)
assert(old.watermark == nil, "existing gallery must not send a watermark it never had")
assert(old.email == "a@b.c" and old.included == 10)
-- Ticked or unticked by hand, it is sent.
assert(G.fields({ watermark = true }, false).watermark == true)
assert(G.fields({ watermark = false }, false).watermark == false)

-- Opening the settings of an existing gallery writes no watermark; a new one starts ticked.
local cs = {}
G.fill(cs, false)
assert(cs.watermark == nil and cs.days == 14)
local fresh = {}
G.fill(fresh, true)
assert(fresh.watermark == true)

print("GallerySettings: all cases pass")
