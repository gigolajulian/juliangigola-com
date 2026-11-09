--[[
  Publish Services > Client Gallery.

  Each published collection is one private client gallery at
  juliangigola.com/proof/<token>. Publish uploads ~2000px watermarked JPEGs,
  one at a time. Nothing is mailed from here: the gallery waits in
  /admin Leads until Julian hits Send.

  Publish again (or right-click > Refresh Comments) brings the client's
  selects back: a Purple label on each selected frame, their note in
  Comments, and a "<gallery> selects" collection under Client selects.

  Light on purpose (Lightroom must never lag): one JSON call per refresh,
  catalog writes batched in one write, no catalog scans.
]]

local LrHttp = import "LrHttp"
local LrView = import "LrView"
local LrDialogs = import "LrDialogs"
local LrPasswords = import "LrPasswords"
local LrFileUtils = import "LrFileUtils"
local LrApplication = import "LrApplication"
local LrDate = import "LrDate"

local Json = require "Json"
local Image = require "Image"

local bind = LrView.bind
local share = LrView.share

local SITE = "https://juliangigola.com"
local API = SITE .. "/api/proof"
-- The same GitHub token the website export saves; the site checks it can push to the repo.
local TOKEN_KEY = "github-token"
local LABEL = "purple"

local provider = {}

provider.supportsIncrementalPublish = "only"
provider.small_icon = "icon.png"
provider.hideSections = { "exportLocation", "fileNaming", "video" }
provider.allowFileFormats = { "JPEG" }
provider.allowColorSpaces = { "sRGB" }
provider.hidePrintResolution = true
provider.canExportVideo = false
provider.titleForPublishedCollection = "Gallery"
provider.titleForPublishedCollection_standalone = "Gallery"
provider.titleForGoToPublishedCollection = "Open gallery"
provider.titleForGoToPublishedPhoto = "disable"
provider.disableRenamePublishedCollection = false
provider.canAddCommentsToService = function() return false end
provider.titleForPhotoRating = "Selected"

provider.exportPresetFields = {}

--- Proof size: 2000px long edge, never enlarged, sRGB, quality 80. The
--  watermark section stays open so Julian picks his wordmark watermark.
function provider.updateExportSettings(s)
  s.LR_format = "JPEG"
  s.LR_jpeg_quality = 0.8
  s.LR_jpeg_useLimitSize = false
  s.LR_export_colorSpace = "sRGB"
  s.LR_size_doConstrain = true
  s.LR_size_doNotEnlarge = true
  s.LR_size_resizeType = "longEdge"
  s.LR_size_maxWidth = 2000
  s.LR_size_maxHeight = 2000
  s.LR_size_units = "pixels"
  s.LR_embeddedMetadataOption = "copyrightOnly"
  s.LR_removeLocationMetadata = true
  s.LR_removeFaceMetadata = true
end

-- ── the site ──────────────────────────────────────────────────────

local function token()
  local t = LrPasswords.retrieve(TOKEN_KEY)
  if not t or t == "" then
    error("No GitHub token yet. Open File > Export > juliangigola.com once, paste it and press Save.", 0)
  end
  return t
end

local function headers(contentType)
  return {
    { field = "Authorization", value = "Bearer " .. token() },
    { field = "Content-Type", value = contentType or "application/json" },
    { field = "User-Agent", value = "juliangigola-lightroom" },
  }
end

local function check(body, hdrs, what)
  local status = hdrs and tonumber(hdrs.status)
  if not status then error("Could not reach juliangigola.com (" .. what .. "). Check the connection and publish again.", 0) end
  if status == 401 then error("The site did not accept the GitHub token. Paste a new one in File > Export > juliangigola.com.", 0) end
  if status >= 300 then
    local msg = body and body:match('"error"%s*:%s*"([^"]*)"') or what
    error(("juliangigola.com said %d: %s"):format(status, msg), 0)
  end
  return body and body ~= "" and Json.decode(body) or {}
end

local function enc(s)
  return (tostring(s):gsub("[^%w%-%._~]", function(c) return ("%%%02X"):format(c:byte()) end))
end

local function send(method, query, fields)
  local o = Json.object()
  for k, v in pairs(fields or {}) do Json.set(o, k, v) end
  local b, h = LrHttp.post(API .. (query or ""), Json.encode(o), headers(), method, 60)
  return check(b, h, method .. " " .. (query or "gallery"))
end

local function fetch(galleryToken)
  local b, h = LrHttp.get(API .. "?token=" .. enc(galleryToken), headers(), 60)
  return check(b, h, "read gallery")
end

-- ── collection settings ───────────────────────────────────────────

local DEFAULTS = { email = "", note = "", included = 10, price = 15, days = 14 }

local function settings(cs)
  local out = {}
  for k, v in pairs(DEFAULTS) do
    local x = cs and cs[k]
    if x == nil then x = v end
    out[k] = x
  end
  return out
end

function provider.getCollectionBehaviorInfo()
  return {
    defaultCollectionName = "Client gallery",
    defaultCollectionCanBeDeleted = true,
    canAddCollection = true,
    maxCollectionSetDepth = 0,
  }
end

function provider.viewForCollectionSettings(f, publishSettings, info)
  local cs = info.collectionSettings
  for k, v in pairs(DEFAULTS) do if cs[k] == nil then cs[k] = v end end
  local label = function(t) return f:static_text { title = t, width = share "plabel", alignment = "right" } end
  return f:group_box {
    title = "Client gallery",
    fill_horizontal = 1,
    bind_to_object = cs,
    f:row { label "Client email", f:edit_field { value = bind "email", width_in_chars = 32 } },
    f:row { label "Note in the email", f:edit_field { value = bind "note", width_in_chars = 32, height_in_lines = 3 } },
    f:row {
      label "Included frames", f:edit_field { value = bind "included", width_in_digits = 4, min = 0, max = 500, precision = 0 },
      f:static_text { title = "Each extra $" }, f:edit_field { value = bind "price", width_in_digits = 4, min = 0, max = 500, precision = 0 },
    },
    f:row { label "Open for", f:edit_field { value = bind "days", width_in_digits = 3, min = 1, max = 90, precision = 0 }, f:static_text { title = "days, from when you send it in /admin" } },
    f:row { label "", f:static_text { title = "Selects come back as a Purple label and Comments when you publish again.", fill_horizontal = 1 } },
  }
end

--- Saved settings go to the site straight away once the gallery exists.
function provider.updateCollectionSettings(publishSettings, info)
  local remote = info.publishedCollection and info.publishedCollection:getRemoteId()
  if not remote then return end
  local s = settings(info.collectionSettings)
  send("PATCH", nil, { token = remote, name = info.name, email = s.email, note = s.note, included = s.included, price = s.price, days = s.days })
end

-- ── publish ───────────────────────────────────────────────────────

function provider.processRenderedPhotos(functionContext, exportContext)
  local session = exportContext.exportSession
  local collection = exportContext.publishedCollection
  local info = collection:getCollectionInfoSummary()
  local s = settings(info.collectionSettings)
  local count = session:countRenditions()
  local progress = exportContext:configureProgress {
    title = ("Uploading %d proof%s to juliangigola.com"):format(count, count == 1 and "" or "s"),
  }

  local remote = collection:getRemoteId()
  local fields = { name = collection:getName(), email = s.email, note = s.note, included = s.included, price = s.price, days = s.days }
  local url
  if not remote then
    fields.action = "create"
    local made = send("POST", nil, fields)
    remote, url = made.token, made.url
    session:recordRemoteCollectionId(remote)
    session:recordRemoteCollectionUrl(url)
  else
    fields.token = remote
    url = SITE .. "/proof/" .. remote
    send("PATCH", nil, fields)
  end

  for i, rendition in exportContext:renditions { stopIfCanceled = true } do
    progress:setPortionComplete((i - 1) / count)
    local ok, path = rendition:waitForRender()
    if ok then
      local photo = rendition.photo
      local id = tostring(photo.localIdentifier)
      local file = (photo:getFormattedMetadata("fileName") or (id .. ".jpg")):gsub("%.[^.]+$", "") .. ".jpg"
      local w, h = Image.measure(path)
      local q = ("?token=%s&id=%s&file=%s&w=%d&h=%d"):format(enc(remote), enc(id), enc(file), w or 0, h or 0)
      local b, hd = LrHttp.post(API .. q, Image.readBytes(path), headers("image/jpeg"), "PUT", 300)
      LrFileUtils.delete(path)
      local pass, err = pcall(check, b, hd, "upload " .. file)
      if pass then
        rendition:recordPublishedPhotoId(id)
        rendition:recordPublishedPhotoUrl(url)
      else
        rendition:uploadFailed(err)
      end
    else
      rendition:uploadFailed(path)
    end
  end
  progress:done()
end

function provider.deletePhotosFromPublishedCollection(publishSettings, arrayOfPhotoIds, deletedCallback, localCollectionId)
  local collection = LrApplication.activeCatalog():getPublishedCollectionByLocalIdentifier(localCollectionId)
  local remote = collection and collection:getRemoteId()
  -- One request for all of them: the gallery is one record, written once.
  if remote and #arrayOfPhotoIds > 0 then
    local ids = {}
    for i, id in ipairs(arrayOfPhotoIds) do ids[i] = enc(id) end
    send("DELETE", ("?token=%s&ids=%s"):format(enc(remote), table.concat(ids, ",")))
  end
  for _, id in ipairs(arrayOfPhotoIds) do deletedCallback(id) end
end

--- Deleting the gallery in Lightroom takes it off the site (web previews only).
function provider.deletePublishedCollection(publishSettings, info)
  if info.remoteId then send("DELETE", "?token=" .. enc(info.remoteId)) end
end

function provider.goToPublishedCollection(publishSettings, info)
  if info.remoteUrl then LrHttp.openUrlInBrowser(info.remoteUrl) end
end

-- ── the selects, back into Lightroom ──────────────────────────────

-- One read per refresh: both hooks ask for the same gallery.
local cache = {}
local function gallery(remote)
  local hit = cache[remote]
  if hit and LrDate.currentTime() - hit.at < 30 then return hit.proof end
  local p = fetch(remote).proof
  cache[remote] = { at = LrDate.currentTime(), proof = p }
  return p
end

-- LrPublishedPhoto has no way back to its collection, so find the
-- gallery of this service that holds the first photo.
-- shortcut: a frame in two proof galleries reads the first one; match on remoteId if that ever happens.
local function remoteOf(arrayOfPhotoInfo)
  local first = arrayOfPhotoInfo[1]
  if not (first and first.photo) then return end
  for _, pc in ipairs(first.photo:getContainedPublishedCollections()) do
    if pc:getService():getPluginId() == _PLUGIN.id and pc:getRemoteId() then
      return pc:getRemoteId(), pc:getName()
    end
  end
end

function provider.getCommentsFromPublishedCollection(publishSettings, arrayOfPhotoInfo, commentCallback)
  local remote = remoteOf(arrayOfPhotoInfo)
  if not remote then return end
  local p = gallery(remote)
  local notes = p.notes or {}
  local when = LrDate.currentTime()
  for _, info in ipairs(arrayOfPhotoInfo) do
    local text = notes[info.remoteId]
    commentCallback {
      publishedPhoto = info,
      comments = text and { { commentId = remote .. ":" .. info.remoteId, commentText = text, dateCreated = when, username = "client", realname = "Client" } } or {},
    }
  end
end

function provider.getRatingsFromPublishedCollection(publishSettings, arrayOfPhotoInfo, ratingCallback)
  local remote, name = remoteOf(arrayOfPhotoInfo)
  if not remote then return end
  local p = gallery(remote)
  local selected = {}
  for _, id in ipairs(p.selects or {}) do selected[id] = true end

  local picked = {}
  for _, info in ipairs(arrayOfPhotoInfo) do
    local on = selected[info.remoteId] == true
    ratingCallback { publishedPhoto = info, rating = on and 1 or 0 }
    if on then picked[#picked + 1] = info.photo end
  end
  if #picked == 0 then return end

  -- One catalog write for every label and the Selects collection.
  local catalog = LrApplication.activeCatalog()
  catalog:withWriteAccessDo("Client selects from juliangigola.com", function()
    for _, photo in ipairs(picked) do photo:setRawMetadata("colorNameForLabel", LABEL) end
    local set = catalog:createCollectionSet("Client selects", nil, true)
    local c = catalog:createCollection((name or "Gallery") .. " selects", set, true)
    c:addPhotos(picked)
  end, { timeout = 30 })
end

return provider
