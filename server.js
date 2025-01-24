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

const path = require("path");

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


// Nuevo endpoint para obtener el PTH de una matrícula
app.get("/obtener-pth/:matricula", async (req, res) => {
  const { matricula } = req.params;
  const url = `http://app02.sanipes.gob.pe:8089/Publico/llenar_protocolo_embarcacion_pesca?matricula=${matricula}`;

  try {
    console.log(`Iniciando solicitud para la matrícula: ${matricula}`);
    console.log(`URL generada: ${url}`);

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json", // Especifica que esperas un JSON
      },
    });

    console.log("Respuesta recibida del servidor SANIPES.");

    if (typeof response.data === "object") {
      // Verifica si la respuesta ya es un JSON
      console.log("Respuesta JSON procesada:");
      console.log(JSON.stringify(response.data, null, 2));
      res.json(response.data);
    } else {
      // Si no es un JSON, intenta procesarlo con cheerio como HTML
      const $ = cheerio.load(response.data);
      const protocolo = $("tr:contains('Protocolo:') td").text().trim();
      const fecha_inicio_text = $("tr:contains('Fecha de Inicio:') td").text().trim();
      const ruta_pdf = $("a:contains('Descargar PDF')").attr("href");

      console.log("Datos procesados desde HTML:");
      console.log(`Protocolo: ${protocolo}`);
      console.log(`Fecha de Inicio: ${fecha_inicio_text}`);
      console.log(`Ruta PDF: ${ruta_pdf ? `http://app02.sanipes.gob.pe:8089${ruta_pdf}` : "No disponible"}`);

      res.json({
        protocolo: protocolo || "No especificado",
        fecha_inicio_text: fecha_inicio_text || "No especificado",
        ruta_pdf: ruta_pdf ? `http://app02.sanipes.gob.pe:8089${ruta_pdf}` : null,
      });
    }
  } catch (error) {
    console.error("Error al obtener el PTH:", error.message);
    res.status(500).json({ error: "No se pudo obtener el protocolo." });
  }
});





// Endpoint para consultar datos de DICAPI
app.post("/consulta-dicapi", async (req, res) => {
  console.log("Iniciando consulta a DICAPI...");
  console.log("Cuerpo recibido:", req.body);

  try {
    const tipoConsulta = req.body.matricula ? "1" : req.body.nombre ? "2" : null;

    if (!tipoConsulta) {
      return res.status(400).json({ error: "Debe proporcionar una matrícula o un nombre." });
    }

    // Construir los parámetros con base en el tipo de consulta
    const params = new URLSearchParams();
    params.append("class", "form-horizontal contForm");
    params.append("ddlTipoConsultaID", tipoConsulta);
    params.append("txtNave", req.body.matricula || req.body.nombre || "");

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
        const codigoNave = detalleLink ? detalleLink.match(/CodigoNave=(\d+)/)?.[1] : null;
    
        results.push({
          matricula,
          nombre,
          ab,
          eslora,
          manga,
          puntal,
          codigoNave,
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

app.post("/detalle-dicapi", async (req, res) => {
  const { codigoNave } = req.body;

  console.log("Iniciando consulta de detalles a DICAPI...");
  console.log("Código de nave recibido:", codigoNave);

  if (!codigoNave) {
    console.error("No se proporcionó un código de nave.");
    return res.status(400).json({ error: "Debe proporcionar un código de nave." });
  }

  try {
    const params = new URLSearchParams({ CodigoNave: codigoNave });
    console.log("Parámetros enviados a DICAPI:", params.toString());

    const response = await axios.post(
      "https://consultas.dicapi.mil.pe/ConsultarNaves/Naves/VerDetalleNave",
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      }
    );

    const $ = cheerio.load(response.data);

    // Extraer los datos principales
    const detalle = {
      nombre: $("ul.list-inline li:contains('Nave:')").next().text().trim(),
      matricula: $("ul.list-inline li:contains('Matricula:')").next().text().trim(),
      estadoMatricula: $("ul.list-inline li:contains('Estado de matricula:')").next().text().trim(),
      folio: $("ul.list-inline li:contains('Folio:')").next().text().trim(),
      libro: $("ul.list-inline li:contains('Libro:')").next().text().trim(),
      arqueoBruto: $("ul.list-inline li:contains('Arqueo Bruto:')").next().text().trim(),
      eslora: $("ul.list-inline li:contains('Eslora:')").next().text().trim(),
      puntal: $("ul.list-inline li:contains('Puntal:')").next().text().trim(),
      manga: $("ul.list-inline li:contains('Manga:')").next().text().trim(),
    };

    // Extraer los certificados digitales
    const certificados = [];
    $("table tbody tr").each((_, row) => {
      const columns = $(row).find("td");
      if (columns.length > 0) {
        const certificado = {
          numeroCertificado: $(columns[0]).text().trim(),
          nombreNave: $(columns[1]).text().trim(),
          tipoCertificado: $(columns[2]).text().trim(),
          fechaExpedicion: $(columns[3]).text().trim(),
          vencimientoRefrenda: $(columns[4]).text().trim(),
          enlaceCertificadoDigital: $(columns[5]).find("a").attr("href") || null,
        };
        certificados.push(certificado);
      }
    });

    // Extraer los propietarios
    const propietarios = [];
    $("#prop table tr").each((_, row) => {
      const columns = $(row).find("td");
      if (columns.length > 0) {
        const propietario = {
          nombre: $(columns[0]).text().trim(),
          dni: $(columns[1]).text().trim(),
        };
        propietarios.push(propietario);
      }
    });

    console.log("Detalle procesado:", detalle);
    console.log("Certificados procesados:", certificados);
    console.log("Propietarios procesados:", propietarios);

    res.json({ detalle, certificados, propietarios });
  } catch (error) {
    console.error("Error al obtener detalles de DICAPI:", error.message);

    if (error.response) {
      console.error("Estado del error:", error.response.status);
      console.error("Encabezados del error:", error.response.headers);
      console.error("Contenido devuelto por DICAPI:", error.response.data);
    }

    res.status(500).json({ error: "No se pudo obtener los detalles. Intenta más tarde." });
  }
});



const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));
