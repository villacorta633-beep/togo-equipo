// ══ MECÁNICO VIRTUAL ════════════════════════════════════════════════════════
// Lo que sabe un mecánico de la flota de TOGO (motos Honda CB160, furgones Suzuki APV
// y la RAM 700 furgón): por qué falla cada pieza, qué otras piezas arrastra, qué revisar
// y qué preguntarle al taller y al conductor. Además arma el plan de mantenimiento y
// cruza los gastos para ver lo que quedó sin revisar.
// Los intervalos son referencias de taller; donde los fabricantes o las fuentes no
// coinciden se dan rangos y se pide confirmar en el manual del vehículo.
(function (global) {
'use strict';
const T = global.Taller;

// ── Los vehículos ────────────────────────────────────────────────────────────
const VEHICULOS = {
  moto: {
    nombre: 'Honda CB160 (Hornet)',
    ficha: [
      'Motor monocilíndrico de 4 tiempos, enfriado por aire: depende del aceite y del aire que lo roza para no recalentarse.',
      'Embrague húmedo: los discos trabajan bañados en el mismo aceite del motor (por eso el aceite debe ser para motos, norma JASO MA).',
      'Distribución por cadenilla con tensor automático; válvulas con holgura que se calibra (tasado de balancines).',
      'Transmisión final por cadena, piñón y corona; la corona va sobre gomas (porta-roseta) que amortiguan los tirones.',
      'Freno delantero de disco (pastillas, mordaza hidráulica) y trasero de tambor (balatas).',
      'Aceite de referencia: 10W-30 JASO MA, cerca de 1 litro (confirmar en el manual de la moto).',
    ],
  },
  apv: {
    nombre: 'Suzuki APV 1.6 (motor G16A)',
    ficha: [
      'Motor de 4 cilindros, 1.6 L, 16 válvulas, enfriado por agua (radiador, bomba, termostato, electroventilador).',
      'Distribución por correa dentada: tiene vida limitada y si se corta deja el vehículo parado y puede dañar válvulas.',
      'Tracción trasera: caja manual con varillaje o chicotillo, cardán y diferencial (corona) con su propio aceite.',
      'Suspensión delantera independiente y trasera con muelles (ballestas) y bujes: sufre mucho con sobrecarga.',
      'Frenos delanteros de disco y traseros de tambor (zapatas).',
    ],
  },
  ram: {
    nombre: 'RAM 700 1.4 (motor Fire Evo, furgón modificado)',
    ficha: [
      'Motor 1.4 L de 8 válvulas (familia Fire de Fiat), enfriado por agua.',
      'Distribución por correa dentada; la bomba de agua y el tensor suelen cambiarse junto con la correa.',
      'Tracción delantera: palieres con homocinéticas (las "crucetas" de adelante); sus guardapolvos rotos dejan entrar tierra.',
      'Trasera con muelles (ballestas): al ser furgón modificado, el peso de la caja se carga atrás y exige más a muelles, amortiguadores y frenos traseros.',
      'Frenos delanteros de disco y traseros de tambor.',
    ],
  },
};

// ── Base de conocimiento por pieza ───────────────────────────────────────────
// aplica: tipos de vehículo; causas: de la más común a la menos; afecta: qué arrastra;
// revisar: lo que un mecánico mira; taller / conductor: preguntas para hacer.
const PIEZAS = {
  aceite: {
    nombre: 'Aceite y filtro', sistema: 'Motor', aplica: ['moto', 'furgon'],
    para: 'Lubrica, enfría y limpia el motor. En la moto también lubrica la caja y el embrague.',
    vida: { moto: 'Cada 2.000–3.000 km con aceite mineral (en reparto urbano, el límite bajo). En días: lo que esa moto recorra; en esta flota, más o menos cada mes.', apv: 'Cada 5.000 km o 3 meses, con filtro.', ram: 'Cada 5.000–10.000 km según el aceite; en reparto urbano, el límite bajo. Siempre con filtro.' },
    sintomas: ['Aceite negro y espeso o con olor a quemado', 'Nivel bajo entre cambios (consume aceite)', 'Humo azul por el escape', 'Ruido de "tac-tac" en frío (cadenilla o válvulas mal lubricadas)'],
    causas: [
      { t: 'Cambios fuera de tiempo', d: 'El aceite pierde viscosidad y aditivos: deja de proteger y el motor se gasta mucho más rápido.' },
      { t: 'Aceite equivocado', d: 'En la moto, un aceite de auto ("ahorro de combustible") hace patinar el embrague. Un grado distinto al del manual cambia la protección en frío y en caliente.' },
      { t: 'Nivel bajo sin que nadie lo revise', d: 'Un motor gastado o con fugas consume aceite; si no se mide cada semana, trabaja seco.' },
      { t: 'Fugas por retenes o empaquetaduras', d: 'Manchas debajo del vehículo; el aceite que cae sobre la correa de distribución (en furgón) la pudre.' },
    ],
    afecta: [
      { p: 'Pistón, anillas y cilindro', d: 'Sin buena lubricación se rayan: aparece consumo de aceite y pérdida de compresión (reparación mayor).' },
      { p: 'Cadenilla y tensor (moto)', d: 'La cadenilla se estira y el tensor automático se vence: ruido metálico y riesgo de que salte.' },
      { p: 'Embrague (moto)', d: 'Comparte el aceite: aceite viejo o equivocado lo hace patinar.' },
      { p: 'Árbol de levas y balancines', d: 'Desgaste que cambia la holgura de válvulas.' },
    ],
    revisar: ['Nivel con la varilla o la mirilla, en plano y con el motor tibio, cada semana', 'Color y olor del aceite', 'Fugas debajo del vehículo', 'Que el filtro se cambie cuando corresponde'],
    taller: ['¿Qué aceite le pusieron (grado y norma)?', '¿Cambiaron el filtro (o limpiaron la malla en la moto)?', '¿A qué kilometraje toca el próximo cambio? Que lo anoten en el comprobante.'],
    conductor: ['¿Revisas el nivel de aceite cada semana?', '¿Notaste humo azul o que le falta aceite entre cambios?'],
  },

  motor: {
    nombre: 'Motor (pistón, anillas, válvulas, culata)', sistema: 'Motor', aplica: ['moto', 'furgon'],
    para: 'Reparación mayor: rectificado de cilindro, pistón y anillas nuevas, asentado de válvulas o arreglo de culata.',
    vida: { moto: 'Un motor bien cuidado pasa largamente los 30.000–40.000 km sin abrirse.', apv: 'Con aceite y refrigerante al día, más de 200.000 km.', ram: 'Con aceite y refrigerante al día, más de 200.000 km.' },
    sintomas: ['Pierde fuerza en subidas', 'Consume aceite o echa humo azul', 'Cuesta arrancar en frío', 'Ruidos internos (golpeteo)', 'Se recalienta (furgón: aguja alta, pierde agua)'],
    causas: [
      { t: 'Aceite vencido o nivel bajo', d: 'La causa más común de una reparación mayor temprana.' },
      { t: 'Filtro de aire sucio, roto o mal colocado', d: 'Entra polvo y "lija" el cilindro y las anillas. Muy común en motos de reparto.' },
      { t: 'Recalentamiento', d: 'Furgón: falta de refrigerante, termostato pegado, radiador tapado o ventilador que no prende. Moto (enfriada por aire): mucho tiempo en ralentí en tráfico, mezcla pobre del carburador o aceite viejo.' },
      { t: 'Agua dentro del motor', d: 'Al cruzar calles inundadas el motor aspira agua: puede doblar la biela y obliga a abrir el motor.' },
      { t: 'Exigirlo en frío o sobre-revolucionarlo', d: 'Arrancar y acelerar fuerte sin que tome temperatura gasta mucho más.' },
      { t: 'Kilometraje y años', d: 'Si el aceite y los filtros estuvieron al día, es desgaste natural.' },
    ],
    afecta: [
      { p: 'Rodaje después de la reparación', d: 'Un motor recién reparado necesita 500–1.000 km de manejo suave y un cambio de aceite temprano. Si no se respeta, la reparación dura poco.' },
      { p: 'Cadenilla, tensor y empaquetaduras', d: 'Si no se cambiaron en la reparación, pueden fallar al poco tiempo.' },
      { p: 'Carburador y bujía', d: 'Un motor con anillas gastadas ensucia la bujía y descalibra la mezcla.' },
      { p: 'Embrague (moto)', d: 'Las limaduras de una avería quedan en el aceite: hay que cambiarlo de nuevo pronto.' },
    ],
    revisar: ['Que se haya encontrado la causa (aceite, filtro de aire, recalentamiento, agua) y no solo arreglado el efecto', 'Compresión del motor', 'Filtro de aire: estado y que selle bien', 'Furgón: refrigerante, termostato, radiador y electroventilador'],
    taller: ['¿Cuál fue la causa del daño: aceite, polvo, recalentamiento o agua?', '¿Midieron el cilindro? ¿El pistón es de sobremedida?', '¿Cambiaron también empaquetaduras, retenes de válvula y filtro de aire?', '¿Qué garantía dan y qué rodaje hay que hacer?', '¿Cuándo hay que hacer el primer cambio de aceite después del arreglo?'],
    conductor: ['¿Notaste pérdida de fuerza, humo o ruido antes de que fallara?', '¿Pasaste por calles inundadas?', '¿Se prendió alguna luz o subió la temperatura (furgón)?'],
  },

  agua: {
    nombre: 'Agua dentro del motor', sistema: 'Motor', aplica: ['moto', 'furgon'],
    para: 'Daño por aspirar agua (cruzar calles inundadas, lavado a presión del motor).',
    vida: {}, sintomas: ['El motor se apaga al cruzar agua y no vuelve a arrancar', 'Aceite color café con leche (agua mezclada)', 'Humo blanco abundante'],
    causas: [
      { t: 'Cruzar calles inundadas', d: 'La toma de aire de la moto está baja: con agua a media rueda ya puede aspirarla.' },
      { t: 'Lavado a presión cerca del filtro de aire', d: 'El agua entra por la caja del filtro.' },
    ],
    afecta: [
      { p: 'Biela y pistón', d: 'El agua no se comprime: puede doblar la biela (motor trabado).' },
      { p: 'Aceite', d: 'El agua mezclada lo arruina: hay que cambiarlo varias veces seguidas.' },
      { p: 'Rodamientos y sistema eléctrico', d: 'El agua también llega a rodamientos de rueda, conectores y la caja.' },
    ],
    revisar: ['No intentar arrancar de nuevo si se apagó en el agua', 'Revisar el filtro de aire y la caja del filtro', 'Cambiar el aceite aunque sea nuevo'],
    taller: ['¿Revisaron que la biela no esté doblada?', '¿Cambiaron el aceite más de una vez para sacar el agua?'],
    conductor: ['¿Dónde se cruzó el agua y a qué altura llegaba?', '¿Intentaste arrancar después de que se apagó?'],
  },

  distribucion: {
    nombre: 'Distribución (correa en furgón, cadenilla en moto)', sistema: 'Motor', aplica: ['moto', 'furgon'],
    para: 'Sincroniza el cigüeñal con las válvulas.',
    vida: { moto: 'La cadenilla dura muchos km si el aceite está al día; se cambia cuando hace ruido o el tensor llega al tope.', apv: 'Correa dentada: alrededor de 60.000–70.000 km o 4–5 años (confirmar en el manual). Con tensor.', ram: 'Correa dentada: alrededor de 50.000–60.000 km o 4 años. Con tensor y, normalmente, la bomba de agua.' },
    sintomas: ['Moto: ruido metálico de cadena en frío o en ralentí', 'Furgón: chillido o golpeteo en la parte delantera del motor', 'Furgón: correa con grietas, dientes gastados o manchada de aceite'],
    causas: [
      { t: 'Se pasó el kilometraje o los años', d: 'La correa es de goma: envejece aunque el furgón ande poco.' },
      { t: 'Aceite o refrigerante sobre la correa', d: 'Un retén de cigüeñal o de levas que gotea pudre la correa antes de tiempo.' },
      { t: 'Tensor o poleas gastados', d: 'Si se cambia solo la correa y no el tensor, la correa nueva dura poco.' },
      { t: 'Moto: aceite vencido', d: 'La cadenilla se estira y el tensor automático se vence.' },
    ],
    afecta: [
      { p: 'Válvulas y pistones', d: 'Si la correa se corta con el motor andando, en muchos motores chocan válvulas con pistones: reparación de culata muy cara.' },
      { p: 'Bomba de agua (furgón)', d: 'Suele moverla la misma correa: si falla después, hay que desarmar todo otra vez. Por eso se cambia junta.' },
      { p: 'Retenes de cigüeñal y levas', d: 'Si gotean, se cambian en la misma desarmada.' },
    ],
    revisar: ['Fecha y kilometraje del último cambio de correa (anotarlo en el vehículo)', 'Fugas de aceite cerca de la tapa de distribución', 'Moto: ruido de cadenilla y estado del tensor'],
    taller: ['¿Cambiaron correa, tensor y poleas como kit?', '¿Cambiaron la bomba de agua en la misma desarmada?', '¿Revisaron los retenes de cigüeñal y de levas?', 'Que anoten el kilometraje del cambio en el comprobante.'],
    conductor: ['¿Escuchas chillidos o ruido de cadena al arrancar?'],
  },

  enfriamiento: {
    nombre: 'Sistema de enfriamiento', sistema: 'Motor', aplica: ['furgon'],
    para: 'Radiador, refrigerante, bomba de agua, termostato y electroventilador: mantienen el motor a su temperatura.',
    vida: { apv: 'Refrigerante cada 2 años; mangueras y tapa del radiador revisarlas en cada servicio.', ram: 'Refrigerante cada 2 años; la bomba de agua normalmente junto con la correa de distribución.' },
    sintomas: ['Se recalienta: la aguja de temperatura sube en tráfico', 'Pierde refrigerante (manchas verdes o rosadas)', 'Vapor o olor dulce', 'Calefacción que no calienta'],
    causas: [
      { t: 'Poner agua en vez de refrigerante', d: 'El agua oxida y tapa el radiador por dentro.' },
      { t: 'Electroventilador que no prende', d: 'En reparto urbano el furgón va lento y depende del ventilador.' },
      { t: 'Termostato pegado o bomba de agua gastada', d: 'El agua no circula bien.' },
      { t: 'Mangueras o tapa de radiador vencidas', d: 'Pierde presión y hierve antes.' },
    ],
    afecta: [
      { p: 'Culata y empaquetadura de culata', d: 'Un recalentamiento alabea la culata y quema la empaquetadura: es la reparación mayor más común en furgones.' },
      { p: 'Aceite', d: 'Con la empaquetadura quemada, el agua pasa al aceite (color café con leche).' },
    ],
    revisar: ['Nivel del depósito de refrigerante cada semana, en frío', 'Que el electroventilador prenda cuando el motor calienta', 'Mangueras sin grietas ni hinchazones'],
    taller: ['¿Le pusieron refrigerante o agua?', '¿Probaron el termostato y el electroventilador?', '¿Hicieron prueba de presión del sistema?'],
    conductor: ['¿Has visto subir la aguja de temperatura?', '¿Le agregas agua seguido?'],
  },

  embrague: {
    nombre: 'Embrague', sistema: 'Transmisión', aplica: ['moto', 'furgon'],
    para: 'Conecta y desconecta el motor de la caja para arrancar y cambiar marchas.',
    vida: { moto: 'Los discos suelen durar 15.000–30.000 km; en reparto urbano, menos.', apv: '60.000–100.000 km según el manejo y la carga.', ram: '60.000–100.000 km según el manejo y la carga.' },
    sintomas: ['Patina: el motor sube de vueltas pero el vehículo no acelera', 'Olor a quemado en subidas', 'Tiembla al arrancar', 'Cuesta meter los cambios (el embrague no corta bien)'],
    causas: [
      { t: 'Manejar con el pie (o la mano) apoyado en el embrague', d: 'Lo deja medio pisado: los discos rozan todo el tiempo.' },
      { t: 'Arrancar en segunda, con mucha carga o en subida "quemando" embrague', d: 'Es el desgaste más rápido que existe.' },
      { t: 'Sobrecarga', d: 'Más peso = más trabajo en cada arranque.' },
      { t: 'Juego mal regulado', d: 'Moto: la palanca necesita un poco de juego (unos 10–20 mm en la punta). Sin juego, el embrague patina solo.' },
      { t: 'Moto: aceite de auto', d: 'Los aditivos "ahorro de combustible" hacen patinar el embrague húmedo.' },
      { t: 'Furgón: retén trasero del cigüeñal que gotea', d: 'El aceite contamina el disco nuevo y lo hace patinar.' },
    ],
    afecta: [
      { p: 'Volante de inercia (furgón)', d: 'Se marca con el calor: al cambiar el embrague hay que rectificarlo o el disco nuevo vibra y dura poco.' },
      { p: 'Collarín o rodamiento de empuje (furgón)', d: 'Se cambia junto: si falla después, hay que bajar la caja de nuevo.' },
      { p: 'Caja de cambios y sincronizados', d: 'Un embrague que no corta bien obliga a forzar los cambios: se dañan sincronizados y chicotillos.' },
      { p: 'Chicotillo del embrague', d: 'Uno estirado o duro hace que el embrague no corte o no suelte del todo.' },
    ],
    revisar: ['Juego del pedal o de la palanca', 'Que no patine en subida con carga', 'Fugas del retén trasero del cigüeñal (furgón)'],
    taller: ['¿Cambiaron disco, plato y collarín como kit?', '¿Rectificaron el volante de inercia?', '¿Revisaron el retén trasero del cigüeñal?', 'Moto: ¿qué aceite le pusieron? Tiene que ser JASO MA.'],
    conductor: ['¿Apoyas el pie o la mano en el embrague mientras manejas?', '¿Arrancas en primera?', '¿Con cuánta carga trabaja normalmente?'],
  },

  kit: {
    nombre: 'Kit de transmisión (cadena, piñón y corona)', sistema: 'Transmisión', aplica: ['moto'],
    para: 'Lleva la fuerza del motor a la rueda trasera.',
    vida: { moto: '10.000–20.000 km con buen tensado y lubricación; mucho menos si se descuida.' },
    sintomas: ['Ruido de cadena', 'Tirones al acelerar y soltar', 'La cadena se afloja seguido', 'Dientes de la corona en forma de gancho o afilados'],
    causas: [
      { t: 'Sin lubricar', d: 'La cadena seca se estira: lubricarla cada 500–1.000 km y después de lluvia.' },
      { t: 'Tensado incorrecto', d: 'Floja: golpea y salta. Demasiado tensa: se gasta y daña los rodamientos de la caja y de la rueda.' },
      { t: 'Cambiar solo la cadena', d: 'Una cadena nueva con piñón y corona gastados dura la mitad: se cambian siempre los tres juntos.' },
      { t: 'Rueda trasera desalineada', d: 'La cadena trabaja torcida y se come los dientes de un lado.' },
      { t: 'Arranques bruscos', d: 'Cada tirón estira la cadena.' },
    ],
    afecta: [
      { p: 'Gomas del porta-corona (roseta)', d: 'Gastadas dan tirones que destruyen la cadena: se cambian junto con el kit.' },
      { p: 'Rodamientos de la rueda trasera y retén del piñón', d: 'Sufren con una cadena demasiado tensa.' },
      { p: 'Basculante', d: 'Una cadena muy floja lo golpea y lo desgasta.' },
    ],
    revisar: ['Holgura de la cadena (la que indica la etiqueta del basculante; en motos de esta cilindrada suele ser unos 25–35 mm)', 'Que las marcas del tensor estén iguales en ambos lados (alineación)', 'Lubricación', 'Gomas de la roseta'],
    taller: ['¿Cambiaron cadena, piñón y corona juntos?', '¿Revisaron las gomas de la roseta?', '¿Alinearon la rueda con las marcas de los dos lados?'],
    conductor: ['¿Cada cuánto lubricas y tensas la cadena?', '¿Sientes tirones al acelerar?'],
  },

  frenos: {
    nombre: 'Pastillas de freno (disco)', sistema: 'Frenos', aplica: ['moto', 'furgon'],
    para: 'Freno de disco: las pastillas aprietan el disco con la mordaza hidráulica.',
    vida: { moto: 'Delantero: 8.000–15.000 km; en reparto urbano, menos.', apv: '20.000–40.000 km según la carga y el manejo.', ram: '20.000–40.000 km según la carga y el manejo.' },
    sintomas: ['Chillido metálico', 'El pedal o la palanca se va al fondo', 'Vibración al frenar (disco deformado)', 'El vehículo se va hacia un lado'],
    causas: [
      { t: 'Frenadas fuertes y tardías', d: 'La forma de manejar es la causa principal del desgaste rápido.' },
      { t: 'Mordaza agarrotada', d: 'El pistón o los pasadores se pegan: la pastilla queda rozando, se gasta de un solo lado y recalienta el disco.' },
      { t: 'Disco rayado o bajo de medida', d: 'Una pastilla nueva sobre un disco gastado dura poco y frena mal.' },
      { t: 'Pastillas de baja calidad', d: 'Las más baratas se gastan rápido y cristalizan.' },
      { t: 'Líquido de frenos viejo', d: 'Absorbe humedad, corroe la mordaza y pierde eficacia al calentarse.' },
      { t: 'Moto: aceite de telescopios en el disco', d: 'Un retén de telescopio que gotea contamina pastillas y disco.' },
    ],
    afecta: [
      { p: 'Disco', d: 'Pastillas gastadas hasta el metal rayan el disco: hay que rectificarlo o cambiarlo.' },
      { p: 'Rodamientos de rueda', d: 'Un freno que queda rozando los calienta.' },
      { p: 'Llantas', d: 'Frenadas con bloqueo hacen planos en la llanta.' },
    ],
    revisar: ['Espesor de las pastillas en cada servicio', 'Espesor y estado del disco', 'Que la rueda gire libre después de frenar (mordaza que no se pega)', 'Nivel y color del líquido de frenos (cambiarlo cada 2 años)'],
    taller: ['¿Midieron el disco? ¿Hace falta rectificarlo?', '¿Limpiaron y lubricaron los pasadores de la mordaza?', '¿Qué marca de pastillas pusieron?', '¿Cuándo se cambió el líquido de frenos?'],
    conductor: ['¿Frenas fuerte y a último momento?', '¿Notas que el vehículo se va a un lado al frenar?'],
  },

  balatas: {
    nombre: 'Balatas o zapatas (tambor)', sistema: 'Frenos', aplica: ['moto', 'furgon'],
    para: 'Freno de tambor: las balatas se abren contra el tambor.',
    vida: { moto: 'Trasero: 10.000–20.000 km.', apv: 'Traseras: 40.000–60.000 km.', ram: 'Traseras: 40.000–60.000 km.' },
    sintomas: ['Hay que pisar mucho el pedal', 'Ruido de roce en la rueda trasera', 'Moto: el indicador del freno trasero llega al límite'],
    causas: [
      { t: 'Freno mal regulado', d: 'Moto: si el pedal tiene poco juego, la balata queda rozando todo el tiempo. Hay que dejar el juego que indica el manual (unos 20–30 mm).' },
      { t: 'Manejar con el pie apoyado en el pedal', d: 'Freno arrastrado = desgaste continuo y recalentamiento.' },
      { t: 'Sobrecarga atrás', d: 'Furgón cargado: el freno trasero trabaja mucho más.' },
      { t: 'Tambor ovalado o rayado', d: 'Balata nueva sobre tambor gastado: frena mal y dura poco (rectificar el tambor).' },
      { t: 'Agua y barro', d: 'Entran al tambor y actúan como lija.' },
    ],
    afecta: [
      { p: 'Tambor', d: 'Balatas acabadas hasta el remache rayan el tambor.' },
      { p: 'Rodamientos de la rueda trasera', d: 'Un freno arrastrado los calienta.' },
      { p: 'Moto: kit de transmisión', d: 'Cada vez que se mueve la rueda para tensar la cadena, hay que volver a regular el freno trasero.' },
    ],
    revisar: ['Juego del pedal (moto) o del freno de mano (furgón)', 'Que la rueda gire libre', 'Medida del tambor'],
    taller: ['¿Rectificaron o midieron el tambor?', '¿Regularon el freno después del cambio?', '¿Revisaron los resortes y el cilindro de rueda (furgón)?'],
    conductor: ['¿Apoyas el pie en el pedal de freno al manejar?'],
  },

  caja: {
    nombre: 'Caja y chicotillo de cambios', sistema: 'Transmisión', aplica: ['furgon'],
    para: 'El chicotillo (o varillaje) lleva el movimiento de la palanca a la caja.',
    vida: { apv: 'El chicotillo y sus bujes deberían durar años.', ram: 'El chicotillo y sus bujes deberían durar años.' },
    sintomas: ['La palanca queda floja o "baila"', 'Cuesta encontrar los cambios', 'Se sale un cambio', 'Crujido al meter cambio'],
    causas: [
      { t: 'Forzar los cambios', d: 'Meter cambio sin pisar del todo el embrague o con brusquedad estira el chicotillo y rompe sus bujes.' },
      { t: 'Embrague que no corta bien', d: 'Si el embrague arrastra, el conductor tiene que forzar la palanca: el problema real está en el embrague.' },
      { t: 'Bujes del varillaje gastados', d: 'Un buje plástico de pocos pesos hace que se cambie un chicotillo caro.' },
      { t: 'Repuesto de mala calidad o mal instalado', d: 'Si vuelve a fallar en pocos meses, revisar la instalación.' },
    ],
    afecta: [
      { p: 'Sincronizados de la caja', d: 'Forzar cambios los desgasta: después la caja "cruje".' },
      { p: 'Embrague', d: 'Son parte del mismo problema: revisar los dos.' },
    ],
    revisar: ['Que el embrague corte bien (con el motor andando, que entre primera sin ruido)', 'Bujes del varillaje y de la palanca', 'Que el chicotillo no roce el escape ni esté doblado'],
    taller: ['¿Revisaron si el embrague corta bien?', '¿Cambiaron los bujes junto con el chicotillo?', '¿El repuesto es original o alternativo?'],
    conductor: ['¿Pisas el embrague hasta el fondo para cambiar?', '¿Algún cambio cuesta más que los otros?'],
  },

  suspension: {
    nombre: 'Suspensión y dirección', sistema: 'Suspensión', aplica: ['moto', 'furgon'],
    para: 'Moto: telescopios y amortiguadores. Furgón: amortiguadores, muelles, bujes, terminales y rótulas.',
    vida: { moto: 'Aceite de telescopios cada 20.000 km aprox.; los retenes cuando gotean.', apv: 'Amortiguadores 50.000–80.000 km; terminales y rótulas según golpes y carga.', ram: 'Amortiguadores 50.000–80.000 km; terminales, rótulas y guardapolvos de homocinética según golpes.' },
    sintomas: ['Golpes secos en baches', 'El vehículo rebota o se balancea', 'Volante con juego o que vibra', 'Llantas gastadas de forma irregular', 'Moto: aceite en los telescopios'],
    causas: [
      { t: 'Sobrecarga', d: 'Es lo que más daña muelles, bujes y amortiguadores en un furgón de reparto.' },
      { t: 'Baches y rompemuelles a velocidad', d: 'Cada golpe fuerte se lo llevan terminales, rótulas, bujes y telescopios.' },
      { t: 'Guardapolvos rotos', d: 'Entra tierra en rótulas, terminales y homocinéticas y las gasta rápido.' },
      { t: 'Moto: retenes de telescopio gastados', d: 'Pierden aceite: la horquilla se queda sin amortiguación.' },
    ],
    afecta: [
      { p: 'Llantas', d: 'Una suspensión gastada desgasta las llantas en "copas" o serrucho.' },
      { p: 'Alineación', d: 'Después de cambiar terminales, rótulas o bujes SIEMPRE hay que alinear, o se comen las llantas.' },
      { p: 'Frenos (moto)', d: 'El aceite que pierden los telescopios cae en el disco y en las pastillas.' },
      { p: 'Rodamientos de dirección', d: 'Golpes y sobrecarga marcan la dirección (se queda "en el centro").' },
    ],
    revisar: ['Juego en terminales y rótulas', 'Bujes de muelles', 'Fugas en amortiguadores y telescopios', 'Alineación después de cualquier cambio de dirección'],
    taller: ['¿Alinearon después del cambio?', '¿Revisaron los guardapolvos?', '¿El repuesto es original o alternativo?'],
    conductor: ['¿Con cuánta carga trabaja?', '¿Pasas los rompemuelles despacio?'],
  },

  llantas: {
    nombre: 'Llantas', sistema: 'Ruedas', aplica: ['moto', 'furgon'],
    para: 'Agarre, frenado y carga. Las motos de esta flota usan llantas con cámara.',
    vida: { moto: 'Trasera: 10.000–15.000 km; delantera: más.', apv: '40.000–60.000 km con rotación y alineación.', ram: '40.000–60.000 km con rotación y alineación.' },
    sintomas: ['Desgaste en el centro (mucha presión) o en los bordes (poca presión)', 'Desgaste de un solo lado (alineación)', 'Vibración a cierta velocidad (balanceo)'],
    causas: [
      { t: 'Presión incorrecta', d: 'Con poca presión se calientan, se gastan en los bordes y se pinchan más. Revisar cada semana en frío.' },
      { t: 'Alineación y balanceo', d: 'Furgón: una mala alineación se come una llanta en pocos meses.' },
      { t: 'Sobrecarga', d: 'Más peso = más desgaste y riesgo de reventón.' },
      { t: 'Frenadas fuertes y arrancones', d: 'Gastan la llanta trasera de la moto rapidísimo.' },
      { t: 'Suspensión gastada', d: 'La llanta rebota y se gasta en copas.' },
    ],
    afecta: [
      { p: 'Suspensión y dirección', d: 'Una llanta desbalanceada hace vibrar y gasta terminales y rodamientos.' },
      { p: 'Frenos', d: 'Una llanta lisa alarga la distancia de frenado.' },
    ],
    revisar: ['Presión cada semana', 'Rotación cada 10.000 km (furgón)', 'Alineación al cambiar llantas o piezas de dirección', 'Profundidad del dibujo'],
    taller: ['¿Alinearon y balancearon al poner las llantas nuevas?', '¿Qué presión dejaron?'],
    conductor: ['¿Revisas la presión cada semana?', '¿Con cuánta carga trabaja?'],
  },

  pinchazos: {
    nombre: 'Pinchazos', sistema: 'Ruedas', aplica: ['moto', 'furgon'],
    para: 'Parchados y vulcanizados repetidos.',
    vida: {}, sintomas: ['Llanta baja varias veces al mes'],
    causas: [
      { t: 'Llanta muy gastada', d: 'Con poco caucho, cualquier piedrita o vidrio la atraviesa.' },
      { t: 'Presión baja', d: 'La llanta se aplasta y la cámara se pellizca (pinchazo de "mordida").' },
      { t: 'Cámara vieja o con muchos parches', d: 'Sale más barato cambiarla que seguir parchando.' },
      { t: 'Problema dentro del aro', d: 'Un rayo, óxido o la cinta protectora del aro dañada pinchan la cámara desde adentro: si el agujero siempre está del lado del aro, es eso.' },
      { t: 'Objeto clavado que no se sacó', d: 'Si no se revisa el interior de la llanta, el mismo clavo vuelve a pinchar la cámara nueva.' },
      { t: 'Ruta', d: 'Zonas con obras, vidrio o clavos.' },
    ],
    afecta: [
      { p: 'Llanta', d: 'Andar con la llanta baja la daña por dentro (flancos).' },
      { p: 'Aro', d: 'Andar desinflado dobla el aro.' },
    ],
    revisar: ['De qué lado está el agujero de la cámara (adentro = aro; afuera = algo clavado)', 'Profundidad del dibujo', 'Presión'],
    taller: ['¿El agujero estaba del lado del aro o de afuera?', '¿Revisaron el interior de la llanta?', '¿Conviene cambiar la cámara o la llanta?'],
    conductor: ['¿Por qué zonas haces el reparto?', '¿Revisas la presión?'],
  },

  bateria: {
    nombre: 'Batería y sistema de carga', sistema: 'Eléctrico', aplica: ['moto', 'furgon'],
    para: 'La batería arranca el vehículo; el alternador (furgón) o el estator con regulador-rectificador (moto) la recargan.',
    vida: { moto: '2–3 años.', apv: '2–4 años.', ram: '2–4 años.' },
    sintomas: ['Arranque lento', 'Luces que bajan en ralentí', 'Batería hinchada o que pierde líquido', 'Focos que se queman seguido (exceso de voltaje)'],
    causas: [
      { t: 'Regulador o alternador que falla', d: 'Si carga de más, hierve y seca la batería y quema focos. Si carga de menos, la descarga. Cambiar la batería sin medir la carga es tirar la plata.' },
      { t: 'Viajes muy cortos con muchos arranques', d: 'El reparto tiene muchos arranques: la batería nunca termina de cargar.' },
      { t: 'Consumos extra', d: 'Luces adicionales, alarmas o cargadores conectados.' },
      { t: 'Bornes sulfatados o flojos', d: 'Parece batería mala y es un borne.' },
      { t: 'Batería de baja calidad o mal tamaño', d: '' },
    ],
    afecta: [
      { p: 'Motor de arranque', d: 'Con batería débil trabaja forzado y se queman sus carbones o el bendix.' },
      { p: 'Focos y electrónica', d: 'Un regulador malo con voltaje alto los quema.' },
      { p: 'CDI y encendido (moto)', d: 'Sufren con voltaje inestable.' },
    ],
    revisar: ['Voltaje de carga con el motor andando (en general entre 13,5 y 14,5 V)', 'Bornes limpios y apretados', 'Consumo con el vehículo apagado'],
    taller: ['¿Midieron el voltaje de carga antes de cambiar la batería?', '¿Revisaron el regulador-rectificador o el alternador?', '¿La batería nueva es del amperaje correcto?'],
    conductor: ['¿Le conectaste algo (luces, cargador)?', '¿Notaste que los focos se queman seguido?'],
  },

  focos: {
    nombre: 'Focos que se queman seguido', sistema: 'Eléctrico', aplica: ['moto', 'furgon'],
    para: 'Faroles, stop y direccionales.',
    vida: { moto: 'Un foco normal dura muchos meses.', apv: 'Un foco normal dura muchos meses.', ram: 'Un foco normal dura muchos meses.' },
    sintomas: ['Hay que cambiar focos varias veces al año'],
    causas: [
      { t: 'Voltaje alto por regulador dañado', d: 'Si se queman focos seguido, lo primero es medir el voltaje de carga.' },
      { t: 'Vibración y socket flojo', d: 'Un portafoco suelto o sulfatado hace falso contacto y quema el filamento.' },
      { t: 'Foco de más potencia que la original', d: 'Calienta el farol y los cables.' },
      { t: 'Focos de baja calidad', d: '' },
    ],
    afecta: [{ p: 'Batería', d: 'El mismo voltaje alto que quema focos seca la batería.' }, { p: 'Cables y socket', d: 'Se derriten con focos de más potencia.' }],
    revisar: ['Voltaje de carga', 'Portafocos y conectores', 'Potencia del foco'],
    taller: ['¿Midieron el voltaje del regulador?', '¿Cambiaron el socket si estaba quemado?'],
    conductor: ['¿Qué foco se quema más?'],
  },

  arranque: {
    nombre: 'Motor de arranque', sistema: 'Eléctrico', aplica: ['moto', 'furgon'],
    para: 'Motor eléctrico con bendix y automático (solenoide) que hace girar el motor para encenderlo.',
    vida: { moto: 'Muchos años si la batería está bien.', apv: '100.000 km o más.', ram: '100.000 km o más.' },
    sintomas: ['Hace "clic" y no gira', 'Gira lento', 'Ruido de engranaje al arrancar'],
    causas: [
      { t: 'Batería débil', d: 'El arranque trabaja forzado y se queman los carbones.' },
      { t: 'Mantener la llave en arranque mucho tiempo', d: 'Más de 5–10 segundos seguidos recalienta el arranque.' },
      { t: 'Motor duro para arrancar', d: 'Bujía, carburador o compresión mala obligan a arrancar muchas veces.' },
      { t: 'Reparación sin cambiar lo gastado', d: 'Si vuelve a fallar en meses, revisar qué se cambió.' },
    ],
    afecta: [{ p: 'Cremallera del volante de inercia', d: 'Un bendix gastado la come.' }, { p: 'Batería', d: 'Muchos intentos la descargan.' }],
    revisar: ['Batería y bornes', 'Que el motor arranque en pocos segundos (si no, el problema es del motor)'],
    taller: ['¿Cambiaron carbones, bendix y automático o solo una pieza?', '¿Revisaron por qué el motor cuesta arrancar?'],
    conductor: ['¿Cuánto tarda en arrancar en las mañanas?'],
  },

  carburador: {
    nombre: 'Carburador y combustible', sistema: 'Motor', aplica: ['moto', 'furgon'],
    para: 'Mezcla aire y combustible. Algunos furgones usan inyección según el año.',
    vida: { moto: 'Limpieza cuando falla; el filtro de aire limpio lo mantiene sano.', apv: 'Según el año: carburador o inyección.', ram: 'Inyección electrónica.' },
    sintomas: ['Se ahoga o se apaga en ralentí', 'Consumo alto', 'Tirones al acelerar', 'Humo negro'],
    causas: [
      { t: 'Filtro de aire sucio', d: 'Enriquece la mezcla: consumo alto y carbonilla.' },
      { t: 'Combustible sucio o con agua', d: 'Tapa los chicleres. Un tanque oxidado manda óxido al carburador una y otra vez.' },
      { t: 'Filtro de gasolina vencido o sin filtro', d: '' },
      { t: 'Calibración tocada', d: 'Una mezcla pobre recalienta el motor (en la moto enfriada por aire, puede quemar el pistón).' },
    ],
    afecta: [
      { p: 'Pistón y válvulas', d: 'Mezcla pobre = recalentamiento.' },
      { p: 'Bujía', d: 'Mezcla rica = bujía carbonizada y arranque difícil.' },
      { p: 'Consumo de combustible', d: 'Un carburador desajustado se nota en la gasolina del mes.' },
    ],
    revisar: ['Filtro de aire', 'Filtro de gasolina', 'Color de la bujía (café claro = bien; negro = rica; blanco = pobre)', 'Óxido en el tanque'],
    taller: ['¿Encontraron suciedad o agua? ¿De dónde viene?', '¿Cambiaron los filtros de aire y de gasolina?', '¿Revisaron el tanque?'],
    conductor: ['¿Dónde cargas combustible?', '¿Notaste que gasta más?'],
  },

  valvulas: {
    nombre: 'Calibración de válvulas (balancines)', sistema: 'Motor', aplica: ['moto'],
    para: 'Las válvulas necesitan una pequeña holgura para cerrar bien.',
    vida: { moto: 'Revisar la holgura cada 4.000–6.000 km aprox. (confirmar en el manual).' },
    sintomas: ['"Tic-tic" en la culata (holgura grande)', 'Pierde fuerza y cuesta arrancar en caliente (holgura chica)'],
    causas: [{ t: 'No calibrar a tiempo', d: 'Con poca holgura la válvula de escape no cierra del todo y se quema.' }, { t: 'Aceite vencido', d: 'Gasta balancines y levas.' }],
    afecta: [{ p: 'Válvulas y culata', d: 'Una válvula quemada obliga a abrir la culata (reparación mayor).' }],
    revisar: ['Holgura de admisión y escape con el motor frío'],
    taller: ['¿Qué holgura dejaron en admisión y en escape?'],
    conductor: ['¿Escuchas un "tic-tic" en el motor?'],
  },

  golpes: {
    nombre: 'Golpes, caídas y robos', sistema: 'Carrocería', aplica: ['moto', 'furgon'],
    para: 'Daños que no son desgaste.', vida: {},
    sintomas: ['Piezas dobladas, rotas o faltantes'],
    causas: [{ t: 'Choques, caídas o maniobras', d: 'Conviene registrar cada incidente con fecha y conductor.' }, { t: 'Robo de piezas', d: 'Espejos, placas, baterías.' }],
    afecta: [{ p: 'Dirección y alineación', d: 'Después de un golpe en una rueda, revisar la alineación y la dirección aunque se vea bien.' }, { p: 'Moto: manubrio, palancas y telescopios', d: 'Una caída suele doblarlos.' }],
    revisar: ['Alineación y dirección después de un golpe', 'Telescopios derechos (moto)'],
    taller: ['¿Revisaron la alineación y la dirección después del golpe?'],
    conductor: ['¿Qué pasó exactamente? ¿Dónde y cuándo?'],
  },
};

// Qué ficha de conocimiento corresponde a cada hallazgo del taller
function piezaDe(h) {
  if (!h) return null;
  if (h.componente === 'motor' && /agua/i.test(h.titulo)) return 'agua';
  if (h.componente && PIEZAS[h.componente]) return h.componente;
  if (/Pinchazos/.test(h.titulo)) return 'pinchazos';
  if (/preventivos|aceite/i.test(h.titulo)) return 'aceite';
  if (h.causa === 'externo') return 'golpes';
  return null;
}

// ── Plan de mantenimiento por modelo ─────────────────────────────────────────
// dias: cada cuánto en días con el uso de reparto de esta flota (aprox.);
// re: cómo se reconoce en la descripción del gasto que se hizo.
const PLAN = {
  moto: [
    { id: 'aceite', nombre: 'Cambio de aceite (y limpieza de malla)', cada: '2.000–3.000 km', dias: 35, re: /CAMBIO DE ACEITE|ACEITE (DE )?MOTOR|ACEITE \d+W|MANTENIMIENTO PREVENTIVO/ },
    { id: 'cadena', nombre: 'Tensar y lubricar la cadena', cada: '500–1.000 km', dias: 35, re: /TASAD|TENSAD|LUBRIC|ENGRAS|CADENA/, nota: 'Lo puede hacer el conductor cada semana; aquí solo se ve cuando lo hace el taller.' },
    { id: 'valvulas', nombre: 'Calibración de válvulas', cada: '4.000–6.000 km', dias: 90, re: /BALANCIN|CALIBRA|REGULADO DE VALV|TASADO DE VALV/ },
    { id: 'filtroAire', nombre: 'Filtro de aire (limpiar / cambiar)', cada: 'limpiar 3.000 km, cambiar 12.000 km', dias: 120, re: /FILTRO DE AIRE/ },
    { id: 'bujia', nombre: 'Bujía', cada: '8.000–12.000 km', dias: 180, re: /BUJIA/ },
    { id: 'frenos', nombre: 'Revisión de frenos (pastillas y balatas)', cada: 'en cada servicio', dias: 120, re: /PASTILLA|BALATA|FRENO/ },
    { id: 'telescopios', nombre: 'Aceite y retenes de telescopios', cada: '20.000 km o si gotean', dias: 365, re: /TELESCOP/ },
    { id: 'kit', nombre: 'Kit de transmisión', cada: '10.000–20.000 km', dias: 300, re: /KIT DE TRANSMISION|KIT TRANSMISION|TRANSMISION COMPLETA|PINON|CORONA/ },
  ],
  furgon: [
    { id: 'aceite', nombre: 'Aceite y filtro de motor', cada: '5.000 km', dias: 100, re: /CAMBIO DE ACEITE|ACEITE (DE )?MOTOR|ACEITE \d+W|MANTENIMIENTO PREVENTIVO|FILTRO DE ACEITE/ },
    { id: 'filtroAire', nombre: 'Filtro de aire', cada: '10.000–20.000 km', dias: 240, re: /FILTRO DE AIRE/ },
    { id: 'bujia', nombre: 'Bujías', cada: '20.000–40.000 km', dias: 365, re: /BUJIA/ },
    { id: 'frenos', nombre: 'Revisión de frenos', cada: '10.000 km', dias: 180, re: /PASTILLA|ZAPATA|BALATA|FRENO/ },
    { id: 'refrigerante', nombre: 'Refrigerante', cada: '2 años', dias: 730, re: /REFRIGERANTE|RADIADOR/ },
    { id: 'alineacion', nombre: 'Alineación, balanceo y rotación', cada: '10.000 km', dias: 240, re: /ALINEA|BALANCEO|ROTACION/ },
    { id: 'diferencial', nombre: 'Aceite de caja y diferencial', cada: '40.000 km', dias: 730, re: /CORONA|DIFERENCIAL|ACEITE DE CAJA|CAJA DE CAMBIO/, solo: ['apv'] },
    { id: 'correa', nombre: 'Correa de distribución (con tensor y bomba de agua)', cada: 'APV 60.000–70.000 km; RAM 50.000–60.000 km', dias: 1460, re: /CORREA (DENTADA|DE DISTRIB|DE TIEMPO)|KIT DE DISTRIB/, critico: true,
      nota: 'Si no hay registro, hay que averiguar con el kilometraje cuándo se cambió: si se corta, el arreglo es muy caro.' },
  ],
};

// Estado del plan para una placa: último registro de cada tarea y si ya toca
function plan(ctx, placa) {
  const v = ctx.veh.get(placa);
  if (!v) return [];
  const items = PLAN[v.tipo].filter(it => !it.solo || it.solo.includes(v.modelo));
  return items.map(it => {
    const hechos = v.filas.filter(r => !['GASOLINA', 'GNV'].includes(r.tipo) && it.re.test(r.d));
    const ult = hechos[hechos.length - 1];
    const dias = ult ? ctx.ref - ult.dia : null;
    // Sin registro desde que hay datos: se pide averiguarlo (no se puede afirmar que no se hizo)
    const desde = ctx.ref - v.primero;
    let estado = ult ? (dias > it.dias * 1.25 ? 'toca' : dias > it.dias * 0.9 ? 'pronto' : 'ok') : (desde > it.dias || it.critico ? 'sin' : 'ok');
    // Si desde el último registro casi ninguna placa tiene sus cambios cargados, puede faltar el dato
    if (estado === 'toca' && it.id === 'aceite' && ctx.parteCompleta(v.tipo, ult.dia, ctx.ref) < 0.6) estado = 'verificar';
    return { ...it, ultimo: ult || null, dias, veces: T.eventos(hechos, 7).length, estado };
  });
}

// ── Revisión cruzada: lo que un mecánico preguntaría al ver los gastos ───────
// Mira si junto a un arreglo se hizo lo que normalmente va con él.
function cruzar(ctx, placa) {
  const v = ctx.veh.get(placa);
  if (!v) return [];
  const m = v.mant;
  const hay = (re, a, b) => m.some(r => r.dia >= a && r.dia <= b && re.test(r.d));
  const out = [];
  const vistos = new Set();
  const add = (pieza, titulo, detalle, filas) => {
    if (vistos.has(titulo)) return; vistos.add(titulo);
    out.push({ pieza, titulo, detalle, filas: filas || [], ultimo: (filas && filas.length) ? filas[filas.length - 1].dia : ctx.ref });
  };
  const desde = ctx.ref - 730;   // últimos 2 años
  const rec = m.filter(r => r.dia >= desde);
  // Un arreglo suele ocupar varias filas (mano de obra, repuestos): se toma la primera de cada arreglo
  const arreglos = (re, junta = 21) => T.eventos(rec.filter(r => re.test(r.d)), junta).map(e => ({ ...e.filas[0], monto: e.monto, filasEv: e.filas }));

  // Embrague del furgón sin volante ni collarín
  if (v.tipo === 'furgon') arreglos(/EMBRAGUE/).forEach(r => {
    if (!hay(/VOLANTE|INERCIA/, r.dia - 30, r.dia + 30))
      add('embrague', `Embrague cambiado sin rectificar el volante (${T.fechaCorta(r.dia)})`, 'No aparece rectificado del volante de inercia en la misma reparación. Si quedó marcado, el embrague nuevo vibra y dura menos.', [r]);
    if (!hay(/COLLARIN|RODAMIENTO DE EMPUJE|CRAPODINA|KIT DE EMBRAGUE|KIT EMBRAGUE/, r.dia - 30, r.dia + 30))
      add('embrague', `¿Cambiaron el collarín con el embrague? (${T.fechaCorta(r.dia)})`, 'No se ve el collarín en la misma reparación. Si falla después, hay que volver a bajar la caja.', [r]);
  });

  // Moto: solo cadena sin piñón ni corona
  if (v.tipo === 'moto') rec.filter(r => /\bCADENA\b/.test(r.d) && /COMPRA|CAMBIO/.test(r.d) && /(COMPRA|CAMBIO) DE (UNA )?CADENA(?!S? DE DISTRIB)|CADENA NUEVA/.test(r.d) && !/KIT|PINON|CORONA|TRANSMISION/.test(r.d)).forEach(r => {
    if (!hay(/PINON|CORONA|KIT/, r.dia - 20, r.dia + 20))
      add('kit', `Se cambió solo la cadena (${T.fechaCorta(r.dia)})`, 'Una cadena nueva con piñón y corona gastados dura la mitad. Revisar los dientes.', [r]);
  });

  // Frenos que se repiten sin revisar disco o tambor
  const fr = arreglos(/PASTILLA|BALATA|ZAPATA/);
  if (fr.length >= 3 && !hay(/RECTIFICAD[OA] DE (DISCO|TAMBOR)|\bDISCO\b|TAMBOR|MORDAZA|CALIPER|CALIPER|LIQUIDO DE FRENO/, desde, ctx.ref))
    add('frenos', `${fr.length} cambios de frenos sin revisar disco, tambor ni mordaza`, 'Cuando los frenos se gastan seguido, además del manejo hay que revisar el disco o tambor y que la mordaza no quede pegada.', fr.slice(-3));

  // Batería repetida o focos que se queman seguido, sin medir la carga
  const bat = arreglos(/BATERIA(?! (CARGADA|RECARGA))/).filter(r => !/AGUA DESTILADA|CARGA DE BATERIA/.test(r.d));
  const foc = T.eventos(m.filter(r => r.dia >= ctx.ref - 365 && /FOCO|FAROL/.test(r.d)), 7).map(e => e.filas[0]);
  const midio = hay(/REGULADOR|RECTIFICADOR|ESTATOR|ALTERNADOR|SISTEMA DE CARGA|VOLTAJE/, desde, ctx.ref);
  if ((bat.length >= 2 || foc.length >= 3) && !midio)
    add(foc.length >= 3 ? 'focos' : 'bateria', foc.length >= 3 ? `${foc.length} cambios de focos en un año` : `${bat.length} baterías en 2 años`,
      'No aparece una revisión del regulador o del alternador. Si el sistema carga de más, quema focos y seca baterías; si carga de menos, descarga la batería. Hay que medir el voltaje de carga antes de seguir cambiando piezas.', [...bat, ...foc].sort((a, b) => a.dia - b.dia).slice(-3));

  // Reparación de motor: ¿se cambió el filtro de aire? (moto) ¿hubo señales de recalentamiento? (furgón)
  rec.filter(r => /RECTIFIC(?!ADO DE (TAMBOR|DISCO))|PISTON|ANILLAS?\b|CULATA|REPARACION (DE|DEL) MOTOR|BAJAD[OA] DE MOTOR/.test(r.d) && r.monto >= (v.tipo === 'moto' ? 500 : 1500)).forEach(r0 => {
    // todo el arreglo (varias filas en días cercanos) cuenta como uno
    const ev = T.eventos(rec.filter(x => x.dia >= r0.dia - 30 && x.dia <= r0.dia + 30 && /MOTOR|CULATA|PISTON/.test(x.d)), 30)[0];
    const r = { ...r0, dia: ev ? ev.filas[0].dia : r0.dia, filasEv: ev ? ev.filas : [r0] };
    const texto = r.filasEv.map(x => x.d).join(' ');
    if (v.tipo === 'moto' && !/AGUA/.test(texto) && !hay(/FILTRO DE AIRE/, r.dia - 120, r.dia + 15))
      add('motor', `Reparación de motor sin cambio de filtro de aire cerca (${T.fechaCorta(r.dia)})`, 'Un filtro de aire sucio o roto deja entrar polvo que gasta el cilindro y las anillas. Si no se cambió, el motor reparado se gasta igual de rápido.', [r]);
    if (v.tipo === 'furgon' && /CULATA|EMPAQUETADURA/.test(texto) && !hay(/TERMOSTATO|RADIADOR|VENTILADOR|BOMBA DE AGUA/, r.dia - 30, r.dia + 30))
      add('enfriamiento', `Culata reparada sin revisar el sistema de enfriamiento (${T.fechaCorta(r.dia)})`, 'Una culata dañada casi siempre viene de un recalentamiento. Si no se revisaron termostato, radiador y ventilador, puede volver a pasar.', [r]);
  });

  // Dirección cambiada sin alineación
  if (v.tipo === 'furgon') arreglos(/TERMINAL|ROTULA|AXIAL|CREMALLERA|BRAZO/).forEach(r => {
    if (!hay(/ALINEA/, r.dia - 5, r.dia + 30))
      add('suspension', `Dirección reparada sin alineación registrada (${T.fechaCorta(r.dia)})`, 'Después de cambiar terminales, rótulas o brazos hay que alinear; si no, se comen las llantas delanteras en pocos meses.', [r]);
  });

  // Telescopios que gotean y pastillas delanteras
  if (v.tipo === 'moto') rec.filter(r => /RETEN(ES)? DE TELESCOP/.test(r.d)).forEach(r => {
    if (hay(/PASTILLA/, r.dia - 60, r.dia + 60)) return;
    add('suspension', `Retenes de telescopios cambiados (${T.fechaCorta(r.dia)})`, 'Si el telescopio goteó, el aceite pudo caer en el disco y las pastillas delanteras: revisar que frenen bien.', [r]);
  });

  // Furgón: sin registro de correa de distribución
  if (v.tipo === 'furgon' && !m.some(r => /CORREA (DENTADA|DE DISTRIB|DE TIEMPO)|KIT DE DISTRIB/.test(r.d)))
    add('distribucion', 'Sin registro de cambio de correa de distribución', `En ${Math.round((ctx.ref - v.primero) / 365)} años de gastos no aparece el cambio de la correa. Hay que averiguar el kilometraje del último cambio: si se corta, el arreglo es muy caro.`, []);

  return out;
}

// ── Lo de hoy: qué hacer y qué revisar en los vehículos que están trabajando ─
// Lo usan Mi taller y el resumen del tablero, así los dos cuentan lo mismo.
const COLOR = { rojo: '#FF5A4E', ambar: '#F5A623', azul: '#5b8def' };
function hoy(ctx, placas) {
  const ahora = [], revisar = [];
  const corto = p => p.nombre.split(' (')[0].toLowerCase();
  const fmt0 = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 });
  placas.forEach(placa => {
    const pl = plan(ctx, placa);
    // Una tarjeta por vehículo con todo lo que tiene pendiente (el aceite primero).
    // Tensar la cadena lo hace el conductor cada semana: no se cuenta como pendiente del taller.
    const toca = pl.filter(p => p.estado === 'toca' && p.id !== 'cadena').sort((x, y) => (y.id === 'aceite') - (x.id === 'aceite'));
    const averiguar = pl.filter(p => p.critico && p.estado === 'sin');
    const verificar = pl.filter(p => p.estado === 'verificar');
    if (toca.length || averiguar.length || verificar.length) {
      const partes = [];
      if (toca.length) partes.push(toca.map(p => `${corto(p)} (último cargado hace ${fmt0.format(p.dias)} días)`).join(', ') + '. Si alguno ya se hizo, falta cargarlo en el Excel');
      if (averiguar.length) partes.push(`averiguar ${averiguar.map(corto).join(', ')}: no hay registro y si se corta el arreglo es muy caro`);
      if (verificar.length) partes.push(`confirmar si se hizo el ${verificar.map(corto).join(', ')} (faltan registros de esos meses)`);
      const aceite = toca.some(p => p.id === 'aceite');
      ahora.push({ placa, color: aceite ? COLOR.rojo : toca.length ? COLOR.ambar : COLOR.azul,
        etiqueta: aceite ? 'Aceite sin registro' : toca.length ? 'Mantenimiento' : 'Averiguar',
        t: toca.length ? `${toca.length} ${toca.length === 1 ? 'tarea sin registro reciente' : 'tareas sin registro reciente'}${averiguar.length ? ' y datos por averiguar' : ''}` : 'Datos por averiguar',
        d: partes.join('. ') + '.', orden: aceite ? 0 : toca.length ? 1 : 2, n: toca.length });
    }
    cruzar(ctx, placa).filter(x => x.ultimo >= ctx.ref - 365 && x.pieza !== 'distribucion').forEach(x => revisar.push({
      placa, color: COLOR.azul, etiqueta: 'Pregunta del mecánico', t: x.titulo, d: x.detalle, orden: 2 }));
  });
  T.consejos(ctx, { placas: new Set(placas) }).filter(c => c.clase !== 'aceite').forEach(c => revisar.push({
    placa: c.placa, color: c.nivel === 'alto' ? COLOR.rojo : T.CAUSAS[c.causa].color, etiqueta: T.CAUSAS[c.causa].nombre, t: c.titulo, d: c.detalle, orden: c.nivel === 'alto' ? 0 : 1 }));
  ahora.sort((a, b) => a.orden - b.orden || b.n - a.n);
  revisar.sort((a, b) => a.orden - b.orden);
  return { ahora, revisar };
}
// Placas que están trabajando: la flota actual, o las que tuvieron gastos en los últimos 90 días
const activas = ctx => [...ctx.veh.values()].filter(v => v.mant.length && (ctx.enFlota ? ctx.enFlota.has(v.placa) : v.ultimo >= ctx.ref - 90));

const api = { VEHICULOS, PIEZAS, PLAN, piezaDe, plan, cruzar, hoy, activas };
global.Mecanico = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
