-- Generado por tools/build-songs-migration.mjs. No editar a mano.
CREATE TABLE songs (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  track            TEXT,
  lyrics           TEXT NOT NULL DEFAULT '',
  position         INTEGER NOT NULL,
  active           INTEGER NOT NULL DEFAULT 1,
  legacy_reference INTEGER NOT NULL DEFAULT 0,
  reference        TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE UNIQUE INDEX songs_title ON songs(title COLLATE NOCASE);
INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES ('fum', 'Fum Fum Fum', 'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760051700/fum_fum_fum_cancion_c7zzyg.m4a', 'Veinticinco de diciembre
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
Fum, fum, fum', 1, 1, 1, NULL, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES ('campanas', 'Canto de las campanas', 'https://res.cloudinary.com/dul66qlpq/video/upload/v1760142195/canto_de_las_campanas_cancion_tq94nl.mp3', '¡Qué dulce son! Campanas dan,
diciendo están: «Penas dejad».
La Navidad llega feliz;
cantos alzad, gozo tened.
Din, don, din, don.

Su canto es canto sin fin,
suenan feliz.
Llevan su voz al cielo azul,
diciendo están: «¡Gozo tened!»

Mas se oye ya su dulce son,
con claridad dice feliz:
la Navidad viene al fin;
gozo tened, pues ya llegó.

En Belén nació un bello niño,
en Belén nació un bello niño.
Su canto es canto sin fin,
llevando van a todo hogar.
Din, don, din, don.', 2, 1, 1, NULL, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES ('adeste', 'Adeste Fideles', 'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760051838/adeste_cancion_kefxux.m4a', 'Adeste fideles, laeti triumphantes,
venite, venite in Bethlehem.
Natum videte, Regem angelorum:
venite adoremus, venite adoremus,
venite adoremus Dominum.

En grege relicto, humiles ad cunas
vocati pastores approperant;
et nos ovanti gradu festinemus:
venite adoremus, venite adoremus,
venite adoremus Dominum.

Aeterni Parentis splendorem aeternum
velatum sub carne videbimus;
Deum infantem pannis involutum:
venite adoremus, venite adoremus,
venite adoremus Dominum.', 3, 1, 1, NULL, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES ('dona', 'Dona Nobis Pacem', 'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760054240/dona_nobis_pacem___cancion_hsep4p.m4a', 'Dona nobis pacem,
dona nobis pacem,
dona nobis pacem.', 4, 1, 1, NULL, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES ('fuentecilla', 'Fuentecilla que corres', 'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760998122/fuentecilla_que_corres_cancion__qhqna2.mp3', 'A la nanita nana, nanita ea,
mi Jesús tiene sueño, bendito sea.
A la nanita nana, nanita ea,
mi Jesús tiene sueño, bendito sea.

Fuentecilla que corres clara y sonora,
ruiseñor que en la selva cantando lloras,
calla mientras la cuna se balancea.
A la nanita nana, nanita ea,
mi Jesús tiene sueño, bendito sea.

Manojito de rosas y alhelíes,
¿qué es lo que estás soñando que te sonríes?
¿Cuáles son tus ensueños, dime, alma mía?
Mas, ¿qué es lo que murmuras? Eucaristía.', 5, 1, 1, NULL, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES ('estrella', 'Estrella Errante', 'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760997189/estrella_errante_cancion_m6bcdm.mp3', 'He visto una estrella errante
rodandito por el cielo,
que va rápido a estrellarse
con su colita de fuego.
Quiero pensar un deseo
mientras que dura su brillo,
mas se apaga en un instante,
¿quién sabe dónde se ha ido?

La, la, la, la, ¿dónde se ha ido?
La, la, la, ya se ha dormido.

He visto una estrella errante
rodandito por el cielo;
unos magos la han seguido
a un establo y ya se han ido.
Allí dentro estaba un niño,
dormidito en un pesebre;
San José era su padre
y María era su madre.

La, la, la, la, ¿dónde se ha ido?
La, la, la, ya se ha dormido.', 6, 1, 1, NULL, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES ('paz', 'Himno a la paz', 'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760997237/himno_a_la_paz_cancion_avurel.mp3', 'Paz, paz, paz,
el mundo pide paz.
Logra la paz en tu interior
y derrámala en la tierra.

Paz, paz, paz,
el mundo pide paz.
Logra la paz en tu interior
y derrámala en la tierra.', 7, 1, 1, NULL, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES ('merry', 'We wish you a merry christmas', 'https://res.cloudinary.com/dcwx23x5o/video/upload/v1760997255/we_wish_you_cancion_pgz1i2.mp3', 'We wish you a merry Christmas,
we wish you a merry Christmas,
we wish you a merry Christmas
and a happy New Year.

Good tidings we bring
to you and your kin.
Good tidings for Christmas
and a happy New Year.

We wish you a merry Christmas,
we wish you a merry Christmas,
we wish you a merry Christmas
and a happy New Year.', 8, 1, 1, NULL, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES ('kling', 'Kling Glöckchen, klingelingeling', 'https://res.cloudinary.com/dul66qlpq/video/upload/v1761827592/kling_cancion_xawypb.mp3', 'Kling, Glöckchen, klingelingeling!
Kling, Glöckchen, kling!
Lasst mich ein, ihr Kinder,
ist so kalt der Winter!
Öffnet mir die Türen,
lasst mich nicht erfrieren!
Kling, Glöckchen, klingelingeling!
Kling, Glöckchen, kling!

Kling, Glöckchen, klingelingeling!
Kling, Glöckchen, kling!
Mädchen, hört, und Bübchen,
macht mir auf das Stübchen!
Bring euch viele Gaben,
sollt euch dran erlaben!
Kling, Glöckchen, klingelingeling!
Kling, Glöckchen, kling!

Kling, Glöckchen, klingelingeling!
Kling, Glöckchen, kling!
Hell erglühn die Kerzen,
öffnet mir die Herzen!
Will drin wohnen fröhlich,
frommes Kind, wie selig!
Kling, Glöckchen, klingelingeling!
Kling, Glöckchen, kling!', 9, 1, 1, NULL, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES ('tannenbaum', 'O Tannenbaum', 'https://res.cloudinary.com/dcwx23x5o/video/upload/v1761968289/oh_thanenbaum_kkhmya.mp3', 'O Tannenbaum, o Tannenbaum,
wie treu sind deine Blätter!
O Tannenbaum, o Tannenbaum,
wie treu sind deine Blätter!
Du grünst nicht nur zur Sommerzeit,
nein, auch im Winter, wenn es schneit.
O Tannenbaum, o Tannenbaum,
wie treu sind deine Blätter!

O Tannenbaum, o Tannenbaum,
du kannst mir sehr gefallen!
O Tannenbaum, o Tannenbaum,
du kannst mir sehr gefallen!
Wie oft hat nicht zur Weihnachtszeit
ein Baum von dir mich hoch erfreut!
O Tannenbaum, o Tannenbaum,
du kannst mir sehr gefallen!', 10, 1, 1, NULL, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES ('mundo', 'Mundo feliz', 'https://res.cloudinary.com/dul66qlpq/video/upload/v1764903368/mundo-feliz_udqafi.m4a', 'Mundo feliz, Jesús nació,
ya nuestro Rey está.
Y todo lo que Dios creó,
a su encuentro va,
a su encuentro va.
Feliz, feliz, a su encuentro va.

Joy to the world, the Lord has come!
Let earth receive her King;
let every heart prepare Him room,
and heaven and nature sing,
and heaven and nature sing,
and heaven, and heaven, and nature sing.', 11, 1, 1, NULL, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
INSERT INTO songs (id, title, track, lyrics, position, active, legacy_reference, reference, created_at, updated_at) VALUES ('stelle', 'Tu scendi dalle stelle', 'https://res.cloudinary.com/dul66qlpq/video/upload/v1764903364/tu-scendi_xbmuo7.m4a', 'O Bambino mio divino,
io ti vedo qui a tremar;
o Dio beato!
Ah, quanto ti costò
l''avermi amato!', 12, 1, 1, NULL, '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
