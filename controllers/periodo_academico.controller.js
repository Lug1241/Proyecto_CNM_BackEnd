const Periodo = require('../models/periodo_academico.model');
const {programarCierrePeriodo} = require('./programarCierre.controller')
const { Op, Sequelize } = require("sequelize");

const createPeriodo = async (req, res) => {
    try {
        console.log(req.body)
        const periodo_academico = req.body
        const periodo_academicoFound = await Periodo.findOne({where: {descripcion: periodo_academico.descripcion} })
        if (periodo_academicoFound) {
            return res.status(409).json({ message: "Error la periodo ya existe" })
        }
        console.log("este es el periodo a crear", periodo_academico)
        if(periodo_academico.fecha_fin<=periodo_academico.fecha_inicio){
            return res.status(400).json({message: "La fecha fin debe ser mayor que la fecha de inicio"})
        }
        const result = await Periodo.create(periodo_academico)
       programarCierrePeriodo(result.ID, periodo_academico.fecha_fin)
        
       return res.status(201).json(result)
    } catch (error) {
        console.error("Error al crear periodo", error)
        if (error.name === "SequelizeValidationError") {
            console.log("Estos son los errores", error);
            
            const errEncontrado = error.errors.find(err =>
                err.validatorKey === "notEmpty" ||
                err.validatorKey === "isNumeric" ||
                err.validatorKey === "len" ||
                err.validatorKey ==="is_null" ||
                err.validatorKey ==="isDate"
            );
        
            if (errEncontrado) {
                return res.status(400).json({ message: errEncontrado.message });
            }
        }
        
        if (error.name === "SequelizeUniqueConstraintError") {
            const errEncontrado = error.errors.find(err =>
              err.validatorKey === "not_unique" 
              
            );
            if (errEncontrado) {
              return res.status(400).json({ message: `${errEncontrado.path} debe ser único` });
            }
      
          }
        return res.status(500).json({message: `Error al crear periodo en el servidor`})
    }
}
const updatePeriodo= async (req, res)=>{
    try {
        const periodo = req.body
        const id= req.params.id
        console.log("este es el periodo a editar", periodo)
        if(periodo.fecha_fin<=periodo.fecha_inicio){
            return res.status(400).json({message: "La fecha fin debe ser mayor que la fecha de inicio"})
        }
        const [updatedRows] = await Periodo.update(periodo,{where: {id}})
        if(updatedRows===0){
            return res.status(404).json({message: "Periodo no encontrada"})
        }
        const result= await Periodo.findByPk(id)
        programarCierrePeriodo(result.ID, periodo.fecha_fin)
        console.log("ESto se envia da la base al actualizar",result)
       return res.status(200).json(result)
    } catch (error) {
        console.error("Error al editar periodo", error)
        if (error.name === "SequelizeValidationError") {
            console.log("Estos son los errores", error);
            
            const errEncontrado = error.errors.find(err =>
                err.validatorKey === "notEmpty" ||
                err.validatorKey === "isNumeric" ||
                err.validatorKey === "len" ||
                err.validatorKey ==="is_null" ||
                err.validatorKey ==="isDate"
            );
        
            if (errEncontrado) {
                return res.status(400).json({ message: errEncontrado.message });
            }
        }
       
        if (error.name === "SequelizeUniqueConstraintError") {
            const errEncontrado = error.errors.find(err =>
              err.validatorKey === "not_unique" 
              
            );
            if (errEncontrado) {
              return res.status(400).json({ message: `${errEncontrado.path} debe ser único` });
            }
      
          }
        return res.status(500).json({message: `Error al editar periodo en el servidor`})
    }
}
const getPeriodo = async(req, res)=>{
    
    try {
        const id= req.params.id
        const periodo = await Periodo.findByPk(id)
        if(!periodo){
            return res.status(404).json({message: "Periodo no encontrado"})
        }
        
        
        return res.status(200).json(periodo)
    } catch (error) {
        console.error("Error al obtener periodo", error)
        return res.status(500).json({message: `Error al obtener periodo en el servidor`})
    }
}
const getPeriodoActivo = async(req, res)=>{
    
    try {
        
        const periodo = await Periodo.findOne({where:{estado:"Activo"}})
        if(!periodo){
            return res.status(404).json({message: "Periodo no encontrado"})
        }
        
        
        return res.status(200).json(periodo)
    } catch (error) {
        console.error("Error al obtener periodo", error)
       return  res.status(500).json({message: `Error al obtener periodo en el servidor`})
    }
}
const getPeriodos = async (req, res) => {
    try {
        let { page = 1, limit = 13, search = '' } = req.query;

        page = parseInt(page);
        limit = parseInt(limit);

        let whereConditions = {};

        if (search.trim() !== '') {
            const term = search.trim().toLowerCase();

            whereConditions = Sequelize.where(
                Sequelize.fn("LOWER", Sequelize.col("descripcion")),
                { [Op.like]: `%${term}%` }
            );
        }

        const { count, rows: periodos } = await Periodo.findAndCountAll({
            limit,
            offset: (page - 1) * limit,
            where: whereConditions
        });

        return res.status(200).json({
            data: periodos,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalRows: count
        });

    } catch (error) {
        console.error("Error al obtener periodos", error);
        return res.status(500).json({ message: `Error al obtener periodos en el servidor:` });
    }
};


const deletePeriodo = async(req, res)=>{
    try {
        
        const id= req.params.id
        const periodo = await Periodo.findByPk(id)
        if(!periodo){
            return res.status(404).json({message: "Periodo no encontrada"})
        }
         await Periodo.destroy({where: {id}})
        
        return res.status(200).json(periodo)
    } catch (error) {
        console.error("Error al eliminar periodo", error)
        return res.status(500).json({message: `Error al eliminar periodo en el servidor:`})
    }
}
module.exports= {
    createPeriodo,
    updatePeriodo,
    getPeriodo,
    getPeriodos,
    deletePeriodo,
    getPeriodoActivo
}