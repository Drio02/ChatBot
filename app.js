"use strict";

const token = process.env.WHATSAPP_TOKEN;
const express = require("express"),
  body_parser = require("body-parser"),
  axios = require("axios").default,
  app = express().use(body_parser.json());

app.listen(process.env.PORT || 1337, () => console.log("webhook is listening"));

app.post("/webhook", (req, res) => {
  let body = req.body;

  if (body.object) {
    let phone_number_id = body.entry[0].changes[0].value.metadata.phone_number_id;
    let from = body.entry[0].changes[0].value.messages[0].from;
    let msg_body = body.entry[0].changes[0].value.messages[0].text.body;

    if (msg_body.startsWith("/comenzar ")) {
      let residentName = msg_body.substring(10); // Elimina el comando para obtener el nombre
      let welcomeMessage = `👋¡Hola ${residentName} Residente! A partir de este momento podés reportarnos tus vistas por medio de este chat.\n👉 Lo único que debes de hacer es enviarnos el comando "/visitante" seguido del nombre de tu visitante y nosotros te devolvemos una llave digital de acceso en forma de código QR.\n👉 Debés compartir este QR con tu visita e indicarle que al llegar al condominio únicamente debe presentarla en el lector de QR para poder entrar o salir. ¡Muchas gracias!`;

      sendMessage(phone_number_id, from, welcomeMessage);
      setTimeout(() => {
        sendMessage(phone_number_id, from, `📖 Para obtener ayuda con el bot escribe: "/ayuda"`);
      }, 1000);  // Retraso de 1 segundo
    } else if (msg_body.startsWith("/ayuda")) {
      let helpMessage = `Cómo usar el bot:\n- Para registrar un visitante, escribe "/visitante" seguido del nombre del visitante. Ejemplo: "/visitante Pablo Agüero". Esto creará un registro válido por 24 horas.\n- Para especificar detalles del visitante, escribe "/visitante" seguido del nombre y los detalles de la visita (fecha y hora de entrada y salida). Ejemplo: "/visitante Pablo Agüero 28/11/2023 28/11/2023 08:00 13:00".\n🔑 Recibirás un código QR que debes compartir con tu visitante para su acceso.`;

      sendMessage(phone_number_id, from, helpMessage);
    } else if (msg_body.startsWith("/visitante ")) {
      let visitorInfo = parseVisitorInfo(msg_body.substring(11));
      if (visitorInfo.startsWith("Formato de información no reconocido")) {
        sendMessage(phone_number_id, from, visitorInfo);
      } else {
        let visitorName = extractVisitorName(visitorInfo);
        let preQRMessage = `La llave de entrada y salida para ${visitorName} Visitante es: `;
        sendMessage(phone_number_id, from, preQRMessage);

        let qrText = createQRText(visitorInfo);
        let qr_url = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrText)}`;
        sendImage(phone_number_id, from, qr_url);
      }
    } else {
      let errorMessage = "Comando no encontrado, utiliza las palabras clave";
      sendMessage(phone_number_id, from, errorMessage);

      setTimeout(() => {
        sendMessage(phone_number_id, from, `📖 Para obtener ayuda con el bot escribe: "/ayuda"`);
      }, 1000);  // Retraso de 1 segundo
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

function extractVisitorName(visitorInfo) {
  let nameMatch = visitorInfo.match(/^Nombre: (.+?)(\n|$)/);
  return nameMatch ? nameMatch[1] : "Visitante";
}

function parseVisitorInfo(info) {
  let parts = info.split(' ');
  // Ajustar la lógica de acuerdo a la estructura esperada del comando
  if (parts.length === 2) {
    return `Nombre: ${parts[0]} ${parts[1]}\nNota: Registro creado por 24 horas a partir de ahora`;
  } else if (parts.length >= 6) {
    // Asegurarse de que todas las partes necesarias estén presentes
    return `Nombre: ${parts[0]} ${parts[1]}\nFecha entrada: ${parts[2]}\nFecha salida: ${parts[3]}\nHora entrada: ${parts[4]}\nHora salida: ${parts[5]}`;
  } else {
    return "Formato de información no reconocido";
  }
}

function createQRText(visitorInfo) {
  return visitorInfo; // Aquí puedes agregar más lógica si es necesario
}

function sendMessage(phone_number_id, recipient, message) {
  axios({
    method: "POST",
    url: `https://graph.facebook.com/v12.0/${phone_number_id}/messages?access_token=${token}`,
    data: {
      messaging_product: "whatsapp",
      to: recipient,
      text: { body: message }
    },
    headers: { "Content-Type": "application/json" },
  }).catch(err => console.error('Error sending message:', err));
}

function sendImage(phone_number_id, recipient, image_url) {
  axios({
    method: "POST",
    url: `https://graph.facebook.com/v12.0/${phone_number_id}/messages?access_token=${token}`,
    data: {
      messaging_product: "whatsapp",
      to: recipient,
      type: "image",
      image: { link: image_url }
    },
    headers: { "Content-Type": "application/json" },
  }).catch(err => console.error('Error sending image:', err));
}

app.get("/webhook", (req, res) => {
  const verify_token = process.env.VERIFY_TOKEN;

  // Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Checks if a token and mode were sent
  if (mode && token) {
    // Checks the mode and token sent are correct
    if (mode === "subscribe" && token === verify_token) {
      // Responds with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if the verify tokens do not match
      res.sendStatus(403);
    }
  }
});