--[[
  lightroom://com.juliangigola.export/<action>?token=<gallery> links from
  the site (the /admin Proofs desk). Windows hands the link to Lightroom,
  Lightroom to this handler.

    sync                Sync with proof, every gallery
    sync?token=<id>     Sync with proof, that gallery only
    galleries           Sync galleries with site

  A link only reads the site and marks photos here: it never publishes,
  sends or deletes anything.
]]

local LrApplication = import "LrApplication"
local LrDialogs = import "LrDialogs"
local LrTasks = import "LrTasks"

local Shoot = require "Shoot"
local Site = require "Site"

-- The Client Gallery collection with this gallery token, at any depth, or nil.
local function galleryHere(token)
  local found
  local function walk(node)
    for _, pc in ipairs(node:getChildCollections()) do
      if pc:getRemoteId() == token then found = found or pc end
    end
    for _, set in ipairs(node:getChildCollectionSets()) do walk(set) end
  end
  for _, service in ipairs(LrApplication.activeCatalog():getPublishServices()) do
    if Site.isProofs(service) then walk(service) end
  end
  return found
end

return {
  URLHandler = function(url)
    local action, token = Shoot.parseLink(url, _PLUGIN.id)
    if action == "galleries" then return require("Galleries").run() end
    if action ~= "sync" then
      LrDialogs.message("juliangigola.com", "The plugin does not know this link: " .. tostring(url))
      return
    end
    local proofs = require "ProofsServiceProvider"
    if not token then return proofs.runCheck() end
    LrTasks.startAsyncTask(function()
      local ok, pc = LrTasks.pcall(galleryHere, token)
      if ok and pc then
        LrApplication.activeCatalog():setActiveSources { pc }
        proofs.runCheck(pc)
      else
        LrDialogs.message("Sync with proof", "That gallery is not in this catalog. Open the catalog it was published from, then click the link again.")
      end
    end)
  end,
}
