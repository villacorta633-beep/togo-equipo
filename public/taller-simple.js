// ══ MI TALLER (vista sencilla) ═══════════════════════════════════════════════
// Para cada vehículo: qué trabajos se le hicieron en el período, por qué se hicieron
// (qué fallaba, por qué pasa en un vehículo de reparto y por qué convenía hacerlo)
// y qué hacer de aquí en adelante. Lee los mismos gastos que Taller (taller.js).
// No usa los huecos de cambio de aceite: los registros de aceite pueden estar incompletos.
(function (global) {
'use strict';
const T = global.Taller || (typeof require !== 'undefined' ? require('./taller.js') : null);

// ── Qué sabe un mecánico de cada trabajo ─────────────────────────────────────
// re se prueba sobre la descripción ya normalizada (mayúsculas, sin tildes, corregida).
// falla: qué estaba fallando · pasa: por qué pasa en reparto · justifica: por qué convenía hacerlo
// despues: qué hacer de aquí en adelante para cuidar ese trabajo.
const TRABAJOS = {
  moto: [
    { id: 'motor', nombre: 'Motor: pistón, anillas y válvulas',
      re: /PISTON|ANILLA|RECTIFIC|CULATA|VALVULA|ASENTADO|TORNERIA CILINDRO/,
      falla: 'El pistón, las anillas o las válvulas estaban gastados. Por ahí se escapa la compresión: el motor pierde fuerza, cuesta encenderlo y empieza a quemar aceite. La tornería rectifica el cilindro y la culata para que las piezas nuevas sellen.',
      pasa: 'Es el desgaste normal del motor por kilómetros y horas de trabajo. Un motor de 160 cc enfriado por aire que pasa el día en tráfico, con arranques y paradas y el cajón cargado, trabaja caliente y se gasta antes que el de una moto particular.',
      justifica: 'Si no se arregla, el motor sigue perdiendo fuerza hasta recalentarse o trabarse. Ahí el daño llega al cigüeñal y al cilindro, y la reparación cuesta mucho más.',
      despues: ['Los primeros 1.000 km después de la reparación: manejo suave, sin acelerar a fondo, y un cambio de aceite temprano para sacar las limaduras del armado.', 'Medir el nivel de aceite cada semana: un motor recién armado o gastado puede consumir aceite.'] },
    { id: 'embrague', nombre: 'Embrague',
      re: /EMBRAGUE|PRENSA(?! DE (PARADOR|PARRILLA))|COLLARIN|DISCOS? DE EMB/,
      excluye: /^(?!.*(DISCO|PRENSA|PLATO|KIT|COLLARIN)).*(CHICOTILLO|CABLE|PALANCA|MANIJA)/,
      falla: 'El embrague patinaba: el motor acelera pero la moto no avanza con fuerza, sobre todo al arrancar con carga o en subida. Se cambiaron los discos o la prensa, que son los que transmiten la fuerza.',
      pasa: 'En reparto el embrague se usa cientos de veces al día: en cada entrega, esquina y semáforo se arranca de nuevo. Los discos se gastan y los resortes de la prensa pierden fuerza con el calor.',
      justifica: 'Con el embrague patinando la moto no responde al arrancar ni al subir con carga: es un riesgo para el conductor y la moto puede quedarse parada en plena ruta.',
      despues: ['Revisar en cada servicio el juego de la palanca del embrague (unos 10 a 20 mm en la punta).', 'Recordar al conductor arrancar siempre en primera y no llevar la mano apoyada en la palanca.'] },
    { id: 'distribucion', nombre: 'Distribución: cadenilla, tensor y balancines',
      re: /CADENILLA|TE?N?SADOR (AUTOMATICO|DE CADENILLA)|BALANCIN/,
      falla: 'La cadenilla de distribución, que sincroniza el cigüeñal con las válvulas, estaba estirada o el tensor ya no la mantenía firme. Se nota como un ruido metálico en el motor. Los balancines son los que abren las válvulas.',
      pasa: 'La cadenilla se estira con los kilómetros y con muchas horas de motor encendido, y el tensor automático pierde fuerza con el tiempo.',
      justifica: 'Una cadenilla floja puede saltar un diente: las válvulas chocan con el pistón y el motor se daña por completo. Cambiarla a tiempo evita una reparación mucho más cara.',
      despues: ['Pedir en cada servicio que escuchen el motor en frío: el ruido de cadenilla avisa antes de que falle.', 'Calibrar las válvulas (tasado de balancines) cada 4.000 a 6.000 km.'] },
    { id: 'caja', nombre: 'Caja de cambios',
      re: /EJE (DE CAMBIO|DESPLAZADOR|SELECTOR)|SEPARADOR DE CAJA|SELECTOR|CAJA DE CAMBIO|RODAMIENTO DE CAJA/,
      falla: 'Piezas de la caja de cambios (eje de cambio, desplazador o separador) estaban gastadas o dañadas: los cambios entraban duro, no entraban o se salían en marcha.',
      pasa: 'En reparto se cambia de marcha todo el tiempo. Cuando el embrague no corta del todo o se mete el cambio con fuerza, las piezas de la caja se gastan antes.',
      justifica: 'Un cambio que se sale en marcha deja a la moto sin tracción de golpe, por ejemplo al cruzar una esquina. Además, una pieza rota dentro de la caja daña los engranajes.',
      despues: ['Recordar al conductor pisar el embrague a fondo antes de cada cambio y no forzar la palanca.'] },
    { id: 'kit', nombre: 'Kit de transmisión: cadena, piñón y corona',
      re: /KIT DE TRANSMISION|KIT TRANSMISION|TRANSMISION COMPLETA|TRANSMISION REFORZADA|CAMBIO DE TRANSMISION|\bCORONA\b|\bPINON\b(?! DE ARRANQUE)/,
      falla: 'La cadena estaba estirada y los dientes del piñón y la corona gastados: la moto da tirones y la cadena se afloja seguido.',
      pasa: 'Es una pieza de desgaste, como las llantas. En reparto se gasta más rápido porque se arranca con carga muchas veces al día.',
      justifica: 'Una cadena gastada puede saltarse o cortarse en marcha y trabar la rueda trasera: es un riesgo de caída.',
      despues: ['Tensar y lubricar la cadena cada semana: así el kit dura bastante más.', 'Evitar arrancones con el cajón cargado.'] },
    { id: 'carburador', nombre: 'Carburador',
      re: /CARBURA|EMBOLO|DIAFRAGMA/,
      falla: 'El carburador mezcla el aire con la gasolina. Sus gomas (émbolo, diafragma, oring) estaban endurecidas o rotas, o estaba sucio: la moto tironeaba, se apagaba en ralentí o le costaba acelerar.',
      pasa: 'Las gomas del carburador se secan con el calor del motor y la gasolina. Si el filtro de aire está sucio, entra polvo y lo ensucia.',
      justifica: 'Una mezcla mal regulada hace trabajar el motor caliente y lo desgasta más rápido, además de gastar más gasolina.',
      despues: ['Limpiar el filtro de aire en cada servicio y cambiarlo cuando esté roto o muy sucio.'] },
    { id: 'frenos', nombre: 'Frenos',
      re: /PASTILLA|BALATA|ZAPATA|DISCO DE FRENO|FRENO/,
      falla: 'Las pastillas (freno delantero) o las balatas (freno trasero) estaban gastadas: la moto frena menos y necesita más distancia para detenerse.',
      pasa: 'Es desgaste normal. En reparto se frena muchas veces al día y con peso, así que se gastan más rápido que en una moto particular.',
      justifica: 'Es la pieza de seguridad más importante: con frenos gastados aumenta el riesgo de accidente.',
      despues: ['Revisar pastillas y balatas en cada servicio.'] },
    { id: 'suspension', nombre: 'Suspensión',
      re: /TELESCOP|AMORTIGUA|HORQUILLA|BASCULANTE|RODAMIENTO DE DIRECCION/,
      falla: 'Los telescopios o amortiguadores perdían aceite o ya no amortiguaban: la moto rebota y se siente insegura en baches.',
      pasa: 'Se gastan con el peso del cajón, los baches y los rompemuelles de todos los días.',
      justifica: 'Una suspensión vencida hace perder control en curvas y frenadas, y castiga el resto de la moto.',
      despues: ['Pasar baches y rompemuelles despacio y no sobrecargar el cajón.'] },
    { id: 'electrico', nombre: 'Sistema eléctrico',
      re: /BATERIA|REGULADOR|BOBINA|\bCDI\b|ARRANQUE|ESTATOR|SISTEMA ELECTRICO|FOCO|FAROL|\bLUCES?\b|STOP/,
      falla: 'Falló una parte del sistema eléctrico (batería, regulador, arranque o luces).',
      pasa: 'Las vibraciones, el calor y la lluvia afectan conectores y piezas eléctricas. Una batería que se descarga seguido suele indicar un problema en el sistema de carga.',
      justifica: 'Sin luces o sin arranque la moto no puede circular con seguridad, sobre todo de noche.',
      despues: ['Si vuelve a fallar la batería, medir el sistema de carga antes de comprar otra.'] },
    { id: 'llantas', nombre: 'Llantas',
      re: /LLANTAS? (NUEVA|DELANTERA|TRASERA|\d{2,3})|COMPRA DE (\d )?LLANTAS?|CAMBIO DE LLANTA/,
      excluye: /PARCHAD|VULCANIZ/,
      falla: 'La llanta estaba gastada o dañada.',
      pasa: 'El uso diario, las frenadas y las calles en mal estado gastan las llantas; con presión baja se gastan aún más rápido.',
      justifica: 'Una llanta lisa resbala con lluvia y se pincha mucho más.',
      despues: ['Revisar la presión de las llantas cada semana.'] },
    { id: 'carroceria', nombre: 'Parador y carrocería',
      re: /PARADA|PARADOR|PARRILLA|SOLDADUR|ASIENTO/,
      falla: 'Se arregló el parador, la parrilla del cajón o una soldadura.',
      pasa: 'El peso del cajón y las vibraciones fatigan los soportes y las soldaduras.',
      justifica: 'Un parador o una parrilla rotos pueden hacer caer la moto o el cajón con la carga.',
      despues: ['Revisar los soportes del cajón y el parador en cada servicio.'] },
  ],
  furgon: [
    { id: 'motor', nombre: 'Motor',
      re: /PISTON|ANILLA|RECTIFIC|CULATA|VALVULA|EMPAQUETADURA DE CULATA|REPARACION (DE|DEL) MOTOR|AJUSTE DE MOTOR|BAJAD[OA] DE MOTOR/,
      falla: 'Se reparó la parte interna del motor (culata, válvulas, pistones o anillas). El motor perdía compresión o fuerza, consumía aceite o se había recalentado.',
      pasa: 'Un furgón de reparto trabaja muchas horas en tráfico y con carga. El motor se gasta con los kilómetros, y un recalentamiento daña la culata.',
      justifica: 'Un motor con baja compresión o la culata dañada termina dejando el furgón parado y el daño crece si se sigue usando.',
      despues: ['Revisar cada semana el nivel de aceite y de refrigerante, con el motor frío.', 'Respetar el rodaje después de la reparación: los primeros 1.000 km sin exigir el motor.'] },
    { id: 'distribucion', nombre: 'Correa de distribución',
      re: /CORREA (DENTADA|DE DISTRIB|DE TIEMPO)|KIT DE DISTRIB|TENSOR DE DISTRIB/,
      falla: 'Se cambió la correa de distribución, que sincroniza el cigüeñal con las válvulas, junto con su tensor.',
      pasa: 'Es de goma: envejece con los kilómetros y con los años, aunque el furgón se use poco.',
      justifica: 'Si la correa se corta con el motor andando, las válvulas chocan con los pistones y la reparación es muy cara. Cambiarla a tiempo es mucho más barato.',
      despues: ['Anotar el kilometraje de este cambio: el próximo toca en unos 50.000 a 60.000 km.'] },
    { id: 'retenes', nombre: 'Fugas de aceite del motor',
      re: /RETEN(ES)? DE (CIGUENAL|(ARBOL DE )?LEVAS?)|FUGA DE ACEITE|EMPAQUETADURA DE (CARTER|TAPA)/,
      falla: 'Los retenes del cigüeñal o del árbol de levas dejaban escapar aceite. Para cambiarlos hay que desarmar la distribución.',
      pasa: 'Los retenes son de goma: se endurecen con el calor del motor y los años, y empiezan a gotear.',
      justifica: 'El aceite que gotea cae sobre la correa de distribución y la pudre; si la correa se corta, el arreglo del motor es muy caro. Además, el motor va perdiendo aceite.',
      despues: ['Revisar cada semana si hay manchas de aceite debajo del furgón y avisar apenas aparezcan.'] },
    { id: 'enfriamiento', nombre: 'Sistema de enfriamiento',
      re: /RADIADOR|BOMBA DE AGUA|TERMOSTATO|ELECTROVENTILADOR|VENTILADOR|REFRIGERANTE/,
      falla: 'Falló una parte del sistema que enfría el motor (radiador, bomba de agua, termostato, ventilador o refrigerante).',
      pasa: 'En reparto urbano el furgón va lento y depende del ventilador para enfriarse; el calor de Santa Cruz exige más al sistema.',
      justifica: 'Un recalentamiento daña la culata y la empaquetadura: es la reparación de motor más cara y más común en furgones.',
      despues: ['Revisar cada semana el nivel de refrigerante en frío y avisar si la aguja de temperatura sube.'] },
    { id: 'embrague', nombre: 'Embrague',
      re: /EMBRAGUE|VOLANTE (DE )?INERCIA|COLLARIN|PRENSA/,
      excluye: /^(?!.*(DISCO|PRENSA|PLATO|KIT|COLLARIN|VOLANTE)).*(CHICOTILLO|CABLE|BOMBA|CILINDRO)/,
      falla: 'El embrague patinaba o no cortaba bien: se cambiaron disco, plato o collarín.',
      pasa: 'Arrancar muchas veces al día con carga desgasta el disco del embrague; en tráfico se usa todo el tiempo.',
      justifica: 'Con el embrague patinando el furgón no sube con carga y termina quedándose parado.',
      despues: ['Recordar al conductor no apoyar el pie en el pedal del embrague y arrancar siempre en primera.'] },
    { id: 'caja', nombre: 'Caja, cardán o diferencial',
      re: /CAJA DE CAMBIO|SELECTOR|CARDAN|CRUCETA|DIFERENCIAL|\bCORONA\b|PALIER|HOMOCINETIC|SEMIEJE/,
      falla: 'Se reparó una pieza que lleva la fuerza del motor a las ruedas (caja, cardán, crucetas, diferencial o palieres).',
      pasa: 'El peso de la carga y los arranques constantes desgastan estas piezas; los ruidos y vibraciones avisan antes de que fallen.',
      justifica: 'Si una de estas piezas se rompe en marcha, el furgón queda parado y puede dañar otras partes.',
      despues: ['Pedir que revisen el aceite de caja y diferencial en los servicios grandes.'] },
    { id: 'suspension', nombre: 'Suspensión y dirección',
      re: /\bBUJES?\b|MUELLE|BALLESTA|AMORTIGUA|ROTULA|TERMINAL|AXIAL|ESTABILIZ|SUSPENSI|BRAZO|EJE TRASERO/,
      falla: 'Se cambiaron piezas de la suspensión o la dirección (bujes, muelles, amortiguadores, rótulas o terminales).',
      pasa: 'Se gastan con el peso de la carga, los baches y los rompemuelles de todos los días.',
      justifica: 'Una suspensión o dirección gastada hace perder control al frenar o en curvas, y gasta las llantas de forma dispareja.',
      despues: ['No sobrecargar el furgón y pasar baches despacio.', 'Hacer alineación después de cambiar piezas de la dirección.'] },
    { id: 'frenos', nombre: 'Frenos',
      re: /PASTILLA|BALATA|ZAPATA|DISCO DE FRENO|FRENO/,
      falla: 'Las pastillas o zapatas de freno estaban gastadas.',
      pasa: 'Es desgaste normal; con carga y tráfico se frena mucho más que en un vehículo particular.',
      justifica: 'Es la pieza de seguridad más importante del vehículo.',
      despues: ['Revisar los frenos en cada servicio.'] },
    { id: 'electrico', nombre: 'Sistema eléctrico',
      re: /ALTERNADOR|BATERIA|BENDIX|ARRANQUE|SENSOR|AIRE ACONDICIONADO|SISTEMA ELECTRICO/,
      falla: 'Falló una parte del sistema eléctrico (batería, alternador, arranque o sensores).',
      pasa: 'En reparto se apaga y enciende el motor muchas veces al día: el arranque y la batería trabajan mucho más.',
      justifica: 'Sin arranque o sin carga de batería el furgón se queda parado en ruta.',
      despues: ['Si la batería vuelve a fallar, medir el alternador antes de comprar otra.'] },
    { id: 'llantas', nombre: 'Llantas',
      re: /LLANTAS? (NUEVA|DELANTERA|TRASERA|\d{2,3})|COMPRA DE (\d )?LLANTAS?|CAMBIO DE LLANTA/,
      excluye: /PARCHAD|VULCANIZ|ROTACION/,
      falla: 'Las llantas estaban gastadas o dañadas.',
      pasa: 'Con carga y presión baja se gastan más rápido; una suspensión desalineada las gasta de un lado.',
      justifica: 'Una llanta lisa no frena bien con lluvia y se revienta más fácil con peso.',
      despues: ['Controlar la presión cada semana y hacer rotación y alineación cada 10.000 km.'] },
  ],
};

const COMBUSTIBLE = ['GASOLINA', 'GNV'];
const GRANDE = { moto: 300, furgon: 800 };

// Trabajos de una placa desde un día: cada gasto de taller (sin combustible) con lo que se reconoce en él
function trabajosDe(ctx, placa, desde = -Infinity, hasta = Infinity) {
  const v = ctx.veh.get(placa);
  if (!v) return [];
  const base = TRABAJOS[v.tipo];
  return v.filas.filter(r => !COMBUSTIBLE.includes(r.tipo) && r.dia >= desde && r.dia <= hasta).map(r => {
    const que = base.filter(t => t.re.test(r.d) && !(t.excluye && t.excluye.test(r.d)));
    // Un cambio de aceite, un servicio chico o un preventivo no se explican como reparación
    const grande = r.monto >= GRANDE[v.tipo] && que.length > 0 && r.tipo !== 'PREVENTIVO';
    return { ...r, que, grande };
  }).sort((a, b) => b.dia - a.dia);
}

// Recomendaciones para adelante de una placa, a partir de lo que se le hizo
function recomendaciones(ctx, placa, desde) {
  const v = ctx.veh.get(placa);
  if (!v) return [];
  const recs = [];
  const add = (t, peso) => { if (!recs.some(x => x.t === t)) recs.push({ t, peso }); };
  const periodo = trabajosDe(ctx, placa, desde);
  const anio = trabajosDe(ctx, placa, ctx.ref - 365);
  const km = [...v.filas].reverse().find(r => +r.km > 0);

  // 1) Lo que se repitió: el mismo trabajo grande dos o más veces en 6 meses.
  //    Cuenta solo el trabajo principal de cada gasto (el carburador o una balata que van
  //    junto a una reparación de motor no son "otra vez lo mismo").
  TRABAJOS[v.tipo].forEach(t => {
    const ev = T.eventos(anio.filter(r => r.grande && r.que[0] === t).sort((a, b) => a.dia - b.dia), 7);
    for (let i = 1; i < ev.length; i++) {
      const dias = ev[i].dia - ev[i - 1].dia;
      if (dias <= 183 && ev[i].dia >= desde) {
        add(`Vigilar ${t.nombre.split(':')[0].toLowerCase()}: se trabajó dos veces en ${dias} días (${T.fechaCorta(ev[i - 1].dia)} y ${T.fechaCorta(ev[i].dia)}). En el próximo servicio, pedir que revisen qué lo está causando antes de cambiar más piezas.`, 0);
        break;
      }
    }
  });

  // 2) Cuidados después de cada trabajo grande del período (lo más reciente primero)
  periodo.filter(r => r.grande).forEach(r => r.que.slice(0, 2).forEach(t => t.despues.forEach(d => add(d, 1))));

  // 3) Vehículo con mucho recorrido y varias reparaciones grandes en el año
  const motorAnio = T.eventos(anio.filter(r => r.grande && r.que.some(t => t.id === 'motor')).sort((a, b) => a.dia - b.dia), 30).length;
  const gastoAnio = anio.filter(r => r.grande).reduce((s, r) => s + r.monto, 0);
  if (motorAnio >= 2 && (!km || +km.km >= (v.tipo === 'moto' ? 50000 : 200000)))
    add(`Lleva ${motorAnio} reparaciones de motor en el último año${km ? ` y ${new Intl.NumberFormat('es-BO').format(+km.km)} km` : ''}, con Bs ${new Intl.NumberFormat('es-BO').format(Math.round(gastoAnio))} en trabajos grandes. Si vuelve a necesitar una reparación grande, comparar ese costo con el de renovar ${v.tipo === 'moto' ? 'la moto' : 'el vehículo'}.`, 2);

  // 4) Tareas del plan que no aparecen hace tiempo (sin el aceite: puede faltar registro)
  if (global.Mecanico) {
    global.Mecanico.plan(ctx, placa).filter(p => p.id !== 'aceite' && p.id !== 'cadena').forEach(p => {
      if (p.estado === 'toca') add(`Programar: ${p.nombre.toLowerCase()} (cada ${p.cada}). El último registro es del ${T.fechaCorta(p.ultimo.dia)}.`, 3);
      else if (p.estado === 'sin' && p.critico) add(`Averiguar cuándo se hizo: ${p.nombre.toLowerCase()}. No hay registro, y si falla el arreglo es muy caro.`, 3);
    });
  }

  // 5) Kilometraje: sin km reciente no se pueden programar los servicios
  if (!km || km.dia < ctx.ref - 90) add('Anotar el kilometraje en cada proforma y en STGO: con eso se programan los servicios por km y se sabe cuánto dura cada reparación.', 4);

  if (!recs.length) add('Seguir con los servicios de rutina: no hubo trabajos grandes en este período.', 5);
  return recs.sort((a, b) => a.peso - b.peso).slice(0, 6).map(x => x.t);
}

const api = { TRABAJOS, GRANDE, trabajosDe, recomendaciones };
global.TallerSimple = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
