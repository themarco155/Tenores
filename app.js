// Datos
const SONGS={
  fum:{
    title:'Fum Fum Fum',
    track:'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760051700/fum_fum_fum_cancion_c7zzyg.wav',
    lyrics:`Veinticinco de diciembre
Fum, fum, fum
Veinticinco de diciembre
Fum, fum, fum
Fum, fum, fum, fum, fum, fum fum
Carita de rosa
Parece una flor hermosa
Fum, fum, fum

Sopla el viento por las calles
Fum, fum, fum
Y la virgen tiene frío
Fum, fum, fum
Fum, fum, fum, fum, fum, fum fum
Quieres niño mío
En mi corazón nacer
Fum, fum, fum

Cierren todos ya sus puertas
Fum, fum, fum
Y hasta el cielo se durmió
Fum, fum, fum
Fum, fum, fum, fum, fum, fum fum
Telas de oro y plata
Yo te haré un buen colchón
Fum, fum, fum`
  },
  adeste:{title:'Adeste Fideles',track:'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760051838/adeste_cancion_kefxux.wav',lyrics:"Adeste fideles, laeti triumphantes,\nvenite, venite in Bethlehem.\nNatum videte, Regem angelorum:\nvenite adoremus, venite adoremus,\nvenite adoremus Dominum.\n\nEn grege relicto, humiles ad cunas\nvocati pastores approperant;\net nos ovanti gradu festinemus:\nvenite adoremus, venite adoremus,\nvenite adoremus Dominum.\n\nAeterni Parentis splendorem aeternum\nvelatum sub carne videbimus;\nDeum infantem pannis involutum:\nvenite adoremus, venite adoremus,\nvenite adoremus Dominum."},
  dona:{title:'Dona Nobis Pacem',track:'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760054240/dona_nobis_pacem___cancion_hsep4p.wav',lyrics:"Dona nobis pacem,\ndona nobis pacem,\ndona nobis pacem."},
  fuentecilla:{title:'Fuentecilla que corres',track:'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760998122/fuentecilla_que_corres_cancion__qhqna2.mp3',lyrics:"A la nanita nana, nanita ea,\nmi Jesús tiene sueño, bendito sea.\nA la nanita nana, nanita ea,\nmi Jesús tiene sueño, bendito sea.\n\nFuentecilla que corres clara y sonora,\nruiseñor que en la selva cantando lloras,\ncalla mientras la cuna se balancea.\nA la nanita nana, nanita ea,\nmi Jesús tiene sueño, bendito sea.\n\nManojito de rosas y alhelíes,\n¿qué es lo que estás soñando que te sonríes?\n¿Cuáles son tus ensueños, dime, alma mía?\nMas, ¿qué es lo que murmuras? Eucaristía."},
  campanas:{title:'Canto de las campanas',track:'https://res.cloudinary.com/dul66qlpq/video/upload/v1760142195/canto_de_las_campanas_cancion_tq94nl.mp3',lyrics:"¡Qué dulce son! Campanas dan,\ndiciendo están: «Penas dejad».\nLa Navidad llega feliz;\ncantos alzad, gozo tened.\nDin, don, din, don.\n\nSu canto es canto sin fin,\nsuenan feliz.\nLlevan su voz al cielo azul,\ndiciendo están: «¡Gozo tened!»\n\nMas se oye ya su dulce son,\ncon claridad dice feliz:\nla Navidad viene al fin;\ngozo tened, pues ya llegó.\n\nEn Belén nació un bello niño,\nen Belén nació un bello niño.\nSu canto es canto sin fin,\nllevando van a todo hogar.\nDin, don, din, don."},
  estrella:{title:'Estrella Errante',track:'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760997189/estrella_errante_cancion_m6bcdm.mp3',lyrics:"He visto una estrella errante\nrodandito por el cielo,\nque va rápido a estrellarse\ncon su colita de fuego.\nQuiero pensar un deseo\nmientras que dura su brillo,\nmas se apaga en un instante,\n¿quién sabe dónde se ha ido?\n\nLa, la, la, la, ¿dónde se ha ido?\nLa, la, la, ya se ha dormido.\n\nHe visto una estrella errante\nrodandito por el cielo;\nunos magos la han seguido\na un establo y ya se han ido.\nAllí dentro estaba un niño,\ndormidito en un pesebre;\nSan José era su padre\ny María era su madre.\n\nLa, la, la, la, ¿dónde se ha ido?\nLa, la, la, ya se ha dormido."},
  paz:{title:'Himno a la paz',track:'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760997237/himno_a_la_paz_cancion_avurel.mp3',lyrics:"Paz, paz, paz,\nel mundo pide paz.\nLogra la paz en tu interior\ny derrámala en la tierra.\n\nPaz, paz, paz,\nel mundo pide paz.\nLogra la paz en tu interior\ny derrámala en la tierra."},
  merry:{title:'We wish you a merry christmas',track:'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760997255/we_wish_you_cancion_pgz1i2.mp3',lyrics:"We wish you a merry Christmas,\nwe wish you a merry Christmas,\nwe wish you a merry Christmas\nand a happy New Year.\n\nGood tidings we bring\nto you and your kin.\nGood tidings for Christmas\nand a happy New Year.\n\nWe wish you a merry Christmas,\nwe wish you a merry Christmas,\nwe wish you a merry Christmas\nand a happy New Year."},
  kling:{title:'Kling Glöckchen, klingelingeling',track:'https://res.cloudinary.com/dul66qlpq/video/upload/v1761827592/kling_cancion_xawypb.mp3',lyrics:"Kling, Glöckchen, klingelingeling!\nKling, Glöckchen, kling!\nLasst mich ein, ihr Kinder,\nist so kalt der Winter!\nÖffnet mir die Türen,\nlasst mich nicht erfrieren!\nKling, Glöckchen, klingelingeling!\nKling, Glöckchen, kling!\n\nKling, Glöckchen, klingelingeling!\nKling, Glöckchen, kling!\nMädchen, hört, und Bübchen,\nmacht mir auf das Stübchen!\nBring euch viele Gaben,\nsollt euch dran erlaben!\nKling, Glöckchen, klingelingeling!\nKling, Glöckchen, kling!\n\nKling, Glöckchen, klingelingeling!\nKling, Glöckchen, kling!\nHell erglühn die Kerzen,\nöffnet mir die Herzen!\nWill drin wohnen fröhlich,\nfrommes Kind, wie selig!\nKling, Glöckchen, klingelingeling!\nKling, Glöckchen, kling!"},
  tannenbaum:{title:'O Tannenbaum',track:'https://res.cloudinary.com/dcwx23x5o/video/upload/v1761968289/oh_thanenbaum_kkhmya.mp3',lyrics:"O Tannenbaum, o Tannenbaum,\nwie treu sind deine Blätter!\nO Tannenbaum, o Tannenbaum,\nwie treu sind deine Blätter!\nDu grünst nicht nur zur Sommerzeit,\nnein, auch im Winter, wenn es schneit.\nO Tannenbaum, o Tannenbaum,\nwie treu sind deine Blätter!\n\nO Tannenbaum, o Tannenbaum,\ndu kannst mir sehr gefallen!\nO Tannenbaum, o Tannenbaum,\ndu kannst mir sehr gefallen!\nWie oft hat nicht zur Weihnachtszeit\nein Baum von dir mich hoch erfreut!\nO Tannenbaum, o Tannenbaum,\ndu kannst mir sehr gefallen!"},
  mundo:{title:'Mundo feliz',track:'https://res.cloudinary.com/dul66qlpq/video/upload/v1764903368/mundo-feliz_udqafi.wav',lyrics:"Mundo feliz, Jesús nació,\nya nuestro Rey está.\nY todo lo que Dios creó,\na su encuentro va,\na su encuentro va.\nFeliz, feliz, a su encuentro va.\n\nJoy to the world, the Lord has come!\nLet earth receive her King;\nlet every heart prepare Him room,\nand heaven and nature sing,\nand heaven and nature sing,\nand heaven, and heaven, and nature sing."},
  stelle:{title:'Tu scendi dalle stelle',track:'https://res.cloudinary.com/dul66qlpq/video/upload/v1764903364/tu-scendi_xbmuo7.wav',lyrics:"O Bambino mio divino,\nio ti vedo qui a tremar;\no Dio beato!\nAh, quanto ti costò\nl'avermi amato!"}
};

const TEAM_OVERVIEW={
  totalMinutes:2400,
  totalHours:40,
  totalMembers:9,
  averageMinutes:1879,
  averageAttendance:78.3,
  rehearsals:11,
  timeframe:'6 de septiembre - 22 de noviembre',
  observations:[
    'Asistencia promedio por tiempo: 78.3%, equivalente a 31.3 de 40 horas programadas por tenor.',
    'Dos de los nueve tenores registraron 100% de asistencia.',
    'Cuatro de los nueve tenores quedaron por debajo del promedio de asistencia.',
    'Promedio de llegadas tarde entre los tenores: 28.2% de los ensayos asistidos.',
    'Los porcentajes individuales de asistencia se situaron entre 49.4% y 100%.'
  ],
  levels:[
    {label:'Nivel superior (100%)',members:['Carlos','Santiago']},
    {label:'Nivel alto (84%-88%)',members:['Diego','H\u00e9ctor','Marco']},
    {label:'Nivel medio (69%-74%)',members:['Isa\u00edas','Mario']},
    {label:'Nivel crítico (49%-51%)',members:['Caleb','Oswaldo']}
  ]
};

const TENOR_MEMBERS_DATA=[
  {id:'carlos',name:'Carlos',minutes:2400,attendance:100,minutesLost:0,rehearsalsAttended:11,tardyPct:0,tardyCount:0,tardyJustifiedPct:0},
  {id:'santiago',name:'Santiago',minutes:2400,attendance:100,minutesLost:0,rehearsalsAttended:11,tardyPct:18.2,tardyCount:2,tardyJustifiedPct:null},
  {id:'hector',name:'H\u00e9ctor',minutes:2036.4,attendance:84.85,minutesLost:363.6,rehearsalsAttended:9,tardyPct:33.3,tardyCount:3,tardyJustifiedPct:null},
  {id:'marco',name:'Marco',minutes:2115,attendance:88.13,minutesLost:285,rehearsalsAttended:10,tardyPct:60,tardyCount:6,tardyJustifiedPct:null},
  {id:'diego',name:'Diego',minutes:2098.8,attendance:87.45,minutesLost:301.2,rehearsalsAttended:10,tardyPct:30,tardyCount:3,tardyJustifiedPct:null},
  {id:'mario',name:'Mario',minutes:1770,attendance:73.75,minutesLost:630,rehearsalsAttended:8,tardyPct:37.5,tardyCount:3,tardyJustifiedPct:null},
  {id:'isaias',name:'Isa\u00edas',minutes:1678.8,attendance:69.95,minutesLost:721.2,rehearsalsAttended:8,tardyPct:25,tardyCount:2,tardyJustifiedPct:null},
  {id:'caleb',name:'Caleb',minutes:1230,attendance:51.25,minutesLost:1170,rehearsalsAttended:6,tardyPct:33,tardyCount:2,tardyJustifiedPct:50},
  {id:'oswaldo',name:'Oswaldo',minutes:1185,attendance:49.38,minutesLost:1215,rehearsalsAttended:6,tardyPct:16.7,tardyCount:1,tardyJustifiedPct:null}
];
const TENOR_MEMBERS_2026=['Liam','Marco','Santiago','Diego','Rodrigo','Héctor','Leonel','Mario']
  .map(name=>({id:name.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,''),name}))
  .sort((a,b)=>a.name.localeCompare(b.name,'es',{sensitivity:'base'}));
const TENOR_LOOKUP_2026=TENOR_MEMBERS_2026.reduce((map,member)=>{map[member.id]=member;return map;},Object.create(null));

const CALENDAR_MONTHS=['2025-11','2025-12'];
const PRESENTATION_EVENTS=[
  {id:'nov-20-incaf',date:'2025-11-20',title:'Coro Polif\u00f3nico',startTime:'5:00 pm',callTime:'03:00 pm',venue:'INCAF',city:'San Salvador',meetingPoint:'Recepci\u00f3n principal',summary:'Actuaci\u00f3n oficial del Coro Polif\u00f3nico en INCAF.',instructions:'Salida programada a las 03:00 pm desde la fundaci\u00f3n.',tag:'Presentaci\u00f3n'},
  {id:'nov-21-quimicos',date:'2025-11-21',title:'Coro Polif\u00f3nico',startTime:'6:00 pm',callTime:'04:00 pm',venue:'Colegio de Qu\u00edmicos Farmac\u00e9uticos',city:'San Salvador',meetingPoint:'Parqueo lateral',summary:'Presentaci\u00f3n para el Colegio de Qu\u00edmicos Farmac\u00e9uticos.',instructions:'Salida coordinada a las 04:00 pm.',tag:'Presentaci\u00f3n'},
  {id:'nov-29-fepade',date:'2025-11-29',title:'Show navide\u00f1o (bandas y coro)',startTime:'4:00 pm',callTime:'02:00 pm',venue:'FEPADE',city:'San Salvador',meetingPoint:'Acceso principal',summary:'Show navide\u00f1o junto a bandas invitadas en FEPADE.',instructions:'Salida general a las 02:00 pm.',tag:'Show'},
  {id:'dec-01-alfa',date:'2025-12-01',title:'Coro Polif\u00f3nico',startTime:'7:00 pm',callTime:'04:30 pm',venue:'ALFA / Milenium Plaza',city:'Antiguo Cuscatl\u00e1n',meetingPoint:'Lobby principal',summary:'Concierto del coro en ALFA / Milenium Plaza.',instructions:'Salida prevista a las 04:30 pm.',tag:'Presentaci\u00f3n'},
  {id:'dec-02-alfa',date:'2025-12-02',title:'Coro Polif\u00f3nico',startTime:'7:00 pm',callTime:'04:30 pm',venue:'ALFA / Milenium Plaza',city:'Antiguo Cuscatl\u00e1n',meetingPoint:'Lobby principal',summary:'Segunda fecha en ALFA / Milenium Plaza.',instructions:'Mantener salida a las 04:30 pm.',tag:'Presentaci\u00f3n'},
  {id:'dec-05-nunciatura',date:'2025-12-05',title:'Coro Polif\u00f3nico',startTime:'6:30 pm',callTime:'04:30 pm',venue:'Nunciatura Apost\u00f3lica',city:'San Salvador',meetingPoint:'Entrada principal',summary:'Participaci\u00f3n protocolaria en la Nunciatura Apost\u00f3lica.',instructions:'Salida puntual a las 04:30 pm.',tag:'Presentaci\u00f3n'},
  {id:'dec-06-binaes',date:'2025-12-06',title:'Show navide\u00f1o: Escuela Ancalmo, bandas, ensambles y coro',startTime:'4:00 pm',callTime:'02:00 pm',venue:'BINAES',city:'San Salvador',meetingPoint:'Vest\u00edbulo BINAES',summary:'Show navide\u00f1o con la Escuela Ancalmo y ensambles invitados.',instructions:'Salida general a las 02:00 pm.',tag:'Show'},
  {id:'dec-07-bosques',date:'2025-12-07',title:'Coro Polif\u00f3nico',startTime:'7:00 pm',callTime:'04:00 pm',venue:'Bosques de la Paz',city:'San Salvador',meetingPoint:'\u00c1rea de estacionamiento',summary:'Presentaci\u00f3n comunitaria en Bosques de la Paz.',instructions:'Salida prevista a las 04:00 pm.',tag:'Presentaci\u00f3n'},
  {id:'dec-11-ateneo',date:'2025-12-11',title:'Coro Polif\u00f3nico',startTime:'7:00 pm',callTime:'04:30 pm',venue:'Ateneo',city:'San Salvador',meetingPoint:'Pasillo principal',summary:'Recital del coro en el Ateneo.',instructions:'Salida a las 04:30 pm.',tag:'Presentaci\u00f3n'},
  {id:'dec-13-merliot',date:'2025-12-13',title:'Coro Polif\u00f3nico',startTime:'10:30 am',callTime:'08:00 am',venue:'Ni\u00f1os de Merliot',city:'Santa Tecla',meetingPoint:'Cancha techada',summary:'Actividad matutina con Ni\u00f1os de Merliot.',instructions:'Salida indicada a las 08:00 am.',tag:'Presentaci\u00f3n'},
  {id:'dec-14-osicala',date:'2025-12-14',title:'Coro Polif\u00f3nico',startTime:'1:00 pm',callTime:'06:00 am',venue:'Osicala',city:'Osicala',meetingPoint:'Casa de la Cultura',summary:'Viaje especial para la comunidad de Osicala.',instructions:'Salida temprana a las 06:00 am.',tag:'Gira'},
  {id:'dec-16-ancalmo',date:'2025-12-16',title:'Coro Polif\u00f3nico',startTime:'1:00 pm',callTime:'10:30 am',venue:'Ancalmo',city:'San Salvador',meetingPoint:'Recepci\u00f3n central',summary:'Presentaci\u00f3n interna en Ancalmo.',instructions:'Salida a las 10:30 am.',tag:'Presentaci\u00f3n'},
  {id:'dec-20-poma',date:'2025-12-20',title:'Coro Polif\u00f3nico',startTime:'5:00 pm',callTime:'03:00 pm',venue:'Teatro Poma',city:'San Salvador',meetingPoint:'Acceso artistas',summary:'Cierre de temporada en el Teatro Poma.',instructions:'Salida programada a las 03:00 pm.',tag:'Presentaci\u00f3n'}
];
const DAY_NAMES=['L','M','X','J','V','S','D'];
const LETTER_TITLE=`Esta es mi carta de despedida como jefe de cuerda`;
const LETTER_SUBTITLE=`No es solo un texto para decir adiós. Es, sobre todo, una guía para el futuro del equipo`;
const TENOR_CHIP_LIMIT=2;
const LETTER_HTML=`Quiero que esta carta sea un abrazo para cada tenor, pero también una guía.
¡Aú, aú!
En esta carta encontrarán 3 cosas:
1. **Mis recomendaciones finales** para el equipo y para el próximo jefe de voz. Algunos de ustedes representarán al país en el festival de Costa Rica, y eso me llena de orgullo. Pero todos, absolutamente todos, tienen la responsabilidad de ayudar a que este coro siga creciendo y sea incluso mejor que en sus mejores días.
2. **Lo bueno y lo malo** del equipo de tenores 2025. Seré honesto. Sin filtros. Yo soy muy patriótico por los tenores, como saben, así que: lo que estuvo mal se dice, y lo que estuvo bien se reconoce.
3. **La razón por la que me voy.**
________________________________________
## Mis recomendaciones para el equipo
Empiezo con una pregunta incómoda:
¿Por qué querríamos malos tenores?
Durante la temporada les hablé muchas veces de "el buen tenor".
"El buen tenor es la clave", repetí una y otra vez.
Y hoy quiero volver a esa idea, pero desde una pregunta diferente:
¿por qué querríamos malos tenores entre nosotros?
Antes de hablar del buen tenor, vale la pena pensar en eso.
El buen tenor es el que busca lo mejor para el equipo, incluso cuando nadie lo está mirando.
Es generoso.
Es honorable.
Se esfuerza por conocer cada canción, no por lucirse, sino porque sabe que el equipo lo componemos TODOS.
El buen tenor quiere que el coro suene mejor.
Quiere que sus compañeros crezcan.
Quiere aportar.
Piensen en una buena persona: alguien trabajador, comprometido, que suma y cuida lo que tiene.
Ese es el buen tenor.
El mal tenor es lo contrario.
• Habla mal de sus compañeros a sus espaldas y rompe la confianza.
• No se compromete de verdad: pone fiestas o cualquier cosa por encima del coro.
• No busca mejorar, se conforma con poco y se exige menos.
Y vuelvo a la pregunta, con todo el cariño que le tengo a este equipo:
¿por qué querríamos ese tipo de actitudes dentro entre nosotros?
**No hay ningún motivo. Ninguno.**
Por eso mi primera recomendación es sencilla, pero y muy profunda:
**trata de ser el buen tenor.**
No vas a ser perfecto.
Nadie lo ha sido nunca en este coro, ni yo mismo.
Lo único verdaderamente importante es intentarlo.
Intentarlo cada ensayo.
Intentarlo incluso cuando cuesta.
Si es posible hacer algo bien, ¿por qué lo haríamos mal?
Si cantar parado es técnicamente mejor que cantar sentado, ¿por qué quedarnos sentados?
Ese es solo un ejemplo para que entiendas lo que quiero decir: si podemos hacer algo bien, entonces intentémoslo.
Quiero contarte algo...
A lo largo de estos 15 años del coro ha habido conflictos que nos han afectado más de lo que a veces se admite.
Mi retiro en 2019 se debió, en parte, a uno de esos conflictos.
Y muchas personas valiosas se han ido a lo largo de los años por razones similares.
Cuando el ambiente se vuelve tenso, algo se rompe.
La confianza se debilita.
Y el coro, inevitablemente, canta peor.
La mayoría de esos conflictos no nacen de grandes problemas, sino de pequeñas actitudes repetidas: egoísmo, complejos de estrella, hipocresía, desinterés.
Por eso insisto tanto en la idea del buen tenor.
Porque cuando uno intenta serlo, cuida al equipo.
Y cuando muchos lo intentan, el coro se vuelve un lugar más sano y fuerte.
Si intentas ser el buen tenor, no solo te sentirás más cómodo aquí.
Construirás relaciones más bonitas.
Y, como el buen tenor también se esfuerza: sonaremos mejor.
Esta idea no es algo que se me ocurrió al azar.
La pensé durante los años que estuve fuera de la fundación, recordando lo bueno, lo difícil y lo valioso de los tenores.
Al próximo jefe de cuerda quiero dejarle una recomendación:
potencia esta idea.
Si logra quedarse en la mente y en el corazón del equipo, servirá durante muchos años.
**Larga vida al buen tenor.**
________________________________________
## Mi segunda recomendación
**Cuiden la cultura tenoril.**
Los tenores siempre hemos tenido nuestro estilo.
Desde los primeros años del coro hubo bromas, chistes, nalgadas y risas.
No importa la generación:
ese siempre ha sido nuestro humor.
Y está bien.
No solo es divertido.
Es necesario para que el equipo respire.
¿Se imaginan una temporada de coro sin eso?
Sería demasiado pesada, tensa y agotadora.
Los buenos tenores saben cuándo ser responsables, trabajadores y serios.
Pero también saben cuándo relajarse, bromear y romper la tensión.
A veces incluso siendo un poco vulgares.
Y no pasa nada. Personalmente, lo aplaudo.
Eso también es cariño.
Eso también es pertenencia.
Eso también es equipo.
No pierdan eso.
Cuídenlo.
## Lo bueno y lo malo de la temporada 2025 (sin filtros)
No hablo del coro en general.
Hablo de nosotros: los tenores.
La pregunta clave es simple:
¿mejoramos esta temporada?
**Mi respuesta es un sí rotundo. SÍ.**
Lo confirmé hablando con varios de ustedes: prácticamente todos coincidieron en algo importante — este año el equipo se sintió más unido que la temporada anterior. Y eso no es menor.
Héctor cumplió su rol como tenor de apoyo con honores.
Prácticamente todos los convocados asistieron a todas las presentaciones.

Recuperamos tradiciones de disciplina que nos van a servir mucho en el futuro.

Errores típicos en las melodías que señalé al inicio de la temporada ya no se escuchan en las últimas grabaciones del coro.
En términos claros:
fue una buena temporada y fuimos un buen equipo en la historia de los tenores del coro.
Ahora bien, siendo exigentes (como hay que ser):
no fuimos los mejores tenores en la historia del coro.
Pero eso no es una acusación. Soy exigente porque debemos serlo y no conformarnos.
Lo hicimos bien.
Y cuando digo bien, quiero decir que estuvimos a la altura, dimos la cara y representamos al equipo con honor.
Y lo más importante de todo:
**mejoramos muchísimo respecto a cómo empezamos.**
¿En qué fallamos?
Veamos...
1. Dominio de las melodías
Éramos 10 tenores (más Rodrigo como invitado en entrenamiento) y, siendo realista, creo que solo 2 o 3 conocíamos todas las canciones sin errores.
La mayoría las manejaba en un 80%–90%. Eso es decente… pero no es suficiente si queremos aspirar a un nivel de clase mundial.
2. Pronunciación
En varias canciones en otros idiomas tuvimos errores de pronunciación.
Especialmente en alemán.
No es un detalle menor: una pronunciación uniforme facilita el acople.
3. Acople
Hacia el final de la temporada mejoramos bastante, pero aun así hubo momentos en los que algunas voces sobresalieron más de lo que debían.
El coro no es lucirse.
Recomiendo al próximo jefe de cuerda poner atención especial a estos tres puntos.
Si los trabajamos bien, llegaremos mucho más fuertes a la próxima temporada navideña y a Costa Rica.

## ¿Por qué me voy?
Me he llevado bien con ustedes. Ha sido una temporada agradable para mi.
Me gustó regresar.

Y quiero que quede algo muy claro: mi deseo de que a los tenores les vaya bien nunca se ha ido ni se irá.
Me fui la primera vez y cada vez que escuchaba un villancico, en mi mente estaba la melodía de tenores.
Veía que mi papá se iba a dirigir los conciertos y pensaba "espero que los tenores estén siendo los mejores esta temporada"
Se los dije desde el inicio y lo repito ahora:
mis prioridades en el coro siempre fueron tres —
**tenores, tenores, tenores.**
Así que merecen una explicación honesta de por qué me voy.
**No me voy por conflictos.**
El ambiente actual es sano y tiene mucho potencial de crecimiento, si lo seguimos cuidando con el concepto de "el buen tenor".
Simplemente tengo otros proyectos que requieren ahora todo mi foco.
Como saben, estudio marketing y quiero montar mi propio proyecto de asesorías para ayudar a que las empresas sean más rentables.
Para que eso funcione, necesito dedicarle tiempo, estrategia y energía.
Pero esta vez no me voy como en 2019.
Aquella vez desaparecí por completo.
No tenía teléfono propio, se acabó la temporada y perdí contacto con todos.
Además, yo mismo quise tomar distancia.
Esta vez es distinto.
Ustedes tienen mi número.
Podemos hablar cuando se pueda.
Si quieren actualizar la página de tenores, puedo ayudar.
Si el próximo jefe de cuerda necesita un consejero, con gusto puedo compartir los secretos que he aprendido en estos 8 años cantando para los tenores y 6 dirigiendo al equipo.
No estaré en la fundación, pero sí planeo seguir apoyando a nuestro equipo desde la distancia si así lo desean ustedes.
Gracias a Caleb, Diego, Elmer, Isaías, Héctor, Marco, Mario, Oswaldo, Rodrigo y Santiago por esta temporada.
Para mí fue un honor volver a representar a los tenores en los conciertos y hacerlo a su lado.
**Esta despedida va con mucho cariño, de tenor a tenor**
(incluyendo a los barítonos en la palabra tenor, claro).
Mucha suerte el otro año y pasen una feliz navidad con su familia.
Tenores, tenores, tenores.
Una nalgada muy fuerte de buena suerte.

**Y… ¡Aú, aú!**`;

const TENOR_LOOKUP=TENOR_MEMBERS_DATA.reduce((map,member)=>{map[member.id]=member;return map;},Object.create(null));
const TENOR_MEMBERS=[...TENOR_MEMBERS_DATA].sort((a,b)=>a.name.localeCompare(b.name,'es',{sensitivity:'base'}));
// Refs
const $home=document.getElementById('home');
const $songView=document.getElementById('song-view');
const $memoriesView=document.getElementById('memories-view');
const $memoriesIndex=document.getElementById('memoriesIndex');
const $memoryReader=document.getElementById('memoryReader');
const $title=document.getElementById('song-title');
const $meta=document.getElementById('song-meta');
const $trk=document.getElementById('audio-track');
const $inlinePlayer=document.querySelector('.audio-player[data-player="trk"]');
const $dlTrk=document.getElementById('dl-track');
const $lblTrk=document.getElementById('lbl-track');
const $audioStatus=document.getElementById('audio-status');
const $lyrics=document.getElementById('lyrics');
const $wrap=document.getElementById('lyrics-wrap');
const $toggle=document.getElementById('toggle-lyrics');
const $fontUp=document.getElementById('fontUp');
const $fontDown=document.getElementById('fontDown');

const $grid=document.getElementById('grid');
const $q=document.getElementById('q');
const $suggest=document.getElementById('suggest');

const $mini=document.getElementById('mini');
const $miniToggle=document.getElementById('mini-toggle');
const $miniLoop=document.getElementById('mini-loop');
const $miniClose=document.getElementById('mini-close');
const $miniTitle=document.getElementById('mini-title');
const $miniSub=document.getElementById('mini-sub');
const $miniBar=document.getElementById('mini-bar');
const $miniProg=document.getElementById('mini-prog');
const $miniMeta=document.getElementById('mini-meta');
const $dataToggle=document.getElementById('dataToggle');
const $dataPanel=document.getElementById('dataPanel');
const $dataPanelTitle=document.getElementById('dataPanelTitle');
const $dataPanelEyebrow=document.getElementById('dataPanelEyebrow');
const $dataPanelIntro=document.getElementById('dataPanelIntro');
const $tenorListIntro=document.getElementById('tenorListIntro');
const $dataCards=document.getElementById('dataCards');
const $dataDetail=document.getElementById('dataDetail');
const $dataClose=document.getElementById('dataClose');
const $overviewDetail=document.getElementById('overviewDetail');
const $dataOverview=document.getElementById('dataOverview');
const $dataTenors=document.getElementById('dataTenors');
const $tenorListView=document.getElementById('tenorListView');
const $tenorDetailView=document.getElementById('tenorDetailView');
const $tenorBack=document.getElementById('tenorBack');
const $menuToggle=document.getElementById('menuToggle');
const $quickMenu=document.getElementById('quickMenu');
const $presentationsPanel=document.getElementById('presentationsPanel');
const $presentationsPeriod=document.getElementById('presentationsPeriod');
const $presentationsTitle=document.getElementById('presentationsTitle');
const $presentationsList=document.getElementById('presentationsList');
const $presentationsClose=document.getElementById('presentationsClose');
const $presentationsCalendar=document.getElementById('presentationsCalendar');
const $calendarPopover=document.getElementById('calendarPopover');
const $calendarPopoverBody=document.getElementById('calendarPopoverBody');
const $calendarPopoverDate=document.getElementById('calendarPopoverDate');
const $calendarPopoverTitle=document.getElementById('calendarPopoverTitle');
const $calendarPopoverClose=document.getElementById('calendarPopoverClose');
const $letterReaderTitle=document.getElementById('letterReaderTitle');
const $letterReaderSubtitle=document.getElementById('letterReaderSubtitle');
const $letterContent=document.getElementById('letterContent');

let currentSongId=null, currentAudio=null, plainLyrics='';

// Velocidad global
const SPEEDS=[0.75,0.9,1,1.25,1.5,2];
let gSpeed=1;
let dataCardsReady=false,currentDataMemberId=null,currentDataTab='overview',dataPanelTimer=null,presentationsTimer=null,isMenuOpen=false,selectedPresentationDate=null;
let currentDataSeason=2026,focusTrapState=null,tenorChipCount=0;
let currentPresentationSeason=2025;

// Helpers
function setActiveCard(id){
  document.querySelectorAll('[data-song]').forEach(a=>{
    const is=a.getAttribute('data-song')===id;
    a.classList.toggle('active',is);
    if(is) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  });
}
function setLoading(btn,on,labelEl){
  if(on){btn.classList.add('is-loading');btn.setAttribute('aria-disabled','true'); if(labelEl)labelEl.textContent='Descargando…';}
  else{btn.classList.remove('is-loading');btn.setAttribute('aria-disabled','false');}
}
function extFromUrl(url){
  try{const u=new URL(url),p=u.pathname,i=p.lastIndexOf('.');return i!==-1?p.slice(i+1).toUpperCase():'MP3';}
  catch{const m=url.match(/\.([a-z0-9]+)(?:$|\?)/i);return m?m[1].toUpperCase():'MP3';}
}
function fileExt(url){
  try{const u=new URL(url),p=u.pathname,i=p.lastIndexOf('.');return i!==-1?p.slice(i):'.mp3';}
  catch{const m=url.match(/\.([a-z0-9]+)(?:$|\?)/i);return m?'.'+m[1]:'.mp3';}
}
function cleanName(s){return s.replace(/[^a-z0-9\- _\.]/gi,'_')}
async function forceDownload(url,filename,btn,labelEl){
  try{
    setLoading(btn,true,labelEl);
    const res=await fetch(url,{mode:'cors'});
    if(!res.ok)throw new Error(`Descarga HTTP ${res.status}`);
    const blob=await res.blob();
    const objectUrl=URL.createObjectURL(blob);
    const link=document.createElement('a'); link.href=objectUrl; link.download=filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
  }catch{window.open(url,'_blank')}
  finally{setLoading(btn,false,labelEl); if(labelEl)labelEl.textContent=labelEl.dataset.default||'Descargar';}
}
function escapeHtml(s){return s.replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
function formatLyrics(s){
  if(!s) return '<em>Letra no disponible a\u00fan.</em>';
  const safe=escapeHtml(s.trim());
  return safe.split(/\n{2,}/).map(b=>`<p>${b.replace(/\n/g,'<br>')}</p>`).join('');
}
function setLyrics(text){
  plainLyrics=text||'';
  $lyrics.innerHTML=formatLyrics(plainLyrics);
  requestAnimationFrame(()=>{
    const tooTall=$wrap.scrollHeight>520 || (plainLyrics.length>700 && window.innerWidth<840);
    $wrap.classList.toggle('is-collapsed', tooTall);
    $toggle.hidden=!tooTall;
    $toggle.textContent=tooTall?'Ver m\u00e1s':' ';
  });
}

function formatClock(sec,fallback='00:00'){
  if(!Number.isFinite(sec) || sec<0) return fallback;
  const minutes=Math.floor(sec/60);
  const seconds=Math.floor(sec%60);
  return String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0');
}
function setAudioStatus(message=''){
  $audioStatus.textContent=message;
  $audioStatus.hidden=!message;
}
let playPending=false;
function startPlayback(audio){
  playPending=true;
  let promise;
  try{promise=audio.play()}
  catch(error){
    playPending=false;
    setAudioStatus('No se pudo reproducir la canción. Comprueba tu conexión e inténtalo de nuevo.');
    player.update();updateMini();
    return;
  }
  if(promise?.then) promise.then(
    ()=>{playPending=false},
    error=>{
      playPending=false;
      if(error?.name==='AbortError')return;
      setAudioStatus('No se pudo reproducir la canción. Comprueba tu conexión e inténtalo de nuevo.');
      player.update();updateMini();
    }
  );
  else playPending=false;
}
function togglePlayback(audio){
  if(!audio.paused||playPending){audio.pause();playPending=false}
  else startPlayback(audio);
}
function createPlayerUI({id,audio,label}){
  const root=document.querySelector('.audio-player[data-player="'+id+'"]');
  if(!root||!audio) return null;
  const toggle=root.querySelector('[data-role="toggle"]');
  const progress=root.querySelector('[data-role="progress"]');
  const fill=root.querySelector('[data-role="fill"]');
  const current=root.querySelector('[data-role="current"]');
  const duration=root.querySelector('[data-role="duration"]');
  let scrubbing=false;

  function update(){
    const total=audio.duration;
    const pct=total && Number.isFinite(total)?(audio.currentTime/total)*100:0;
    if(fill) fill.style.width=`${pct}%`;
    if(progress){
      progress.setAttribute('aria-valuenow',String(Math.round(pct)));
      const desc=formatClock(audio.currentTime||0,'00:00')+' de '+formatClock(total,'--:--');
      progress.setAttribute('aria-valuetext',desc);
    }
    if(current) current.textContent=formatClock(audio.currentTime||0,'00:00');
    if(duration) duration.textContent=formatClock(total,'--:--');
    if(toggle){
      const playing=!audio.paused && !audio.ended;
      root.classList.toggle('is-active',playing);
      toggle.classList.toggle('is-playing',playing);
      toggle.innerHTML=playing?iconPause():iconPlay();
      const labelText=label.toLowerCase();
      toggle.setAttribute('aria-label',playing?'Pausar '+labelText:'Reproducir '+labelText);
    }
  }
  function reset(){
    root.classList.remove('is-active');
    if(fill) fill.style.width='0%';
    if(progress){
      progress.setAttribute('aria-valuenow','0');
      progress.setAttribute('aria-valuetext',formatClock(0)+' de --:--');
    }
    if(current) current.textContent='00:00';
    if(duration) duration.textContent='--:--';
    if(toggle){
      toggle.classList.remove('is-playing');
      toggle.innerHTML=iconPlay();
      toggle.setAttribute('aria-label','Reproducir '+label.toLowerCase());
    }
  }
  if(toggle){
    toggle.addEventListener('click',()=>togglePlayback(audio));
  }
  function seek(ev){
    if(!progress||!audio.duration||!Number.isFinite(audio.duration)) return;
    const rect=progress.getBoundingClientRect();
    if(!rect.width) return;
    const pct=Math.min(1,Math.max(0,(pointX(ev)-rect.left)/rect.width));
    audio.currentTime=pct*audio.duration;
    update();
  }
  if(progress){
    progress.addEventListener('pointerdown',ev=>{
      if(ev.pointerType==='mouse'&&ev.button!==0)return;
      scrubbing=true;
      progress.setPointerCapture(ev.pointerId);
      seek(ev);
    });
    progress.addEventListener('pointermove',ev=>{if(scrubbing)seek(ev)});
    progress.addEventListener('pointerup',ev=>{if(scrubbing)seek(ev);scrubbing=false});
    progress.addEventListener('pointercancel',()=>{scrubbing=false});
    progress.addEventListener('keydown',ev=>{
      if(!audio.duration||!Number.isFinite(audio.duration)) return;
      const step=Math.min(5,audio.duration/20);
      if(ev.key==='ArrowLeft'||ev.key==='ArrowDown'){
        audio.currentTime=Math.max(0,audio.currentTime-step);
        ev.preventDefault(); update();
      }else if(ev.key==='ArrowRight'||ev.key==='ArrowUp'){
        audio.currentTime=Math.min(audio.duration,audio.currentTime+step);
        ev.preventDefault(); update();
      }else if(ev.key==='Home'){
        audio.currentTime=0; ev.preventDefault(); update();
      }else if(ev.key==='End'){
        audio.currentTime=audio.duration; ev.preventDefault(); update();
      }
    });
  }
  audio.addEventListener('timeupdate',update);
  audio.addEventListener('play',update);
  audio.addEventListener('pause',update);
  audio.addEventListener('loadedmetadata',update);
  audio.addEventListener('ended',update);
  audio.addEventListener('playing',()=>setAudioStatus());
  audio.addEventListener('error',()=>{
    setAudioStatus('No se pudo cargar la canción. Comprueba tu conexión e inténtalo de nuevo.');
    update();
  });
  reset();
  return {reset,update,audio,label};
}
const player=createPlayerUI({id:'trk',audio:$trk,label:'Canción'});

// Render
function renderHome(){
  document.body.classList.remove('view-memories','view-song');
  $home.hidden=false; $songView.hidden=true; $memoriesView.hidden=true; setActiveCard('');
  document.title='Tenores';
  window.scrollTo({top:0,behavior:'auto'});
  syncMiniVisibility();
}
function renderSong(id){
  document.body.classList.remove('view-memories');
  document.body.classList.add('view-song');
  const s=SONGS[id]; if(!s) return renderHome();
  if(currentSongId!==id){
    $trk.pause();
    playPending=false;
    currentAudio=null;
    hideMini();
    $trk.src=s.track;
    $trk.load();
    $trk.playbackRate=gSpeed;
    $trk.loop=false;
    player.reset();
    $audioStatus.hidden=true;
    $audioStatus.textContent='';
  }else player.update();
  currentSongId=id;
  $title.textContent=s.title;
  $meta.textContent='Bienvenido al equipo. Si hacemos las cosas bien, 2026 será el mejor año de nuestra historia.';
  $lblTrk.textContent=`Descargar ${extFromUrl(s.track)}`;
  $lblTrk.dataset.default=$lblTrk.textContent;
  setLyrics(s.lyrics||''); $home.hidden=true; $memoriesView.hidden=true; $songView.hidden=false; setActiveCard(id);
  document.title=`Tenores - ${s.title}`; window.scrollTo({top:0,behavior:'smooth'});
  syncMiniVisibility();
}

function renderMemories(item=''){
  document.body.classList.remove('view-song');
  document.body.classList.add('view-memories');
  $home.hidden=true; $songView.hidden=true; $memoriesView.hidden=false; setActiveCard('');
  const showingLetter=item==='carta';
  $memoriesIndex.hidden=showingLetter;
  $memoryReader.hidden=!showingLetter;
  document.title=showingLetter?'Carta de despedida · Tenores':'Recuerdos · Tenores';
  window.scrollTo({top:0,behavior:'auto'});
  syncMiniVisibility();
}
// Router
function route(){ const h=(location.hash||'').replace('#','').trim(); if(!h) return renderHome(); if(h==='recuerdos') return renderMemories(); if(h==='recuerdos/carta') return renderMemories('carta'); renderSong(h); }

// Downloads
if($lblTrk) $lblTrk.dataset.default=$lblTrk.textContent;
if($dlTrk) $dlTrk.addEventListener('click',e=>{e.preventDefault(); if(!currentSongId) return; const s=SONGS[currentSongId]; if(!s.track) return; const ext=fileExt(s.track); forceDownload(s.track,cleanName(`${s.title} - cancion${ext}`),$dlTrk,$lblTrk);});

// Sticky mini
function inlinePlayerIsVisible(){
  if($songView.hidden||!$inlinePlayer) return false;
  const rect=$inlinePlayer.getBoundingClientRect();
  return rect.bottom>0&&rect.top<window.innerHeight&&rect.right>0&&rect.left<window.innerWidth;
}
function syncMiniVisibility(){
  $mini.hidden=!currentAudio||inlinePlayerIsVisible();
}
function hideMini(){ $mini.hidden=true; $miniProg.style.width='0%'; }
function bindToMini(audio){
  currentAudio=audio;
  $miniTitle.textContent=SONGS[currentSongId]?.title||'—'; $miniSub.textContent='Canción';
  currentAudio.playbackRate=gSpeed; syncMiniVisibility(); updateMini();
}
function iconPlay(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="8,5 19,12 8,19 8,5"></polygon></svg>`}
function iconPause(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/></svg>`}
function updateMini(){
  const paused=!currentAudio||currentAudio.paused;
  $miniToggle.innerHTML=paused?iconPlay():iconPause();
  $miniToggle.setAttribute('aria-label', paused?'Reproducir':'Pausar');
  $miniLoop.classList.toggle('active', currentAudio && currentAudio.loop);
  $miniLoop.setAttribute('aria-pressed',String(!!currentAudio?.loop));
  $miniLoop.setAttribute('aria-label',currentAudio?.loop?'Desactivar repetición continua':'Activar repetición continua');
  if(!currentAudio||!Number.isFinite(currentAudio.duration)){
    $miniProg.style.width='0%';
    $miniBar.setAttribute('aria-valuenow','0');
    $miniBar.setAttribute('aria-valuetext','00:00 de --:--');
    return;
  }
  const pct=(currentAudio.currentTime/currentAudio.duration)*100;
  $miniProg.style.width=`${pct}%`; $miniBar.setAttribute('aria-valuenow',String(Math.round(pct)));
  $miniBar.setAttribute('aria-valuetext',`${formatClock(currentAudio.currentTime)} de ${formatClock(currentAudio.duration)}`);
}
$trk.addEventListener('play',()=>{if(currentAudio!==$trk)bindToMini($trk);else updateMini()});
$trk.addEventListener('pause',updateMini);
$trk.addEventListener('timeupdate',updateMini);
$trk.addEventListener('loadedmetadata',updateMini);
$trk.addEventListener('ended',updateMini);
$miniToggle.addEventListener('click',()=>{
  if(!currentAudio)return;
  togglePlayback(currentAudio);
  updateMini();
});
$miniLoop.addEventListener('click',()=>{if(!currentAudio) return; currentAudio.loop=!currentAudio.loop; $miniLoop.classList.toggle('active',currentAudio.loop); $miniLoop.setAttribute('aria-label',currentAudio.loop?'Desactivar repetici\u00f3n continua':'Activar repetici\u00f3n continua'); updateMini();});
$miniClose.addEventListener('click',()=>{
  if(currentAudio)currentAudio.pause();
  playPending=false;
  currentAudio=null;
  hideMini();
  updateMini();
});

// Scrub barra mini
let scrubbing=false;
function pointX(ev){return ev.clientX}
function scrubTo(ev){
  if(!currentAudio||!Number.isFinite(currentAudio.duration))return;
  const rect=$miniBar.getBoundingClientRect();
  if(!rect.width)return;
  const pct=Math.min(1,Math.max(0,(pointX(ev)-rect.left)/rect.width));
  currentAudio.currentTime=pct*currentAudio.duration;
  player.update();updateMini();
}
$miniBar.addEventListener('pointerdown',ev=>{
  if(ev.pointerType==='mouse'&&ev.button!==0)return;
  scrubbing=true;
  $miniBar.setPointerCapture(ev.pointerId);
  scrubTo(ev);
});
$miniBar.addEventListener('pointermove',ev=>{if(scrubbing)scrubTo(ev)});
$miniBar.addEventListener('pointerup',ev=>{if(scrubbing)scrubTo(ev);scrubbing=false});
$miniBar.addEventListener('pointercancel',()=>{scrubbing=false});
$miniBar.addEventListener('keydown',ev=>{
  if(!currentAudio||!Number.isFinite(currentAudio.duration)) return;
  const step=Math.min(5,currentAudio.duration/20);
  if(ev.key==='ArrowLeft'||ev.key==='ArrowDown') currentAudio.currentTime=Math.max(0,currentAudio.currentTime-step);
  else if(ev.key==='ArrowRight'||ev.key==='ArrowUp') currentAudio.currentTime=Math.min(currentAudio.duration,currentAudio.currentTime+step);
  else if(ev.key==='Home') currentAudio.currentTime=0;
  else if(ev.key==='End') currentAudio.currentTime=currentAudio.duration;
  else return;
  ev.preventDefault();player.update();updateMini();
});

window.addEventListener('scroll',syncMiniVisibility,{passive:true});
window.addEventListener('resize',syncMiniVisibility);
if('IntersectionObserver' in window&&$inlinePlayer){
  new IntersectionObserver(syncMiniVisibility,{threshold:0}).observe($inlinePlayer);
}
$miniMeta.addEventListener('click',()=>{if(currentSongId) location.hash=currentSongId;});
$miniMeta.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();$miniMeta.click();}});

// Buscador + fix teclado móvil
function normalize(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
const items=[...document.querySelectorAll('#grid [data-song]')].map(a=>({el:a,id:a.getAttribute('data-song'),title:normalize(a.querySelector('.mini-title').textContent)}));
function applyFilter(q){
  const n=normalize(q); let shown=0;
  items.forEach(({el,title})=>{const match=title.includes(n); el.hidden=!match; if(match) shown++;});
  $suggest.hidden=!n; $suggest.textContent=n ? (shown?`${shown} resultado${shown>1?'s':''}`:'Sin resultados') : '';
}
$q.addEventListener('input',()=>applyFilter($q.value));
$q.addEventListener('keydown',e=>{ if(e.key==='Escape'){ $q.value=''; applyFilter(''); $q.blur(); }});

// Letras zoom
function getZoom(){const z=parseFloat(localStorage.getItem('lyricsZoom')||'1'); return isNaN(z)?1:Math.min(1.6,Math.max(0.8,z));}
function setZoom(z){document.documentElement.style.setProperty('--lyrics-zoom', z); localStorage.setItem('lyricsZoom', z);}
$fontUp.addEventListener('click',()=>setZoom(Math.min(1.6, getZoom()+0.1)));
$fontDown.addEventListener('click',()=>setZoom(Math.max(0.8, getZoom()-0.1)));
const $toggleBtn=document.getElementById('toggle-lyrics');
$toggleBtn.addEventListener('click',()=>{const isNow=$wrap.classList.toggle('is-collapsed'); $toggleBtn.textContent=isNow?'Ver m\u00e1s':'Ver menos';});

// Velocidad: menu (delegacion)
function applySpeedAll(){
  $trk.playbackRate=gSpeed;
  document.querySelectorAll('.speed').forEach(btn=>{
    const active=parseFloat(btn.dataset.speed)===gSpeed;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed',String(active));
  });
}
document.addEventListener('click',e=>{
  const t=e.target;
  const dots=t.closest('.dots');
  const speed=t.closest('.speed');
  if(dots){
    const key=dots.dataset.menu;
    const wasOpen=dots.getAttribute('aria-expanded')==='true';
    document.querySelectorAll('.speed-menu').forEach(m=>m.hidden=true);
    document.querySelectorAll('.dots').forEach(b=>b.setAttribute('aria-expanded','false'));
    const menu=document.querySelector(`.speed-menu[data-for="${key}"]`);
    if(menu&&!wasOpen){menu.hidden=false;dots.setAttribute('aria-expanded','true')}
  }else if(speed){
    const selected=parseFloat(speed.dataset.speed);
    if(SPEEDS.includes(selected)){gSpeed=selected;applySpeedAll()}
    document.querySelectorAll('.speed-menu').forEach(m=>m.hidden=true);
    document.querySelectorAll('.dots').forEach(b=>b.setAttribute('aria-expanded','false'));
  }else{
    if(!t.closest('.more')){
      document.querySelectorAll('.speed-menu').forEach(m=>m.hidden=true);
      document.querySelectorAll('.dots').forEach(b=>b.setAttribute('aria-expanded','false'));
    }
  }
});
applySpeedAll();

function formatPlainNumber(value,decimals=0){
  if(value===null||value===undefined) return 'Sin dato';
  const num=Number(value);
  if(Number.isNaN(num)) return 'Sin dato';
  return num.toLocaleString('es-MX',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
}
function formatMinutes(value){
  if(value===null||value===undefined) return 'Sin dato';
  const num=Number(value);
  if(Number.isNaN(num)) return 'Sin dato';
  const decimals=Number.isInteger(num)?0:1;
  return `${num.toLocaleString('es-MX',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})} min`;
}
function formatPercent(value){
  if(value===null||value===undefined) return 'Sin dato';
  const num=Number(value);
  if(Number.isNaN(num)) return 'Sin dato';
  const decimals=Number.isInteger(num)?0:1;
  return `${num.toLocaleString('es-MX',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}%`;
}
function clampPercent(value){
  if(typeof value!=='number'||Number.isNaN(value)) return 0;
  return Math.max(0,Math.min(100,value));
}
function ensureDataCards(){
  if(dataCardsReady||!$dataCards) return;
  renderDataCards();
  dataCardsReady=true;
}
function renderDataCards(){
  if(!$dataCards) return;
  const cards=currentDataSeason===2025?[...TENOR_MEMBERS]:TENOR_MEMBERS_2026;
  const frag=document.createDocumentFragment();
  cards.forEach(card=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='data-card';
    btn.dataset.target=card.id;
    if(currentDataSeason===2025){
      const pct=clampPercent(card.attendance);
      btn.innerHTML=`<span class="data-card__name">${card.name}<small>${formatPercent(card.attendance)}</small></span><span class="data-card__meta">${card.rehearsalsAttended} de ${TEAM_OVERVIEW.rehearsals} ensayos</span><span class="data-card__bar"><span style="--value:${pct}%;"></span></span>`;
    }else{
      btn.innerHTML=`<span class="data-card__name">${card.name}<small>—</small></span><span class="data-card__meta">Sin registros de ensayo</span><span class="data-card__bar"><span style="--value:0%;"></span></span>`;
    }
    frag.appendChild(btn);
  });
  $dataCards.innerHTML='';
  $dataCards.appendChild(frag);
  setActiveDataCard(currentDataMemberId);
}
function setActiveDataCard(id){
  if(!$dataCards) return;
  const activeId=id||'';
  $dataCards.querySelectorAll('.data-card').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.target===activeId);
  });
}
function renderDataDetail(id){
  if(!$dataDetail) return;
  const lookup=currentDataSeason===2025?TENOR_LOOKUP:TENOR_LOOKUP_2026;
  if(!id||!lookup[id]){
    $dataDetail.innerHTML='<p class="data-panel__empty">Selecciona un tenor para consultar sus datos.</p>';
    return;
  }
  renderMemberDetail(lookup[id]);
}
function renderTeamDetail(){
  if(!$overviewDetail) return;
  const hasData=currentDataSeason===2025;
  const members=hasData?TENOR_MEMBERS:TENOR_MEMBERS_2026;
  const attendanceValues=hasData?members.map(member=>member.attendance):[];
  const attendanceRange=hasData?`${formatPercent(Math.min(...attendanceValues))}–${formatPercent(Math.max(...attendanceValues))}`:'—';
  const attendanceBars=members.map(member=>{
    const pct=hasData?clampPercent(member.attendance):0;
    const shortName=member.name==='Marco'?'Mco':member.name==='Mario'?'Mio':member.name.slice(0,3);
    const value=hasData?formatPercent(member.attendance):'sin registros';
    return `<div class="stats-chart__item" title="${member.name}: ${value}"><div class="stats-chart__track">${hasData?`<div class="stats-chart__bar" style="--attendance:${pct}%;"></div>`:''}</div><span class="stats-chart__name"><span class="stats-chart__name-full">${member.name}</span><span class="stats-chart__name-short">${shortName}</span></span></div>`;
  }).join('');
  const attendanceRows=members.map(member=>{
    const pct=hasData?clampPercent(member.attendance):0;
    const detail=hasData?`${member.rehearsalsAttended} de ${TEAM_OVERVIEW.rehearsals} ensayos`:'Sin registros de ensayo';
    return `<div class="tenor-stat"><div class="tenor-stat__meta"><strong>${member.name}</strong><span>${detail}</span></div><div class="tenor-stat__meter"><span style="--value:${pct}%;"></span></div><span class="tenor-stat__value">${hasData?formatPercent(member.attendance):'—'}</span></div>`;
  }).join('');
  const levelHtml=hasData?(TEAM_OVERVIEW.levels||[]).map(level=>`<div class="level-chip"><strong>${level.label}</strong><span>${level.members.join(', ')}</span></div>`).join(''):'<p class="data-panel__empty">Sin datos para clasificar.</p>';
  const obsHtml=hasData?(TEAM_OVERVIEW.observations||[]).map(item=>`<li>${item}</li>`).join(''):'<li>Sin datos de asistencia o puntualidad registrados para 2026.</li>';
  $overviewDetail.innerHTML=`<div class="data-detail__stack">
    <p class="data-overview-meta">${hasData?`${formatPlainNumber(TEAM_OVERVIEW.rehearsals)} ensayos`:'Ensayos sin registrar'} <span aria-hidden="true">·</span> ${formatPlainNumber(members.length)} tenores</p>
    <section class="stats-card${hasData?'':' stats-card--empty'}" aria-labelledby="attendanceChartTitle">
      <div class="stats-card__header">
        <h4 id="attendanceChartTitle">Asistencia de tenores</h4>
        <button class="stats-card__action" type="button" data-action="show-tenors">Datos persona por persona <span aria-hidden="true">→</span></button>
      </div>
      <p class="stats-card__range"><strong>${attendanceRange}</strong><span>de asistencia</span></p>
      <div class="stats-card__context"><p class="stats-card__period">${hasData?`${TEAM_OVERVIEW.timeframe} de 2025`:'2026 · Sin ensayos registrados'}</p><p class="stats-card__average">Promedio de asistencia <strong>${hasData?formatPercent(TEAM_OVERVIEW.averageAttendance):'—'}</strong></p></div>
      <div class="stats-chart${hasData?'':' stats-chart--empty'}" aria-hidden="true">
        <div class="stats-chart__plot" style="--bar-count:${members.length}">
          ${hasData?`<div class="stats-chart__average" style="--average:${clampPercent(TEAM_OVERVIEW.averageAttendance)}%;"></div>`:'<p class="stats-chart__empty">Sin datos de asistencia</p>'}
          ${attendanceBars}
        </div>
      </div>
      <p class="sr-only">${hasData?`Asistencia promedio: ${formatPercent(TEAM_OVERVIEW.averageAttendance)}. El detalle de cada tenor aparece en la lista Asistencia por tenor.`:'No hay porcentajes de asistencia registrados para 2026.'}</p>
      <div class="stats-card__readings">
        <div><span>Tiempo programado</span><strong>${hasData?`${formatPlainNumber(TEAM_OVERVIEW.totalHours)} h`:'—'}</strong></div>
        <div><span>Promedio activo por tenor</span><strong>${hasData?`${formatPlainNumber(TEAM_OVERVIEW.averageMinutes/60,1)} h`:'—'}</strong></div>
      </div>
    </section>
    <div class="overview-columns">
      <section class="data-panel-box">
        <h4>Grupos de desempe\u00f1o</h4>
        <div class="level-grid">${levelHtml}</div>
      </section>
      <section class="data-panel-box">
        <h4>Observaciones</h4>
        <ul class="detail-list">${obsHtml}</ul>
      </section>
    </div>
    <section class="data-panel-box data-panel-box--table">
      <div class="table-header">
        <div>
          <h4>Asistencia por tenor</h4>
        </div>
        <span class="badge badge--ghost">${formatPlainNumber(members.length)} integrantes</span>
      </div>
      <div class="tenor-stats">${attendanceRows}</div>
    </section>
  </div>`;
}
function renderMemberDetail(member){
  if(!$dataDetail) return;
  const hasData=currentDataSeason===2025;
  const hasRehearsals=hasData&&member.rehearsalsAttended!==null&&member.rehearsalsAttended!==undefined;
  const freqValue=hasRehearsals?`${member.rehearsalsAttended} / ${TEAM_OVERVIEW.rehearsals}`:'—';
  const freqLabel=hasRehearsals?'Ensayos cubiertos':'Sin registros de ensayo';
  const minutePct=hasData?clampPercent((member.minutes/TEAM_OVERVIEW.totalMinutes)*100):0;
  const missingMinutes=hasData?Math.max(0,TEAM_OVERVIEW.totalMinutes-Number(member.minutes||0)):null;
  const minutesNarrative=hasData?`Tiempo activo registrado: ${formatMinutes(member.minutes)} de ${formatMinutes(TEAM_OVERVIEW.totalMinutes)} programados.`:'Sin registros de tiempo de ensayo para 2026.';
  const pendingBadge=hasData?`Diferencia: ${formatMinutes(missingMinutes)}`:'Sin datos registrados';
  const hasTardy=hasData&&member.tardyPct!==null&&member.tardyPct!==undefined;
  const tardyWidth=hasTardy?clampPercent(member.tardyPct):0;
  let tardyNote=`Sin registros de llegadas tarde para ${currentDataSeason}.`;
  if(hasTardy){
    tardyNote=`${member.tardyCount||0} de ${member.rehearsalsAttended} ensayos asistidos registran llegada tarde.`;
  }
  let tardyExtra='';
  if(hasTardy && typeof member.tardyJustifiedPct==='number' && member.tardyPct>0){
    tardyExtra=`${formatPercent(member.tardyJustifiedPct)} de esas llegadas tarde fueron justificadas.`;
  }
  const metrics=[
    {value:hasData?formatMinutes(member.minutes):'—',label:'Tiempo activo',note:`Programado: ${hasData?formatMinutes(TEAM_OVERVIEW.totalMinutes):'—'}`},
    {value:hasData?formatMinutes(member.minutesLost):'—',label:'Tiempo no asistido',note:pendingBadge},
    {value:freqValue,label:'Cobertura de ensayos',note:freqLabel}
  ].map(metric=>`<article class="metric-card"><span>${metric.label}</span><strong>${metric.value}</strong><small>${metric.note}</small></article>`).join('');
  const tardyLegend=hasTardy?`${member.tardyCount||0} llegadas tarde`:'Sin dato';
  $dataDetail.innerHTML=`<div class="data-detail__stack">
    <article class="data-detail__hero member-hero">
      <div class="data-hero-text">
        <p class="kicker">Datos individuales · ${currentDataSeason}</p>
        <h3>${member.name}</h3>
        <div class="data-legend">
          <span class="badge badge--ghost">${pendingBadge}</span>
        </div>
      </div>
      <div class="member-hero__value"><strong>${hasData?formatPercent(minutePct):'—'}</strong><span>del tiempo programado</span></div>
    </article>
    <div class="member-metrics">${metrics}</div>
    <div class="member-columns">
      <section class="data-panel-box member-panel">
        <h4>Tiempo de ensayo</h4>
        <div class="data-legend" style="margin-bottom:10px">
          <span class="badge badge--ghost">Tiempo activo: ${hasData?formatMinutes(member.minutes):'—'}</span>
          <span class="badge badge--ghost">Programado ${hasData?formatMinutes(TEAM_OVERVIEW.totalMinutes):'—'}</span>
        </div>
        <div class="attendance-bar"><span style="--value:${minutePct}%;"></span></div>
        <p class="stat-card__note">${minutesNarrative}</p>
      </section>
      <section class="data-panel-box member-panel">
        <h4>Llegadas tarde</h4>
        <div class="data-legend" style="margin-bottom:10px">
          <span class="badge badge--ghost">${hasTardy?formatPercent(member.tardyPct):'Sin dato'}</span>
          <span class="badge badge--ghost">${tardyLegend}</span>
        </div>
        <div class="attendance-bar"><span style="--value:${tardyWidth}%;"></span></div>
        <p class="stat-card__note">${tardyNote}${tardyExtra?` ${tardyExtra}`:''}</p>
      </section>
    </div>
  </div>`;
}
function updateTenorView(){
  if(!$tenorListView||!$tenorDetailView) return;
  const lookup=currentDataSeason===2025?TENOR_LOOKUP:TENOR_LOOKUP_2026;
  const hasSelection=currentDataMemberId&&lookup[currentDataMemberId];
  $tenorListView.hidden=!!hasSelection;
  $tenorDetailView.hidden=!hasSelection;
  renderDataDetail(hasSelection?currentDataMemberId:null);
  setActiveDataCard(hasSelection?currentDataMemberId:null);
  if(hasSelection){$tenorDetailView.scrollTop=0;}
  else if($tenorListView){$tenorListView.scrollTop=0;}
}
function showTenorDetail(id){
  if(!(currentDataSeason===2025?TENOR_LOOKUP:TENOR_LOOKUP_2026)[id]) return;
  currentDataMemberId=id;
  setDataTab('tenors');
  if($tenorBack) $tenorBack.focus();
}
function resetTenorView(){
  currentDataMemberId=null;
  updateTenorView();
  $dataCards?.querySelector('.data-card')?.focus();
}
function setDataTab(tab){
  if(!$dataPanel) return;
  const normalized=tab==='overview'?'overview':'tenors';
  currentDataTab=normalized;
  const sections={overview:$dataOverview,tenors:$dataTenors};
  document.querySelectorAll('[data-tab-target]').forEach(btn=>{
    const is=btn.dataset.tabTarget===normalized;
    btn.classList.toggle('is-active',is);
    btn.setAttribute('aria-selected',is?'true':'false');
  });
  Object.entries(sections).forEach(([key,section])=>{
    if(section) section.hidden=key!==normalized;
  });
  if(normalized==='tenors') updateTenorView();
}

function renderPresentations(){
  $presentationsPanel.dataset.season=String(currentPresentationSeason);
  $presentationsPeriod.textContent=`Noviembre – diciembre de ${currentPresentationSeason}`;
  $presentationsTitle.textContent=`Presentaciones ${currentPresentationSeason}`;
  renderCalendar();
  renderUpcomingList();
}

function renderUpcomingList(){
  if(!$presentationsList) return;
  const upcoming=getUpcomingEvents(3);
  if(!upcoming.length){
    $presentationsList.innerHTML='<p class="presentations-empty">Sin presentaciones registradas.</p>';
    return;
  }
  $presentationsList.innerHTML=upcoming.map(event=>{
    const tag=event.tag?`<div class="upcoming-card__tag">${event.tag}</div>`:'';
    return `<article class="upcoming-card">
      <div>
        <p class="calendar-eyebrow">${formatCalendarDate(event.date)}</p>
        <h4>${event.title}</h4>
      </div>
      <div class="upcoming-card__meta">
        <span>${event.startTime}</span>
        <span>Salida ${event.callTime}</span>
        <span>${event.venue}</span>
      </div>
      <p class="upcoming-card__summary">${event.summary}</p>
      ${tag}
    </article>`;
  }).join('');
}

function renderCalendar(){
  if(!$presentationsCalendar) return;
  const months=getCalendarMonths();
  if(!months.length){
    selectedPresentationDate=null;
    $presentationsCalendar.innerHTML=`<p class="presentations-empty">No hay presentaciones registradas para ${currentPresentationSeason}.</p>`;
    return;
  }
  ensureSelectedPresentationDate();
  const monthsHtml=months.map(month=>buildCalendarMonth(month)).join('');
  $presentationsCalendar.innerHTML=monthsHtml;
  if(!$presentationsCalendar.dataset.bound){
    $presentationsCalendar.addEventListener('click',ev=>{
      const btn=ev.target.closest('.calendar-day');
      if(!btn||!btn.dataset.date) return;
      selectedPresentationDate=btn.dataset.date;
      updateCalendarSelection();
      openCalendarPopover(selectedPresentationDate,rectToObject(btn.getBoundingClientRect()));
    });
    $presentationsCalendar.dataset.bound='true';
  }
  updateCalendarSelection();
  if($calendarPopover&&!$calendarPopover.hidden) positionCalendarPopover();
}

function buildCalendarMonth(monthKey){
  const [yearStr,monthStr]=monthKey.split('-');
  const year=Number(yearStr);
  const monthIndex=Number(monthStr)-1;
  const todayKey=getLocalDateKey();
  const baseDate=new Date(year,monthIndex,1);
  const monthLabel=baseDate.toLocaleDateString('es-MX',{month:'long',year:'numeric'});
  const niceLabel=monthLabel.charAt(0).toUpperCase()+monthLabel.slice(1);
  const totalDays=new Date(year,monthIndex+1,0).getDate();
  const firstDayOffset=(baseDate.getDay()+6)%7;
  const dayNameRow=DAY_NAMES.map(name=>`<span class="calendar-dayname">${name}</span>`).join('');
  let dayCells='';
  for(let i=0;i<firstDayOffset;i++){
    dayCells+='<span class="calendar-day calendar-day--empty" aria-hidden="true"></span>';
  }
  for(let day=1;day<=totalDays;day++){
    const dateStr=`${monthKey}-${String(day).padStart(2,'0')}`;
    const hasEvent=getEventsOnDate(dateStr).length>0;
    const ariaLabel=formatCalendarDate(dateStr);
    if(hasEvent){
      const classes=['calendar-day','has-event'];
      if(dateStr===selectedPresentationDate) classes.push('is-selected');
      if(dateStr===todayKey) classes.push('is-today');
      dayCells+=`<button type="button" class="${classes.join(' ')}" data-date="${dateStr}" aria-label="${ariaLabel}: ver detalles">${day}</button>`;
    }else{
      dayCells+=`<span class="calendar-day is-empty${dateStr===todayKey?' is-today':''}" aria-label="${ariaLabel}">${day}</span>`;
    }
  }
  return `<article class="calendar-month">
    <div class="calendar-month__title">${niceLabel}</div>
    <div class="calendar-grid">${dayNameRow}${dayCells}</div>
  </article>`;
}

function updateCalendarSelection(){
  if(!$presentationsCalendar) return;
  $presentationsCalendar.querySelectorAll('.calendar-day').forEach(btn=>{
    if(!btn.dataset.date) return;
    btn.classList.toggle('is-selected',btn.dataset.date===selectedPresentationDate);
  });
}

function rectToObject(rect){
  if(!rect) return null;
  return {top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right,width:rect.width,height:rect.height};
}

function getLocalDateKey(date=new Date()){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function getActiveCalendarDayRect(){
  if(!$presentationsCalendar) return null;
  const active=$presentationsCalendar.querySelector('.calendar-day.is-selected');
  return active?rectToObject(active.getBoundingClientRect()):null;
}

function openCalendarPopover(date,anchorRect){
  if(!$calendarPopover||!$calendarPopoverBody) return;
  const anchor=anchorRect?rectToObject(anchorRect):null;
  const events=getEventsOnDate(date);
  const dateLabel=formatCalendarDate(date);
  if($calendarPopoverDate) $calendarPopoverDate.textContent=dateLabel;
  if(!events.length){
    if($calendarPopoverTitle) $calendarPopoverTitle.textContent='Sin presentaciones';
    $calendarPopoverBody.innerHTML='<p class="presentations-empty">No hay presentaciones registradas para esta fecha.</p>';
  }else{
    if($calendarPopoverTitle) $calendarPopoverTitle.textContent='Concierto';
    $calendarPopoverBody.innerHTML=events.map(event=>{
      return `<section class="calendar-popover__event">
        <p>${event.venue}, ${event.city}</p>
        <div class="calendar-detail__meta">
          <div><small>Hora</small><span>${event.startTime}</span></div>
          <div><small>Salida</small><span>${event.callTime}</span></div>
          <div><small>Lugar</small><span>${event.venue}</span></div>
        </div>
      </section>`;
    }).join('');
  }
  $calendarPopover.hidden=false;
  requestAnimationFrame(()=>{
    $calendarPopover.classList.add('is-visible');
    positionCalendarPopover(anchor);
  });
}

function closeCalendarPopover(){
  if(!$calendarPopover||$calendarPopover.hidden) return;
  $calendarPopover.classList.remove('is-visible');
  const card=$calendarPopover.querySelector('.calendar-popover__card');
  if(card){
    card.style.top='';
    card.style.left='';
  }
  setTimeout(()=>{ if($calendarPopover) $calendarPopover.hidden=true; },220);
}

function positionCalendarPopover(anchorRect){
  if(!$calendarPopover||$calendarPopover.hidden) return;
  const card=$calendarPopover.querySelector('.calendar-popover__card');
  if(!card) return;
  let rect=anchorRect||getActiveCalendarDayRect();
  if(!rect){
    rect={top:window.innerHeight/2,bottom:window.innerHeight/2,left:window.innerWidth/2,width:0,height:0};
  }
  const cardWidth=card.offsetWidth;
  const cardHeight=card.offsetHeight;
  const offset=16;
  let top=(rect.bottom||rect.top||0)+offset;
  if(top+cardHeight>window.innerHeight-offset){
    top=(rect.top||rect.bottom||0)-cardHeight-offset;
  }
  if(top<offset) top=offset;
  let left=(rect.left||0)+(rect.width||0)/2-cardWidth/2;
  if(left<offset) left=offset;
  const maxLeft=window.innerWidth-cardWidth-offset;
  if(left>maxLeft) left=maxLeft;
  card.style.top=`${Math.round(top)}px`;
  card.style.left=`${Math.round(left)}px`;
}

function getEventsOnDate(date){
  if(!date) return [];
  return PRESENTATION_EVENTS.filter(event=>event.date===date&&event.date.startsWith(String(currentPresentationSeason)));
}

function getUpcomingEvents(limit){
  const sorted=PRESENTATION_EVENTS.filter(event=>event.date.startsWith(String(currentPresentationSeason))).sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(typeof limit==='number') return sorted.slice(0,limit);
  return sorted;
}

function getCalendarMonths(){
  if(currentPresentationSeason===2025) return CALENDAR_MONTHS;
  const baseMonths=CALENDAR_MONTHS.map(month=>month.replace('2025',String(currentPresentationSeason)));
  return [...new Set([...baseMonths,...getUpcomingEvents().map(event=>event.date.slice(0,7))])].sort();
}

function ensureSelectedPresentationDate(){
  if(selectedPresentationDate&&getEventsOnDate(selectedPresentationDate).length) return;
  const upcoming=getUpcomingEvents(1);
  if(upcoming.length) selectedPresentationDate=upcoming[0].date;
  else selectedPresentationDate=null;
}

function formatCalendarDate(dateStr){
  if(!dateStr) return 'Sin fecha';
  const date=new Date(`${dateStr}T00:00:00`);
  if(Number.isNaN(date.getTime())) return dateStr;
  const label=date.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  return label.charAt(0).toUpperCase()+label.slice(1);
}

function openPresentationsPanel(year=2025){
  if(!$presentationsPanel) return;
  if(document.body.classList.contains('data-panel-open')) closeDataPanel();
  if(presentationsTimer){clearTimeout(presentationsTimer);presentationsTimer=null;}
  closeCalendarPopover();
  currentPresentationSeason=year===2026?2026:2025;
  selectedPresentationDate=null;
  renderPresentations();
  $presentationsPanel.hidden=false;
  requestAnimationFrame(()=>document.body.classList.add('presentations-panel-open'));
}
function closePresentationsPanel(){
  if(!$presentationsPanel||$presentationsPanel.hidden) return;
  if(presentationsTimer){clearTimeout(presentationsTimer);presentationsTimer=null;}
  closeCalendarPopover();
  document.body.classList.remove('presentations-panel-open');
  presentationsTimer=setTimeout(()=>{
    $presentationsPanel.hidden=true;
    presentationsTimer=null;
  },320);
}

function setupPresentationsPanel(){
  if(!$presentationsPanel) return;
  document.body.classList.remove('presentations-panel-open');
  $presentationsPanel.hidden=true;
  renderPresentations();
  if($presentationsClose) $presentationsClose.addEventListener('click',closePresentationsPanel);
  $presentationsPanel.addEventListener('click',ev=>{
    if(ev.target&&ev.target.dataset&&ev.target.dataset.role==='close-presentations') closePresentationsPanel();
  });
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'&&document.body.classList.contains('presentations-panel-open')) closePresentationsPanel();
  });
}

function setupCalendarPopover(){
  if(!$calendarPopover) return;
  if($calendarPopoverClose) $calendarPopoverClose.addEventListener('click',closeCalendarPopover);
  $calendarPopover.addEventListener('click',ev=>{
    if(ev.target&&ev.target.dataset&&ev.target.dataset.role==='close-calendar') closeCalendarPopover();
  });
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'&&!$calendarPopover.hidden) closeCalendarPopover();
  });
  window.addEventListener('resize',()=>{ if($calendarPopover&&!$calendarPopover.hidden) positionCalendarPopover(); });
  window.addEventListener('scroll',()=>{ if($calendarPopover&&!$calendarPopover.hidden) positionCalendarPopover(); },{passive:true});
}

function setMenuState(open){
  if(!$menuToggle||!$quickMenu) return;
  isMenuOpen=!!open;
  $menuToggle.setAttribute('aria-expanded',isMenuOpen?'true':'false');
  $quickMenu.hidden=!isMenuOpen;
  if(!isMenuOpen) $quickMenu.querySelectorAll('details').forEach(folder=>{folder.open=false});
}

function setupMenu(){
  if(!$menuToggle||!$quickMenu) return;
  setMenuState(false);
  $menuToggle.addEventListener('click',()=>setMenuState(!isMenuOpen));
  document.addEventListener('click',ev=>{
    if(!isMenuOpen) return;
    if(ev.target.closest('#menuToggle')||ev.target.closest('#quickMenu')) return;
    setMenuState(false);
  });
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'&&isMenuOpen){setMenuState(false);$menuToggle.focus();}
  });
  $quickMenu.addEventListener('keydown',ev=>{
    const items=[...$quickMenu.querySelectorAll('summary, .quick-menu__item')].filter(item=>item.tagName==='SUMMARY'||!item.closest('details')||item.closest('details').open);
    const index=items.indexOf(document.activeElement);
    if(index<0) return;
    let next=index;
    if(ev.key==='ArrowDown') next=(index+1)%items.length;
    else if(ev.key==='ArrowUp') next=(index-1+items.length)%items.length;
    else if(ev.key==='Home') next=0;
    else if(ev.key==='End') next=items.length-1;
    else return;
    ev.preventDefault();items[next].focus();
  });
  $quickMenu.addEventListener('click',ev=>{
    const btn=ev.target.closest('.quick-menu__item');
    if(!btn) return;
    const action=btn.dataset.action;
    setMenuState(false);
    $menuToggle.focus();
    if(action==='data-2026'){ setDataSeason(2026); openDataPanel();}
    else if(action==='data-2025'){ setDataSeason(2025); openDataPanel();}
    else if(action==='memories') location.hash='recuerdos';
    else if(action==='presentations-2026') openPresentationsPanel(2026);
    else if(action==='presentations-2025') openPresentationsPanel(2025);
  });
}

function storageGet(storage,key){
  try{return storage.getItem(key);}
  catch{return null;}
}
function storageSet(storage,key,value){
  try{storage.setItem(key,value);}
  catch{}
}
function storageRemove(storage,key){
  try{storage.removeItem(key);}
  catch{}
}

function getFocusableElements(container){
  if(!container) return [];
  const selector='a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll(selector)).filter(el=>{
    if(el.hasAttribute('disabled')) return false;
    if(el.getAttribute('aria-hidden')==='true') return false;
    return el.getClientRects().length>0;
  });
}

function activateFocusTrap(container,initialFocus){
  if(!container) return;
  deactivateFocusTrap(false);
  const previous=document.activeElement;
  function onKeydown(ev){
    if(ev.key!=='Tab') return;
    const focusables=getFocusableElements(container);
    if(!focusables.length){
      ev.preventDefault();
      if(!container.hasAttribute('tabindex')) container.setAttribute('tabindex','-1');
      container.focus();
      return;
    }
    const first=focusables[0];
    const last=focusables[focusables.length-1];
    if(ev.shiftKey&&document.activeElement===first){
      ev.preventDefault();
      last.focus();
    }else if(!ev.shiftKey&&document.activeElement===last){
      ev.preventDefault();
      first.focus();
    }
  }
  focusTrapState={container,previous,onKeydown};
  document.addEventListener('keydown',onKeydown);
  const focusables=getFocusableElements(container);
  const target=initialFocus||focusables[0]||container;
  if(target&&typeof target.focus==='function') target.focus();
}

function deactivateFocusTrap(restoreFocus=true){
  if(!focusTrapState) return;
  document.removeEventListener('keydown',focusTrapState.onKeydown);
  const previous=focusTrapState.previous;
  focusTrapState=null;
  if(!restoreFocus||!previous||typeof previous.focus!=='function') return;
  if(typeof previous.getClientRects==='function'&&previous.getClientRects().length===0) return;
  previous.focus();
}

function formatLetterInline(text){
  let safe=escapeHtml(text);
  safe=safe.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  safe=safe.replace(/\[\[(.+?)\]\]/g,'<span class="letter-badge">$1</span>');
  safe=safe.replace(/\b(buen tenor|buenos tenores)\b/gi,match=>{
    if(tenorChipCount<TENOR_CHIP_LIMIT){
      tenorChipCount+=1;
      return `<span class="tenor-chip">${match}</span>`;
    }
    return match;
  });
  return safe;
}

function renderLetterContent(raw){
  const text=String(raw||'').replace(/\r\n/g,'\n').trim();
  if(!text||text.includes('{{CARTA_COMPLETA}}')){
    return '<p class="letter-placeholder">Pega el contenido en LETTER_HTML para ver la carta aqui.</p>';
  }
  tenorChipCount=0;
  const lines=text.split('\n');
  const blocks=[];
  let paragraph=[];
  let list=null;
  let quote=[];
  let callout=[];

  function flushParagraph(){
    if(!paragraph.length) return;
    paragraph.forEach(line=>blocks.push(`<p>${formatLetterInline(line)}</p>`));
    paragraph=[];
  }
  function flushList(){
    if(!list) return;
    const items=list.items.map(item=>`<li>${formatLetterInline(item)}</li>`).join('');
    blocks.push(`<${list.type}>${items}</${list.type}>`);
    list=null;
  }
  function flushQuote(){
    if(!quote.length) return;
    const content=quote.map(line=>formatLetterInline(line)).join('<br>');
    blocks.push(`<blockquote>${content}</blockquote>`);
    quote=[];
  }
  function flushCallout(){
    if(!callout.length) return;
    const content=callout.map(line=>formatLetterInline(line)).join('<br>');
    blocks.push(`<div class="letter-callout">${content}</div>`);
    callout=[];
  }

  lines.forEach(line=>{
    const trimmed=line.trim();
    if(!trimmed){
      flushParagraph();
      flushList();
      flushQuote();
      flushCallout();
      return;
    }
    if(/^_{3,}$/.test(trimmed)||/^-{3,}$/.test(trimmed)||/^\*{3,}$/.test(trimmed)){
      flushParagraph();
      flushList();
      flushQuote();
      flushCallout();
      blocks.push('<hr class="letter-divider">');
      return;
    }
    const headingMatch=trimmed.match(/^(#{1,3})\s+(.+)/);
    if(headingMatch){
      flushParagraph();
      flushList();
      flushQuote();
      flushCallout();
      const level=headingMatch[1].length;
      const tag=level>=3?'h5':'h4';
      blocks.push(`<${tag}>${formatLetterInline(headingMatch[2])}</${tag}>`);
      return;
    }
    if(trimmed.startsWith('>> ')){
      flushParagraph();
      flushList();
      flushQuote();
      callout.push(trimmed.slice(3));
      return;
    }
    if(trimmed.startsWith('> ')){
      flushParagraph();
      flushList();
      flushCallout();
      quote.push(trimmed.slice(2));
      return;
    }
    const orderedMatch=trimmed.match(/^(\d+)[\.\)]\s+(.+)/);
    if(orderedMatch){
      flushParagraph();
      flushQuote();
      flushCallout();
      if(!list||list.type!=='ol'){
        flushList();
        list={type:'ol',items:[]};
      }
      list.items.push(orderedMatch[2]);
      return;
    }
    const unorderedMatch=trimmed.match(/^[-*\u2022]\s+(.+)/);
    if(unorderedMatch){
      flushParagraph();
      flushQuote();
      flushCallout();
      if(!list||list.type!=='ul'){
        flushList();
        list={type:'ul',items:[]};
      }
      list.items.push(unorderedMatch[1]);
      return;
    }
    flushList();
    flushQuote();
    flushCallout();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();
  flushQuote();
  flushCallout();
  return blocks.join('');
}

function setLetterCopy(){
  if($letterReaderTitle) $letterReaderTitle.textContent=LETTER_TITLE;
  if($letterReaderSubtitle) $letterReaderSubtitle.textContent=LETTER_SUBTITLE;
  if($letterContent) $letterContent.innerHTML=renderLetterContent(LETTER_HTML);
}

function setupLetterFlow(){ setLetterCopy(); }

function setDataSeason(year){
  currentDataSeason=year===2025?2025:2026;
  $dataPanel.dataset.season=String(currentDataSeason);
  currentDataMemberId=null;
  currentDataTab='overview';
  dataCardsReady=false;
  $dataPanelEyebrow.hidden=true;
  $dataPanelEyebrow.textContent='';
  $dataPanelTitle.textContent=`Datos ${currentDataSeason}`;
  $dataPanelIntro.textContent=currentDataSeason===2025?'Registros de asistencia y ensayos de 2025.':'Aún no hay registros de asistencia ni ensayos de 2026.';
  $tenorListIntro.textContent=`Selecciona un tenor para consultar sus registros de ${currentDataSeason}.`;
  renderTeamDetail();
  renderDataCards();
  dataCardsReady=true;
  setDataTab('overview');
}

function openDataPanel(targetId){
  if(!$dataPanel) return;
  if(document.body.classList.contains('presentations-panel-open')) closePresentationsPanel();
  ensureDataCards();
  const isValidTarget=targetId&&(currentDataSeason===2025?TENOR_LOOKUP:TENOR_LOOKUP_2026)[targetId];
  if(isValidTarget) currentDataMemberId=targetId;
  if(dataPanelTimer){clearTimeout(dataPanelTimer);dataPanelTimer=null;}
  $dataPanel.hidden=false;
  requestAnimationFrame(()=>document.body.classList.add('data-panel-open'));
  if($dataToggle) $dataToggle.setAttribute('aria-expanded','true');
  setDataTab(currentDataTab||'overview');
  activateFocusTrap($dataPanel,$dataClose);
}
function closeDataPanel(){
  if(!$dataPanel||$dataPanel.hidden) return;
  if(dataPanelTimer){clearTimeout(dataPanelTimer);dataPanelTimer=null;}
  document.body.classList.remove('data-panel-open');
  deactivateFocusTrap(true);
  if($dataToggle) $dataToggle.setAttribute('aria-expanded','false');
  dataPanelTimer=setTimeout(()=>{
    $dataPanel.hidden=true;
    dataPanelTimer=null;
  },320);
}
function setupDataPanel(){
  if(!$dataPanel) return;
  document.body.classList.remove('data-panel-open');
  $dataPanel.hidden=true;
  if($dataToggle){
    $dataToggle.setAttribute('aria-expanded','false');
    $dataToggle.addEventListener('click',()=>{
      const isOpen=document.body.classList.contains('data-panel-open') && !$dataPanel.hidden;
      if(isOpen) closeDataPanel(); else openDataPanel();
    });
  }
  if($dataClose) $dataClose.addEventListener('click',closeDataPanel);
  $dataPanel.addEventListener('click',ev=>{
    if(ev.target&&ev.target.dataset&&ev.target.dataset.role==='close-panel') closeDataPanel();
  });
  if($dataCards){
    $dataCards.addEventListener('click',ev=>{
      const btn=ev.target.closest('.data-card');
      if(!btn) return;
      const id=btn.dataset.target||null;
      if(!id) return;
      showTenorDetail(id);
    });
  }
  if($overviewDetail){
    $overviewDetail.addEventListener('click',ev=>{
      if(!ev.target.closest('[data-action="show-tenors"]')) return;
      currentDataMemberId=null;
      setDataTab('tenors');
      document.getElementById('tabTenors')?.focus();
    });
  }
  if($tenorBack) $tenorBack.addEventListener('click',resetTenorView);
  const tabButtons=$dataPanel.querySelectorAll('[data-tab-target]');
  tabButtons.forEach(btn=>{
    btn.addEventListener('click',()=>{
      setDataTab(btn.dataset.tabTarget);
    });
  });
  setDataTab(currentDataTab);
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'&&!$dataPanel.hidden) closeDataPanel();
  });
}
setupDataPanel();
setDataSeason(2026);
setupPresentationsPanel();
setupCalendarPopover();
setupMenu();
setupLetterFlow();
// Navegación
function routerInit(){ setZoom(getZoom()); route(); }
window.addEventListener('hashchange',route);
window.addEventListener('DOMContentLoaded',routerInit);

// Back link
document.querySelector('.back').addEventListener('click',e=>{e.preventDefault(); history.replaceState(null,'',location.pathname+location.search); route();});

// Celebración Aú Aú
(function(){
  const btn=document.getElementById('auBtn');
  const celebration=document.getElementById('auCelebration');
  const celebrationMessage=celebration.querySelector('.au-celebration__message');
  const fireworks=document.getElementById('auFireworks');
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const colors=['#0FFC7E','#91ffd0','#e5ffe9','#38d990'];
  let clicksUntilSpecial=2+Math.floor(Math.random()*4);
  let messageTimer,celebrationTimer;
  function vibrate(pattern){
    if(reducedMotion.matches)return;
    if(typeof navigator.vibrate==='function'){
      try{navigator.vibrate(pattern)}catch(_error){/* El dispositivo puede bloquear la vibración. */}
    }
  }
  function confettiBurst(){
    if(reducedMotion.matches)return;
    for(let i=0;i<22;i++){
      const d=document.createElement('div'); d.className='confetti';
      const sx=Math.random()*window.innerWidth; const drift=(Math.random()*2-1)*100; const rot=(Math.random()*360).toFixed(0)+'deg';
      d.style.left=sx+'px'; d.style.setProperty('--x',drift+'px'); d.style.setProperty('--r',rot);
      const w=5+Math.random()*5,h=7+Math.random()*8; d.style.width=w+'px'; d.style.height=h+'px';
      d.style.background=colors[i%colors.length]; d.style.opacity=(0.7+Math.random()*0.3).toFixed(2);
      d.style.animationDelay=(Math.random()*200)+'ms'; document.body.appendChild(d); setTimeout(()=>d.remove(),1800);
    }
  }
  function showFireworks(){
    clearTimeout(messageTimer);
    clearTimeout(celebrationTimer);
    fireworks.replaceChildren();
    celebration.classList.remove('is-message-visible');
    celebration.hidden=false;
    const width=window.innerWidth,height=window.innerHeight;
    const messageWidth=celebrationMessage.offsetWidth;
    const messageHeight=celebrationMessage.offsetHeight;
    celebrationMessage.style.setProperty('--message-left',Math.max(16,(width-messageWidth)/2)+'px');
    celebrationMessage.style.setProperty('--message-top',Math.max(16,(height-messageHeight)/2)+'px');
    if(reducedMotion.matches){
      celebration.classList.add('is-message-visible');
      celebrationTimer=setTimeout(()=>{celebration.hidden=true;celebration.classList.remove('is-message-visible')},1800);
      return;
    }
    const fragment=document.createDocumentFragment();
    [[.17,.25,.31],[.82,.75,.26],[.46,.52,.43]].forEach(([fromX,x,y],index)=>{
      const launchDelay=index*280;
      const burstDelay=launchDelay+820;
      const color=colors[index%colors.length];
      const rocket=document.createElement('i');
      rocket.className='au-rocket';
      rocket.style.setProperty('--launch-x',fromX*100+'%');
      rocket.style.setProperty('--dx',(x-fromX)*width+'px');
      rocket.style.setProperty('--travel',(height*(1-y)+30)+'px');
      rocket.style.setProperty('--launch-delay',launchDelay+'ms');
      rocket.style.setProperty('--spark-color',color);
      fragment.appendChild(rocket);
      const flash=document.createElement('i');
      flash.className='au-burst-flash';
      flash.style.setProperty('--sx',x*100+'%');
      flash.style.setProperty('--sy',y*100+'%');
      flash.style.setProperty('--burst-delay',burstDelay+'ms');
      flash.style.setProperty('--spark-color',color);
      fragment.appendChild(flash);
      for(let i=0;i<24;i++){
        const spark=document.createElement('i');
        const angle=Math.PI*2*i/24;
        const radius=65+Math.random()*Math.min(70,width*.15);
        spark.className='au-spark';
        spark.style.setProperty('--sx',x*100+'%');
        spark.style.setProperty('--sy',y*100+'%');
        spark.style.setProperty('--tx',Math.cos(angle)*radius+'px');
        spark.style.setProperty('--ty',Math.sin(angle)*radius+'px');
        spark.style.setProperty('--angle',(i*15+90)+'deg');
        spark.style.setProperty('--burst-delay',burstDelay+'ms');
        spark.style.setProperty('--spark-color',colors[(i+index)%colors.length]);
        fragment.appendChild(spark);
      }
    });
    fireworks.appendChild(fragment);
    messageTimer=setTimeout(()=>celebration.classList.add('is-message-visible'),1540);
    celebrationTimer=setTimeout(()=>{
      celebration.hidden=true;
      celebration.classList.remove('is-message-visible');
      fireworks.replaceChildren();
    },4100);
  }
  btn.addEventListener('click',()=>{
    confettiBurst();
    clicksUntilSpecial--;
    if(clicksUntilSpecial===0){
      showFireworks();vibrate([45,35,65,40,90]);
      clicksUntilSpecial=3+Math.floor(Math.random()*5);
    }
    else vibrate(25);
  });
})();

// Tests básicos
(function tests(){
  console.group('%cTests Tenores','color:#0ffc7e');
  console.assert(typeof SONGS.fum==='object' && !!SONGS.fum.track,'fum ok');
  console.assert(escapeHtml('<>&"\'' ).includes('&lt;'),'escape ok');
  console.assert(formatLyrics('a\n\nb').includes('<p>'),'format ok');
  console.groupEnd();
})();





















