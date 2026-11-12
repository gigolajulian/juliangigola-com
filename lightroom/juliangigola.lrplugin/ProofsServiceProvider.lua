--[[
  Publish Services > Client Gallery.

  Each published collection is one private client gallery at
  juliangigola.com/proof/<token>. Publish uploads ~2000px watermarked JPEGs,
  one at a time. Nothing is mailed from here: the gallery waits in
  /admin Leads until Julian hits Send.

  Library > Plug-in Extras > Sync with proof (or Publish again) mirrors the
  client's selects, sent or not: the Pick flag and a Purple label on each
  selected frame, and a "<gallery> selects" collection under Client selects.
  A frame the client unpicks loses both and leaves that collection. Their
  notes land in Comments on Publish or right-click > Refresh Comments.

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
local LrTasks = import "LrTasks"

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
-- Proofs carry pixels and a file name only: labels, flags and other metadata (the client's picks
-- included) never mark a frame for re-publish. Develop edits still do.
function provider.metadataThatTriggersRepublish()
  return { default = false }
end

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

local GallerySettings = require "GallerySettings"

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
  GallerySettings.fill(cs, not (info.publishedCollection and info.publishedCollection:getRemoteId()))
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
      f:checkbox { title = "Watermark", value = bind "watermark", tooltip = "Julian Gigola in the bottom third of every frame. The clean files stay for finals." },
    },
    f:row { label "Open for", f:edit_field { value = bind "days", width_in_digits = 3, min = 1, max = 90, precision = 0 }, f:static_text { title = "days, from when you send it in /admin" } },
    f:row { label "", f:static_text { title = "Selects come back flagged with a Purple label: Library > Plug-in Extras > Sync with proof, or publish again.", fill_horizontal = 1 } },
  }
end

--- Saved settings go to the site straight away once the gallery exists.
function provider.updateCollectionSettings(publishSettings, info)
  local remote = info.publishedCollection and info.publishedCollection:getRemoteId()
  if not remote then return end
  local s = GallerySettings.fields(info.collectionSettings, false)
  s.token, s.name = remote, info.name
  send("PATCH", nil, s)
end

-- ── publish ───────────────────────────────────────────────────────

function provider.processRenderedPhotos(functionContext, exportContext)
  local session = exportContext.exportSession
  local collection = exportContext.publishedCollection
  local info = collection:getCollectionInfoSummary()
  local count = session:countRenditions()
  local progress = exportContext:configureProgress {
    title = ("Uploading %d proof%s to juliangigola.com"):format(count, count == 1 and "" or "s"),
  }

  local remote = collection:getRemoteId()
  local fields = GallerySettings.fields(info.collectionSettings, not remote)
  fields.name = collection:getName()
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
      -- Capture time for shot order and looks on the site: Lightroom counts from 2001, the site from 1970.
      local shot = photo:getRawMetadata("dateTimeOriginal")
      local q = ("?token=%s&id=%s&file=%s&w=%d&h=%d&t=%d"):format(enc(remote), enc(id), enc(file), w or 0, h or 0, shot and math.floor(shot + 978307200) or 0)
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

-- Lightroom ids each service of a plugin as "<toolkit id>.<n>" (com.juliangigola.export.2), so match the prefix.
local function ours(service)
  local id = tostring(service:getPluginId())
  return id == _PLUGIN.id or id:sub(1, #_PLUGIN.id + 1) == _PLUGIN.id .. "."
end

-- LrPublishedPhoto has no way back to its collection, so find the
-- gallery of this service that holds the first photo.
-- shortcut: a frame in two proof galleries reads the first one; match on remoteId if that ever happens.
local function remoteOf(arrayOfPhotoInfo)
  local first = arrayOfPhotoInfo[1]
  if not (first and first.photo) then return end
  for _, pc in ipairs(first.photo:getContainedPublishedCollections()) do
    if ours(pc:getService()) and pc:getRemoteId() then
      return pc:getRemoteId(), pc:getName()
    end
  end
end

-- One catalog write for every gallery, mirroring the site: picks get the Pick flag, a Purple
-- label and "<gallery> selects"; the rest (g.others) lose them. Only a Purple label is cleared,
-- so a label Julian set by hand stays, and a frame picked in any gallery is never cleared.
-- Safe to run twice. Returns the selects collections that hold picks.
local function syncPicks(galleries)
  local made = {}
  local picked, any = {}, false
  for _, g in ipairs(galleries) do
    for _, photo in ipairs(g.photos) do picked[photo.localIdentifier] = true end
    any = any or #g.photos > 0 or #(g.others or {}) > 0
  end
  if not any then return made end
  local catalog = LrApplication.activeCatalog()
  catalog:withWriteAccessDo("Client selects from juliangigola.com", function()
    local set = catalog:createCollectionSet("Client selects", nil, true)
    local existing = {}
    for _, c in ipairs(set:getChildCollections()) do existing[c:getName()] = c end
    for _, g in ipairs(galleries) do
      local name = (g.name or "Gallery") .. " selects"
      local c = existing[name]
      if #g.photos > 0 then
        for _, photo in ipairs(g.photos) do
          photo:setRawMetadata("colorNameForLabel", LABEL)
          photo:setRawMetadata("pickStatus", 1)
        end
        c = c or catalog:createCollection(name, set, true)
        c:addPhotos(g.photos)
        made[#made + 1] = c
      end
      local drop = {}
      for _, photo in ipairs(g.others or {}) do
        if not picked[photo.localIdentifier] then
          if photo:getRawMetadata("colorNameForLabel") == LABEL then
            photo:setRawMetadata("colorNameForLabel", "none")
            if photo:getRawMetadata("pickStatus") == 1 then photo:setRawMetadata("pickStatus", 0) end
          end
          drop[#drop + 1] = photo
        end
      end
      if c and #drop > 0 then c:removePhotos(drop) end
    end
  end, { timeout = 30 })
  return made
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

  local picked, others = {}, {}
  for _, info in ipairs(arrayOfPhotoInfo) do
    local on = selected[info.remoteId] == true
    ratingCallback { publishedPhoto = info, rating = on and 1 or 0 }
    if on then picked[#picked + 1] = info.photo else others[#others + 1] = info.photo end
  end
  syncPicks { { name = name, photos = picked, others = others } }
end

--- Library > Plug-in Extras > Sync with proof: every gallery of this
--  plugin, one read each, nothing published. Picks not sent yet count too. Run inside an async task.
function provider.checkForPicks()
  local catalog = LrApplication.activeCatalog()
  local found, lines, failed, why = {}, {}, {}, nil
  local checked = 0
  -- Every gallery of this plugin's services, at any depth.
  local all = {}
  local function walk(node)
    for _, pc in ipairs(node:getChildCollections()) do all[#all + 1] = pc end
    for _, set in ipairs(node:getChildCollectionSets()) do walk(set) end
  end
  for _, service in ipairs(catalog:getPublishServices()) do
    if ours(service) then walk(service) end
  end
  do
    for _, pc in ipairs(all) do
      local remote = pc:getRemoteId()
      if remote then
        -- LrTasks.pcall: plain pcall cannot wrap LrHttp, which yields.
        local ok, p = LrTasks.pcall(gallery, remote)
        checked = checked + 1
        if not ok then
          failed[#failed + 1], why = pc:getName(), tostring(p)
        else
          local selects = p.selects or {}
          local want = {}
          for _, id in ipairs(selects) do want[id] = true end
          local picked, others = {}, {}
          for _, pp in ipairs(pc:getPublishedPhotos()) do
            if want[pp:getRemoteId()] then picked[#picked + 1] = pp:getPhoto() else others[#others + 1] = pp:getPhoto() end
          end
          found[#found + 1] = { name = pc:getName(), photos = picked, others = others }
          if #selects > 0 then
            -- Frames taken out of the Lightroom gallery after sending can't be flagged: say so.
            local missing = #selects - #picked
            lines[#lines + 1] = ("%s: %d %s%s%s"):format(pc:getName(), #selects, #selects == 1 and "pick" or "picks",
              p.submittedAt and "" or " (not sent yet)",
              missing > 0 and (" (%d not in this catalog)"):format(missing) or "")
          end
        end
      end
    end
  end
  local made = syncPicks(found)
  local info = table.concat(lines, "\n")
  if #failed > 0 then info = info .. "\n\nCould not read " .. table.concat(failed, ", ") .. ": " .. why end
  if #made == 0 then
    if info == "" then
      info = checked == 0 and "No client galleries in this catalog yet." or ("Checked %d %s."):format(checked, checked == 1 and "gallery" or "galleries")
    end
    LrDialogs.message(#lines > 0 and "Client picks" or "No picks yet", info)
  elseif LrDialogs.confirm("Client picks", info .. "\n\nPicks flagged with a Purple label. Unpicked frames cleared.", "Show selects", "Close") == "ok" then
    catalog:setActiveSources(made)
  end
end

--- Every entry point (both Plug-in Extras menus, the Plug-in Manager button) runs this.
function provider.runCheck()
  LrTasks.startAsyncTask(function()
    -- LrTasks.pcall: plain pcall cannot wrap LrHttp, which yields.
    local ok, err = LrTasks.pcall(provider.checkForPicks)
    if not ok then LrDialogs.message("Sync with proof", tostring(err), "critical") end
  end)
end

return provider
