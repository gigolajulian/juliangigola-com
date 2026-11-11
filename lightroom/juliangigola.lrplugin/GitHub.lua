--[[
  The same GitHub calls /admin makes (lib/admin-github.ts), from Lightroom.

  Every publish lands as one commit through the Git Data API: blobs, a tree
  on top of the branch head, a commit, then a non-forced move of `main`. One
  commit is one build on Workers Builds, and the manifest is never in the
  repo describing files that are not.
]]

local LrHttp = import "LrHttp"
local LrStringUtils = import "LrStringUtils"
local Json = require "Json"

local G = {}

local BRANCH = "main"
local API = "https://api.github.com/repos/gigolajulian/juliangigola-com"

local function headers(token, accept, json)
  local h = {
    { field = "Authorization", value = "Bearer " .. token },
    { field = "Accept", value = accept or "application/vnd.github+json" },
    { field = "X-GitHub-Api-Version", value = "2022-11-28" },
    { field = "User-Agent", value = "juliangigola-lightroom" },
  }
  if json then h[#h + 1] = { field = "Content-Type", value = "application/json" } end
  return h
end

local function check(body, hdrs, what)
  local status = hdrs and tonumber(hdrs.status)
  if not status then
    error("Could not reach GitHub (" .. what .. "). Check the connection and publish again.", 0)
  end
  if status == 401 then
    error("GitHub rejected the token. It has probably expired: paste a new one in the publish service settings.", 0)
  end
  if status >= 300 then
    local msg = body and body:match('"message"%s*:%s*"([^"]*)"') or what
    if status == 403 then msg = msg .. ". The token needs Contents: read and write on this repo" end
    if status == 422 and what:find("refs") then
      msg = "the site changed while this was uploading (probably an /admin edit). Publish again"
    end
    error(("GitHub said %d: %s."):format(status, msg), 0)
  end
  return status
end

local function call(token, method, path, body)
  local b, h
  if method == "GET" then
    b, h = LrHttp.get(API .. path, headers(token), 60)
  else
    b, h = LrHttp.post(API .. path, Json.encode(body), headers(token, nil, true), method, 600)
  end
  check(b, h, path)
  return Json.decode(b)
end

--- A folder at the branch head: { { name, type, sha }, ... }.
function G.list(token, path)
  return call(token, "GET", "/contents/" .. path .. "?ref=" .. BRANCH)
end

--- A file at the branch head, as raw bytes. nil when it does not exist.
function G.read(token, path)
  local b, h = LrHttp.get(API .. "/contents/" .. path .. "?ref=" .. BRANCH,
    headers(token, "application/vnd.github.raw+json"), 120)
  if h and tonumber(h.status) == 404 then return nil end
  check(b, h, path)
  return b
end

--- Writes and removes files in one commit.
--  files: { { path = "public/work/x/a.jpg", bytes = "..." } | { path = ..., text = "..." } | { path = ..., remove = true } }
function G.commit(token, message, files, onProgress)
  local parent = call(token, "GET", "/git/ref/heads/" .. BRANCH).object.sha
  local baseTree = call(token, "GET", "/git/commits/" .. parent).tree.sha

  local tree = Json.array()
  for i, f in ipairs(files) do
    local entry = Json.object()
    Json.set(entry, "path", f.path)
    Json.set(entry, "mode", "100644")
    Json.set(entry, "type", "blob")
    if f.remove then
      -- A null sha is how a tree says "delete this path".
      Json.set(entry, "sha", Json.null)
    else
      local blob = Json.object()
      if f.bytes then
        Json.set(blob, "content", LrStringUtils.encodeBase64(f.bytes))
        Json.set(blob, "encoding", "base64")
      else
        Json.set(blob, "content", f.text)
        Json.set(blob, "encoding", "utf-8")
      end
      Json.set(entry, "sha", call(token, "POST", "/git/blobs", blob).sha)
    end
    tree[#tree + 1] = entry
    if onProgress then onProgress(i, #files) end
  end

  local treeBody = Json.object()
  Json.set(treeBody, "base_tree", baseTree)
  Json.set(treeBody, "tree", tree)
  local newTree = call(token, "POST", "/git/trees", treeBody).sha

  local commitBody = Json.object()
  Json.set(commitBody, "message", message)
  Json.set(commitBody, "tree", newTree)
  Json.set(commitBody, "parents", Json.array({ parent }))
  local sha = call(token, "POST", "/git/commits", commitBody).sha

  -- Not forced: if main moved while the blobs uploaded, fail rather than
  -- throw away whatever arrived in the meantime.
  local ref = Json.object()
  Json.set(ref, "sha", sha)
  Json.set(ref, "force", false)
  call(token, "PATCH", "/git/refs/heads/" .. BRANCH, ref)
  return sha
end

return G
