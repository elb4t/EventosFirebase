const functions = require('firebase-functions');
const admin = require('firebase-admin');

const gcs = require('@google-cloud/storage')();
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

var tema = "Todos";
exports.notificaFoto = functions.firestore.document('eventos/{evento}')
    .onWrite(event => {
        if (event.data.data()['imagen'] !== event.data.previous.data()['imagen']) {
            const datos = {
                notification: {
                    title: 'Nueva imagen de ' + event.data.data()['evento'], body: "Se ha cambiado la imagen del evento "
                        + event.data.data()['evento']
                }
            };
            admin.messaging().sendToTopic(tema, datos).then(response => {
                console.log("Envío correcto:", response);
                return response;
            }).catch(error => {
                console.log("Envío erróneo:", error);
            });
        }
    });

const nodemailer = require('nodemailer');
exports.enviarEmailDesinstalacion = functions.analytics.event('app_remove').onLog(event => {
    const gmailEmail = functions.config().gmail.email;
    const gmailPassword = functions.config().gmail.password;
    const mailTransport = nodemailer.createTransport({
        service: 'gmail', auth: {
            user: gmailEmail,
            pass: gmailPassword
        }
    });
    const opcionesEmail = {
        from: `${APP_NAME} <noreply@firebase.com>`,
        to: 'elllabel@epsa.upv.es',
        subject: 'Desinstalación aplicación Eventos',
        text: 'Un usuario ha desinstalado la aplicación Eventos'
    };
    return mailTransport.sendMail(opcionesEmail);
});

exports.crearMiniatura = functions.storage.object().onChange(event => {
    // Código a ejecutar
    const objeto = event.data;
    const deposito = objeto.bucket;
    const ruta = objeto.name;
    const tipo = objeto.contentType;
    const estado = objeto.resourceState;
    const metageneration = objeto.metageneration;

    // Salimos del desencadenador si el fichero no es una imagen.
    if (!tipo.startsWith('image/')) {
        console.log('No es una imagen.');
        return null;
    }
    // Obtenemos el nombre del fichero.
    const nombreFichero = path.basename(ruta);

    // Salimos de la función si es una miniatura.
    if (nombreFichero.startsWith('thumb_')) {
        console.log('Existe una miniatura.');
        return null;
    }
    // Salimos de la función si se trata de un evento mover o borrado.
    if (estado === 'not_exists') {
        console.log('Evento de borrado.');
        return null;
    }
    // Salimos si no es un fichero nuevo. Sólo ha cambiado los metadata.
    if (estado === 'exists' && metageneration > 1) {
        console.log('Cambio de metadata.');
        return null;
    }

    const bucket = gcs.bucket(deposito);
    const tempRuta = path.join(os.tmpdir(), nombreFichero);
    const metadata = {
        contentType: tipo,
    };
    return bucket.file(ruta).download({
        destination: tempRuta,
    }).then(() => {
        return spawn('convert', [tempRuta, '-thumbnail', '200x200>', tempRuta]);
    }).then(() => {
        const thumbArchivo = `thumb_${nombreFichero}`;
        const thumbRuta = path.join(path.dirname(ruta), thumbArchivo);
        return bucket.upload(tempRuta, {
            destination: thumbRuta,
            metadata: metadata,
        });
    }).then(() => fs.unlinkSync(tempRuta));
});

exports.mostrarEventos = functions.https.onRequest((req, res) => {
    var evento = req.query.evento;
    db.collection('eventos').doc(evento).get().then(doc => {
        if (doc.exists) {
            res.json(doc.data());
        } else {
            res.send(`No se encuentra el evento ${evento}`);
        }
        return doc;
    }).catch(reason => {
        res.send("Error");
    })
});

exports.mostrarEventosHtml = functions.https.onRequest((req, res) => {
    var evento = req.query.evento; db.collection('eventos').doc(evento).get().then(doc => {
        if (doc.exists) {
            res.status(200).send(`<!doctype html>
    <head>
    <link rel="stylesheet"
    href="https://fonts.googleapis.com/css?family=Ranga"> </head>
    <body>
    <span style="font-family: 'Ranga',serif;
    font-size:medium;"> El evento ${doc.data().evento} se realiza en la ciudad de ${doc.data().ciudad} el dia
    ${doc.data().fecha}. </span>
    </body>
    </html>`);
        } else {
            res.send(`No se encuentra el evento ${evento}`);
        }
        return;
    }).catch(reason => {
        res.send("Error");
    })
});