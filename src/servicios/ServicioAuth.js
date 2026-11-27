import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "../firebase.js";

/** Encapsula Firebase Authentication. */
export class ServicioAuth {
  iniciarSesion(correo, contrasena) {
    return signInWithEmailAndPassword(auth, String(correo).trim(), contrasena);
  }

  registrar(correo, contrasena) {
    return createUserWithEmailAndPassword(auth, String(correo).trim(), contrasena);
  }

  cerrarSesion() {
    return signOut(auth);
  }

  /** Avisa con el usuario (o null) al arrancar y cada vez que cambia la sesión. */
  alCambiarUsuario(callback) {
    return onAuthStateChanged(auth, callback);
  }
}
