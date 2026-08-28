const {DataTypes}= require('sequelize')
const {sequelize}= require('../config/sequelize.config')

const Periodo_Academico = sequelize.define('Periodo_Academico',{
    ID: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    },
    descripcion: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notNull: { msg: "La descripción del periodo es requerida"},
            notEmpty: {msg: "La descripción del periodo no puede ser vacía"},
            len: { args: [4, 50], msg: "La descripción debe tener entre 4 y 50 caracteres"},
            
        }
    },
    estado: {
        type: DataTypes.ENUM("Activo", "Finalizado"),
        allowNull: false,
        defaultValue: "Activo",
    },
    fecha_inicio: {
        type: DataTypes.DATEONLY,  // Solo guarda la fecha sin hora
        allowNull: false,
        validate: {
            notNull: { msg: "La fecha de inicio es obligatoria" },
            notEmpty: { msg: "La fecha de inicio no puede estar vacía" },
            isDate: {msg: "Debe ingresar una fecha válida"}
        },
        // Getter: Para cuando recuperas la fecha de la BD
        get() {
            const rawValue = this.getDataValue("fecha_inicio");
            if (rawValue) {
                const date = new Date(rawValue + "T00:00:00"); // Asegura que la fecha esté en el inicio del día
                return date.toLocaleDateString("es-ES");
            }
            return null;
        },
        
    },
    fecha_fin: {
        type: DataTypes.DATEONLY,  // Solo guarda la fecha sin hora
        allowNull: false,
        validate: {
            notNull: { msg: "La fecha de finalización es obligatoria" },
            notEmpty: { msg: "La fecha de finalización no puede estar vacía" },
            isDate: {msg: "Debe ingresar una fecha válida"}
        },
        // Getter: Para cuando recuperas la fecha de la BD
        get() {
            const rawValue = this.getDataValue("fecha_fin");
            if (rawValue) {
                const date = new Date(rawValue + "T00:00:00"); // Asegura que la fecha esté en el inicio del día
                return date.toLocaleDateString("es-ES");
            }
            return null;
        },
        
    }
}, 
{
    tableName: 'periodos_academicos'
}
)
module.exports=Periodo_Academico;