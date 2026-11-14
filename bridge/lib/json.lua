-- Decoder/encoder JSON mínimo para LuaJIT (Lua 5.1).
-- Suficiente para partida.json / resultado.json: objetos, arrays, strings,
-- números, true/false/null. Strings com \uXXXX são convertidas para UTF-8.

local json = {}

local function utf8_char(cp)
  if cp < 0x80 then return string.char(cp) end
  if cp < 0x800 then
    return string.char(0xC0 + math.floor(cp / 0x40), 0x80 + cp % 0x40)
  end
  if cp < 0x10000 then
    return string.char(0xE0 + math.floor(cp / 0x1000),
      0x80 + math.floor(cp / 0x40) % 0x40, 0x80 + cp % 0x40)
  end
  return string.char(0xF0 + math.floor(cp / 0x40000),
    0x80 + math.floor(cp / 0x1000) % 0x40,
    0x80 + math.floor(cp / 0x40) % 0x40, 0x80 + cp % 0x40)
end

local escapes = { b = "\b", f = "\f", n = "\n", r = "\r", t = "\t", ['"'] = '"', ["\\"] = "\\", ["/"] = "/" }

function json.decode(str)
  local pos = 1

  local function err(msg)
    error(string.format("JSON inválido na posição %d: %s", pos, msg), 0)
  end

  local function skip()
    pos = str:find("[^ \t\r\n]", pos) or (#str + 1)
  end

  local value

  local function parse_string()
    pos = pos + 1 -- pula a aspa
    local out = {}
    while true do
      local c = str:sub(pos, pos)
      if c == "" then err("string não terminada") end
      if c == '"' then pos = pos + 1; break end
      if c == "\\" then
        local e = str:sub(pos + 1, pos + 1)
        if e == "u" then
          local cp = tonumber(str:sub(pos + 2, pos + 5), 16) or err("\\u inválido")
          pos = pos + 6
          -- par substituto (surrogate pair)
          if cp >= 0xD800 and cp <= 0xDBFF and str:sub(pos, pos + 1) == "\\u" then
            local lo = tonumber(str:sub(pos + 2, pos + 5), 16)
            if lo and lo >= 0xDC00 and lo <= 0xDFFF then
              cp = 0x10000 + (cp - 0xD800) * 0x400 + (lo - 0xDC00)
              pos = pos + 6
            end
          end
          out[#out + 1] = utf8_char(cp)
        else
          out[#out + 1] = escapes[e] or err("escape inválido")
          pos = pos + 2
        end
      else
        out[#out + 1] = c
        pos = pos + 1
      end
    end
    return table.concat(out)
  end

  local function parse_number()
    local s, e = str:find("^-?%d+%.?%d*[eE]?[-+]?%d*", pos)
    if not s then err("número inválido") end
    local n = tonumber(str:sub(s, e)) or err("número inválido")
    pos = e + 1
    return n
  end

  local function parse_array()
    pos = pos + 1
    local arr = {}
    skip()
    if str:sub(pos, pos) == "]" then pos = pos + 1; return arr end
    while true do
      arr[#arr + 1] = value()
      skip()
      local c = str:sub(pos, pos)
      pos = pos + 1
      if c == "]" then return arr end
      if c ~= "," then err("esperava ',' ou ']'") end
    end
  end

  local function parse_object()
    pos = pos + 1
    local obj = {}
    skip()
    if str:sub(pos, pos) == "}" then pos = pos + 1; return obj end
    while true do
      skip()
      if str:sub(pos, pos) ~= '"' then err("esperava chave entre aspas") end
      local k = parse_string()
      skip()
      if str:sub(pos, pos) ~= ":" then err("esperava ':'") end
      pos = pos + 1
      obj[k] = value()
      skip()
      local c = str:sub(pos, pos)
      pos = pos + 1
      if c == "}" then return obj end
      if c ~= "," then err("esperava ',' ou '}'") end
    end
  end

  value = function()
    skip()
    local c = str:sub(pos, pos)
    if c == "{" then return parse_object() end
    if c == "[" then return parse_array() end
    if c == '"' then return parse_string() end
    if c == "-" or c:match("%d") then return parse_number() end
    if str:sub(pos, pos + 3) == "true" then pos = pos + 4; return true end
    if str:sub(pos, pos + 4) == "false" then pos = pos + 5; return false end
    if str:sub(pos, pos + 3) == "null" then pos = pos + 4; return json.null end
    err("valor inesperado '" .. c .. "'")
  end

  -- remove BOM UTF-8, se houver
  if str:sub(1, 3) == "\239\187\191" then pos = 4 end
  local result = value()
  skip()
  if pos <= #str then err("conteúdo extra após o JSON") end
  return result
end

json.null = setmetatable({}, { __tostring = function() return "null" end })

local function is_array(t)
  local n = 0
  for _ in pairs(t) do n = n + 1 end
  for i = 1, n do if t[i] == nil then return false end end
  return true
end

local function encode_string(s)
  return '"' .. s:gsub('[%c"\\]', function(c)
    local map = { ['"'] = '\\"', ["\\"] = "\\\\", ["\n"] = "\\n", ["\r"] = "\\r", ["\t"] = "\\t" }
    return map[c] or string.format("\\u%04x", c:byte())
  end) .. '"'
end

function json.encode(v, indent, level)
  indent = indent or "  "
  level = level or 0
  local t = type(v)
  if v == nil or v == json.null then return "null" end
  if t == "boolean" then return tostring(v) end
  if t == "number" then
    if v ~= v or v == math.huge or v == -math.huge then return "null" end
    if v == math.floor(v) then return string.format("%d", v) end
    return string.format("%.14g", v)
  end
  if t == "string" then return encode_string(v) end
  if t == "table" then
    local pad = string.rep(indent, level + 1)
    local close = string.rep(indent, level)
    local parts = {}
    if next(v) == nil then return is_array(v) and "[]" or "{}" end
    if is_array(v) then
      for i = 1, #v do parts[i] = pad .. json.encode(v[i], indent, level + 1) end
      return "[\n" .. table.concat(parts, ",\n") .. "\n" .. close .. "]"
    end
    local keys = {}
    for k in pairs(v) do keys[#keys + 1] = tostring(k) end
    table.sort(keys)
    for i, k in ipairs(keys) do
      parts[i] = pad .. encode_string(k) .. ": " .. json.encode(v[k], indent, level + 1)
    end
    return "{\n" .. table.concat(parts, ",\n") .. "\n" .. close .. "}"
  end
  error("tipo não suportado em JSON: " .. t)
end

function json.read_file(path)
  local f, e = io.open(path, "rb")
  if not f then return nil, e end
  local s = f:read("*a")
  f:close()
  local ok, res = pcall(json.decode, s)
  if not ok then return nil, res end
  return res
end

function json.write_file(path, data)
  local f, e = io.open(path, "wb")
  if not f then return false, e end
  f:write(json.encode(data), "\n")
  f:close()
  return true
end

return json
