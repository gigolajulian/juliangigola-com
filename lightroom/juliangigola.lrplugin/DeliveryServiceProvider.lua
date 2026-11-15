--[[
  Publish Services > Client Delivery.

  The finished photos. Each published collection is the delivery side of a
  client gallery: its remote id is the proof gallery's token, so the finals
  land in the same gallery the client picked from, and the link preview
  keeps its cover (finals use the same frame ids as proofs). Publish uploads
  full-size JPEGs at quality 100, sRGB, no watermark, copyright embedded,
  location and faces stripped. Nothing is mailed from here: "Send finals"
  in /admin mails the client /delivery/<id>, open 60 days.

  Library > Plug-in Extras > Make delivery from selects builds a Delivery
  collection from a proof gallery's selects. A Delivery collection made by
  hand, with no proof gallery, makes a new gallery on its first publish.

  Removing photos or the collection here only takes finals off the site.
  The gallery itself is the proof gallery too and is never deleted from here.
]]

local LrHttp = import "LrHttp"
local LrView = import "LrView"
local LrDialogs = import "LrDialogs"
local LrFileUtils = import "LrFileUtils"
local LrApplication = import "LrApplication"
local LrTasks = import "LrTasks"

local Image = require "Image"
local Site = require "Site"
local Shoot = require "Shoot"

local bind = LrView.bind
local enc = Site.enc

local provider = {}

provider.supportsIncrementalPublish = "only"
provider.small_icon = "icon.png"
provider.hideSections = { "exportLocation", "fileNaming", "video", "watermarking", "imageSettings" }
provider.allowFileFormats = { "JPEG" }
provider.allowColorSpaces = { "sRGB" }
provider.hidePrintResolution = true
provider.canExportVideo = false
provider.titleForPublishedCollection = "Delivery"
provider.titleForPublishedCollection_standalone = "Delivery"
provider.titleForGoToPublishedCollection = "Open delivery"
provider.titleForGoToPublishedPhoto = "disable"
provider.disableRenamePublishedCollection = false
provider.canAddCommentsToService = function() return false end
-- Finals are pixels: metadata edits never mark one for re-publish. Develop edits still do.
function provider.metadataThatTriggersRepublish()
  return { default = false }
end

-- Marks this service's publish settings, so Sync with proof (Site.isProofs) can tell it from Client Gallery.
provider.exportPresetFields = { { key = "jg_delivery", default = true } }

--- Finals: full size, JPEG quality 100, sRGB, no watermark, copyright only, no location or faces.
function provider.updateExportSettings(s)
  s.jg_delivery = true
  s.LR_format = "JPEG"
  s.LR_jpeg_quality = 1
  s.LR_jpeg_useLimitSize = false
  s.LR_export_colorSpace = "sRGB"
  s.LR_size_doConstrain = false
  s.LR_useWatermark = false
  s.LR_embeddedMetadataOption = "copyrightOnly"
  s.LR_removeLocationMetadata = true
  s.LR_removeFaceMetadata = true
end

-- ── collection settings ───────────────────────────────────────────

function provider.getCollectionBehaviorInfo()
  return {
    defaultCollectionName = "Client delivery",
    defaultCollectionCanBeDeleted = true,
    canAddCollection = true,
    maxCollectionSetDepth = 0,
  }
end

function provider.viewForCollectionSettings(f, publishSettings, info)
  local cs = info.collectionSettings
  if cs.email == nil then cs.email = "" end
  local linked = info.publishedCollection and info.publishedCollection:getRemoteId()
  return f:group_box {
    title = "Client delivery",
    fill_horizontal = 1,
    bind_to_object = cs,
    f:row { f:static_text { title = "Client email" }, f:edit_field { value = bind "email", width_in_chars = 32 } },
    f:row {
      f:static_text {
        title = linked and "Finals go into the client's gallery. Send them from /admin when they are all up."
          or "Not linked to a proof gallery: the first publish makes a new one. To use a proof gallery's selects, run Library > Plug-in Extras > Make delivery from selects.",
        fill_horizontal = 1, height_in_lines = 2,
      },
    },
  }
end

--- A changed email goes to the site straight away once the gallery exists.
function provider.updateCollectionSettings(publishSettings, info)
  local remote = info.publishedCollection and info.publishedCollection:getRemoteId()
  local email = info.collectionSettings and info.collectionSettings.email
  if remote and email and email ~= "" then Site.send("PATCH", nil, { token = remote, email = email }) end
end

-- ── publish ───────────────────────────────────────────────────────

function provider.processRenderedPhotos(functionContext, exportContext)
  local session = exportContext.exportSession
  local collection = exportContext.publishedCollection
  local cs = collection:getCollectionInfoSummary().collectionSettings or {}
  local count = session:countRenditions()
  local progress = exportContext:configureProgress {
    title = ("Uploading %d final%s to juliangigola.com"):format(count, count == 1 and "" or "s"),
  }

  local remote = collection:getRemoteId()
  if not remote then
    -- A delivery-only shoot: a new gallery, named by the shoot day like a proof gallery.
    local fields = { action = "create", name = collection:getName(), day = Site.day(session:photosToExport()) }
    if cs.email and cs.email ~= "" then fields.email = cs.email end
    remote = Site.send("POST", nil, fields).token
    session:recordRemoteCollectionId(remote)
  end

  local url
  for i, rendition in exportContext:renditions { stopIfCanceled = true } do
    progress:setPortionComplete((i - 1) / count)
    local ok, path = rendition:waitForRender()
    if ok then
      local photo = rendition.photo
      local id = tostring(photo.localIdentifier)
      local file = (photo:getFormattedMetadata("fileName") or (id .. ".jpg")):gsub("%.[^.]+$", "") .. ".jpg"
      local w, h = Image.measure(path)
      -- Capture time for shot order on the site: Lightroom counts from 2001, the site from 1970.
      local shot = photo:getRawMetadata("dateTimeOriginal")
      local q = ("?token=%s&id=%s&file=%s&w=%d&h=%d&t=%d&final=1"):format(enc(remote), enc(id), enc(file), w or 0, h or 0, shot and math.floor(shot + 978307200) or 0)
      -- A full-size final is tens of MB: ten minutes before giving up on a slow connection.
      local b, hd = LrHttp.post(Site.API .. q, Image.readBytes(path), Site.headers("image/jpeg"), "PUT", 600)
      LrFileUtils.delete(path)
      local pass, res = pcall(Site.check, b, hd, "upload " .. file)
      if pass then
        url = res.url or url
        rendition:recordPublishedPhotoId(id)
        if res.url then rendition:recordPublishedPhotoUrl(res.url) end
      else
        rendition:uploadFailed(res)
      end
    else
      rendition:uploadFailed(path)
    end
  end
  if url then session:recordRemoteCollectionUrl(url) end
  progress:done()
end

--- Finals off the site, one request per 200. The proofs and the gallery stay.
local function dropFinals(remote, ids)
  for i, list in ipairs(Shoot.idLists(ids, enc, 200)) do
    -- Each request rewrites the gallery's one KV record, and KV takes about one write per second per key.
    if i > 1 then LrTasks.sleep(1.1) end
    Site.send("DELETE", ("?token=%s&final=1&ids=%s"):format(enc(remote), list))
  end
end

function provider.deletePhotosFromPublishedCollection(publishSettings, arrayOfPhotoIds, deletedCallback, localCollectionId)
  local collection = LrApplication.activeCatalog():getPublishedCollectionByLocalIdentifier(localCollectionId)
  local remote = collection and collection:getRemoteId()
  if remote and #arrayOfPhotoIds > 0 then dropFinals(remote, arrayOfPhotoIds) end
  for _, id in ipairs(arrayOfPhotoIds) do deletedCallback(id) end
end

--- Deleting the Delivery collection takes its finals off the site, never the gallery: that is the proof gallery too.
function provider.deletePublishedCollection(publishSettings, info)
  local pc = info.publishedCollection
  if not (info.remoteId and pc) then return end
  local ids = {}
  for _, pp in ipairs(pc:getPublishedPhotos()) do
    local id = pp:getRemoteId()
    if id then ids[#ids + 1] = id end
  end
  if #ids > 0 then dropFinals(info.remoteId, ids) end
end

function provider.goToPublishedCollection(publishSettings, info)
  if info.remoteUrl then LrHttp.openUrlInBrowser(info.remoteUrl) end
end

-- ── Make delivery from selects ────────────────────────────────────

local function deliveryService(catalog)
  for _, service in ipairs(catalog:getPublishServices()) do
    if Site.ofPlugin(service) and Site.isDelivery(service) then return service end
  end
end

--- The proof galleries picked in the Library: the selected sources that are Client Gallery collections.
local function proofSources(catalog)
  local out = {}
  for _, src in ipairs(catalog:getActiveSources()) do
    if type(src) == "table" and src.type and src:type() == "LrPublishedCollection" and Site.isProofs(src:getService()) and src:getRemoteId() then
      out[#out + 1] = src
    end
  end
  return out
end

function provider.makeFromSelects()
  local catalog = LrApplication.activeCatalog()
  local service = deliveryService(catalog)
  if not service then
    LrDialogs.message("Make delivery from selects", "Add a Client Delivery service first: in the Publish Services panel, click + then Go to Publishing Manager, and add a juliangigola.com Client Delivery.")
    return
  end
  local sources = proofSources(catalog)
  if #sources == 0 then
    LrDialogs.message("Make delivery from selects", "Select a proof gallery under Client Gallery in the Publish Services panel first.")
    return
  end
  -- What the Delivery service holds already: a gallery made into a delivery before is reused, never re-pointed.
  local byRemote, names = {}, {}
  for _, c in ipairs(service:getChildCollections()) do
    if c:getRemoteId() then byRemote[c:getRemoteId()] = c end
    names[c:getName():lower()] = true
  end
  -- Read every gallery before the catalog write: no HTTP inside withWriteAccessDo.
  local plans, lines = {}, {}
  for _, pc in ipairs(sources) do
    local remote = pc:getRemoteId()
    local p = Site.fetch(remote).proof or {}
    local items = {}
    for _, pp in ipairs(pc:getPublishedPhotos()) do items[#items + 1] = { remoteId = pp:getRemoteId(), photo = pp:getPhoto() } end
    local photos = Shoot.picked(items, p.selects)
    local selects = #(p.selects or {})
    -- A different gallery under the same name (a repeat client) gets the gallery id on the end.
    local name = pc:getName()
    if not byRemote[remote] and names[name:lower()] then name = name .. " " .. remote end
    plans[#plans + 1] = { name = name, remote = remote, url = pc:getRemoteUrl(), photos = photos, email = p.email, existing = byRemote[remote] }
    lines[#lines + 1] = ("%s: %d of %d selects%s"):format(pc:getName(), #photos, selects,
      selects > #photos and (" (%d not in this catalog)"):format(selects - #photos) or "")
  end
  catalog:withWriteAccessDo("Make delivery from selects", function()
    for _, plan in ipairs(plans) do
      local c = plan.existing or service:createPublishedCollection(plan.name, nil, false)
      if not c then error(("Could not make a delivery named %s: a collection set already has that name."):format(plan.name), 0) end
      c:setRemoteId(plan.remote)
      if plan.url then c:setRemoteUrl(plan.url) end
      if plan.email then c:setCollectionSettings { email = plan.email } end
      if #plan.photos > 0 then c:addPhotos(plan.photos) end
    end
  end, { timeout = 30 })
  LrDialogs.message("Delivery ready to publish", table.concat(lines, "\n") ..
    "\n\nEdit the finals, then click Publish on the delivery under Client Delivery. Send them from /admin when they are all up.")
end

--- Both Plug-in Extras menus run this.
function provider.runMake()
  LrTasks.startAsyncTask(function()
    -- LrTasks.pcall: plain pcall cannot wrap LrHttp, which yields.
    local ok, err = LrTasks.pcall(provider.makeFromSelects)
    if not ok then LrDialogs.message("Make delivery from selects", tostring(err), "critical") end
  end)
end

return provider
