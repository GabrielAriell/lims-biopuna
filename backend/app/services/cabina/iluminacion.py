import time
import numpy as np
from app.services.cabina import config

try:
    from pyfirmata import Arduino
except ImportError:
    try:
        from pyfirmata2 import Arduino
    except ImportError:
        Arduino = None


def probar_puerto_serial(puerto: str) -> bool:
    """Verifica si el puerto COM existe y se puede abrir con pyserial sin causar errores."""
    if not puerto:
        return False
    try:
        import serial
        s = serial.Serial(puerto.strip(), timeout=0.2)
        s.close()
        return True
    except Exception:
        return False


def buscar_puerto_arduino() -> str | None:
    """Detecta automáticamente si el Arduino está conectado y en qué puerto COM."""
    try:
        import serial.tools.list_ports
        puertos = list(serial.tools.list_ports.comports())
        # Buscar por identificador de hardware común (CH340, Arduino, FTDI)
        for p in puertos:
            desc = (p.description or "").upper()
            hwid = (p.hwid or "").upper()
            if any(k in desc or k in hwid for k in ["CH340", "ARDUINO", "1A86", "FTDI", "CP210"]):
                if probar_puerto_serial(p.device):
                    return p.device

        # Si el puerto configurado en config.py está disponible
        if config.PUERTO_ARDUINO and probar_puerto_serial(config.PUERTO_ARDUINO):
            return config.PUERTO_ARDUINO

        # Probar puertos USB disponibles
        for p in puertos:
            if "USB" in (p.description or "").upper() and probar_puerto_serial(p.device):
                return p.device
    except Exception:
        pass
    return None


class ControladorIluminacion:
    """Controla la tira LED RGB vía Arduino: luz blanca fija o corrección bajo demanda."""

    def __init__(self):
        self.conectado = False
        self.board = None
        self.pin_r = None
        self.pin_g = None
        self.pin_b = None
        self.intensidad = config.BRILLO_BLANCO_INICIAL
        self.balance = (1.0, 1.0, 1.0)
        self.color_activo = "BLANCO"

        if config.ACTIVAR_ARDUINO and Arduino is not None:
            puerto = buscar_puerto_arduino()
            if puerto:
                try:
                    print(f"[Cabina] Conectando Arduino en {puerto} (esperando arranque)...")
                    self.board = Arduino(puerto)
                    time.sleep(2.5)  # Tiempo necesario para que el bootloader de Arduino termine de reiniciar
                    self.pin_r = self.board.get_pin("d:9:p")
                    self.pin_g = self.board.get_pin("d:10:p")
                    self.pin_b = self.board.get_pin("d:11:p")
                    time.sleep(0.1)
                    self.conectado = True
                    self.activar_luz_blanca()
                    print(f"[Cabina] Arduino conectado en {puerto} -> LEDs en BLANCO.")
                except Exception as e:
                    print(f"[Cabina] Aviso: Error al inicializar Firmata en {puerto}: {e}")
                    self.conectado = False
                    self.board = None
            else:
                self.conectado = False
                print("[Cabina] Arduino no detectado en puertos COM. Iluminación en modo simulado.")
        else:
            self.conectado = False

    def set_color(self, r: float, g: float, b: float):
        if not self.conectado or self.board is None:
            return
        try:
            r = max(0, min(255, int(r)))
            g = max(0, min(255, int(g)))
            b = max(0, min(255, int(b)))
            # Si pines 10 y 11 quedan ambos en 255 (HIGH), el canal rojo (pin 9)
            # deja de conducir en este hardware; un mínimo PWM (253) en pin 10 lo mantiene activo.
            if r > 0 and g == 0 and b == 0:
                g = 2
            # Lógica invertida para tira LED RGB de ánodo común (+12V)
            pr = 1.0 - (r / 255.0)
            pg = 1.0 - (g / 255.0)
            pb = 1.0 - (b / 255.0)
            self.pin_r.write(pr)
            self.pin_g.write(pg)
            self.pin_b.write(pb)
            print(f"[Cabina] LEDs {self.color_activo} -> RGB=({r},{g},{b}) | PWM=({pr:.2f},{pg:.2f},{pb:.2f})")
        except Exception as e:
            print(f"[Cabina] Error al enviar color a LEDs: {e}")
            self.conectado = False

    def activar_luz_blanca(self):
        """Enciende los 3 canales RGB para volver a luz blanca neutra."""
        self.balance = (1.0, 1.0, 1.0)
        self.intensidad = config.BRILLO_BLANCO_INICIAL
        self.color_activo = "BLANCO"
        self.set_color(self.intensidad, self.intensidad, self.intensidad)

    def activar_color_manual(self, color: str):
        """Permite seleccionar manualmente el color de los LEDs: BLANCO, VERDE, ROJO o AZUL."""
        c = color.upper()
        if c in ("BLANCO", "BLANCA"):
            self.activar_luz_blanca()
        elif c in ("VERDE", "VERDE_CONTRASTE"):
            self.balance = (0.0, 1.0, 0.0)
            self.intensidad = config.BRILLO_BLANCO_INICIAL
            self.color_activo = "VERDE"
            self.set_color(0, self.intensidad, 0)
        elif c in ("ROJO", "ROJA", "ROJO_CONTRASTE"):
            self.balance = (1.0, 0.0, 0.0)
            self.intensidad = 255
            self.color_activo = "ROJO"
            self.set_color(255, 0, 0)
        elif c == "AZUL":
            self.balance = (0.0, 0.0, 1.0)
            self.intensidad = 255
            self.color_activo = "AZUL"
            self.set_color(0, 0, 255)

    def configurar_espectro_tincion(self, tincion: str):
        """Ajusta al color complementario según la tinción."""
        t = tincion.upper()
        if t in ("ROJA", "ROJO"):
            # Para tinción roja (Ponceau S), luz VERDE pura
            self.balance = (0.0, 1.0, 0.0)
            self.intensidad = config.BRILLO_BLANCO_INICIAL
            self.color_activo = "VERDE"
        elif t in ("AZUL", "AZULES"):
            # Para tinción azul (Coomassie), luz ROJA pura al 100% de potencia
            self.balance = (1.0, 0.0, 0.0)
            self.intensidad = 255
            self.color_activo = "ROJO"
        elif t in ("BLANCO", "BLANCA"):
            self.activar_luz_blanca()
            return

        br, bg, bb = self.balance
        self.set_color(self.intensidad * br, self.intensidad * bg, self.intensidad * bb)

    def regular_brillo(self, frame: np.ndarray, roi_box: list[int], canal_idx: int):
        """Ajusta la intensidad PWM para mantener constante el brillo del fondo."""
        x1, y1, x2, y2 = roi_box
        recorte = frame[y1:y2, x1:x2]
        if recorte.size == 0:
            return True, 0.0

        brillo_actual = float(np.percentile(recorte[:, :, canal_idx], 80))

        if not self.conectado:
            return True, brillo_actual

        error = config.BRILLO_OBJETIVO - brillo_actual
        if abs(error) <= config.TOLERANCIA_BRILLO:
            return True, brillo_actual

        self.intensidad += int(error * 0.35)
        self.intensidad = max(20, min(255, self.intensidad))
        br, bg, bb = self.balance
        self.set_color(
            self.intensidad * br,
            self.intensidad * bg,
            self.intensidad * bb,
        )
        return False, brillo_actual

    def apagar_y_cerrar(self):
        if self.conectado and self.board is not None:
            try:
                self.set_color(0, 0, 0)
                self.board.exit()
            except Exception:
                pass
            self.conectado = False
