require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const usuariosRouter = require('./routes/usuarios');
const deportistasRouter = require('./routes/deportistas');
const deportesRouter = require('./routes/deportes');
const temporadasRouter = require('./routes/temporadas');
const equiposRouter = require('./routes/equipos');
const cuotasRouter = require('./routes/cuotas');
const partidosRouter = require('./routes/partidos');
const sesionesRouter = require('./routes/sesiones');
const inicioRouter = require('./routes/inicio');
const ejerciciosRouter = require('./routes/ejercicios');
const planificacionesRouter = require('./routes/planificaciones');
const metodologiaRouter = require('./routes/metodologia');
const competicionesRouter = require('./routes/competiciones');

const app = express();
app.use(cors());
app.use(express.json());

// Fotos de deportistas y demás archivos subidos (ver routes/deportistas.js)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth', authRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/deportistas', deportistasRouter);
app.use('/api/deportes', deportesRouter);
app.use('/api/temporadas', temporadasRouter);
app.use('/api/equipos', equiposRouter);
app.use('/api/cuotas', cuotasRouter);
app.use('/api/partidos', partidosRouter);
app.use('/api/sesiones', sesionesRouter);
app.use('/api/inicio', inicioRouter);
app.use('/api/ejercicios', ejerciciosRouter);
app.use('/api/planificaciones', planificacionesRouter);
app.use('/api/metodologia', metodologiaRouter);
app.use('/api/competiciones', competicionesRouter);

app.get('/api/salud', (req, res) => res.json({ estado: 'ok' }));

// En producción (Docker), el frontend ya viene compilado en
// frontend/dist y este mismo servidor lo sirve — así solo hay un puerto
// público y no hay líos de CORS entre frontend y API. En desarrollo local
// (npm run dev en frontend/) esta carpeta no existe y no pasa nada: el
// frontend se sirve aparte con Vite.
const CARPETA_FRONTEND = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (require('fs').existsSync(CARPETA_FRONTEND)) {
  app.use(express.static(CARPETA_FRONTEND));
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    res.sendFile(path.join(CARPETA_FRONTEND, 'index.html'));
  });
}

// Manejador de errores general (recoge, entre otros, los que lance multer
// al subir una foto: archivo demasiado grande, tipo no válido...)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Error inesperado' });
});

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => console.log(`NUBAPP backend escuchando en puerto ${PUERTO}`));
