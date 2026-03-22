const express = require('express')
const router = express.Router()
const { docenteProfesor } = require('../middlewares/protect')
const { getNotasFaltantes } = require('../controllers/alertas.controller')

router.get('/notas-faltantes', docenteProfesor, getNotasFaltantes)

module.exports = (app) => {
  app.use('/api/alertas', router)
}
