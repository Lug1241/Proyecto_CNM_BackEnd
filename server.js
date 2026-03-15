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
const startServer = async () => {
    try {
        const mensaje = await sequelize.conexion(); // Espera a que la BD se sincronice
        console.log(mensaje);

        // Una vez sincronizada, inicia el servidor
        const [results] = await sequelize.sequelize.query("SHOW TABLES");
        console.log("Tablas disponibles:", results);
        app.listen(port, "0.0.0.0", () => {
            console.log("Server listening at port", port);
        });
    } catch (error) {
        console.error("Error al sincronizar la base de datos:", error);
    }
};
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
// Llamar a la función para iniciar
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

reprogramarPeriodosPendientes()
startServer();

