// O pngjs só aparece nos testes (para conferir o PNG do main) e nas ferramentas; sem @types.
declare module 'pngjs' {
  export class PNG {
    constructor(opcoes: { width: number; height: number })
    width: number
    height: number
    data: Buffer
    static sync: { read(buf: Buffer): PNG; write(png: PNG): Buffer }
  }
}
