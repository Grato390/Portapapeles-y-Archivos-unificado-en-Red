# Compartir en red local

Sistema web para compartir **portapapeles**, **imágenes** y **archivos** entre todos los dispositivos de una misma red local (LAN). Ideal como AirDrop o LAN Share casero.

---

## Características

- **Portapapeles compartido**: historial de textos con fecha/hora. Copiar, borrar por entrada o enviar a todos. Sin actualización automática constante (solo al abrir la pestaña, al enviar o al pulsar Actualizar).
- **Imágenes**: subir o pegar con **Ctrl+V** en la zona indicada. Historial con fecha, visor con zoom, Descargar / Copiar / Borrar por imagen.
- **Archivos**: subir archivos o carpetas. Lista con Descargar y Borrar por archivo.
- **Liberar todo**: botón para borrar todo el contenido compartido (historial, imágenes y archivos).
- Acceso desde **cualquier dispositivo** en la misma red (PC, laptop, móvil, tablet) usando la IP del servidor.

---

## Requisitos

- **Python 3.8 o superior**
- Dispositivos en la **misma red local (LAN)**

---

## Instalación

### 1. Clonar o descargar el proyecto

```bash
git clone <url-del-repositorio>
cd "portapeles y archivos compartidos via wep"
```

(O descomprime la carpeta donde quieras.)

### 2. Crear entorno virtual (recomendado)

**Windows (PowerShell o CMD):**

```bash
py -3 -m venv .venv
.venv\Scripts\activate
```

**Windows (Git Bash) / Linux / macOS:**

```bash
python3 -m venv .venv
source .venv/bin/activate   # Linux/macOS
```

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

---

## Uso

### 1. Iniciar el servidor

Desde la carpeta del proyecto (con el entorno virtual activado si lo usas):

```bash
python app.py
```

o, en Windows si solo tienes el lanzador `py`:

```bash
py -3 app.py
```

### 2. Ver la dirección de acceso

En la consola aparecerá algo como:

```
==================================================
  Servidor de intercambio en red local
==================================================
  Acceso desde esta máquina:  http://127.0.0.1:5000
  Acceso desde la red (LAN):  http://192.168.1.20:5000
==================================================
```

### 3. Conectar otros dispositivos

En **cualquier** dispositivo de la misma red (móvil, otra PC, tablet), abre el navegador y entra en:

```
http://IP_QUE_MOSTRÓ_EL_SERVIDOR:5000
```

Ejemplo: `http://192.168.1.20:5000`

Todos verán la misma interfaz y el mismo contenido compartido.

---

## Guía rápida por secciones

### Portapapeles

- Escribe o pega texto en el cuadro y pulsa **Enviar a todos los dispositivos** (el botón se activa solo si hay texto).
- En **Historial compartido** verás todas las entradas con fecha/hora. Arriba de cada una: **Copiar** y **Borrar**.
- **Actualizar**: para ver lo que han enviado otros sin tener que recargar la página.

### Imágenes

- **Subir**: arrastra imágenes a la zona o haz clic para elegir archivos. Luego **Enviar a todos los dispositivos**.
- **Pegar**: haz clic en la zona **"Ctrl+V (o Cmd+V en Mac) aquí para pegar tu imagen"** y pulsa Ctrl+V (o Cmd+V). La imagen se añade a la lista; después pulsa Enviar a todos.
- En **Historial de imágenes**: cada imagen muestra fecha/hora, **Descargar**, **Copiar** y **Borrar**. Clic en la miniatura abre el visor con zoom y botón X para cerrar.

### Archivos

- Arrastra archivos o usa **Seleccionar archivos** / **Seleccionar carpeta**. Luego **Enviar a todos los dispositivos**.
- En la lista: **Descargar** y **Borrar** por archivo.

### Liberar todo

- En la cabecera, el botón **Liberar todo** borra historial del portapapeles, todas las imágenes y todos los archivos (pide confirmación).

---

## Estructura del proyecto

```
├── app.py                 # Servidor Flask (escucha en 0.0.0.0)
├── requirements.txt       # Flask, Werkzeug
├── .gitignore
├── README.md
├── templates/
│   └── index.html         # Interfaz (portapapeles, imágenes, archivos)
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── main.js
└── uploads/               # Se crea al ejecutar (no se sube a Git)
    ├── images/
    └── files/
```

---

## Notas técnicas

- El servidor usa **Flask** y escucha en **0.0.0.0** para aceptar conexiones desde la LAN.
- No hay polling constante: el historial del portapapeles y las listas de imágenes/archivos se actualizan al abrir la pestaña, al enviar contenido o al pulsar **Actualizar** / **Liberar todo**.
- Los datos se guardan en memoria (portapapeles) y en la carpeta `uploads/` (imágenes y archivos). Al borrar con **Liberar todo** o con los botones **Borrar** se eliminan del servidor.

---

## Subir a GitHub (o otro Git remoto)

Si quieres subir el proyecto a GitHub:

1. Crea un repositorio nuevo en GitHub (sin inicializarlo con README si ya tienes uno local).
2. En la carpeta del proyecto:

```bash
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git branch -M main
git push -u origin main
```

Sustituye `TU_USUARIO` y `TU_REPOSITORIO` por los tuyos.

---

## Licencia

Proyecto de uso libre. Puedes modificarlo y compartirlo como quieras.
