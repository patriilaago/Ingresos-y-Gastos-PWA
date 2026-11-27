import {
  db,
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  setDoc
} from "../firebase.js";
import { Movimiento } from "../modelos/Movimiento.js";

/** Encapsula todas las operaciones con Cloud Firestore. */
export class ServicioFinanzas {
  #referenciaMovimientos(uid) {
    return collection(db, "users", uid, "transactions");
  }

  /** Movimientos de un mes ("AAAA-MM"), de más reciente a más antiguo. */
  obtenerMovimientosMes(uid, mes) {
    return this.obtenerMovimientosRango(uid, `${mes}-01`, `${mes}-31`);
  }

  /** Movimientos entre dos fechas "AAAA-MM-DD" (ambas incluidas), de más reciente a más antiguo. */
  async obtenerMovimientosRango(uid, desde, hasta) {
    const consulta = query(
      this.#referenciaMovimientos(uid),
      where("date", ">=", desde),
      where("date", "<=", hasta)
    );
    const instantanea = await getDocs(consulta);
    return instantanea.docs
      .map((documento) => Movimiento.desdeDocumento(documento))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  /** Guarda un movimiento y devuelve el id que le ha asignado Firestore. */
  async guardarMovimiento(uid, movimiento) {
    const referencia = await addDoc(this.#referenciaMovimientos(uid), movimiento.aObjetoFirestore());
    return referencia.id;
  }

  eliminarMovimiento(uid, idMovimiento) {
    return deleteDoc(doc(db, "users", uid, "transactions", idMovimiento));
  }

  /** Presupuesto mensual guardado en users/{uid}.monthlyBudget, o null si no hay. */
  async obtenerPresupuesto(uid) {
    const instantanea = await getDoc(doc(db, "users", uid));
    if (!instantanea.exists()) return null;
    const valor = Number(instantanea.data().monthlyBudget);
    return Number.isFinite(valor) && valor > 0 ? valor : null;
  }

  /** Guarda (o quita, con null) el presupuesto sin tocar otros campos del documento. */
  guardarPresupuesto(uid, importe) {
    return setDoc(doc(db, "users", uid), { monthlyBudget: importe }, { merge: true });
  }
}
