const { InvalidConnectionError } = require('sequelize');
const InscripcionController = require('../controllers/inscripcion.controller');
const {DocenteANDReprsentante, docenteSecretaria,Docente}=require('../middlewares/protect')
const { OwnerInscription } = require('../middlewares/inscripcion');

module.exports = function(app) {
    app.post('/api/inscripcion/crear', DocenteANDReprsentante,InscripcionController.createInscripcion)
    app.put('/api/inscripcion/editar/:id',docenteSecretaria ,InscripcionController.updateInscripcion)
    app.get('/api/inscripcion/obtener/:id', DocenteANDReprsentante,InscripcionController.getInscripcion)
    app.delete('/api/inscripcion/eliminar/:id', OwnerInscription ,InscripcionController.deleteInscripcion)
    app.get('/api/inscripcion/asignacion/:id_asignacion', DocenteANDReprsentante,InscripcionController.getEstudiantesPorAsignacion)
    app.get('/api/inscripcion/obtener/matricula/:matricula',DocenteANDReprsentante,InscripcionController.getInscripcionesByMatricula),
    app.get('/api/inscripcion/obtener/docente/:docente/:periodo',Docente,InscripcionController.getInscripcionesIndividualesDocente)
    app.get(`/api/inscripcion/obtener/nivel/:periodo/:nivel`,Docente,InscripcionController.getInscripcionesIndividualesByNivel)
}