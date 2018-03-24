const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);

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
        from: '${APP_NAME} <noreply@firebase.com>',
        to: 'elllabel@epsa.upv.es',
        subject: 'Desinstalación aplicación Eventos',
        text: 'Un usuario ha desinstalado la aplicación Eventos'
    };
    return mailTransport.sendMail(opcionesEmail);
});