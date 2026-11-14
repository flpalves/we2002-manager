-- Acesso à RAM principal do PS1 dentro do PCSX-Redux.
-- Endereços podem ser passados como 0x80xxxxxx (KSEG0), 0xA0xxxxxx (KSEG1)
-- ou 0x00xxxxxx (físico). Tudo é mapeado para os 2 MB de RAM.

local ffi = require("ffi")

local M = {}

M.RAM_SIZE = 0x200000 -- 2 MB

local function ptr()
  return PCSX.getMemPtr() -- uint8_t* para a RAM principal
end

-- Converte qualquer endereço para offset físico na RAM.
function M.phys(addr)
  return bit.band(addr, 0x1FFFFF)
end

-- Formata como endereço KSEG0 (é como os debuggers de PS1 costumam mostrar).
function M.fmt(addr)
  return string.format("0x%08X", 0x80000000 + M.phys(addr))
end

function M.read8(addr)
  return ptr()[M.phys(addr)]
end

function M.read16(addr)
  local p, a = ptr(), M.phys(addr)
  return p[a] + p[a + 1] * 0x100
end

function M.read32(addr)
  local p, a = ptr(), M.phys(addr)
  return p[a] + p[a + 1] * 0x100 + p[a + 2] * 0x10000 + p[a + 3] * 0x1000000
end

function M.write8(addr, v)
  ptr()[M.phys(addr)] = bit.band(v, 0xFF)
end

function M.write16(addr, v)
  local p, a = ptr(), M.phys(addr)
  p[a] = bit.band(v, 0xFF)
  p[a + 1] = bit.band(bit.rshift(v, 8), 0xFF)
end

function M.write32(addr, v)
  local p, a = ptr(), M.phys(addr)
  for i = 0, 3 do
    p[a + i] = bit.band(bit.rshift(v, 8 * i), 0xFF)
  end
end

function M.read(addr, width)
  if width == 2 then return M.read16(addr) end
  if width == 4 then return M.read32(addr) end
  return M.read8(addr)
end

function M.write(addr, v, width)
  if width == 2 then return M.write16(addr, v) end
  if width == 4 then return M.write32(addr, v) end
  return M.write8(addr, v)
end

-- Lê `len` bytes como string Lua (útil para nomes de jogadores).
function M.read_bytes(addr, len)
  local a = M.phys(addr)
  return ffi.string(ptr() + a, len)
end

-- Copia a RAM inteira para um buffer novo (para buscas por diferença).
function M.snapshot()
  local buf = ffi.new("uint8_t[?]", M.RAM_SIZE)
  ffi.copy(buf, ptr(), M.RAM_SIZE)
  return buf
end

-- Grava um dump da RAM em disco (para comparar no ImHex/HxD).
function M.dump(path)
  local f, e = io.open(path, "wb")
  if not f then return false, e end
  f:write(ffi.string(ptr(), M.RAM_SIZE))
  f:close()
  return true
end

-- Hexdump curto para o log.
function M.hexdump(addr, len)
  local lines = {}
  for row = 0, len - 1, 16 do
    local hex, asc = {}, {}
    for i = 0, math.min(15, len - 1 - row) do
      local b = M.read8(addr + row + i)
      hex[#hex + 1] = string.format("%02X", b)
      asc[#asc + 1] = (b >= 32 and b < 127) and string.char(b) or "."
    end
    lines[#lines + 1] = string.format("%s  %-47s  %s", M.fmt(addr + row),
      table.concat(hex, " "), table.concat(asc))
  end
  return table.concat(lines, "\n")
end

return M
