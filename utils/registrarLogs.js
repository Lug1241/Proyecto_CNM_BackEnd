const path = require('path');
const fs = require('fs').promises;
// Función para escribir logs en un archivo físico
const registrarLog = async (mensaje, { tipo = 'INFO', archivo = 'general.log' } = {}) => {
  try {
    const ahora = new Date();
    // Formato de fecha local para Ecuador (o la zona horaria del servidor)
    const timestamp = ahora.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });
    
    const lineaLog = `[${timestamp}] [${tipo}] ${mensaje}\n`;

    // path.resolve(__dirname, '..') sube un nivel. 
    // Ajusta los '..' dependiendo de en qué carpeta esté este controlador.
    const directorioLogs = path.resolve(__dirname, '../logs'); 
    const rutaArchivo = path.join(directorioLogs, archivo);

    // Crea la carpeta de logs si no existe (recursive: true evita errores si ya existe)
    await fs.mkdir(directorioLogs, { recursive: true });

    // Escribe (añade) la línea al final del archivo
    await fs.appendFile(rutaArchivo, lineaLog, 'utf8');

    // Opcional: mantenerlo en consola también para tu entorno local
    if (tipo === 'ERROR' || tipo === 'WARN') {
      console.error(lineaLog.trim());
    } else {
      console.log(lineaLog.trim());
    }

  } catch (error) {
    console.error("Fallo crítico al intentar escribir el log:", error);
  }
}

module.exports = { registrarLog };