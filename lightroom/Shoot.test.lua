-- Run from the repo root: uv run --with lupa python -c "import lupa; lupa.LuaRuntime().execute(open('lightroom/Shoot.test.lua').read())"
package.path = "lightroom/juliangigola.lrplugin/?.lua;" .. package.path
local S = require "Shoot"

-- The shoot day is the earliest capture; photos with no capture time are skipped.
local fmt = function(t, f) assert(f == "%m%d%Y"); return ({ [100] = "11082026", [50] = "11072026" })[t] end
assert(S.day({ 100, false, 50 }, fmt) == "11072026")
assert(S.day({ false, false }, fmt) == nil, "no capture times: the site uses today")
assert(S.day({}, fmt) == nil)
assert(S.day({ 7 }, function() return "Nov 7" end) == nil, "only MMDDYYYY goes to the site")

-- Ids go out encoded, in comma lists of at most `size`.
local enc = function(s) return (s:gsub(",", "%%2C")) end
local lists = S.idLists({ "1", "2", "3", "4", "5" }, enc, 2)
assert(#lists == 3 and lists[1] == "1,2" and lists[3] == "5")
assert(#S.idLists({}, enc, 2) == 0)
assert(S.idLists({ "a,b" }, enc)[1] == "a%2Cb")

-- Only the client's selects become finals.
local items = { { remoteId = "1", photo = "p1" }, { remoteId = "2", photo = "p2" }, { remoteId = "3", photo = "p3" } }
local got = S.picked(items, { "3", "1", "9" })
assert(#got == 2 and got[1] == "p1" and got[2] == "p3")
assert(#S.picked(items, nil) == 0)

-- Links from the site: only this plugin's, sync by default, the gallery token when given.
local ID = "com.juliangigola.export"
local a, t = S.parseLink("lightroom://com.juliangigola.export/sync?token=11142026-ykqpg2de", ID)
assert(a == "sync" and t == "11142026-ykqpg2de")
a, t = S.parseLink("lightroom://com.juliangigola.export", ID)
assert(a == "sync" and t == nil)
assert(S.parseLink("lightroom://com.other.plugin/sync", ID) == nil)
assert(S.parseLink("https://juliangigola.com", ID) == nil)
assert(S.parseLink("lightroom://com.juliangigola.export/galleries", ID) == "galleries")
assert(select(2, S.parseLink("lightroom://com.juliangigola.export/sync?token=x;rm", ID)) == "x", "a token is letters, digits and dashes only")

-- Syncing galleries renames proofs only, relinks all, and only lists what is missing on either side.
local plan = S.planGalleries(
  { { remoteId = "a", name = "Old", url = "u1", proofs = true }, { remoteId = "a", name = "Old a", url = "u1", proofs = false }, { remoteId = "z", name = "Other catalog", url = "u9", proofs = true } },
  { { token = "a", name = "New", url = "u2" }, { token = "b", name = "Site only", url = "u3" } })
assert(#plan.rename == 1 and plan.rename[1].index == 1 and plan.rename[1].name == "New")
assert(#plan.relink == 2)
assert(#plan.onlyHere == 1 and plan.onlyHere[1] == "Other catalog")
assert(#plan.onlySite == 1 and plan.onlySite[1] == "Site only")

print("Shoot.test.lua: ok")
