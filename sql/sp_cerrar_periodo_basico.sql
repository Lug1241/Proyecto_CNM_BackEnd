-- ============================================================
-- Stored Procedure: sp_cerrar_periodo_basico
-- Calcula notas finales y cierra el período académico para Básico Elemental
-- Usa escala cualitativa: DAR, AAR, PAR, NAR
-- ============================================================

DELIMITER //

CREATE PROCEDURE sp_cerrar_periodo_basico(IN p_periodo_id INT)
BEGIN
    -- Tabla temporal para almacenar resultados
    DROP TEMPORARY TABLE IF EXISTS temp_resultados_be;
    CREATE TEMPORARY TABLE temp_resultados_be (
        id_matricula INT,
        id_estudiante INT,
        nota_final DECIMAL(5,2),
        escala_cualitativa VARCHAR(3),
        aprobado BOOLEAN
    );
    
    -- Insertar los cálculos en la tabla temporal
    INSERT INTO temp_resultados_be (id_matricula, id_estudiante, nota_final, escala_cualitativa, aprobado)
    SELECT 
        m.ID AS id_matricula,
        m.ID_estudiante,
        COALESCE(cfbe.examen_recuperacion, 
            (
                (
                    (
                        ((cpbe1.insumo1 + cpbe1.insumo2)/2 * 0.7 + cpbe1.evaluacion * 0.7) +
                        ((cpbe2.insumo1 + cpbe2.insumo2)/2 * 0.7 + cpbe2.evaluacion * 0.7)
                    ) / 2 * 0.7 + cqbe1.examen * 0.3
                ) +
                (
                    ((cpbe3.insumo1 + cpbe3.insumo2)/2 * 0.7 + cpbe3.evaluacion * 0.7) +
                    ((cpbe4.insumo1 + cpbe4.insumo2)/2 * 0.7 + cpbe4.evaluacion * 0.7)
                ) / 2 * 0.7 + cqbe2.examen * 0.3
            ) / 2
        ) AS nota_final,
        -- Convertir nota numérica a escala cualitativa
        CASE 
            WHEN COALESCE(cfbe.examen_recuperacion, 
                (
                    (
                        (
                            ((cpbe1.insumo1 + cpbe1.insumo2)/2 * 0.7 + cpbe1.evaluacion * 0.7) +
                            ((cpbe2.insumo1 + cpbe2.insumo2)/2 * 0.7 + cpbe2.evaluacion * 0.7)
                        ) / 2 * 0.7 + cqbe1.examen * 0.3
                    ) +
                    (
                        ((cpbe3.insumo1 + cpbe3.insumo2)/2 * 0.7 + cpbe3.evaluacion * 0.7) +
                        ((cpbe4.insumo1 + cpbe4.insumo2)/2 * 0.7 + cpbe4.evaluacion * 0.7)
                    ) / 2 * 0.7 + cqbe2.examen * 0.3
                ) / 2
            ) >= 9 THEN 'DAR'
            WHEN COALESCE(cfbe.examen_recuperacion, 
                (
                    (
                        (
                            ((cpbe1.insumo1 + cpbe1.insumo2)/2 * 0.7 + cpbe1.evaluacion * 0.7) +
                            ((cpbe2.insumo1 + cpbe2.insumo2)/2 * 0.7 + cpbe2.evaluacion * 0.7)
                        ) / 2 * 0.7 + cqbe1.examen * 0.3
                    ) +
                    (
                        ((cpbe3.insumo1 + cpbe3.insumo2)/2 * 0.7 + cpbe3.evaluacion * 0.7) +
                        ((cpbe4.insumo1 + cpbe4.insumo2)/2 * 0.7 + cpbe4.evaluacion * 0.7)
                    ) / 2 * 0.7 + cqbe2.examen * 0.3
                ) / 2
            ) >= 7 THEN 'AAR'
            WHEN COALESCE(cfbe.examen_recuperacion, 
                (
                    (
                        (
                            ((cpbe1.insumo1 + cpbe1.insumo2)/2 * 0.7 + cpbe1.evaluacion * 0.7) +
                            ((cpbe2.insumo1 + cpbe2.insumo2)/2 * 0.7 + cpbe2.evaluacion * 0.7)
                        ) / 2 * 0.7 + cqbe1.examen * 0.3
                    ) +
                    (
                        ((cpbe3.insumo1 + cpbe3.insumo2)/2 * 0.7 + cpbe3.evaluacion * 0.7) +
                        ((cpbe4.insumo1 + cpbe4.insumo2)/2 * 0.7 + cpbe4.evaluacion * 0.7)
                    ) / 2 * 0.7 + cqbe2.examen * 0.3
                ) / 2
            ) > 4 THEN 'PAR'
            ELSE 'NAR'
        END AS escala_cualitativa,
        -- Regla de aprobación para BE: DAR, AAR o PAR = aprueba, NAR = reprueba
        -- O si tiene examen de recuperación >= 7
        CASE 
            WHEN COALESCE(cfbe.examen_recuperacion, 0) >= 7 THEN TRUE
            WHEN COALESCE(cfbe.examen_recuperacion, 
                (
                    (
                        (
                            ((cpbe1.insumo1 + cpbe1.insumo2)/2 * 0.7 + cpbe1.evaluacion * 0.7) +
                            ((cpbe2.insumo1 + cpbe2.insumo2)/2 * 0.7 + cpbe2.evaluacion * 0.7)
                        ) / 2 * 0.7 + cqbe1.examen * 0.3
                    ) +
                    (
                        ((cpbe3.insumo1 + cpbe3.insumo2)/2 * 0.7 + cpbe3.evaluacion * 0.7) +
                        ((cpbe4.insumo1 + cpbe4.insumo2)/2 * 0.7 + cpbe4.evaluacion * 0.7)
                    ) / 2 * 0.7 + cqbe2.examen * 0.3
                ) / 2
            ) > 4 THEN TRUE
            ELSE FALSE
        END AS aprobado
    FROM matriculas m
    JOIN inscripciones i ON i.ID_matricula = m.ID
    LEFT JOIN calificaciones_parciales_be cpbe1 ON cpbe1.ID_inscripcion = i.ID AND cpbe1.quimestre = 'Q1' AND cpbe1.parcial = 1
    LEFT JOIN calificaciones_parciales_be cpbe2 ON cpbe2.ID_inscripcion = i.ID AND cpbe2.quimestre = 'Q1' AND cpbe2.parcial = 2
    LEFT JOIN calificaciones_parciales_be cpbe3 ON cpbe3.ID_inscripcion = i.ID AND cpbe3.quimestre = 'Q2' AND cpbe3.parcial = 1
    LEFT JOIN calificaciones_parciales_be cpbe4 ON cpbe4.ID_inscripcion = i.ID AND cpbe4.quimestre = 'Q2' AND cpbe4.parcial = 2
    LEFT JOIN calificaciones_quimestrales_be cqbe1 ON cqbe1.ID_inscripcion = i.ID AND cqbe1.quimestre = 'Q1'
    LEFT JOIN calificaciones_quimestrales_be cqbe2 ON cqbe2.ID_inscripcion = i.ID AND cqbe2.quimestre = 'Q2'
    LEFT JOIN calificaciones_finales_be cfbe ON cfbe.ID_inscripcion = i.ID
    WHERE m.ID_periodo_academico = p_periodo_id;
    
    -- Actualizar estados en la tabla matriculas
    UPDATE matriculas m
    JOIN temp_resultados_be tr ON m.ID = tr.id_matricula
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
        FROM temp_resultados_be tr
        JOIN estudiante e ON e.ID = tr.id_estudiante
        JOIN matriculas m ON m.ID_estudiante = e.ID AND m.ID_periodo_academico = p_periodo_id
        WHERE tr.aprobado = TRUE
    ) promociones ON e.ID = promociones.id_estudiante
    SET e.nivel = promociones.nuevo_nivel;
    
    -- Mostrar resultados
    SELECT 
        COUNT(*) AS total_actualizados,
        SUM(CASE WHEN aprobado = TRUE THEN 1 ELSE 0 END) AS aprobados,
        SUM(CASE WHEN aprobado = FALSE THEN 1 ELSE 0 END) AS reprobados,
        SUM(CASE WHEN escala_cualitativa = 'DAR' THEN 1 ELSE 0 END) AS dar,
        SUM(CASE WHEN escala_cualitativa = 'AAR' THEN 1 ELSE 0 END) AS aar,
        SUM(CASE WHEN escala_cualitativa = 'PAR' THEN 1 ELSE 0 END) AS par,
        SUM(CASE WHEN escala_cualitativa = 'NAR' THEN 1 ELSE 0 END) AS nar
    FROM temp_resultados_be;
    
    -- Limpiar tabla temporal
    DROP TEMPORARY TABLE IF EXISTS temp_resultados_be;
    
END //

DELIMITER ;
