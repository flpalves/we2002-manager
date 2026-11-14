-- Busca por diferença na RAM (estilo "cheat search").
-- Fluxo típico para achar o byte de estado do jogo:
--   1. Nova busca (tira snapshot)       -> no menu
--   2. Vai para a partida, filtra "mudou"
--   3. Volta ao menu, filtra "mudou"; fica parado, filtra "não mudou"...
-- até sobrarem poucos candidatos.

local ffi = require("ffi")
local mem = require("mem")

local S = {}

S.width = 1        -- 1 ou 2 bytes
S.candidates = nil -- array FFI de offsets físicos
S.count = 0
S.prev = nil       -- snapshot anterior
S.history = {}     -- descrição dos filtros aplicados

local function value_at(buf, a, width)
  if width == 2 then return buf[a] + buf[a + 1] * 0x100 end
  return buf[a]
end

function S.reset(width)
  S.width = width or S.width
  S.prev = mem.snapshot()
  local n = mem.RAM_SIZE / S.width
  S.candidates = ffi.new("int32_t[?]", n)
  for i = 0, n - 1 do S.candidates[i] = i * S.width end
  S.count = n
  S.history = { string.format("início (%d byte%s)", S.width, S.width > 1 and "s" or "") }
end

-- mode: "eq", "changed", "unchanged", "inc", "dec"
function S.filter(mode, target)
  if not S.candidates then return 0 end
  local cur = mem.snapshot()
  local w, kept = S.width, 0
  for i = 0, S.count - 1 do
    local a = S.candidates[i]
    local old, new = value_at(S.prev, a, w), value_at(cur, a, w)
    local keep
    if mode == "eq" then keep = new == target
    elseif mode == "changed" then keep = new ~= old
    elseif mode == "unchanged" then keep = new == old
    elseif mode == "inc" then keep = new > old
    elseif mode == "dec" then keep = new < old
    end
    if keep then
      S.candidates[kept] = a
      kept = kept + 1
    end
  end
  S.count = kept
  S.prev = cur
  S.history[#S.history + 1] = mode .. (target and ("=" .. target) or "") .. " -> " .. kept
  return kept
end

-- Lista até `limit` candidatos com valor atual e anterior.
function S.list(limit)
  local out = {}
  if not S.candidates then return out end
  for i = 0, math.min(S.count, limit or 50) - 1 do
    local a = S.candidates[i]
    out[#out + 1] = { addr = a, prev = value_at(S.prev, a, S.width), cur = mem.read(a, S.width) }
  end
  return out
end

return S
