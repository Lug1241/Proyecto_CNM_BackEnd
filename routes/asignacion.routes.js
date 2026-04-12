const AsignacionController = require('../controllers/asignacion.controller');
const {Docente,DocenteANDReprsentante,docenteVicerrector,DocenteVicerrectorANDSecretaria,docenteAdministrador,validarPropietarioAsignacion}=require('../middlewares/protect')
module.exports = (app) => {
    app.post('/api/asignacion/crear',Docente, AsignacionController.createAsignacion);
    app.put('/api/asignacion/editar/:id',Docente, validarPropietarioAsignacion, AsignacionController.updateAsignacion);
    app.get('/api/asignacion/obtener/:id',DocenteANDReprsentante ,AsignacionController.getAsignacion);
    app.delete('/api/asignacion/eliminar/:id',Docente, validarPropietarioAsignacion, AsignacionController.deleteAsignacion);
    app.get('/api/asignacion/docente/:id_docente', DocenteANDReprsentante,AsignacionController.getAsignacionesPorDocente);
    app.get('/api/asignacion/nivel/:nivel/:periodo',docenteVicerrector,AsignacionController.getAsignacionesPorNivel)
    app.get('/api/asignacion/obtener/periodo/:periodo',DocenteVicerrectorANDSecretaria ,AsignacionController.getAsignaciones);
    app.get('/api/asignacion/obtener/periodo_academico/:periodo',DocenteVicerrectorANDSecretaria ,AsignacionController.getAsignacionesPorPeriodo);
    app.get('/api/asignacion/obtener/materias/:periodo/:nivel/:materia/:jornada', DocenteANDReprsentante,AsignacionController.getAsignacionesPorAsignatura);
    app.get('/api/asignacion/obtener/docente/:docente/:periodo',Docente,AsignacionController.getAsignacionesSinMatriculaPorDocente),
    app.get('/api/asignacion/sinMatricula',docenteVicerrector,AsignacionController.getAsignacionesSinMatricula)
}
