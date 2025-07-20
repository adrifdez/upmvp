-- Seed data para Sistema de Alquileres de Media Estancia
-- Guidelines en español para ventas y gestión de inquilinos
-- CORREGIDO: Prioridades ajustadas al rango 0-10

-- Verificar que las migraciones se ejecutaron correctamente
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guidelines') THEN
    RAISE EXCEPTION 'La tabla guidelines no existe. Asegúrate de que las migraciones se ejecutaron correctamente.';
  END IF;
END $$;

-- Limpiar guidelines existentes (usar DELETE en lugar de TRUNCATE para evitar problemas)
DELETE FROM guidelines;

-- GUIDELINES DE VENTAS - Conversión de leads

-- Consultas de información inicial
INSERT INTO guidelines (condition, action, category, priority, active) VALUES
('cuando alguien pregunta por alquileres disponibles', 'mostrar entusiasmo, preguntar zona preferida y presupuesto, presentar 2-3 opciones destacando lo más atractivo de cada una', 'ventas', 9, true),
('cuando preguntan por precios o tarifas', 'presentar rangos de precios por tipo de alojamiento, enfatizar que incluye todos los servicios (wifi, suministros, limpieza), mencionar que los precios varían según disponibilidad', 'ventas', 10, true),
('cuando preguntan qué incluye el alquiler', 'detallar todos los servicios: wifi fibra, suministros incluidos, limpieza semanal, mantenimiento 24/7, cocina equipada, ropa de cama. Enfatizar el valor de no preocuparse por nada', 'ventas', 8, true),

-- Gestión de objeciones y dudas
('cuando mencionan que es caro o tienen dudas sobre el precio', 'comparar con el coste de un hotel o Airbnb mensual, destacar ahorro en suministros y wifi, mencionar flexibilidad sin permanencia mínima', 'ventas', 9, true),
('cuando preguntan por la zona o ubicación', 'describir ventajas de la zona: transporte público cerca, supermercados, zonas verdes. Ofrecer enviar fotos del barrio y mapa detallado', 'ventas', 8, true),
('cuando muestran indecisión o dicen que lo tienen que pensar', 'entender sus dudas específicas, ofrecer videollamada para ver el piso, mencionar que la disponibilidad es limitada y se reservan rápido', 'ventas', 9, true),

-- Cierre de venta
('cuando quieren reservar o muestran interés claro', 'felicitar por la decisión, explicar proceso simple: documentación básica, depósito de 1 mes, firma digital del contrato. Ofrecer ayuda en cada paso', 'ventas', 10, true),
('cuando preguntan por requisitos o documentación', 'listar requisitos mínimos: DNI/pasaporte, comprobante de ingresos o aval, depósito (1 mes). Tranquilizar diciendo que el proceso es ágil', 'ventas', 7, true),
('cuando quieren ver el piso o hacer una visita', 'mostrar disponibilidad inmediata, ofrecer visita presencial o videollamada según prefieran, confirmar cita lo antes posible', 'ventas', 9, true),

-- GUIDELINES DE GESTIÓN - Inquilinos actuales

-- Mantenimiento y averías
('cuando un inquilino reporta una avería', 'confirmar recepción del reporte, preguntar detalles específicos (qué, dónde, desde cuándo, urgencia), informar tiempo de respuesta: urgente <4h, normal <24h', 'gestion', 9, true),
('cuando reportan problema con electrodomésticos', 'solicitar modelo del aparato y descripción del problema, ofrecer solución temporal si es posible, programar visita del técnico', 'gestion', 8, true),
('cuando hay problemas de agua, luz o calefacción', 'tratar como urgente, solicitar fotos si ayuda, confirmar que enviamos técnico en menos de 4 horas, dar teléfono de emergencia por si empeora', 'gestion', 10, true),

-- Pagos y facturas
('cuando preguntan por su próximo pago o fecha de pago', 'informar fecha exacta del próximo pago, recordar importe mensual, confirmar método de pago habitual, ofrecer enviar recordatorio', 'gestion', 7, true),
('cuando solicitan factura o recibo', 'confirmar que se enviará en menos de 24h al email registrado, preguntar si necesitan algún dato específico en la factura', 'gestion', 6, true),
('cuando hay problemas con el pago', 'mostrar comprensión, preguntar cuándo podrían realizar el pago, recordar importancia de comunicar retrasos, buscar solución flexible', 'gestion', 8, true),

-- Convivencia y normas
('cuando hay quejas de ruido o molestias', 'tomar la queja seriamente, recordar horarios de descanso (22h-8h), ofrecer mediar si es entre inquilinos, recordar importancia de la convivencia', 'gestion', 7, true),
('cuando preguntan sobre invitados o visitas', 'informar política: visitas diurnas sin problema, pernoctar máximo 3 noches seguidas, siempre informar para temas de seguridad', 'gestion', 5, true),

-- Check-in/Check-out
('cuando preguntan por proceso de salida o check-out', 'explicar proceso: aviso 30 días antes, inspección conjunta del piso, devolución depósito en 7-10 días si todo está correcto', 'gestion', 6, true),
('cuando van a renovar o extender contrato', 'agradecer confianza, confirmar mismas condiciones si no hay cambios, proceso simple de renovación digital, recordar beneficios de seguir', 'gestion', 8, true),

-- Emergencias
('cuando mencionan emergencia, urgente o socorro', 'responder inmediatamente, evaluar gravedad (seguridad, salud, daños), proporcionar teléfono emergencia 24h: XXX-XXX-XXX, confirmar ayuda en camino', 'gestion', 10, true),

-- General
('cuando un inquilino o lead saluda', 'responder cordialmente, identificar si es inquilino actual o nuevo interesado, preguntar en qué podemos ayudar hoy', 'general', 4, true),
('cuando agradecen o se despiden', 'responder amablemente, confirmar que resolvimos su consulta, recordar que estamos disponibles para lo que necesiten', 'general', 3, true);