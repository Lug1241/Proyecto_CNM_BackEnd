// Rutas para ESTUDIANTE
const upload=require('../middlewares/uploadFiles')
const EstudianteController = require('../controllers/estudiante.controller');
const {docenteSecretaria, DocenteANDReprsentante}=require('../middlewares/protect')
module.exports = (app) => {
    app.post('/api/estudiante/crear',docenteSecretaria ,upload.uploadEstudiantesFields,EstudianteController.crearEstudiante);
    app.put('/api/estudiante/editar/:ID',DocenteANDReprsentante,upload.uploadEstudiantesFields, EstudianteController.updateEstudiante);
    app.get('/api/estudiante/obtener/:cedula',DocenteANDReprsentante,EstudianteController.getEstudianteByCedula)
    app.get('/api/estudiante/obtener',DocenteANDReprsentante, EstudianteController.getAllEstudiantes);
    app.delete('/api/estudiante/eliminar/:ID', docenteSecretaria,EstudianteController.deleteEstudiante);
    app.get('/api/api/representantes/:cedula/estudiantes',DocenteANDReprsentante ,EstudianteController.getRepresentanteEstudiante);
    app.get('/api/estudiante/nivel/:nivel',docenteSecretaria,EstudianteController.getEstudiantesByNivel)
    app.get('/api/estudiante/matricula/:nivel/periodo/:idPeriodo',docenteSecretaria,EstudianteController.getEstudiantesByMatricula)
    app.get('/api/estudiante/verificar-matricula-ier/:id', DocenteANDReprsentante, EstudianteController.verificarMatriculaIER);
    app.get('/api/estudiante/obtenerPorApellido',EstudianteController.getEstudiantesByApellido)
}