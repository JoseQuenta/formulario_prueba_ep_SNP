const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

// Endpoint principal para obtener los datos generales
app.post("/consulta-sanipes", async (req, res) => {
  try {
    const response = await axios.post(
      "http://app02.sanipes.gob.pe:8089/Publico/Consulta_protocolos_embarcacion_pesca",
      new URLSearchParams(req.body)
    );

    const $ = cheerio.load(response.data);
    const results = [];

    $("table").each((_, table) => {
      const matricula = $(table).find("tr:contains('Matricula:')").text().replace("Matricula:", "").trim();
      const nombre = $(table).find("tr:contains('Nombre:')").text().replace("Nombre:", "").trim();
      const tipo = $(table).find("tr:contains('Tipo:')").text().replace("Tipo:", "").trim();
      const actividad = $(table).find("tr:contains('Actividad:')").text().replace("Actividad:", "").trim();
      const codigoHabilitacion = $(table).find("tr:contains('Código de Habilitación:')").text().replace("Código de Habilitación:", "").trim();
      const protocoloLink = $(table).find("tr:contains('Ver Listado de Protocolos:') a").attr("href");

      if (matricula) {
        results.push({
          matricula,
          nombre,
          tipo,
          actividad,
          codigoHabilitacion,
          protocoloLink: protocoloLink || "#",
        });
      }
    });

    res.json(results);
  } catch (error) {
    console.error("Error en la consulta:", error.message);
    res.status(500).json({ error: "No se pudo procesar la solicitud. Intenta más tarde." });
  }
});

// Nuevo endpoint para obtener el PTH de una matrícula
app.get("/obtener-pth/:matricula", async (req, res) => {
  const { matricula } = req.params;
  const url = `http://app02.sanipes.gob.pe:8089/Publico/llenar_protocolo_embarcacion_pesca?matricula=${matricula}`;

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "http://app02.sanipes.gob.pe:8089/Publico/Consulta_protocolos_embarcacion_pesca",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });
    res.json(response.data); // Envía la respuesta al cliente
  } catch (error) {
    console.error("Error al obtener el protocolo:", error.message);
    res.status(500).json({ error: "No se pudo obtener el protocolo. Intenta más tarde." });
  }
});


const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));
