const DocenteController = require('../controllers/docente.controller')
const { obtenerMonitoreoPendientes } = require('../controllers/monitoreoDocentes.controller')
const { Docente, docenteAdministrador,docenteVicerrector } = require('../middlewares/protect')



module.exports = (app) => {
    app.post('/api/docente/crear', DocenteController.createDocente)
    app.put('/api/docente/editar/:cedula', docenteVicerrector, DocenteController.editDocente)
    app.get('/api/docente/obtener/:cedula', DocenteController.getDocente)
    app.get('/api/docente/obtener', Docente, DocenteController.getDocentes)
    app.delete('/api/docente/eliminar/:cedula', docenteAdministrador, DocenteController.eliminarDocente)
    app.get('/api/docente/monitoreo', Docente, obtenerMonitoreoPendientes)
    app.get('/api/docente/get/nombre/:busqueda', DocenteController.getDocentesPorNombreOApellido)
} 