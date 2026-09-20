// Este middleware es el corazón de "cada rol ve solo lo suyo".
// Se usa en cada ruta declarando qué roles pueden entrar.
//
// Ejemplo de uso en una ruta:
//   router.get('/personal', autenticar, requiereRol('administrador'), listarPersonal)
//
// Para rutas donde varios roles pueden entrar pero con distinto alcance
// de datos (ej: un entrenador solo ve SUS jugadores, dirección los ve
// todos), el filtrado de qué FILAS puede ver no va aquí — este
// middleware solo decide si puede entrar a la ruta. El alcance de datos
// se aplica dentro de cada consulta SQL usando req.usuario.roles y
// req.usuario.id (ver ejemplo en routes/deportistas.js).

function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    const tieneAcceso = req.usuario.roles.some(r => rolesPermitidos.includes(r));
    if (!tieneAcceso) {
      return res.status(403).json({ error: 'No tienes permiso para esto' });
    }
    next();
  };
}

// Atajo: administrador y dirección_deportiva siempre tienen acceso total
// de lectura. Se usa mucho, así que se define una vez aquí.
const ACCESO_TOTAL_LECTURA = ['administrador', 'direccion_deportiva'];

// Quién puede dar de alta/editar fichas de deportistas, asignarlos a
// equipos, etc. El coordinador gestiona la plantilla de sus equipos, así
// que también entra aquí (el entrenador, en cambio, solo consulta y marca
// lesión/asistencia de los suyos — ver routes/deportistas.js).
const GESTION_DEPORTIVA = ['administrador', 'direccion_deportiva', 'coordinador'];

// Cualquiera que entrene o coordine (no un deportista con solo su propio
// acceso). Se usa para recursos compartidos entre cuerpos técnicos, como
// el banco de ejercicios o la planificación: cualquiera puede consultarlo
// y aportar, pero un deportista no debería ver la pizarra táctica de sus
// entrenadores.
//
// IMPORTANTE: el monitor queda deliberadamente FUERA de este grupo. Su
// perfil es el más limitado del club: solo consulta la ficha de los
// deportistas de su equipo y marca asistencia (rutas deportistas.js y
// sesiones.js, que ya filtran por equipo_personal sin necesitar este
// middleware). No debe entrar al banco de ejercicios, la planificación,
// ni la gestión de equipos/competiciones — si algún día necesita algo
// más, se añade explícitamente ahí, nunca aquí.
const PERSONAL_TECNICO = ['administrador', 'direccion_deportiva', 'coordinador', 'entrenador'];

// Perfiles que NUNCA deben ver datos económicos (cuotas, pagos). Además
// de no estar en ACCESO_TOTAL_LECTURA (que ya los bloquea en cuotas.js),
// se deja esta lista aparte para dejar constancia explícita de la regla:
// coordinador y entrenador gestionan lo deportivo, nunca lo económico.
const SIN_ACCESO_ECONOMICO = ['coordinador', 'entrenador', 'monitor'];

module.exports = {
  requiereRol, ACCESO_TOTAL_LECTURA, GESTION_DEPORTIVA, PERSONAL_TECNICO, SIN_ACCESO_ECONOMICO,
};
