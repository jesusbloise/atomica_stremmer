const { execSync } = require("child_process");
const fs = require("fs");

const gh = '"C:\\Program Files\\GitHub CLI\\gh.exe"';
const repo = "jesusbloise/Prueba_atomica_gratis";
const outputFile = "./reporte_semanal.md";
const fechaArchivo = "./ultima-fecha.txt";

// 🔎 Leer la última fecha registrada
let fechaInicio = "1970-01-01T00:00:00Z";
if (fs.existsSync(fechaArchivo)) {
  fechaInicio = fs.readFileSync(fechaArchivo, "utf8").trim();
}

console.log(`🕓 Generando reporte desde: ${fechaInicio}`);

let issueDataRaw;

try {
  issueDataRaw = execSync(`${gh} issue list --repo ${repo} --state all --json number,createdAt --jq ".[] | select(.createdAt > \\"${fechaInicio}\\") | .number"`)

    .toString()
    .trim()
    .split("\n")
    .filter(n => n);
} catch (err) {
  console.error("❌ Error al obtener issues:", err.message);
  process.exit(1);
}

if (issueDataRaw.length === 0) {
  console.log("📭 No hay issues nuevos desde la última fecha.");
  process.exit(0);
}

let output = `# 📊 Reporte Semanal - ${repo}\n\n📅 Desde: ${fechaInicio}\n📅 Hasta: ${new Date().toISOString()}\n\n`;

issueDataRaw.forEach((number) => {
  try {
    const json = execSync(`${gh} issue view ${number} --repo ${repo} --json title,body,author,state,labels,createdAt,closedAt,comments`)
      .toString();
    const issue = JSON.parse(json);
    const labels = issue.labels.map(l => l.name).join(", ") || "Sin etiquetas";
    const comentarios = issue.comments.length
      ? issue.comments.map(c => `**${c.author.login}**:\n> ${c.body}`).join("\n\n")
      : "_Sin comentarios_";

    output += `
---

## 📝 Issue #${number}: ${issue.title}
**Estado:** ${issue.state}  
**Autor:** ${issue.author.login}  
**Etiquetas:** ${labels}  
**Creado en:** ${new Date(issue.createdAt).toLocaleString()}  
**Cerrado en:** ${issue.closedAt ? new Date(issue.closedAt).toLocaleString() : "Aún abierto"}

### 📄 Descripción:
${issue.body || "_Sin descripción_"}

### 💬 Comentarios:
${comentarios}
`;
  } catch (err) {
    output += `\n---\n⚠️ No se pudo procesar el issue #${number}\n`;
  }
});

fs.writeFileSync(outputFile, output.trim(), "utf8");

// 📌 Guardar la fecha de corte para el próximo reporte
fs.writeFileSync(fechaArchivo, new Date().toISOString());

console.log(`\n✅ Reporte generado: ${outputFile}`);
