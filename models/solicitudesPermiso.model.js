const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/sequelize.config')
const Docente = require('./docente.model')

const SolicitudesPermiso = sequelize.define("SolicitudesPermiso", {
    ID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
    },
    descripcion: {
        type: DataTypes.ENUM,
        values: [
            "parcial1_quim1",
            "parcial2_quim1",
            "quimestre1",
            "parcial1_quim2",
            "parcial2_quim2",
            "quimestre2",
            "nota_final"
        ],
        allowNull: false,
        validate: {
            notNull: { msg: "La descripción del permiso es obligatoria" },
            notEmpty: { msg: "Debe seleccionar una descripción válida" },
        }
    },
    fecha_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        validate: {
            isDate: { msg: "Debe ingresar una fecha válida" }
        },
        get() {
            const rawValue = this.getDataValue("fecha_inicio");
            if (rawValue) {
                const date = new Date(rawValue + "T00:00:00");
                return date.toLocaleDateString("es-ES");
            }
            return null;
        }
    },
    fecha_fin: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        validate: {
            isDate: { msg: "Debe ingresar una fecha válida" }
        },
        get() {
            const rawValue = this.getDataValue("fecha_fin");
            if (rawValue) {
                const date = new Date(rawValue + "T00:00:00");
                return date.toLocaleDateString("es-ES");
            }
            return null;
        }
    },
    motivo: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notNull: { msg: "El motivo es requerido" },
            notEmpty: { msg: "El motivo no puede ser vacío" },
            len: { args: [2, 50], msg: "Debe tener entre 4 y 50 caracteres" }
        }
    },
    estado: {
        type: DataTypes.ENUM("Pendiente", "Aceptada", "Rechazada"),
        allowNull: false,
        defaultValue: "Pendiente",
    },
    fechaSolicitud: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
            notNull: { msg: "La fecha de solicitud es obligatoria" },
            notEmpty: { msg: "La fecha de solicitud no puede estar vacía" },
            isDate: { msg: "Debe ingresar una fecha válida" }
        }
    },
}, {
    tableName: "SolicitudesPermisos"
});

// Relación
Docente.hasMany(SolicitudesPermiso, {
    foreignKey: 'ID_docente',
    sourceKey: 'ID'
});
SolicitudesPermiso.belongsTo(Docente, {
    foreignKey: {
        name: 'ID_docente',
        allowNull: false
    },
    targetKey: 'ID'
});

module.exports = SolicitudesPermiso;