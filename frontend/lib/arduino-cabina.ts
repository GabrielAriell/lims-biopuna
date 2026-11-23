/**
 * Controlador Web Serial API para la tira LED RGB de la cabina densitométrica.
 * Se comunica directamente desde Chrome/Edge (HTTPS o localhost) con un Arduino
 * que tenga cargado el firmware StandardFirmata (57600 baudios, pines PWM 9/10/11).
 */

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPortLike {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  getInfo(): SerialPortInfo;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

interface SerialFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialApiLike extends EventTarget {
  getPorts(): Promise<SerialPortLike[]>;
  requestPort(options?: { filters?: SerialFilter[] }): Promise<SerialPortLike>;
}

type NavigatorConSerial = Navigator & {
  serial?: SerialApiLike;
};

const BAUDRATE_FIRMATA = 57600;
const PIN_R = 9;
const PIN_G = 10;
const PIN_B = 11;

const SET_PIN_MODE = 0xf4;
const MODO_PWM = 0x03;
const ANALOG_MESSAGE = 0xe0;
const REPORT_VERSION = 0xf9;
const START_SYSEX = 0xf0;

export const BRILLO_BLANCO_INICIAL = 180;

// VIDs frecuentes en placas Arduino y conversores USB-Serial (CH340, Arduino, FTDI, CP210x)
const VIDS_ARDUINO = new Set([0x1a86, 0x2341, 0x2a03, 0x0403, 0x10c4]);

export function soportaWebSerial(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serial" in navigator
  );
}

function obtenerSerialApi(): SerialApiLike | null {
  if (!soportaWebSerial()) return null;
  return (navigator as NavigatorConSerial).serial ?? null;
}

function clampByte(valor: number): number {
  return Math.max(0, Math.min(255, Math.round(valor)));
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ControladorArduinoWeb {
  private port: SerialPortLike | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private leyendo = false;
  private firmataListo = false;
  private sessionId = 0;
  private conectandoPromise: Promise<boolean> | null = null;

  conectado = false;
  colorActivo = "BLANCO";
  intensidad = BRILLO_BLANCO_INICIAL;

  private onDisconnectHandler = (ev: Event) => {
    const target = (ev as unknown as { target?: SerialPortLike }).target;
    if (this.port && (!target || target === this.port)) {
      this.limpiarReferencias();
    }
  };

  constructor() {
    const api = obtenerSerialApi();
    api?.addEventListener("disconnect", this.onDisconnectHandler);
  }

  destruir(): void {
    const api = obtenerSerialApi();
    api?.removeEventListener("disconnect", this.onDisconnectHandler);
    void this.desconectar();
  }

  async intentarAutoconectar(modoTincion = "ROJA"): Promise<boolean> {
    const api = obtenerSerialApi();
    if (!api) return false;
    if (this.conectado) return true;
    if (this.conectandoPromise) return this.conectandoPromise;

    try {
      const puertos = await api.getPorts();
      if (puertos.length === 0) return false;
      const preferido =
        puertos.find((p) => {
          const vid = p.getInfo().usbVendorId;
          return vid !== undefined && VIDS_ARDUINO.has(vid);
        }) ?? puertos[0];
      return await this.conectarPuerto(preferido, modoTincion);
    } catch {
      return false;
    }
  }

  async conectarConSelector(modoTincion = "ROJA"): Promise<boolean> {
    const api = obtenerSerialApi();
    if (!api) {
      throw new Error(
        "Tu navegador no soporta Web Serial. Usá Chrome o Edge en computadora para controlar los LEDs del Arduino.",
      );
    }
    if (this.conectandoPromise) return this.conectandoPromise;

    const puerto = await api.requestPort();
    return this.conectarPuerto(puerto, modoTincion);
  }

  private async conectarPuerto(
    puerto: SerialPortLike,
    modoTincion: string,
  ): Promise<boolean> {
    if (this.conectandoPromise) return this.conectandoPromise;

    const sesion = ++this.sessionId;
    const tarea = (async (): Promise<boolean> => {
      try {
        if (this.port && this.port !== puerto) {
          await this.desconectar();
        }
        this.port = puerto;
        this.firmataListo = false;

        if (!puerto.readable || !puerto.writable) {
          await puerto.open({ baudRate: BAUDRATE_FIRMATA });
        }

        if (sesion !== this.sessionId) {
          await this.cerrarPuertoSeguro(puerto);
          return false;
        }

        this.iniciarLectura(puerto);

        // Esperar a que StandardFirmata termine el reinicio del bootloader (máx. 2.5 s)
        const inicio = Date.now();
        while (!this.firmataListo && Date.now() - inicio < 2500) {
          if (sesion !== this.sessionId) {
            await this.cerrarPuertoSeguro(puerto);
            return false;
          }
          await esperar(100);
        }
        // Pequeño margen para que StandardFirmata procese comandos tras enviar su versión
        await esperar(this.firmataListo ? 200 : 100);

        if (sesion !== this.sessionId || !puerto.writable) {
          await this.cerrarPuertoSeguro(puerto);
          return false;
        }

        this.writer = puerto.writable.getWriter();

        // Configurar pines 9, 10, 11 como salidas PWM en Firmata
        await this.escribirBytes(
          new Uint8Array([
            SET_PIN_MODE,
            PIN_R,
            MODO_PWM,
            SET_PIN_MODE,
            PIN_G,
            MODO_PWM,
            SET_PIN_MODE,
            PIN_B,
            MODO_PWM,
          ]),
        );
        await esperar(50);

        this.conectado = true;
        await this.configurarEspectroTincion(modoTincion);
        return true;
      } catch (err) {
        this.limpiarReferencias();
        await this.cerrarPuertoSeguro(puerto);
        throw err;
      } finally {
        this.conectandoPromise = null;
      }
    })();

    this.conectandoPromise = tarea;
    return tarea;
  }

  private iniciarLectura(puerto: SerialPortLike): void {
    if (!puerto.readable || this.leyendo) return;
    this.leyendo = true;
    const reader = puerto.readable.getReader();
    this.reader = reader;

    void (async () => {
      try {
        while (this.leyendo) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.length > 0) {
            for (let i = 0; i < value.length; i++) {
              if (value[i] === REPORT_VERSION || value[i] === START_SYSEX) {
                this.firmataListo = true;
                break;
              }
            }
          }
        }
      } catch {
        // Ignorar cancelación o desconexión física
      } finally {
        this.leyendo = false;
        try {
          reader.releaseLock();
        } catch {
          // Ignorar
        }
        if (this.reader === reader) {
          this.reader = null;
        }
      }
    })();
  }

  private async escribirBytes(datos: Uint8Array): Promise<void> {
    if (!this.writer) return;
    await this.writer.write(datos);
  }

  async setColor(r: number, g: number, b: number): Promise<void> {
    if (!this.conectado || !this.writer) return;
    try {
      const cr = clampByte(r);
      const cg = clampByte(g);
      const cb = clampByte(b);

      // Lógica invertida para tira LED RGB de ánodo común (+12V)
      const pr = 255 - cr;
      const pg = 255 - cg;
      const pb = 255 - cb;

      const trama = new Uint8Array([
        ANALOG_MESSAGE | PIN_R,
        pr & 0x7f,
        (pr >> 7) & 0x7f,
        ANALOG_MESSAGE | PIN_G,
        pg & 0x7f,
        (pg >> 7) & 0x7f,
        ANALOG_MESSAGE | PIN_B,
        pb & 0x7f,
        (pb >> 7) & 0x7f,
      ]);
      await this.escribirBytes(trama);
    } catch {
      this.conectado = false;
    }
  }

  async activarLuzBlanca(): Promise<void> {
    this.intensidad = BRILLO_BLANCO_INICIAL;
    this.colorActivo = "BLANCO";
    await this.setColor(this.intensidad, this.intensidad, this.intensidad);
  }

  async configurarEspectroTincion(tincion: string): Promise<void> {
    const t = tincion.toUpperCase();
    if (t === "ROJA" || t === "ROJO") {
      // Para tinción roja (Ponceau S), luz VERDE pura
      this.intensidad = BRILLO_BLANCO_INICIAL;
      this.colorActivo = "VERDE";
      await this.setColor(0, this.intensidad, 0);
    } else if (t === "AZUL" || t === "AZULES") {
      // Para tinción azul (Coomassie), luz ROJA pura al 100%
      this.intensidad = 255;
      this.colorActivo = "ROJO";
      await this.setColor(255, 0, 0);
    } else {
      await this.activarLuzBlanca();
    }
  }

  async desconectar(): Promise<void> {
    this.sessionId++;
    const puerto = this.port;

    if (this.conectado && this.writer) {
      try {
        await this.setColor(0, 0, 0);
        await esperar(30);
      } catch {
        // Ignorar si ya se desconectó
      }
    }

    this.leyendo = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // Ignorar
      }
      try {
        this.reader.releaseLock();
      } catch {
        // Ignorar
      }
      this.reader = null;
    }

    if (this.writer) {
      try {
        this.writer.releaseLock();
      } catch {
        // Ignorar
      }
      this.writer = null;
    }

    this.limpiarReferencias();
    if (puerto) {
      await this.cerrarPuertoSeguro(puerto);
    }
  }

  private limpiarReferencias(): void {
    this.conectado = false;
    this.writer = null;
    this.reader = null;
    this.port = null;
  }

  private async cerrarPuertoSeguro(puerto: SerialPortLike): Promise<void> {
    try {
      await puerto.close();
    } catch {
      // Ignorar si ya está cerrado
    }
  }
}
