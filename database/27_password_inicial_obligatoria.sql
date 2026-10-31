-- El club comunica a las familias una contraseña inicial fija (1234) para
-- entrar a "Mi app" la primera vez, en vez de una contraseña aleatoria
-- larga y difícil de transcribir a mano. Como esa contraseña la sabe
-- cualquiera, se añade esta columna para poder obligar a cambiarla la
-- primera vez que el usuario entra (lo hace la app, ver routes/auth.js y
-- routes/usuarios.js): se pone a TRUE cada vez que el sistema genera la
-- contraseña automáticamente (importación de Excel sin contraseña en la
-- fila, aprobación de una solicitud de alta) y se vuelve a FALSE en
-- cuanto el usuario cambia su contraseña por una propia.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_contrasena BOOLEAN NOT NULL DEFAULT FALSE;
