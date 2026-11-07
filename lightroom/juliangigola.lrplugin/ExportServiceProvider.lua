--[[
  File > Export > juliangigola.com.

  The dialog loads the live site: its disciplines, and the projects in the
  one picked. Export into an existing project, or name a new one. Either
  way the photographs and content/projects.json land in one commit, the
  push builds, and the site is live a few minutes later: /admin's upload,
  from Lightroom.
]]

local LrView = import "LrView"
local LrTasks = import "LrTasks"
local LrPasswords = import "LrPasswords"
local LrDialogs = import "LrDialogs"
local LrFileUtils = import "LrFileUtils"
local LrHttp = import "LrHttp"

local GitHub = require "GitHub"
local Manifest = require "Manifest"
local Json = require "Json"
local Image = require "Image"

local bind = LrView.bind
local share = LrView.share

local NEW = "__new"
local TOKEN_KEY = "github-token"
local SITE_URL = "https://juliangigola.com/portfolio/"

-- The site as last loaded, for the dialog's lists. The export itself reads
-- the repo again rather than trusting this.
local SITE

local provider = {}

provider.hideSections = { "exportLocation", "fileNaming", "fileSettings", "imageSettings", "video", "watermarking", "metadata" }
provider.allowFileFormats = { "JPEG" }
provider.allowColorSpaces = { "sRGB" }
provider.hidePrintResolution = true
provider.canExportVideo = false

provider.exportPresetFields = {
  { key = "discipline", default = "editorial" },
  { key = "project", default = NEW },
  { key = "newName", default = "" },
  { key = "credits", default = "Photographer: Julian Gigola @juliangigola" },
  { key = "atStart", default = false },
}

--- The archive's format, forced on every export: 2500px wide, never
--  enlarged, never cropped (each photo keeps its own proportions), sRGB,
--  quality 82, location and faces stripped.
function provider.updateExportSettings(s)
  s.LR_format = "JPEG"
  s.LR_jpeg_quality = 0.82
  s.LR_jpeg_useLimitSize = false
  s.LR_export_colorSpace = "sRGB"
  s.LR_size_doConstrain = true
  s.LR_size_doNotEnlarge = true
  s.LR_size_resizeType = "wh"
  s.LR_size_maxWidth = 2500
  s.LR_size_maxHeight = 65000
  s.LR_size_units = "pixels"
  s.LR_embeddedMetadataOption = "copyrightOnly"
  s.LR_removeLocationMetadata = true
  s.LR_removeFaceMetadata = true
  s.LR_useWatermark = false
end

-- ── the dialog ────────────────────────────────────────────────────

local function titleCase(s) return s:sub(1, 1):upper() .. s:sub(2):lower() end

local function trim(s) return ((s or ""):gsub("^%s+", ""):gsub("%s+$", "")) end

local function refreshProjects(props)
  local items = { { title = "New project", value = NEW } }
  if not SITE then
    if props.project ~= NEW then items[2] = { title = props.project, value = props.project } end
    props.projectItems = items
    return
  end
  local valid = props.project == NEW
  for _, p in ipairs(SITE.projects) do
    if p.discipline == props.discipline then
      items[#items + 1] = { title = p.name .. (p.hidden and "  (hidden)" or ""), value = p.slug }
      valid = valid or p.slug == props.project
    end
  end
  props.projectItems = items
  if not valid then props.project = NEW end
end

local function loadSite(props)
  LrTasks.startAsyncTask(function()
    local token = LrPasswords.retrieve(TOKEN_KEY)
    if not token or token == "" then
      props.status = "Paste the GitHub token /admin uses below, then Save."
      return
    end
    props.status = "Loading the site..."
    local ok, err = LrTasks.pcall(function()
      local doc = Json.decode(GitHub.read(token, "content/projects.json"))
      SITE = Manifest.site(doc, GitHub.read(token, "lib/work-data.ts"))
    end)
    if not ok then
      props.status = tostring(err)
      return
    end
    local items = {}
    for _, d in ipairs(SITE.disciplines) do items[#items + 1] = { title = titleCase(d.name), value = d.slug } end
    props.disciplineItems = items
    refreshProjects(props)
    props.status = ("%d projects on the site."):format(#SITE.projects)
  end)
end

function provider.startDialog(props)
  props.status = ""
  props.tokenEntry = ""
  props.disciplineItems = { { title = props.discipline, value = props.discipline } }
  refreshProjects(props)
  props:addObserver("discipline", function() refreshProjects(props) end)
  loadSite(props)
end

function provider.sectionsForTopOfDialog(f, props)
  local isNew = bind { key = "project", transform = function(v) return v == NEW end }
  local isExisting = bind { key = "project", transform = function(v) return v ~= NEW end }
  local label = function(title) return f:static_text { title = title, width = share "label", alignment = "right" } end

  return {
    {
      title = "juliangigola.com",
      synopsis = bind { key = "project", transform = function(v) return v == NEW and "New project" or v end },

      f:row { label "Discipline", f:popup_menu { value = bind "discipline", items = bind "disciplineItems", width_in_chars = 30 } },
      f:row { label "Project", f:popup_menu { value = bind "project", items = bind "projectItems", width_in_chars = 30 } },

      f:row { visible = isNew, label "Name", f:edit_field { value = bind "newName", width_in_chars = 30 } },
      f:row {
        visible = isNew,
        label "Credits",
        f:edit_field { value = bind "credits", width_in_chars = 40, height_in_lines = 4 },
      },
      f:row {
        visible = isNew,
        label "",
        f:static_text { title = "One per line, as Role: Name @instagram. The first photo is the cover." },
      },
      f:row {
        visible = isExisting,
        label "",
        f:checkbox { title = "Add at the start, so the first photo leads the project", value = bind "atStart" },
      },

      f:row { label "", f:static_text { title = bind "status", fill_horizontal = 1, width_in_chars = 50 } },
      f:separator { fill_horizontal = 1 },
      f:row {
        label "GitHub token",
        f:password_field { value = bind "tokenEntry", width_in_chars = 30 },
        f:push_button {
          title = "Save",
          action = function()
            local token = trim(props.tokenEntry)
            if token == "" then return end
            LrPasswords.store(TOKEN_KEY, token)
            props.tokenEntry = ""
            loadSite(props)
          end,
        },
      },
      f:row {
        label "",
        f:static_text {
          title = "Exported 2500px wide in sRGB, each photo in its own proportions.\nOne commit to the site; live in about three minutes.",
        },
      },
    },
  }
end

-- ── the export ────────────────────────────────────────────────────

function provider.processRenderedPhotos(functionContext, exportContext)
  local props = exportContext.propertyTable
  local count = exportContext.exportSession:countRenditions()
  local token = LrPasswords.retrieve(TOKEN_KEY)
  if not token or token == "" then error("No GitHub token yet. Paste it in the export dialog and press Save.", 0) end

  local progress = exportContext:configureProgress {
    title = ("Uploading %d photo%s to juliangigola.com"):format(count, count == 1 and "" or "s"),
  }

  local isNew = props.project == NEW
  local name = isNew and trim(props.newName) or nil

  -- Resolve the target against the repo as it is now, before spending time
  -- rendering, so a taken name or a vanished project fails straight away.
  local function resolve()
    local doc = Json.decode(GitHub.read(token, "content/projects.json"))
    local workData = GitHub.read(token, "lib/work-data.ts")
    local site = Manifest.site(doc, workData)
    if isNew then
      local slug, err = Manifest.checkNew(site, workData, name, props.discipline)
      if not slug then error(err, 0) end
      return doc, slug
    end
    local target = Manifest.findProject(site, props.project)
    if not target then error(('"%s" is no longer on the site. Pick the project again.'):format(props.project), 0) end
    return doc, target.slug, target
  end
  local _, slug, target = resolve()

  local stamp = Manifest.base36(os.time() * 1000)
  local files, frames, first = {}, {}, nil
  for i, rendition in exportContext:renditions { stopIfCanceled = true } do
    progress:setPortionComplete((i - 1) / count * 0.4)
    local ok, path = rendition:waitForRender()
    if ok then
      local w, h, color = Image.measure(path)
      local n = #frames + 1
      -- New projects number their frames as /admin does. Frames added to an
      -- existing project get /admin's `a<time>-<n>` names, which the
      -- harvester's 01.jpg, 02.jpg... can never collide with.
      local src = ("/work/%s/%s"):format(slug, isNew and ("%02d.jpg"):format(n) or ("a%s-%d.jpg"):format(stamp, n))
      files[#files + 1] = { path = "public" .. src, bytes = Image.readBytes(path) }
      frames[n] = Manifest.frame(src, w, h, color)
      if n == 1 and isNew then
        first = Image.cover(path)
      end
      LrFileUtils.delete(path)
    else
      rendition:uploadFailed(path)
    end
  end
  if #frames == 0 or progress:isCanceled() then return end

  if first then
    local w, h = Image.measure(first)
    files[#files + 1] = { path = ("public/work/%s/cover.jpg"):format(slug), bytes = Image.readBytes(first) }
    LrFileUtils.delete(first)
    first = Manifest.frame(("/work/%s/cover.jpg"):format(slug), w, h, frames[1].color)
  end

  -- Read the list again: /admin may have changed it while this rendered,
  -- and writing back the copy from before would undo that.
  local doc
  doc, slug, target = resolve()
  local message
  if isNew then
    Manifest.addProject(doc, {
      slug = slug,
      name = name,
      categorySlug = props.discipline,
      credits = Manifest.parseCredits(props.credits),
      cover = first,
      images = frames,
    })
    message = ("Add %s from Lightroom"):format(name)
  else
    Manifest.addFrames(doc, target, frames, props.atStart)
    message = ("Add %d photo%s to %s from Lightroom"):format(#frames, #frames == 1 and "" or "s", target.name)
  end
  files[#files + 1] = { path = "content/projects.json", text = Manifest.encode(doc) }

  GitHub.commit(token, message, files, function(done, total)
    progress:setPortionComplete(0.4 + 0.6 * done / total)
  end)
  progress:done()

  local answer = LrDialogs.confirm(
    message:gsub(" from Lightroom", "") .. ": done.",
    "The site rebuilds and is live in about three minutes.",
    "Open the project", "Close")
  if answer == "ok" then LrHttp.openUrlInBrowser(SITE_URL .. slug) end
end

return provider
