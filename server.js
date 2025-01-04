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

// Endpoint para consultar datos de DICAPI
app.post("/consulta-dicapi", async (req, res) => {
  console.log("Iniciando consulta a DICAPI...");
  console.log("Cuerpo recibido:", req.body);

  try {
    // Construir los parámetros exactamente como se configuran en Postman
    const params = new URLSearchParams();
    params.append("class", "form-horizontal contForm");
    params.append("ddlTipoConsultaID", "1"); // Consulta por matrículas
    params.append("txtNave", req.body.matricula || "");

    console.log("Parámetros enviados a DICAPI:", params.toString());

    const response = await axios.post(
      "https://consultas.dicapi.mil.pe/ConsultarNaves/Naves/ConsultarNave",
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      }
    );

    // Imprimir la respuesta completa de DICAPI
    console.log("Respuesta completa de DICAPI:");
    console.log(response.data);

    const $ = cheerio.load(response.data);
    const results = [];

    // Procesar la tabla de resultados
    $("table tr").each((index, element) => {
      const row = $(element).find("td");
      if (row.length > 0) {
        const matricula = $(row[0]).text().trim();
        const nombre = $(row[1]).text().trim();
        const ab = $(row[2]).text().trim();
        const eslora = $(row[3]).text().trim();
        const manga = $(row[4]).text().trim();
        const puntal = $(row[5]).text().trim();
        const detalleLink = $(row[6]).find("a").attr("href");

        results.push({
          matricula,
          nombre,
          ab,
          eslora,
          manga,
          puntal,
          detalleLink: detalleLink || "#",
        });
      }
    });

    if (results.length > 0) {
      console.log("Resultados procesados:", results);
    } else {
      console.log("No se encontraron resultados en DICAPI.");
    }

    res.json(results);
  } catch (error) {
    console.error("Error en la consulta DICAPI:", error.message);

    // Imprimir detalles de error
    if (error.response) {
      console.error("Estado del error:", error.response.status);
      console.error("Encabezados del error:", error.response.headers);
      console.error("Contenido devuelto por DICAPI:");
      console.error(error.response.data);
    }

    res.status(500).json({ error: "No se pudo procesar la solicitud. Intenta más tarde." });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));
