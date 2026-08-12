const { sequelize } = require('../config/sequelize.config')
const { DataTypes } = require('sequelize')
const Periodo_Academico = require('./periodo_academico.model')
const Estudiante = require('./estudiante.model')

const Matrícula = sequelize.define('Matricula', {
    ID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
    },
    nivel: {
        type: DataTypes.ENUM(
            "1ro Básico Elemental",
            "2do Básico Elemental",
            "1ro Básico Medio",
            "2do Básico Medio",
            "3ro Básico Medio",
            "1ro Básico Superior",
            "2do Básico Superior",
            "3ro Básico Superior",
            "1ro Bachillerato",
            "2do Bachillerato",
            "3ro Bachillerato"
        ),
        allowNull: false,
        validate:{
            notEmpty: {msg: "No se permiten valores vacíos"},
            notNull: {msg: "No se permiten valores nulos"},

        }
    },
    estado: {
        type: DataTypes.ENUM("Aprobado", "Reprobado","En curso"),
        allowNull: false,
    }
},
    {
        tableName: "Matriculas"
    })
Estudiante.belongsToMany(Periodo_Academico, { through: Matrícula, foreignKey: {name:"ID_estudiante", allowNull: false}, unique: false });
Periodo_Academico.belongsToMany(Estudiante, { through: Matrícula, foreignKey: {name: "ID_periodo_academico", allowNull: false} ,unique: false });

// ✅ NUEVA relación necesaria para los include
Matrícula.belongsTo(Estudiante, { foreignKey: 'ID_estudiante' });
Estudiante.hasMany(Matrícula, { foreignKey: 'ID_estudiante' });

module.exports = Matrícula