--[[
  Measuring a rendered frame, and cutting the 600px cover, with ffmpeg.

  Lightroom's SDK cannot read pixels, so the two numbers /admin gets from a
  canvas come from ffmpeg instead:

    - the size, from ffprobe;
    - the mean colour, the mat drawn behind the frame: a 32x32 RGB
      reduction averaged here, the same method as lib/admin-image.ts.
      Measured against sharp's mean on three archive frames it lands within
      1/255. A straight 1x1 scale was up to 7/255 off.
]]

local LrTasks = import "LrTasks"
local LrPathUtils = import "LrPathUtils"
local LrFileUtils = import "LrFileUtils"

local I = {}

local function temp(ext)
  return LrPathUtils.child(LrPathUtils.getStandardFilePath("temp"),
    ("jg-%d-%d.%s"):format(os.time(), math.random(1e9), ext))
end

local function run(cmd)
  -- cmd.exe strips the first and last quote of a line that starts with one,
  -- so the whole line gets a pair of its own and the paths keep theirs.
  local code = LrTasks.execute(WIN_ENV and ('"' .. cmd .. '"') or cmd)
  if code == 9009 or code == 127 then
    error("ffmpeg was not found. It has to be on PATH; if it was installed while Lightroom was open, restart Lightroom.", 0)
  end
  if code ~= 0 then error("ffmpeg failed (" .. tostring(code) .. "): " .. cmd, 0) end
end

function I.readBytes(path)
  local f = assert(io.open(path, "rb"))
  local bytes = f:read("*a")
  f:close()
  return bytes
end

function I.writeBytes(path, bytes)
  local f = assert(io.open(path, "wb"))
  f:write(bytes)
  f:close()
end

--- width, height, "#RRGGBB"
function I.measure(path)
  local dims, raw = temp("txt"), temp("rgb")
  run(('ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "%s" > "%s"')
    :format(path, dims))
  run(('ffmpeg -v error -y -i "%s" -vf "format=rgb24,scale=32:32:flags=area" -f rawvideo "%s"'):format(path, raw))

  local w, h = I.readBytes(dims):match("(%d+)x(%d+)")
  local px = I.readBytes(raw)
  LrFileUtils.delete(dims)
  LrFileUtils.delete(raw)

  local sum = { 0, 0, 0 }
  for i = 1, #px do
    local c = (i - 1) % 3 + 1
    sum[c] = sum[c] + px:byte(i)
  end
  local n = #px / 3
  local color = ("#%02X%02X%02X"):format(math.floor(sum[1] / n + 0.5), math.floor(sum[2] / n + 0.5),
    math.floor(sum[3] / n + 0.5))
  return tonumber(w), tonumber(h), color
end

--- The 600px cover, as /admin cuts it from the first frame. Returns its path.
function I.cover(path)
  local out = temp("jpg")
  run(('ffmpeg -v error -y -i "%s" -vf "scale=600:-1:flags=lanczos" -q:v 2 "%s"'):format(path, out))
  return out
end

I.temp = temp

return I
