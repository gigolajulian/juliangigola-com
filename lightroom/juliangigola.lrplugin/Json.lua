--[[
  JSON that keeps its key order.

  content/projects.json is written by /admin as JSON.stringify(doc, null, 2).
  A Lua table forgets the order of its keys, so a plain decode and encode
  would reshuffle every project and turn a one-line change into a diff of the
  whole file. Objects here carry their key order with them, and the encoder
  writes exactly what JSON.stringify writes, so an untouched file round-trips
  byte for byte.
]]

local Json = {}

local KEYS = {}
local ARRAY = {}

Json.null = setmetatable({}, { __tostring = function() return "null" end })

function Json.object() return { [KEYS] = {} } end

function Json.array(t)
  t = t or {}
  t[ARRAY] = true
  return t
end

function Json.isArray(v) return type(v) == "table" and v[ARRAY] == true end

function Json.remove(o, k)
  if o[k] == nil then return end
  o[k] = nil
  for i, key in ipairs(o[KEYS]) do
    if key == k then
      table.remove(o[KEYS], i)
      return
    end
  end
end

function Json.set(o, k, v)
  if v == nil then return Json.remove(o, k) end
  if o[k] == nil then table.insert(o[KEYS], k) end
  o[k] = v
end

-- ── decode ────────────────────────────────────────────────────────

local function fail(i, msg) error(("JSON: %s at byte %d"):format(msg, i), 0) end

local function skip(s, i) return s:find("[^ \t\r\n]", i) or #s + 1 end

local function utf8char(c)
  if c < 0x80 then return string.char(c) end
  if c < 0x800 then return string.char(0xC0 + math.floor(c / 64), 0x80 + c % 64) end
  if c < 0x10000 then
    return string.char(0xE0 + math.floor(c / 4096), 0x80 + math.floor(c / 64) % 64, 0x80 + c % 64)
  end
  return string.char(0xF0 + math.floor(c / 262144), 0x80 + math.floor(c / 4096) % 64,
    0x80 + math.floor(c / 64) % 64, 0x80 + c % 64)
end

local UNESCAPE = { ['"'] = '"', ["\\"] = "\\", ["/"] = "/", b = "\b", f = "\f", n = "\n", r = "\r", t = "\t" }

local function parseString(s, i)
  local out, j = {}, i + 1
  while true do
    local k = s:find('["\\]', j)
    if not k then fail(i, "unterminated string") end
    out[#out + 1] = s:sub(j, k - 1)
    if s:sub(k, k) == '"' then return table.concat(out), k + 1 end
    local e = s:sub(k + 1, k + 1)
    if e == "u" then
      local c = tonumber(s:sub(k + 2, k + 5), 16) or fail(k, "bad \\u escape")
      j = k + 6
      if c >= 0xD800 and c < 0xDC00 and s:sub(j, j + 1) == "\\u" then
        local lo = tonumber(s:sub(j + 2, j + 5), 16)
        c = 0x10000 + (c - 0xD800) * 1024 + (lo - 0xDC00)
        j = j + 6
      end
      out[#out + 1] = utf8char(c)
    else
      out[#out + 1] = UNESCAPE[e] or fail(k, "bad escape")
      j = k + 2
    end
  end
end

local parse

parse = function(s, i)
  i = skip(s, i)
  local c = s:sub(i, i)

  if c == "{" then
    local o = Json.object()
    i = skip(s, i + 1)
    if s:sub(i, i) == "}" then return o, i + 1 end
    while true do
      if s:sub(i, i) ~= '"' then fail(i, "expected a key") end
      local k, v
      k, i = parseString(s, i)
      i = skip(s, i)
      if s:sub(i, i) ~= ":" then fail(i, "expected :") end
      v, i = parse(s, i + 1)
      Json.set(o, k, v)
      i = skip(s, i)
      local d = s:sub(i, i)
      if d == "}" then return o, i + 1 end
      if d ~= "," then fail(i, "expected , or }") end
      i = skip(s, i + 1)
    end
  end

  if c == "[" then
    local a = Json.array()
    i = skip(s, i + 1)
    if s:sub(i, i) == "]" then return a, i + 1 end
    while true do
      local v
      v, i = parse(s, i)
      a[#a + 1] = v
      i = skip(s, i)
      local d = s:sub(i, i)
      if d == "]" then return a, i + 1 end
      if d ~= "," then fail(i, "expected , or ]") end
      i = i + 1
    end
  end

  if c == '"' then return parseString(s, i) end
  if s:sub(i, i + 3) == "true" then return true, i + 4 end
  if s:sub(i, i + 4) == "false" then return false, i + 5 end
  if s:sub(i, i + 3) == "null" then return Json.null, i + 4 end

  local num = s:match("^-?%d+%.?%d*[eE]?[-+]?%d*", i)
  if num and num ~= "" then return tonumber(num), i + #num end
  fail(i, "unexpected character")
end

function Json.decode(s)
  local v, i = parse(s, 1)
  if skip(s, i) <= #s then fail(i, "trailing characters") end
  return v
end

-- ── encode, as JSON.stringify(v, null, 2) ────────────────────────

local ESCAPE = { ['"'] = '\\"', ["\\"] = "\\\\", ["\b"] = "\\b", ["\f"] = "\\f", ["\n"] = "\\n", ["\r"] = "\\r", ["\t"] = "\\t" }

local function encodeString(s)
  return '"' .. (s:gsub('[%z\1-\31"\\]', function(ch)
    return ESCAPE[ch] or ("\\u%04x"):format(ch:byte())
  end)) .. '"'
end

local function encodeNumber(n)
  if n == math.floor(n) and math.abs(n) < 2 ^ 53 then return ("%d"):format(n) end
  for p = 15, 17 do
    local out = ("%." .. p .. "g"):format(n)
    if tonumber(out) == n then return out end
  end
end

local encode

encode = function(v, indent)
  if v == Json.null then return "null" end
  local t = type(v)
  if t == "string" then return encodeString(v) end
  if t == "number" then return encodeNumber(v) end
  if t == "boolean" then return tostring(v) end

  local inner = indent .. "  "
  local parts = {}
  if Json.isArray(v) then
    if #v == 0 then return "[]" end
    for i = 1, #v do parts[i] = inner .. encode(v[i], inner) end
    return "[\n" .. table.concat(parts, ",\n") .. "\n" .. indent .. "]"
  end

  local keys = v[KEYS] or error("Json.encode: a table that is not a Json.object or Json.array", 0)
  if #keys == 0 then return "{}" end
  for i, k in ipairs(keys) do parts[i] = inner .. encodeString(k) .. ": " .. encode(v[k], inner) end
  return "{\n" .. table.concat(parts, ",\n") .. "\n" .. indent .. "}"
end

function Json.encode(v) return encode(v, "") end

return Json
