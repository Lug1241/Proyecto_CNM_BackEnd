const sequelize = require('./config/sequelize.config');
const { reprogramarPeriodosPendientes } = require('./controllers/programarCierre.controller')

require('./models/asignacion.model')
require('./models/calificaciones_finales.model')
require('./models/calificaciones_parciales_be.model')
require('./models/calificaciones_parciales.model')
require('./models/calificaciones_quimestrales_be.model')
require('./models/calificaciones_quimestrales.model')
require('./models/docente.model')
require('./models/estudiante.model')
require('./models/fechas_notas.model')
require('./models/fechas_procesos.model')
require('./models/inscripcion.model')
require('./models/materia.model')
require('./models/matricula.models')
require('./models/periodo_academico.model')
require('./models/representante.model')
require('./models/solicitudesPermiso.model')

const express = require('express')
const cors = require('cors')

const app = express();
app.use(express.json())
app.use(express.urlencoded({ extended: true }));

// NO RECOMENDADO PARA PRODUCCION
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

const port = 8000;
let server; // Declaramos la variable globalmente para poder cerrarla luego

const startServer = async () => {
    try {
        const mensaje = await sequelize.conexion(); 
        console.log(mensaje);

        const [results] = await sequelize.sequelize.query("SHOW TABLES");
        console.log("Tablas disponibles:", results);
        await reprogramarPeriodosPendientes();
        
        server = app.listen(port, "0.0.0.0", () => {
            console.log("✅ Server listening at port", port);
        });

        // Si el puerto está ocupado, avisamos claramente y detenemos el proceso
        server.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                console.error(`❌ El puerto ${port} está ocupado. Ejecuta 'taskkill /F /IM node.exe' en otra terminal para liberarlo.`);
                process.exit(1);
            }
        });

    } catch (error) {
        console.error("Error al sincronizar la base de datos:", error);
    }
};

// =========================================================
// GESTIÓN DE APAGADO ELEGANTE (Registrado UNA SOLA VEZ)
// =========================================================
const gracefulShutdown = () => {
    if (server) {
        console.log("\n⏳ Cerrando el servidor y liberando el puerto 8000...");
        server.close(() => {
            console.log("✅ Puerto liberado. Adiós.");
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
};

// Capturamos las señales de cierre de Nodemon, Node --watch y Ctrl+C
process.once('SIGUSR2', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);


// =========================================================
// RUTAS
// =========================================================
const allDocente = require('./routes/docente.routes')
allDocente(app)

const allCalificaciones = require('./routes/calificaciones.routes')
allCalificaciones(app)

const allRepresentante = require('./routes/representante.routes')
allRepresentante(app)

const allEstudiante = require('./routes/estudiante.routes')
allEstudiante(app)

const allMateria = require('./routes/materia.routes')
allMateria(app)

const allPeriodos = require('./routes/periodo_academico.routes')
allPeriodos(app)

const allEstudiantes = require('./routes/estudiante.routes')
allEstudiantes(app)

const allAsignacion = require('./routes/asignacion.routes')
allAsignacion(app)

const allLogin = require('./routes/login.routes')
allLogin(app)

const allInscripcion = require('./routes/inscripcion.routes')
allInscripcion(app)

const AllFechasNotas = require('./routes/fechas.routes')
AllFechasNotas(app)

const AllMatriculas = require('./routes/matricula.route')
AllMatriculas(app)

const AllSolicitudes = require('./routes/solicitud.routes')
AllSolicitudes(app)

const AllPassword = require('./routes/password.routes')
AllPassword(app)

const AllFiles = require('./routes/downlodadFile.routes')
AllFiles(app)

const AllAlertas = require('./routes/alertas.routes')
AllAlertas(app)

startServer();