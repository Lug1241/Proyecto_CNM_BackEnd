-- ============================================================
-- Stored Procedure: sp_cerrar_periodo_regular
-- Calcula notas finales y cierra el período académico
-- ============================================================

DELIMITER //

CREATE PROCEDURE sp_cerrar_periodo_regular(IN p_periodo_id INT)
BEGIN
    -- Tabla temporal para almacenar resultados
    DROP TEMPORARY TABLE IF EXISTS temp_resultados;
    CREATE TEMPORARY TABLE temp_resultados (
        id_matricula INT,
        id_estudiante INT,
        nota_final DECIMAL(5,2),
        exam_recuperacion DECIMAL(5,2),
        aprobado BOOLEAN
    );
    
    -- Insertar los cálculos en la tabla temporal
    INSERT INTO temp_resultados (id_matricula, id_estudiante, nota_final, exam_recuperacion, aprobado)
    SELECT 
        m.ID AS id_matricula,
        m.ID_estudiante,
        COALESCE(cf.examen_recuperacion, 
            (
                (
                    (
                        ((cp1.insumo1 + cp1.insumo2)/2 * 0.7 + cp1.evaluacion * 0.3) +
                        ((cp2.insumo1 + cp2.insumo2)/2 * 0.7 + cp2.evaluacion * 0.3)
                    ) / 2 * 0.7 + cq1.examen * 0.3
                ) +
                (
                    ((cp3.insumo1 + cp3.insumo2)/2 * 0.7 + cp3.evaluacion * 0.3) +
                    ((cp4.insumo1 + cp4.insumo2)/2 * 0.7 + cp4.evaluacion * 0.3)
                ) / 2 * 0.7 + cq2.examen * 0.3
            ) / 2
        ) AS nota_final,
        cf.examen_recuperacion,
        -- Regla de aprobación: nota >= 7 O (nota >= 4 Y recuperacion >= 7)
        CASE 
            WHEN COALESCE(cf.examen_recuperacion, 0) >= 7 THEN TRUE
            WHEN (
                (
                    (
                        ((cp1.insumo1 + cp1.insumo2)/2 * 0.7 + cp1.evaluacion * 0.3) +
                        ((cp2.insumo1 + cp2.insumo2)/2 * 0.7 + cp2.evaluacion * 0.3)
                    ) / 2 * 0.7 + cq1.examen * 0.3
                ) +
                (
                    ((cp3.insumo1 + cp3.insumo2)/2 * 0.7 + cp3.evaluacion * 0.3) +
                    ((cp4.insumo1 + cp4.insumo2)/2 * 0.7 + cp4.evaluacion * 0.3)
                ) / 2 * 0.7 + cq2.examen * 0.3
            ) / 2 >= 7 THEN TRUE
            ELSE FALSE
        END AS aprobado
    FROM matriculas m
    JOIN inscripciones i ON i.ID_matricula = m.ID
    LEFT JOIN calificaciones_parciales cp1 ON cp1.ID_inscripcion = i.ID AND cp1.quimestre = 'Q1' AND cp1.parcial = 1
    LEFT JOIN calificaciones_parciales cp2 ON cp2.ID_inscripcion = i.ID AND cp2.quimestre = 'Q1' AND cp2.parcial = 2
    LEFT JOIN calificaciones_parciales cp3 ON cp3.ID_inscripcion = i.ID AND cp3.quimestre = 'Q2' AND cp3.parcial = 1
    LEFT JOIN calificaciones_parciales cp4 ON cp4.ID_inscripcion = i.ID AND cp4.quimestre = 'Q2' AND cp4.parcial = 2
    LEFT JOIN calificaciones_quimestrales cq1 ON cq1.ID_inscripcion = i.ID AND cq1.quimestre = 'Q1'
    LEFT JOIN calificaciones_quimestrales cq2 ON cq2.ID_inscripcion = i.ID AND cq2.quimestre = 'Q2'
    LEFT JOIN calificaciones_finales cf ON cf.ID_inscripcion = i.ID
    WHERE m.ID_periodo_academico = p_periodo_id;
    
    -- Actualizar estados en la tabla matriculas
    UPDATE matriculas m
    JOIN temp_resultados tr ON m.ID = tr.id_matricula
    SET m.estado = IF(tr.aprobado, 'Aprobado', 'Reprobado');
    
    -- Niveles ordenados para promoción
    UPDATE estudiante e
    JOIN (
        SELECT 
            tr.id_estudiante,
            e.nivel AS nivel_actual,
            CASE 
                WHEN e.nivel = '1ro Básico Elemental' THEN '2do Básico Elemental'
                WHEN e.nivel = '2do Básico Elemental' THEN '1ro Básico Medio'
                WHEN e.nivel = '1ro Básico Medio' THEN '2do Básico Medio'
                WHEN e.nivel = '2do Básico Medio' THEN '3ro Básico Medio'
                WHEN e.nivel = '3ro Básico Medio' THEN '1ro Básico Superior'
                WHEN e.nivel = '1ro Básico Superior' THEN '2do Básico Superior'
                WHEN e.nivel = '2do Básico Superior' THEN '3ro Básico Superior'
                WHEN e.nivel = '3ro Básico Superior' THEN '1ro Bachillerato'
                WHEN e.nivel = '1ro Bachillerato' THEN '2do Bachillerato'
                WHEN e.nivel = '2do Bachillerato' THEN '3ro Bachillerato'
                WHEN e.nivel = '3ro Bachillerato' THEN 'Graduado'
                ELSE e.nivel
            END AS nuevo_nivel
        FROM temp_resultados tr
        JOIN estudiante e ON e.ID = tr.id_estudiante
        JOIN matriculas m ON m.ID_estudiante = e.ID AND m.ID_periodo_academico = p_periodo_id
        WHERE tr.aprobado = TRUE
    ) promociones ON e.ID = promociones.id_estudiante
    SET e.nivel = promociones.nuevo_nivel;
    
    -- Mostrar resultados
    SELECT 
        COUNT(*) AS total_actualizados,
        SUM(CASE WHEN aprobado = TRUE THEN 1 ELSE 0 END) AS aprobados,
        SUM(CASE WHEN aprobado = FALSE THEN 1 ELSE 0 END) AS reprobados
    FROM temp_resultados;
    
    -- Limpiar tabla temporal
    DROP TEMPORARY TABLE IF EXISTS temp_resultados;
    
END //

DELIMITER ;
