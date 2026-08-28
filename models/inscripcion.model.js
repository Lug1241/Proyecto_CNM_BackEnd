const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/sequelize.config')
const Matricula = require('./matricula.models')
const Asignacion = require('./asignacion.model')

const Inscripcion = sequelize.define("Inscripcion", {
    ID: { 
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
    },
    ID_matricula: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Matricula,
            key: 'ID'
        }
    },
    ID_asignacion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Asignacion,
            key: 'ID'
        }
    }
}, {
    tableName: "inscripciones",
    timestamps: true
});

// 🔁 Relaciones muchos a muchos (si quieres que Matricula y Asignacion puedan consultarse entre sí)
Matricula.belongsToMany(Asignacion, { through: Inscripcion, foreignKey: { name: "ID_matricula", allowNull: false } });
Asignacion.belongsToMany(Matricula, { through: Inscripcion, foreignKey: { name: "ID_asignacion", allowNull: false } });

// ➕ Relaciones directas para permitir include desde Inscripcion
Inscripcion.belongsTo(Matricula, { foreignKey: {name: 'ID_matricula', allowNull:false} });
Inscripcion.belongsTo(Asignacion, { foreignKey:{name:  'ID_asignacion', allowNull:false} ,onDelete: "CASCADE"}, );

module.exports = Inscripcion;
